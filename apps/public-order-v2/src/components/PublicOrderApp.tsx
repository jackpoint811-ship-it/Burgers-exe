import {
  type CreateOrderV2Response,
  type MenuItem,
  type MenuV2Response,
  type OrderV2Mode,
  type OrderV2PaymentMethod
} from '@config/index';
import { Badge, Button, Card, EmptyState, IconButton, SectionHeader } from '@ui/index';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadMenuV2, toMockResponse } from '../lib/menu-v2';
import { CartEntry, formatCurrency, getCartCount, getCartTotal } from '../lib/order';
import { createOrderV2 } from '../lib/orders-v2';

type CustomerDraft = {
  name: string;
  phone: string;
  notes: string;
  orderMode: OrderV2Mode;
  paymentMethod: OrderV2PaymentMethod;
};
type VisualKind = 'burger' | 'spicy-burger' | 'fries' | 'drink' | 'combo' | 'dip';
type CatalogImageProps = { src?: string; alt: string; fallbackLabel: string; kind: VisualKind };
type PromoEntry = MenuV2Response['promos'][number];
type PromoCardProps = { promo: PromoEntry; reduce: boolean; onPromoAction: (promo: PromoEntry) => void; canAddDirectly: boolean };
type MenuItemCardProps = { item: MenuItem; onAdd: (item: MenuItem) => void; reduce: boolean };
type OrderConfirmation = NonNullable<CreateOrderV2Response['data']>['order'] & {
  orderMode: OrderV2Mode;
  paymentMethod: OrderV2PaymentMethod;
};
type CartPanelProps = {
  cart: CartEntry[];
  total: number;
  count: number;
  onMinus: (sku: string) => void;
  onPlus: (sku: string) => void;
  customer: CustomerDraft;
  setCustomer: (v: CustomerDraft) => void;
  onCheckout: () => void;
  submitting: boolean;
  error: string | null;
  orderConfirmation: OrderConfirmation | null;
};
type MenuSectionProps = Omit<CartPanelProps, 'onCheckout'> & {
  onAdd: (item: MenuItem) => void;
  onCheckout: () => void;
  reduce: boolean;
};

type DraftSnapshot = {
  customer: CustomerDraft;
  items: Array<{ sku: string; qty: number }>;
};

const IDEMPOTENCY_KEY_STORAGE = 'burgers-v2-order-draft-idempotency-key';
const IDEMPOTENCY_DRAFT_STORAGE = 'burgers-v2-order-draft-idempotency-fingerprint';
const ORDER_MODES = new Set<OrderV2Mode>(['pickup', 'delivery']);
const PAYMENT_METHODS = new Set<OrderV2PaymentMethod>(['cash', 'transfer', 'card', 'unknown']);
const orderModeLabels: Record<OrderV2Mode, string> = { pickup: 'Pickup', delivery: 'Delivery' };
const paymentMethodLabels: Record<OrderV2PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  unknown: 'Por confirmar'
};
const statusLabels: Record<string, string> = { new: 'Nuevo', preparing: 'En preparación', ready: 'Listo', delivered: 'Entregado', cancelled: 'Cancelado' };

const getVisualKind = (seed: string): VisualKind => {
  const key = seed.toLowerCase();
  if (key.includes('spicy')) return 'spicy-burger';
  if (key.includes('burger') || key.includes('signature')) return 'burger';
  if (key.includes('fries') || key.includes('side')) return 'fries';
  if (key.includes('drink')) return 'drink';
  if (key.includes('combo')) return 'combo';
  return 'dip';
};

