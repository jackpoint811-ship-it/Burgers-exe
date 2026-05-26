import { menuCategories, menuItems, promoCards, siteConfig, type MenuItem } from '@config/index';
import { Badge, Button, Card, EmptyState, IconButton, SectionHeader } from '@ui/index';
import { motion, useReducedMotion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { CartEntry, formatCurrency, getCartCount, getCartTotal } from '../lib/order';

type Payment = 'pickup' | 'delivery';
type CustomerDraft = { name: string; phone: string; notes: string; payment: Payment };
type VisualKind = 'burger' | 'spicy-burger' | 'fries' | 'drink' | 'combo' | 'dip';
type PromoCardProps = { promo: (typeof promoCards)[number]; reduce: boolean; onPromoAction: (promo: (typeof promoCards)[number]) => void; canAddDirectly: boolean };
type MenuItemCardProps = { item: MenuItem; onAdd: (item: MenuItem) => void; reduce: boolean };
type CartPanelProps = { cart: CartEntry[]; total: number; count: number; onMinus: (sku: string) => void; onPlus: (sku: string) => void; customer: CustomerDraft; setCustomer: (v: CustomerDraft) => void; onCheckout: () => void; success: boolean };
type MenuSectionProps = Omit<CartPanelProps, 'onCheckout' | 'success'> & { onAdd: (item: MenuItem) => void; onCheckout: () => void; success: boolean; reduce: boolean };

const getVisualKind = (seed: string): VisualKind => {
  const key = seed.toLowerCase();
  if (key.includes('spicy')) return 'spicy-burger';
  if (key.includes('burger') || key.includes('signature')) return 'burger';
  if (key.includes('fries') || key.includes('side')) return 'fries';
  if (key.includes('drink')) return 'drink';
  if (key.includes('combo')) return 'combo';
  return 'dip';
};

const PlaceholderVisual = ({ label, kind }: { label: string; kind: VisualKind }) => <div className={`placeholder placeholder-${kind}`} aria-hidden='true'><span>{label}</span></div>;
const QuantityControl = ({ qty, onMinus, onPlus }: { qty: number; onMinus: () => void; onPlus: () => void }) => <div className='mt-2 flex items-center gap-2'><IconButton aria-label='Disminuir cantidad' onClick={onMinus}>−</IconButton><span aria-live='polite' className='min-w-5 text-center text-sm font-semibold'>{qty}</span><IconButton aria-label='Aumentar cantidad' onClick={onPlus}>+</IconButton></div>;

const HeroSection = () => <Card className='hero-card rounded-3xl p-6 sm:p-8'><Badge className='w-fit border-white/20 bg-white/5 text-zinc-200'>Vista de prueba · catálogo local</Badge><div className='mt-4 grid items-center gap-5 md:grid-cols-[1.2fr_1fr]'><article><p className='text-xs uppercase tracking-[0.3em] text-neon'>Burgers.exe live batch</p><h1 className='mt-2 text-4xl font-black leading-tight sm:text-5xl'>Smash burgers que aterrizan en minutos.</h1><p className='mt-3 max-w-xl text-zinc-200'>Sube el antojo en 3 pasos: elige un combo viral, agrega extras y simula tu ticket premium al instante.</p><div className='mt-5 flex flex-wrap gap-3'><a href='#menu' className='rounded-xl bg-neon px-5 py-3 font-bold text-black'>Quiero mi burger</a><a href='#promos' className='rounded-xl border border-white/30 bg-black/20 px-5 py-3 font-semibold'>Explorar promos</a></div></article><PlaceholderVisual label='Signature combo' kind='combo' /></div></Card>;

const PromoCard = ({ promo, reduce, onPromoAction, canAddDirectly }: PromoCardProps) => <motion.article whileHover={reduce ? undefined : { y: -4 }} className='rounded-3xl border border-white/15 bg-zinc-900/80 p-5'><div className='mb-3 flex items-center justify-between text-xs uppercase tracking-widest text-zinc-300'><Badge className='border-neon/40 text-neon'>{promo.badge ?? 'Top pick'}</Badge><span>{promo.promoLabel ?? 'Limited'}</span></div><h3 className='text-3xl font-extrabold leading-tight'>{promo.title}</h3><p className='mt-2 text-zinc-300'>{promo.description}</p><div className='mt-4'><PlaceholderVisual label={promo.asset.alt} kind={getVisualKind(promo.asset.placeholder)} /></div><Button onClick={() => onPromoAction(promo)} className='mt-4 w-full bg-white text-black'>{canAddDirectly ? 'Agregar promo al ticket' : 'Ver en menú'}</Button></motion.article>;
const PromoSection = ({ reduce, onPromoAction, canAddPromo }: { reduce: boolean; onPromoAction: (promo: (typeof promoCards)[number]) => void; canAddPromo: (promo: (typeof promoCards)[number]) => boolean }) => <section id='promos' className='space-y-3'><SectionHeader title='Promos grandes, hambre resuelta' subtitle='Descuentos, combos y favoritos del turno.' /><div className='grid gap-4 md:grid-cols-2'>{promoCards.map((promo) => <PromoCard key={promo.id} promo={promo} reduce={reduce} onPromoAction={onPromoAction} canAddDirectly={canAddPromo(promo)} />)}</div></section>;

const MenuItemCard = ({ item, onAdd, reduce }: MenuItemCardProps) => <motion.article whileTap={reduce ? undefined : { scale: 0.98 }} className='rounded-2xl border border-white/15 bg-zinc-900/80 p-3'><PlaceholderVisual label={item.name} kind={getVisualKind(item.tags.join('-'))} /><div className='mt-3 flex items-start justify-between gap-2'><div><h4 className='font-semibold'>{item.name}</h4><p className='text-xs uppercase tracking-widest text-zinc-400'>{item.badge ?? item.promoLabel ?? 'Hecho al momento'}</p></div><span className='text-lg font-black text-neon'>{formatCurrency(item.price)}</span></div><p className='mt-1 text-sm text-zinc-300'>{item.description}</p><Button disabled={!item.isAvailable} onClick={() => onAdd(item)} className='mt-3 w-full bg-neon text-black disabled:bg-zinc-800 disabled:text-zinc-500'>{item.isAvailable ? 'Agregar al ticket' : 'Agotado por ahora'}</Button></motion.article>;
const MenuCategoryBlock = ({ name, items, onAdd, reduce }: { name: string; items: MenuItem[]; onAdd: (item: MenuItem) => void; reduce: boolean }) => <div className='space-y-3'><h3 className='text-xl font-semibold'>{name}</h3><div className='grid gap-3 sm:grid-cols-2'>{items.map((item) => <MenuItemCard key={item.sku} item={item} onAdd={onAdd} reduce={reduce} />)}</div></div>;

const CheckoutMock = ({ customer, setCustomer, onCheckout }: { customer: CustomerDraft; setCustomer: (v: CustomerDraft) => void; onCheckout: () => void }) => <div className='space-y-3 pt-2'><label className='text-xs uppercase tracking-widest text-zinc-300'>Nombre<input className='mt-1 w-full rounded-lg border border-white/20 bg-zinc-900 px-3 py-2 text-sm' placeholder='Tu nombre' value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></label><label className='text-xs uppercase tracking-widest text-zinc-300'>Teléfono<input className='mt-1 w-full rounded-lg border border-white/20 bg-zinc-900 px-3 py-2 text-sm' placeholder='55 0000 0000' value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></label><label className='text-xs uppercase tracking-widest text-zinc-300'>Entrega<select className='mt-1 w-full rounded-lg border border-white/20 bg-zinc-900 px-3 py-2 text-sm' value={customer.payment} onChange={(e) => setCustomer({ ...customer, payment: e.target.value as Payment })}><option value='pickup'>Pickup</option><option value='delivery'>Delivery</option></select></label><label className='text-xs uppercase tracking-widest text-zinc-300'>Notas<textarea className='mt-1 w-full rounded-lg border border-white/20 bg-zinc-900 px-3 py-2 text-sm' rows={2} placeholder='Alergias, sin cebolla, etc.' value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} /></label><Button onClick={onCheckout} className='w-full bg-white py-3 font-bold text-black'>Simular pedido</Button></div>;