const resolveAssetUrl = (imageUrl?: string, imageKey?: string): string | undefined => {
  const trimmedUrl = imageUrl?.trim();
  if (trimmedUrl && ((trimmedUrl.startsWith('/') && !trimmedUrl.startsWith('//')) || trimmedUrl.startsWith('https://'))) return trimmedUrl;
  const trimmedKey = imageKey?.trim();
  if (!trimmedKey) return undefined;
  return `/api/assets-v2/${trimmedKey.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;
};

const normalizePhoneDigits = (phone: string) => phone.replace(/\D/g, '');

const createDraftFingerprint = (snapshot: DraftSnapshot) => JSON.stringify({
  customer: {
    name: snapshot.customer.name.trim(),
    phone: normalizePhoneDigits(snapshot.customer.phone),
    notes: snapshot.customer.notes.trim(),
    orderMode: snapshot.customer.orderMode,
    paymentMethod: snapshot.customer.paymentMethod
  },
  items: snapshot.items.map((item) => ({ sku: item.sku, qty: item.qty })).sort((a, b) => a.sku.localeCompare(b.sku))
});

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `public-v2-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getDraftIdempotencyKey = (snapshot: DraftSnapshot) => {
  const fingerprint = createDraftFingerprint(snapshot);
  const storedFingerprint = sessionStorage.getItem(IDEMPOTENCY_DRAFT_STORAGE);
  const storedKey = sessionStorage.getItem(IDEMPOTENCY_KEY_STORAGE);
  if (storedFingerprint === fingerprint && storedKey) return storedKey;
  const nextKey = createIdempotencyKey();
  sessionStorage.setItem(IDEMPOTENCY_DRAFT_STORAGE, fingerprint);
  sessionStorage.setItem(IDEMPOTENCY_KEY_STORAGE, nextKey);
  return nextKey;
};

const clearDraftIdempotencyKey = () => {
  sessionStorage.removeItem(IDEMPOTENCY_DRAFT_STORAGE);
  sessionStorage.removeItem(IDEMPOTENCY_KEY_STORAGE);
};

const validateCheckout = (customer: CustomerDraft, cart: CartEntry[], items: MenuItem[]) => {
  if (customer.name.trim().length < 2) return 'Escribe tu nombre con al menos 2 caracteres.';
  if (normalizePhoneDigits(customer.phone).length < 10) return 'Escribe un teléfono válido con al menos 10 dígitos.';
  if (cart.length === 0) return 'Agrega al menos un producto al ticket.';
  if (!ORDER_MODES.has(customer.orderMode)) return 'Elige pickup o delivery para la entrega.';
  if (!PAYMENT_METHODS.has(customer.paymentMethod)) return 'Elige un método de pago válido.';
  if (customer.notes.trim().length > 500) return 'Las notas no pueden superar 500 caracteres.';
  const unavailable = cart.find((entry) => !items.find((item) => item.sku === entry.sku && item.isAvailable));
  if (unavailable) return 'Uno de los productos ya no está disponible. Actualiza el ticket antes de enviar.';
  return null;
};

const PlaceholderVisual = ({ label, kind }: { label: string; kind: VisualKind }) => (
  <div className={`placeholder placeholder-${kind}`} aria-hidden='true'>
    <span>{label}</span>
  </div>
);

const CatalogImage = ({ src, alt, fallbackLabel, kind }: CatalogImageProps) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && src !== failedSrc;
  return (
    <div className='catalog-visual'>
      {showImage ? (
        <img className='catalog-image' src={src} alt={alt} loading='lazy' decoding='async' onError={() => setFailedSrc(src ?? null)} />
      ) : (
        <PlaceholderVisual label={fallbackLabel} kind={kind} />
      )}
    </div>
  );
};

const QuantityControl = ({ qty, onMinus, onPlus }: { qty: number; onMinus: () => void; onPlus: () => void }) => (
  <div className='mt-2 flex items-center gap-2'>
    <IconButton aria-label='Disminuir cantidad' onClick={onMinus}>−</IconButton>
    <span aria-live='polite' className='min-w-5 text-center text-sm font-semibold'>{qty}</span>
    <IconButton aria-label='Aumentar cantidad' onClick={onPlus}>+</IconButton>
  </div>
);

const HeroSection = ({ sourceLabel }: { sourceLabel: string }) => (
  <Card className='hero-card rounded-3xl p-5 sm:p-8'>
    <Badge className='w-fit border-white/20 bg-white/5 text-zinc-200'>{sourceLabel}</Badge>
    <div className='mt-4 grid items-center gap-5 md:grid-cols-[1.2fr_1fr]'>
      <article>
        <p className='text-xs uppercase tracking-[0.28em] text-neon'>Burgers.exe live batch</p>
        <h1 className='mt-2 text-3xl font-black leading-tight sm:text-5xl'>Smash burgers que aterrizan en minutos.</h1>
        <p className='mt-3 max-w-xl text-sm text-zinc-200 sm:text-base'>Sube el antojo en 3 pasos: elige un combo viral, agrega extras y registra tu pedido V2 en backend.</p>
        <div className='mt-5 flex flex-wrap gap-3'>
          <a href='#menu' className='rounded-xl bg-neon px-5 py-3 text-sm font-bold text-black sm:text-base'>Quiero mi burger</a>
          <a href='#promos' className='rounded-xl border border-white/30 bg-black/20 px-5 py-3 text-sm font-semibold sm:text-base'>Explorar promos</a>
        </div>
      </article>
      <PlaceholderVisual label='Signature combo' kind='combo' />
    </div>
  </Card>
);

const PromoCard = ({ promo, reduce, onPromoAction, canAddDirectly }: PromoCardProps) => (
  <motion.article whileHover={reduce ? undefined : { y: -4 }} className='rounded-3xl border border-white/15 bg-zinc-900/80 p-5'>
    <div className='mb-3 flex items-center justify-between gap-2 text-xs uppercase tracking-widest text-zinc-300'>
      <Badge className='border-neon/40 text-neon'>{promo.badge ?? 'Top pick'}</Badge>
      <span>{promo.promoLabel ?? 'Limited'}</span>
    </div>
    <h3 className='text-2xl font-extrabold leading-tight sm:text-3xl'>{promo.title}</h3>
    <p className='mt-2 text-sm text-zinc-300 sm:text-base'>{promo.description}</p>
    <div className='mt-4'>
      <CatalogImage src={resolveAssetUrl(promo.asset.imageUrl, promo.asset.imageKey)} alt={promo.asset.alt} fallbackLabel={promo.asset.alt} kind={getVisualKind(promo.asset.placeholder)} />
    </div>
    <Button onClick={() => onPromoAction(promo)} className='mt-4 w-full bg-white text-black'>{canAddDirectly ? 'Agregar promo al ticket' : 'Ver en menú'}</Button>
  </motion.article>
);

const PromoSection = ({ promos, reduce, onPromoAction, canAddPromo }: { promos: PromoEntry[]; reduce: boolean; onPromoAction: (promo: PromoEntry) => void; canAddPromo: (promo: PromoEntry) => boolean }) => (
  <section id='promos' className='space-y-3'>
    <SectionHeader title='Promos grandes, hambre resuelta' subtitle='Descuentos, combos y favoritos del turno.' />
    <div className='grid gap-4 md:grid-cols-2'>
      {promos.map((promo) => <PromoCard key={promo.id} promo={promo} reduce={reduce} onPromoAction={onPromoAction} canAddDirectly={canAddPromo(promo)} />)}
    </div>
  </section>
);

const MenuItemCard = ({ item, onAdd, reduce }: MenuItemCardProps) => (
  <motion.article whileTap={reduce ? undefined : { scale: 0.98 }} className='rounded-2xl border border-white/15 bg-zinc-900/80 p-3'>
    <CatalogImage src={resolveAssetUrl(item.imageUrl, item.imageKey)} alt={item.name} fallbackLabel={item.name} kind={getVisualKind(item.tags.join('-'))} />
    <div className='mt-3 flex items-start justify-between gap-2'>
      <div>
        <h4 className='font-semibold'>{item.name}</h4>
        <p className='text-xs uppercase tracking-widest text-zinc-400'>{item.badge ?? item.promoLabel ?? 'Hecho al momento'}</p>
      </div>
      <span className='text-lg font-black text-neon'>{formatCurrency(item.price)}</span>
    </div>
    <p className='mt-1 text-sm text-zinc-300'>{item.description}</p>
    <Button disabled={!item.isAvailable} onClick={() => onAdd(item)} className='mt-3 w-full bg-neon text-black disabled:bg-zinc-800 disabled:text-zinc-500'>
      {item.isAvailable ? 'Agregar al ticket' : 'Agotado por ahora'}
    </Button>
  </motion.article>
);

const MenuCategoryBlock = ({ name, items, onAdd, reduce }: { name: string; items: MenuItem[]; onAdd: (item: MenuItem) => void; reduce: boolean }) => (
  <div className='space-y-3'>
    <h3 className='text-xl font-semibold'>{name}</h3>
    <div className='grid gap-3 sm:grid-cols-2'>
      {items.map((item) => <MenuItemCard key={item.sku} item={item} onAdd={onAdd} reduce={reduce} />)}
    </div>
  </div>
);