const CartPanel = ({ cart, total, count, onMinus, onPlus, customer, setCustomer, onCheckout, success }: CartPanelProps) => <aside className='sticky top-2 h-fit space-y-3 rounded-2xl border border-white/15 bg-zinc-950 p-4'><p className='text-xs uppercase tracking-[0.2em] text-zinc-400'>Acciones locales · no se envía a producción</p><h3 className='text-xl font-bold'>Ticket ({count})</h3><div className='max-h-56 space-y-2 overflow-auto'>{cart.length === 0 ? <EmptyState title='Tu ticket está vacío' description='Agrega un combo o burger para comenzar.' /> : cart.map((entry) => {const item = menuItems.find((m) => m.sku === entry.sku);if (!item) return null;return <div key={entry.sku} className='rounded-lg border border-dashed border-white/20 bg-zinc-900/80 p-2 text-sm'><div className='flex justify-between'><span>{item.name}</span><span>{formatCurrency(item.price * entry.qty)}</span></div><QuantityControl qty={entry.qty} onMinus={() => onMinus(entry.sku)} onPlus={() => onPlus(entry.sku)} /></div>;})}</div><p className='border-t border-white/10 pt-3 text-3xl font-black'>Total {formatCurrency(total)}</p><CheckoutMock customer={customer} setCustomer={setCustomer} onCheckout={onCheckout} />{success ? <p className='rounded-lg border border-emerald-400/40 bg-emerald-500/15 p-2 text-sm text-emerald-200'>Orden simulada: cocina en preparación local.</p> : null}</aside>;