const CheckoutForm = ({ customer, setCustomer, onCheckout, submitting, count }: { customer: CustomerDraft; setCustomer: (v: CustomerDraft) => void; onCheckout: () => void; submitting: boolean; count: number }) => (
  <div className='space-y-3 pt-2'>
    <label className='text-xs uppercase tracking-widest text-zinc-300'>
      Nombre
      <input className='mt-1.5 w-full rounded-lg border border-white/20 bg-zinc-900 px-3 py-2.5 text-sm' placeholder='Tu nombre' value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
    </label>
    <label className='text-xs uppercase tracking-widest text-zinc-300'>
      Teléfono
      <input className='mt-1.5 w-full rounded-lg border border-white/20 bg-zinc-900 px-3 py-2.5 text-sm' inputMode='tel' placeholder='55 0000 0000' value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
    </label>
    <label className='text-xs uppercase tracking-widest text-zinc-300'>
      Entrega
      <select className='mt-1.5 w-full rounded-lg border border-white/20 bg-zinc-900 px-3 py-2.5 text-sm' value={customer.orderMode} onChange={(e) => setCustomer({ ...customer, orderMode: e.target.value as OrderV2Mode })}>
        <option value='pickup'>Pickup</option>
        <option value='delivery'>Delivery</option>
      </select>
    </label>
    <label className='text-xs uppercase tracking-widest text-zinc-300'>
      Pago
      <select className='mt-1.5 w-full rounded-lg border border-white/20 bg-zinc-900 px-3 py-2.5 text-sm' value={customer.paymentMethod} onChange={(e) => setCustomer({ ...customer, paymentMethod: e.target.value as OrderV2PaymentMethod })}>
        <option value='cash'>Efectivo</option>
        <option value='transfer'>Transferencia</option>
        <option value='card'>Tarjeta</option>
        <option value='unknown'>Por confirmar</option>
      </select>
    </label>
    <label className='text-xs uppercase tracking-widest text-zinc-300'>
      Notas
      <textarea className='mt-1.5 w-full rounded-lg border border-white/20 bg-zinc-900 px-3 py-2.5 text-sm' rows={2} maxLength={500} placeholder='Alergias, sin cebolla, etc.' value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} />
      <span className='mt-1 block text-[11px] normal-case tracking-normal text-zinc-500'>{customer.notes.length}/500</span>
    </label>
    <Button onClick={onCheckout} disabled={submitting || count === 0} className='w-full bg-white py-3 font-bold text-black'>
      {submitting ? 'Enviando pedido...' : 'Confirmar pedido'}
    </Button>
    <p className='text-xs leading-relaxed text-zinc-500'>Sin pago en línea todavía. El backend V2 confirma productos y total antes de registrar el pedido.</p>
  </div>
);

const OrderSuccess = ({ order }: { order: OrderConfirmation }) => (
  <section className='space-y-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 p-3 text-sm text-emerald-100' aria-live='polite'>
    <div>
      <p className='text-base font-bold text-white'>Pedido recibido</p>
      <p>Tu pedido quedó registrado.</p>
    </div>
    <dl className='grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-emerald-50'>
      <dt className='text-emerald-200'>Folio:</dt>
      <dd className='font-bold'>{order.folio}</dd>
      <dt className='text-emerald-200'>Estado:</dt>
      <dd>{statusLabels[order.status] ?? order.status}</dd>
      <dt className='text-emerald-200'>Total confirmado:</dt>
      <dd>{formatCurrency(order.total)} {order.currency}</dd>
      <dt className='text-emerald-200'>Método de pago:</dt>
      <dd>{paymentMethodLabels[order.paymentMethod]}</dd>
      <dt className='text-emerald-200'>Entrega:</dt>
      <dd>{orderModeLabels[order.orderMode]}</dd>
      <dt className='text-emerald-200'>Creado:</dt>
      <dd>{new Date(order.createdAt).toLocaleString('es-MX')}</dd>
    </dl>
    <p>Pago pendiente de confirmación.</p>
    <p>No se realizó ningún cobro en línea.</p>
    <p>Te contactaremos por WhatsApp/teléfono si necesitamos confirmar algo.</p>
  </section>
);

const CartPanel = ({ cart, total, count, onMinus, onPlus, customer, setCustomer, onCheckout, submitting, error, orderConfirmation, items }: CartPanelProps & { items: MenuItem[] }) => (
  <aside className='sticky top-2 h-fit space-y-3 rounded-2xl border border-white/15 bg-zinc-950 p-4'>
    <p className='text-xs uppercase tracking-[0.2em] text-zinc-400'>Vista V2 preview · Pedido registrado en backend V2</p>
    <h3 className='text-xl font-bold'>Ticket ({count})</h3>
    <div className='max-h-56 space-y-2 overflow-auto'>
      {cart.length === 0 ? (
        <EmptyState title='Tu ticket está vacío' description='Agrega un combo o burger para comenzar.' />
      ) : cart.map((entry) => {
        const item = items.find((m) => m.sku === entry.sku);
        if (!item) return null;
        return (
          <div key={entry.sku} className='rounded-lg border border-dashed border-white/20 bg-zinc-900/80 p-2 text-sm'>
            <div className='flex justify-between gap-3'>
              <span>{item.name}</span>
              <span>{formatCurrency(item.price * entry.qty)}</span>
            </div>
            <QuantityControl qty={entry.qty} onMinus={() => onMinus(entry.sku)} onPlus={() => onPlus(entry.sku)} />
          </div>
        );
      })}
    </div>
    <p className='border-t border-white/10 pt-3 text-3xl font-black'>Total {formatCurrency(total)}</p>
    <p className='text-xs text-zinc-500'>Total estimado en UI; el backend recalcula el total final desde D1.</p>
    <CheckoutForm customer={customer} setCustomer={setCustomer} onCheckout={onCheckout} submitting={submitting} count={count} />
    {submitting ? <p className='rounded-lg border border-cyan-400/40 bg-cyan-500/15 p-2 text-sm text-cyan-100' aria-live='polite'>Enviando pedido...</p> : null}
    {error ? <p className='rounded-lg border border-red-400/50 bg-red-500/15 p-2 text-sm text-red-100' role='alert'>{error}</p> : null}
    {orderConfirmation ? <OrderSuccess order={orderConfirmation} /> : null}
  </aside>
);

const MenuSection = ({ categories, items, onAdd, reduce, ...cartProps }: MenuSectionProps & { categories: MenuV2Response['categories']; items: MenuItem[] }) => (
  <section id='menu' className='grid gap-5 lg:grid-cols-[1fr_340px]'>
    <div className='space-y-4'>
      <SectionHeader title='Menú smash-ready' subtitle='Sabor primero: badges claros, precios visibles y CTA directo.' />
      {categories.map((category) => <MenuCategoryBlock key={category.id} name={category.name} items={items.filter((item) => item.category === category.key)} onAdd={onAdd} reduce={reduce} />)}
    </div>
    <CartPanel {...cartProps} items={items} />
  </section>
);

const TrustSection = () => (
  <section className='grid gap-3 rounded-2xl border border-white/15 bg-zinc-900/70 p-4 sm:grid-cols-3'>
    <article>
      <h3 className='font-semibold'>Operación preview</h3>
      <p className='text-sm text-zinc-300'>Vista V2 preview conectada a órdenes D1.</p>
    </article>
    <article>
      <h3 className='font-semibold'>Estado pickup/delivery</h3>
      <p className='text-sm text-zinc-300'>Pickup 12 min · Delivery 28 min estimado.</p>
    </article>
    <article>
      <h3 className='font-semibold'>Fresh batch</h3>
      <p className='text-sm text-zinc-300'>Carne al sello, papas recién fritas y salsas de la casa.</p>
    </article>
  </section>
);