const MenuSection = ({ onAdd, reduce, ...cartProps }: MenuSectionProps) => <section id='menu' className='grid gap-5 lg:grid-cols-[1fr_340px]'><div className='space-y-4'><SectionHeader title='Menú smash-ready' subtitle='Sabor primero: badges claros, precios visibles y CTA directo.' />{menuCategories.map((category) => <MenuCategoryBlock key={category.id} name={category.name} items={menuItems.filter((item) => item.category === category.key)} onAdd={onAdd} reduce={reduce} />)}</div><CartPanel {...cartProps} /></section>;
const TrustSection = () => <section className='grid gap-3 rounded-2xl border border-white/15 bg-zinc-900/70 p-4 sm:grid-cols-3'><article><h3 className='font-semibold'>Operación estable</h3><p className='text-sm text-zinc-300'>Vista de prueba para QA visual y flujo mobile.</p></article><article><h3 className='font-semibold'>Estado pickup/delivery</h3><p className='text-sm text-zinc-300'>Pickup 12 min · Delivery 28 min estimado.</p></article><article><h3 className='font-semibold'>Fresh batch</h3><p className='text-sm text-zinc-300'>Carne al sello, papas recién fritas y salsas de la casa.</p></article></section>;

export function PublicOrderApp() {
  const reduce = useReducedMotion() ?? false;
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [customer, setCustomer] = useState({ name: '', phone: '', notes: '', payment: 'pickup' as Payment });
  const [success, setSuccess] = useState(false);
  const total = useMemo(() => getCartTotal(cart, menuItems), [cart]);
  const count = getCartCount(cart);
  const addToCart = (item: MenuItem) => { if (!item.isAvailable) return; setSuccess(false); setCart((prev) => { const found = prev.find((entry) => entry.sku === item.sku); return found ? prev.map((entry) => (entry.sku === item.sku ? { ...entry, qty: entry.qty + 1 } : entry)) : [...prev, { sku: item.sku, qty: 1 }]; }); };
  const updateQty = (sku: string, delta: number) => setCart((prev) => prev.map((entry) => (entry.sku === sku ? { ...entry, qty: Math.max(0, entry.qty + delta) } : entry)).filter((entry) => entry.qty > 0));
  const getPromoItem = (promo: (typeof promoCards)[number]) => {
    const candidates = promo.comboLinks
      .map((ref) => menuItems.find((item) => item.sku === ref && item.isAvailable))
      .filter((item): item is MenuItem => Boolean(item));
    return candidates[0] ?? null;
  };
  const canAddPromo = (promo: (typeof promoCards)[number]) => Boolean(getPromoItem(promo));
  const handlePromoAction = (promo: (typeof promoCards)[number]) => {
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

  return <main className='mx-auto max-w-7xl space-y-8 px-3 py-4 sm:px-6 lg:px-8'><HeroSection /><PromoSection reduce={reduce} onPromoAction={handlePromoAction} canAddPromo={canAddPromo} /><MenuSection cart={cart} total={total} count={count} onAdd={addToCart} reduce={reduce} onMinus={(sku: string) => updateQty(sku, -1)} onPlus={(sku: string) => updateQty(sku, 1)} customer={customer} setCustomer={setCustomer} onCheckout={() => setSuccess(true)} success={success} /><TrustSection /><p className='text-center text-xs text-zinc-500'>{siteConfig.notice}</p></main>;
}