export function PublicOrderApp() {
  const reduce = useReducedMotion() ?? false;
  const submittingRef = useRef(false);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [menuData, setMenuData] = useState<MenuV2Response>(toMockResponse('mock'));
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [customer, setCustomer] = useState<CustomerDraft>({ name: '', phone: '', notes: '', orderMode: 'pickup', paymentMethod: 'unknown' });
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderConfirmation, setOrderConfirmation] = useState<OrderConfirmation | null>(null);
  const total = useMemo(() => getCartTotal(cart, menuData.items), [cart, menuData.items]);

  useEffect(() => {
    let mounted = true;
    loadMenuV2().then((payload) => {
      if (!mounted) return;
      setMenuData(payload);
      setLoadingMenu(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const count = getCartCount(cart);

  const addToCart = (item: MenuItem) => {
    if (!item.isAvailable) return;
    setOrderConfirmation(null);
    setCheckoutError(null);
    setCart((prev) => {
      const found = prev.find((entry) => entry.sku === item.sku);
      return found ? prev.map((entry) => (entry.sku === item.sku ? { ...entry, qty: entry.qty + 1 } : entry)) : [...prev, { sku: item.sku, qty: 1 }];
    });
  };

  const updateQty = (sku: string, delta: number) => {
    setOrderConfirmation(null);
    setCheckoutError(null);
    setCart((prev) => prev.map((entry) => (entry.sku === sku ? { ...entry, qty: Math.max(0, entry.qty + delta) } : entry)).filter((entry) => entry.qty > 0));
  };

  const getPromoItem = (promo: PromoEntry) => {
    const candidates = promo.comboLinks
      .map((ref) => menuData.items.find((item) => item.sku === ref && item.isAvailable))
      .filter((item): item is MenuItem => Boolean(item));
    return candidates[0] ?? null;
  };

  const canAddPromo = (promo: PromoEntry) => Boolean(getPromoItem(promo));

  const handlePromoAction = (promo: PromoEntry) => {
    const item = getPromoItem(promo);
    if (item) {
      addToCart(item);
      return;
    }
    const menu = document.getElementById('menu');
    menu?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    const firstInteractive = menu?.querySelector<HTMLElement>('button, [href], input, select, textarea');
    firstInteractive?.focus();
  };

  const handleCheckout = async () => {
    if (submittingRef.current) return;
    setCheckoutError(null);
    setOrderConfirmation(null);

    const validationError = validateCheckout(customer, cart, menuData.items);
    if (validationError) {
      setCheckoutError(validationError);
      return;
    }

    const payloadItems = cart.map((entry) => ({ sku: entry.sku, qty: entry.qty }));
    const idempotencyKey = getDraftIdempotencyKey({ customer, items: payloadItems });
    const payload = {
      customer: { name: customer.name.trim(), phone: normalizePhoneDigits(customer.phone) },
      orderMode: customer.orderMode,
      paymentMethod: customer.paymentMethod,
      notes: customer.notes.trim() || undefined,
      items: payloadItems
    };

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const response = await createOrderV2(payload, idempotencyKey);
      const order = response.data?.order;
      if (!order) throw new Error('El backend no devolvió folio de confirmación.');
      setOrderConfirmation({ ...order, orderMode: customer.orderMode, paymentMethod: customer.paymentMethod });
      setCart([]);
      setCustomer({ name: '', phone: '', notes: '', orderMode: 'pickup', paymentMethod: 'unknown' });
      clearDraftIdempotencyKey();
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'No se pudo enviar el pedido. Intenta de nuevo.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const sourceLabel = menuData.source === 'd1' ? 'Catálogo live' : 'Vista V2 preview';
  const footerNotice = menuData.source === 'd1'
    ? menuData.siteConfig.notice
    : 'Vista V2 preview: si el catálogo live no está disponible, se muestra catálogo de respaldo; el envío usa backend V2 cuando el endpoint responde.';

  return (
    <main className='mx-auto max-w-7xl space-y-8 px-3 py-4 sm:px-6 lg:px-8'>
      <HeroSection sourceLabel={sourceLabel} />
      {loadingMenu ? <p className='text-sm text-zinc-400'>Cargando catálogo…</p> : null}
      <PromoSection promos={menuData.promos} reduce={reduce} onPromoAction={handlePromoAction} canAddPromo={canAddPromo} />
      <MenuSection
        categories={menuData.categories}
        items={menuData.items}
        cart={cart}
        total={total}
        count={count}
        onAdd={addToCart}
        reduce={reduce}
        onMinus={(sku: string) => updateQty(sku, -1)}
        onPlus={(sku: string) => updateQty(sku, 1)}
        customer={customer}
        setCustomer={setCustomer}
        onCheckout={handleCheckout}
        submitting={submitting}
        error={checkoutError}
        orderConfirmation={orderConfirmation}
      />
      <TrustSection />
      <p className='text-center text-xs text-zinc-500'>{footerNotice}</p>
    </main>
  );
}
