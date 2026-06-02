import {
  type CreateOrderV2Response,
  type MenuCategory,
  type MenuItem,
  type MenuV2Response,
  type OrderV2Mode,
  type OrderV2PaymentMethod,
  type PromoCard,
  type RaffleCampaignPublicV2,
} from "@config/index";
import { EmptyState } from "@ui/index";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadMenuV2, toFallbackMenuResponse } from "../lib/menu-v2";
import { loadActiveRaffleV2 } from "../lib/raffles-v2";
import {
  type CartEntry,
  type TicketItemKind,
  formatCurrency,
  getCartCount,
  getCartTotal,
} from "../lib/order";
import { createOrderV2 } from "../lib/orders-v2";

type QuestSection = "menu" | "main" | "workbench" | "side" | "checkout" | "success";
type OrderChoice = "burger" | "combo";
type CustomerDraft = {
  name: string;
  phone: string;
  notes: string;
  referralCode: string;
  location: "" | "Torre GGA" | "Torre Valcob";
  paymentMethod: OrderV2PaymentMethod;
};
type BuilderDraft = {
  item: MenuItem;
  itemKind: Extract<TicketItemKind, "burger" | "combo">;
  quantity: 1 | 2 | 3;
  units: CartEntry[];
  error: string | null;
  editLineKey?: string;
};
type OrderConfirmation = NonNullable<CreateOrderV2Response["data"]>["order"] & {
  paymentMethod: OrderV2PaymentMethod;
  location: CustomerDraft["location"];
  referralAccepted?: boolean;
  customerReferralCode?: string;
  activeRaffleTitle?: string;
  earnedTickets?: NonNullable<CreateOrderV2Response["data"]>["earnedTickets"];
};
type DraftSnapshot = { customer: CustomerDraft; items: CartEntry[] };

const IDEMPOTENCY_KEY_STORAGE = "burgers-v2-order-draft-idempotency-key";
const IDEMPOTENCY_DRAFT_STORAGE = "burgers-v2-order-draft-idempotency-fingerprint";
const LOCATIONS = ["Torre GGA", "Torre Valcob"] as const;
const PAYMENT_METHODS = new Set<OrderV2PaymentMethod>(["cash", "transfer", "card", "unknown"]);
const orderModeForBackend: OrderV2Mode = "pickup";
const MENU_GROUPS: Array<{ key: MenuCategory["key"] | "combos"; label: string }> = [
  { key: "burgers", label: "Hamburguesas" },
  { key: "combos", label: "Combos" },
  { key: "guarniciones", label: "Guarniciones" },
  { key: "drinks", label: "Bebidas" },
];
const paymentMethodLabels: Record<OrderV2PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  unknown: "Por confirmar",
};
const statusLabels: Record<string, string> = {
  new: "Nuevo",
  preparing: "En preparación",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const createEmptyCustomer = (): CustomerDraft => ({
  name: "",
  phone: "",
  notes: "",
  referralCode: "",
  location: "",
  paymentMethod: "unknown",
});
const normalizePhoneDigits = (phone: string) => phone.replace(/\D/g, "");
const scrollToTop = () => window.scrollTo({ top: 0, behavior: "auto" });
const createId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
const resolveAssetUrl = (imageUrl?: string, imageKey?: string): string | undefined => {
  const trimmedUrl = imageUrl?.trim();
  if (trimmedUrl && ((trimmedUrl.startsWith("/") && !trimmedUrl.startsWith("//")) || trimmedUrl.startsWith("https://"))) return trimmedUrl;
  const trimmedKey = imageKey?.trim();
  if (!trimmedKey) return undefined;
  return `/api/assets-v2/${trimmedKey.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;
};
const inferItemKind = (item: MenuItem): TicketItemKind => {
  const seed = `${item.category} ${item.name} ${item.tags.join(" ")}`.toLowerCase();
  if (seed.includes("combo")) return "combo";
  if (item.category === "burgers") return "burger";
  if (item.category === "guarniciones") return "garnish";
  if (item.category === "drinks") return "drink";
  return "other";
};
const inferIngredients = (item: MenuItem) => {
  const stop = new Set(["burger", "burgers", "smash", "signature", "spicy", "combo", "hot", "best seller"]);
  return item.description
    .replace(/[.]/g, "")
    .split(/,|\+| y | con /i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2 && !/\bpan\b/i.test(part) && !stop.has(part.toLowerCase()));
};
const makeUnit = (item: MenuItem, itemKind: TicketItemKind, index: number, source?: Partial<CartEntry>): CartEntry => ({
  sku: item.sku,
  name: item.name,
  qty: 1,
  lineKey: source?.lineKey ?? createId("line"),
  itemDisplayIndex: index,
  itemKind,
  removedIngredients: [...(source?.removedIngredients ?? [])],
  extras: [...(source?.extras ?? [])],
  burgerNote: source?.burgerNote ?? "",
  garnish: itemKind === "burger" ? null : (source?.garnish ?? null),
});
const createDraftFingerprint = (snapshot: DraftSnapshot) =>
  JSON.stringify({
    customer: {
      name: snapshot.customer.name.trim(),
      phone: normalizePhoneDigits(snapshot.customer.phone),
      notes: snapshot.customer.notes.trim(),
      referralCode: snapshot.customer.referralCode.trim().toUpperCase(),
      location: snapshot.customer.location,
      paymentMethod: snapshot.customer.paymentMethod,
    },
    items: snapshot.items.map(({ lineKey, sku, itemDisplayIndex, itemKind, removedIngredients, extras, burgerNote, garnish }) => ({
      lineKey,
      sku,
      itemDisplayIndex,
      itemKind,
      removedIngredients,
      extras,
      burgerNote,
      garnish,
    })),
  });
const getDraftIdempotencyKey = (snapshot: DraftSnapshot) => {
  const fingerprint = createDraftFingerprint(snapshot);
  const storedFingerprint = sessionStorage.getItem(IDEMPOTENCY_DRAFT_STORAGE);
  const storedKey = sessionStorage.getItem(IDEMPOTENCY_KEY_STORAGE);
  if (storedFingerprint === fingerprint && storedKey) return storedKey;
  const nextKey = createId("public-v2");
  sessionStorage.setItem(IDEMPOTENCY_DRAFT_STORAGE, fingerprint);
  sessionStorage.setItem(IDEMPOTENCY_KEY_STORAGE, nextKey);
  return nextKey;
};
const clearDraftIdempotencyKey = () => {
  sessionStorage.removeItem(IDEMPOTENCY_DRAFT_STORAGE);
  sessionStorage.removeItem(IDEMPOTENCY_KEY_STORAGE);
};
const validateCheckout = (customer: CustomerDraft, cart: CartEntry[], items: MenuItem[]) => {
  if (cart.length === 0) return "Agrega al menos un producto al ticket.";
  if (customer.name.trim().length < 2) return "Escribe tu nombre con al menos dos caracteres.";
  if (normalizePhoneDigits(customer.phone).length < 10) return "Escribe un teléfono válido con al menos diez dígitos.";
  if (!customer.location) return "Elige Torre GGA o Torre Valcob.";
  if (!PAYMENT_METHODS.has(customer.paymentMethod) || customer.paymentMethod === "unknown") return "Elige un método de pago.";
  if (customer.notes.trim().length > 500) return "La nota general no puede superar quinientos caracteres.";
  const unavailable = cart.find((entry) => !items.find((item) => item.sku === entry.sku && item.isAvailable));
  if (unavailable) return "Uno de los productos ya no está disponible. Actualiza el ticket antes de enviar.";
  return null;
};

const QuestButton = ({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...props} className={`quest-button ${className}`}>{children}</button>
);

const LoadingOverlay = ({ loading }: { loading: boolean }) => loading ? (
  <div className="boot-overlay" role="status" aria-live="polite">
    <div className="boot-window">
      <h1>Burgers.exe</h1>
      <p>Preparando menú y quest.</p>
      <div className="boot-bar"><span /></div>
    </div>
  </div>
) : null;

const AppHeader = ({ count, total }: { count: number; total: number }) => (
  <header className="quest-header">
    <strong>Burgers.exe</strong>
    <span>Ticket: {count} item{count === 1 ? "" : "s"} · {formatCurrency(total)}</span>
  </header>
);

const RaffleBanner = ({ campaign }: { campaign: RaffleCampaignPublicV2 | null }) => {
  if (!campaign) return null;
  const src = resolveAssetUrl(campaign.bannerImageUrl, campaign.bannerImageKey);
  return (
    <section className="raffle-banner" aria-label="Sorteo activo">
      {src ? (
        <div className="raffle-banner-media">
          <img src={src} alt={campaign.title} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />
        </div>
      ) : null}
      <div className="raffle-banner-copy">
        <span>Sorteo activo</span>
        <h2>{campaign.title}</h2>
        {campaign.description ? <p>{campaign.description}</p> : null}
        {campaign.rulesText ? <p className="raffle-rules">{campaign.rulesText}</p> : null}
        <strong>{campaign.ticketPerBurger || 1} ticket por burger pedida · {campaign.ticketPerReferral || 2} tickets por amigo invitado.</strong>
      </div>
    </section>
  );
};

const PromoRail = ({ promos }: { promos: PromoCard[] }) => {
  const active = promos.filter((promo) => promo.isAvailable).sort((a, b) => a.sortOrder - b.sortOrder);
  if (!active.length) return null;
  return (
    <section className="promo-rail" aria-label="Promos y concursos">
      {active.map((promo) => {
        const src = resolveAssetUrl(promo.asset.imageUrl, promo.asset.imageKey);
        return (
          <article className="promo-card" key={promo.id}>
            {src ? <img src={src} alt={promo.asset.alt || promo.title} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
            <div>
              <span>{promo.badge || promo.promoLabel || "Promo"}</span>
              <h3>{promo.title}</h3>
              <p>{promo.description}</p>
            </div>
          </article>
        );
      })}
    </section>
  );
};

const ProductCard = ({ item, mode, onClick, reduce }: { item: MenuItem; mode: "info" | "select"; onClick: (item: MenuItem) => void; reduce: boolean }) => {
  const src = resolveAssetUrl(item.imageUrl, item.imageKey);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(src) && !imageFailed;
  const kind = inferItemKind(item);
  return (
    <motion.button
      type="button"
      whileTap={reduce ? undefined : { scale: 0.98 }}
      className="kiosk-card"
      onClick={() => onClick(item)}
      aria-label={`${mode === "info" ? "Ver información de" : "Elegir"} ${item.name}`}
      disabled={mode === "select" && !item.isAvailable}
    >
      <div className={showImage ? "kiosk-visual" : "kiosk-visual no-image"}>
        {showImage && src ? <img src={src} alt="" loading="lazy" onError={() => setImageFailed(true)} /> : <span>{item.name}</span>}
      </div>
      <div className="kiosk-body">
        <span>{kind === "combo" ? "Combo" : item.category}</span>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <footer>
          <strong>{formatCurrency(item.price)}</strong>
          <em>{item.isAvailable ? "Disponible" : "Agotado"}</em>
        </footer>
      </div>
    </motion.button>
  );
};

const MenuSection = ({ menuData, raffleCampaign, onExplore, onStart, reduce }: { menuData: MenuV2Response; raffleCampaign: RaffleCampaignPublicV2 | null; onExplore: (item: MenuItem) => void; onStart: () => void; reduce: boolean }) => {
  const visibleItems = menuData.items.filter((item) => item.category !== "extras");
  const comboItems = menuData.items.filter((item) => inferItemKind(item) === "combo");
  const byGroup = (key: MenuCategory["key"] | "combos") => key === "combos" ? comboItems : visibleItems.filter((item) => item.category === key);
  return (
    <section className="quest-panel hero-panel">
      <div className="hero-copy-block">
        <span className="eyebrow">Menu</span>
        <h1>Burgers.exe</h1>
        <p>Elige tu burger, personalízala y confirma tu pedido.</p>
        <QuestButton onClick={onStart}>INICIAR QUEST</QuestButton>
      </div>
      <RaffleBanner campaign={raffleCampaign} />
      <PromoRail promos={menuData.promos} />
      {MENU_GROUPS.map(({ key, label }) => {
        const list = byGroup(key).sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <section className="menu-cluster" key={key}>
            <h2>{label}</h2>
            {list.length ? <div className="kiosk-grid">{list.map((item) => <ProductCard key={item.sku} item={item} mode="info" onClick={onExplore} reduce={reduce} />)}</div> : <EmptyState title={key === "combos" ? "Combos disponibles pronto." : `${label} disponibles pronto.`} description="Vuelve a revisar el menú más tarde." />}
          </section>
        );
      })}
    </section>
  );
};

const MenuInfoDialog = ({ item, onClose }: { item: MenuItem | null; onClose: () => void }) => {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = "menu-info-title";
  const src = item ? resolveAssetUrl(item.imageUrl, item.imageKey) : undefined;
  useEffect(() => {
    if (!item) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [item, onClose]);
  if (!item) return null;
  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-labelledby={titleId} aria-modal="true" className="info-dialog" role="dialog">
        {src ? <img src={src} alt={item.name} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
        <div>
          <span className="eyebrow">Menu</span>
          <h2 id={titleId}>{item.name}</h2>
          <p>{item.description}</p>
          <strong>{formatCurrency(item.price)}</strong>
          <button ref={closeRef} type="button" className="quest-button" onClick={onClose}>Cerrar</button>
        </div>
      </section>
    </div>
  );
};

const MainQuest = ({ choice, availableBurgerItems, availableComboItems, builder, onBack, onChoice, onProduct, reduce }: { choice: OrderChoice | null; availableBurgerItems: MenuItem[]; availableComboItems: MenuItem[]; builder: BuilderDraft | null; onBack: () => void; onChoice: (choice: OrderChoice) => void; onProduct: (item: MenuItem) => void; reduce: boolean }) => {
  const filteredItems = choice === "burger" ? availableBurgerItems : choice === "combo" ? availableComboItems : [];
  const hasChoices = availableBurgerItems.length > 0 || availableComboItems.length > 0;
  return (
    <section className="quest-panel">
      <QuestButton className="ghost" onClick={onBack}>Regresar</QuestButton>
      <span className="eyebrow">Main Quest</span>
      <h2>¿Qué vas a ordenar?</h2>
      <p className="muted section-subcopy">Elige qué vas a ordenar.</p>
      {hasChoices ? <div className="choice-grid" role="group" aria-label="Tipo de orden">
        {availableBurgerItems.length ? <button type="button" className={choice === "burger" ? "choice-card active" : "choice-card"} onClick={() => onChoice("burger")}><strong>Hamburguesa</strong><span>MOD y UPGRADE por unidad.</span></button> : null}
        {availableComboItems.length ? <button type="button" className={choice === "combo" ? "choice-card active" : "choice-card"} onClick={() => onChoice("combo")}><strong>Combo</strong><span>Combo completo disponible hoy.</span></button> : null}
      </div> : <EmptyState title="Productos disponibles pronto" description="Vuelve a revisar el menú más tarde." />}
      {choice ? <div className="kiosk-grid">{filteredItems.length ? filteredItems.map((item) => <ProductCard key={item.sku} item={item} mode="select" onClick={onProduct} reduce={reduce} />) : <EmptyState title="Productos disponibles pronto" description="Elige otra opción del menú." />}</div> : null}
      {builder ? <p className="selection-pulse">Seleccionado: {builder.item.name}</p> : null}
    </section>
  );
};

const QuantityControl = ({ value, onChange }: { value: 1 | 2 | 3; onChange: (qty: 1 | 2 | 3) => void }) => (
  <div className="qty-control" role="group" aria-label="Cantidad de unidades">
    <button type="button" onClick={() => onChange(Math.max(1, value - 1) as 1 | 2 | 3)} disabled={value === 1}>−</button>
    <strong>x{value}</strong>
    <button type="button" onClick={() => onChange(Math.min(3, value + 1) as 1 | 2 | 3)} disabled={value === 3}>+</button>
  </div>
);

const UnitEditor = ({ unit, index, item, extras, garnishes, onChange }: { unit: CartEntry; index: number; item: MenuItem; extras: MenuItem[]; garnishes: MenuItem[]; onChange: (unit: CartEntry) => void }) => {
  const ingredients = inferIngredients(item);
  const isBurgerLike = unit.itemKind === "burger" || unit.itemKind === "combo";
  return (
    <article className="unit-editor">
      <header><h3>{unit.name} #{index + 1}</h3><span>{unit.itemKind === "combo" ? "Combo" : "Burger"}</span></header>
      {isBurgerLike ? <p className="muted">Pan incluido · no editable</p> : null}
      {isBurgerLike ? <div className="builder-block"><h4>MOD</h4><p className="builder-hint">Quita ingredientes.</p>{ingredients.length ? <div className="chip-grid">{ingredients.map((ingredient) => {
        const active = unit.removedIngredients.includes(ingredient);
        return <button type="button" key={ingredient} className={active ? "chip active" : "chip"} onClick={() => onChange({ ...unit, removedIngredients: active ? unit.removedIngredients.filter((entry) => entry !== ingredient) : [...unit.removedIngredients, ingredient] })}>Sin {ingredient}</button>;
      })}</div> : <p className="muted">Sin ingredientes editables para esta burger.</p>}</div> : null}
      {isBurgerLike ? <div className="builder-block"><h4>UPGRADE</h4><p className="builder-hint">Agrega extras.</p>{extras.length ? <div className="chip-grid">{extras.map((extra) => {
        const active = unit.extras.some((entry) => entry.sku === extra.sku);
        return <button type="button" key={extra.sku} className={active ? "chip active" : "chip"} onClick={() => onChange({ ...unit, extras: active ? unit.extras.filter((entry) => entry.sku !== extra.sku) : [...unit.extras, { sku: extra.sku, name: extra.name, price: extra.price }] })}>{extra.name} +{formatCurrency(extra.price)}</button>;
      })}</div> : <p className="muted">Sin extras disponibles.</p>}</div> : null}
      {unit.itemKind === "combo" ? <div className="builder-block"><h4>Guarnición incluida</h4>{garnishes.length ? <div className="chip-grid">{garnishes.map((garnish) => <button type="button" key={garnish.sku} className={unit.garnish?.sku === garnish.sku ? "chip active" : "chip"} onClick={() => onChange({ ...unit, garnish: { sku: garnish.sku, name: garnish.name } })}>{garnish.name}</button>)}</div> : <p className="inline-error">No hay guarniciones disponibles para confirmar este combo.</p>}</div> : null}
      {isBurgerLike ? <label className="field-label">Nota por burger opcional<textarea maxLength={220} value={unit.burgerNote ?? ""} onChange={(event) => onChange({ ...unit, burgerNote: event.target.value })} placeholder="Ej. bien cocida" /></label> : null}
    </article>
  );
};

const Workbench = ({ builder, extras, garnishes, onBack, onQuantity, onUnitChange }: { builder: BuilderDraft | null; extras: MenuItem[]; garnishes: MenuItem[]; onBack: () => void; onQuantity: (qty: 1 | 2 | 3) => void; onUnitChange: (index: number, unit: CartEntry) => void }) => (
  <section className="quest-panel">
    <QuestButton className="ghost" onClick={onBack}>Regresar</QuestButton>
    <span className="eyebrow">Workbench</span>
    <h2>{builder ? builder.item.name : "Selecciona producto"}</h2>
    <p className="muted section-subcopy">Personaliza cada burger.</p>
    {builder ? <><QuantityControl value={builder.quantity} onChange={onQuantity} /><div className="unit-stack">{builder.units.map((unit, index) => <UnitEditor key={unit.lineKey} unit={unit} index={index} item={builder.item} extras={extras} garnishes={garnishes} onChange={(next) => onUnitChange(index, next)} />)}</div>{builder.error ? <p className="inline-error" role="alert">{builder.error}</p> : null}</> : <EmptyState title="Sin producto activo" description="Regresa a Main Quest y elige una hamburguesa o combo." />}
  </section>
);

const SideQuest = ({ garnishes, selected, onToggle, onBack, onSkip, reduce }: { garnishes: MenuItem[]; selected: string[]; onToggle: (sku: string) => void; onBack: () => void; onSkip: () => void; reduce: boolean }) => (
  <section className="quest-panel">
    <QuestButton className="ghost" onClick={onBack}>Regresar</QuestButton>
    <span className="eyebrow">Side Quest</span>
    <h2>Guarniciones extra opcionales</h2>
    <p className="muted">Opcional. Si tu combo incluye guarnición, ya va incluida.</p>
    {garnishes.length ? <div className="kiosk-grid">{garnishes.map((item) => <div className={selected.includes(item.sku) ? "side-card active" : "side-card"} key={item.sku}><ProductCard item={item} mode="select" onClick={() => onToggle(item.sku)} reduce={reduce} /></div>)}</div> : <EmptyState title="Sin guarniciones disponibles" description="Puedes continuar sin guarnición extra." />}
    <QuestButton className="ghost" onClick={onSkip}>Continuar sin guarnición</QuestButton>
  </section>
);

const TicketList = ({ cart, items, onEdit, onDuplicate, onRemove }: { cart: CartEntry[]; items: MenuItem[]; onEdit: (lineKey: string) => void; onDuplicate: (lineKey: string) => void; onRemove: (lineKey: string) => void }) => (
  <div className="ticket-list">
    {cart.map((entry) => {
      const price = items.find((item) => item.sku === entry.sku)?.price ?? 0;
      const extrasTotal = entry.extras.reduce((sum, extra) => sum + (extra.price ?? 0), 0);
      return <article className="ticket-item" key={entry.lineKey}>
        <div><h3>{entry.name} #{entry.itemDisplayIndex}</h3><strong>{formatCurrency(price + extrasTotal)}</strong></div>
        <ul>
          {entry.removedIngredients.map((ingredient) => <li key={ingredient}>MOD · Sin {ingredient}</li>)}
          {entry.extras.map((extra) => <li key={extra.sku ?? extra.name}>UPGRADE · {extra.name}{extra.price ? ` +${formatCurrency(extra.price)}` : ""}</li>)}
          {entry.garnish ? <li>Guarnición incluida: {entry.garnish.name}</li> : null}
          {entry.burgerNote ? <li>Nota: {entry.burgerNote}</li> : null}
          {!entry.removedIngredients.length && !entry.extras.length && !entry.garnish && !entry.burgerNote ? <li>Unidad separada · precio unitario</li> : null}
        </ul>
        <footer>{entry.itemKind === "burger" || entry.itemKind === "combo" ? <button type="button" onClick={() => onEdit(entry.lineKey)}>Editar</button> : null}<button type="button" onClick={() => onDuplicate(entry.lineKey)}>Duplicar</button><button type="button" onClick={() => onRemove(entry.lineKey)}>Eliminar</button></footer>
      </article>;
    })}
  </div>
);

const Checkout = ({ cart, items, total, customer, setCustomer, onBack, onSubmit, submitting, error, onEdit, onDuplicate, onRemove }: { cart: CartEntry[]; items: MenuItem[]; total: number; customer: CustomerDraft; setCustomer: (customer: CustomerDraft) => void; onBack: () => void; onSubmit: () => void; submitting: boolean; error: string | null; onEdit: (lineKey: string) => void; onDuplicate: (lineKey: string) => void; onRemove: (lineKey: string) => void }) => (
  <section className="quest-panel checkout-panel">
    <QuestButton className="ghost" onClick={onBack}>Regresar</QuestButton>
    <span className="eyebrow">Loadout final</span>
    <h2>Revisa tu ticket</h2>
    <p className="muted section-subcopy">Revisa tu ticket y confirma.</p>
    <TicketList cart={cart} items={items} onEdit={onEdit} onDuplicate={onDuplicate} onRemove={onRemove} />
    <div className="checkout-grid">
      <label className="field-label">Nombre<input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} placeholder="Tu nombre" /></label>
      <label className="field-label">Teléfono<input inputMode="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder="55 0000 0000" /></label>
      <label className="field-label wide">Nota general opcional<textarea maxLength={500} value={customer.notes} onChange={(event) => setCustomer({ ...customer, notes: event.target.value })} placeholder="Nota general del pedido" /></label>
      <label className="field-label wide">Código de invitado<input value={customer.referralCode} onChange={(event) => setCustomer({ ...customer, referralCode: event.target.value.toUpperCase() })} placeholder="CARLOS-BURGER-27" maxLength={32} /><small>Si alguien te invitó, escribe su código. No es obligatorio.</small></label>
      <div className="builder-block"><h4>Ubicación</h4><div className="chip-grid">{LOCATIONS.map((location) => <button type="button" key={location} className={customer.location === location ? "chip active" : "chip"} onClick={() => setCustomer({ ...customer, location })}>{location}</button>)}</div></div>
      <label className="field-label">Pago<select value={customer.paymentMethod} onChange={(event) => setCustomer({ ...customer, paymentMethod: event.target.value as OrderV2PaymentMethod })}><option value="unknown">Seleccionar</option><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="card">Tarjeta</option></select></label>
    </div>
    <div className="checkout-total"><span>Total</span><strong>{formatCurrency(total)}</strong></div>
    <QuestButton onClick={onSubmit} disabled={submitting || !cart.length}>{submitting ? "Enviando pedido..." : "Confirmar pedido"}</QuestButton>
    {error ? <p className="inline-error" role="alert">{error}</p> : null}
  </section>
);

const Success = ({ order, onCreateAnother }: { order: OrderConfirmation; onCreateAnother: () => void }) => {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const earnedTickets = order.earnedTickets;
  const copyReferralCode = async () => {
    if (!order.customerReferralCode) return;
    try {
      await navigator.clipboard.writeText(order.customerReferralCode);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };

  return (
    <section className="quest-panel success-panel" aria-live="polite">
      <span className="eyebrow">Success</span>
      <h2>Pedido recibido</h2>
      <p className="muted section-subcopy">Pedido recibido.</p>
      <p>Folio: <strong>{order.folio}</strong></p>
      <p>Estado: {statusLabels[order.status] ?? order.status}</p>
      <p>Total confirmado: {formatCurrency(order.total)}</p>
      <p>Ubicación: {order.location}</p>
      <p>Pago: {paymentMethodLabels[order.paymentMethod]}</p>
      {earnedTickets ? <article className="success-reward-card">
        <span className="eyebrow">Tickets ganados por esta orden</span>
        <strong className="success-ticket-total">+{earnedTickets.totalTickets} tickets</strong>
        <ul>
          <li>Burgers/combos: +{earnedTickets.burgerTickets}</li>
          {earnedTickets.referralUsedTickets > 0 ? <li>Código aplicado: +{earnedTickets.referralUsedTickets}</li> : null}
        </ul>
        {order.referralAccepted === true && earnedTickets.referralUsedTickets === 0 ? <p>Código aplicado. Los tickets de referido se asignan a quien te invitó.</p> : null}
      </article> : null}
      {order.customerReferralCode ? <article className="success-referral-card">
        <span className="eyebrow">Tu código para invitar</span>
        <strong className="success-referral-code">{order.customerReferralCode}</strong>
        {order.activeRaffleTitle ? <p>Sorteo activo: {order.activeRaffleTitle}</p> : null}
        <p>Comparte tu código. Por cada amigo que haga pedido con tu código ganas 2 tickets.</p>
        <QuestButton className="ghost" onClick={copyReferralCode}>Copiar código</QuestButton>
        {copyStatus === "copied" ? <p className="success-copy-status">Código copiado.</p> : null}
        {copyStatus === "error" ? <p className="success-copy-status error">No se pudo copiar automático. Mantén presionado el código para copiarlo manualmente.</p> : null}
      </article> : null}
      {order.referralAccepted === true && !earnedTickets ? <p className="success-note">Código de invitado aplicado.</p> : null}
      {order.referralAccepted === false ? <p className="success-note muted">Pedido recibido. El código de invitado no aplicó.</p> : null}
      <QuestButton onClick={onCreateAnother}>Nuevo pedido</QuestButton>
    </section>
  );
};

const PersistentCta = ({ section, count, total, disabled, submitting, onClick }: { section: QuestSection; count: number; total: number; disabled?: boolean; submitting?: boolean; onClick: () => void }) => {
  if (section === "success" || (section === "checkout" && !count)) return null;
  const label = section === "menu" ? "INICIAR QUEST" : section === "main" || section === "workbench" ? "CONTINUAR" : section === "side" ? "Ir a checkout" : "Confirmar pedido";
  return <aside className="persistent-cta"><div><span>Ticket</span><strong>{count} item{count === 1 ? "" : "s"} · {formatCurrency(total)}</strong></div><QuestButton disabled={disabled || submitting} onClick={onClick}>{submitting && section === "checkout" ? "Enviando..." : label}</QuestButton></aside>;
};

export function PublicOrderApp() {
  const reduce = useReducedMotion() ?? false;
  const submittingRef = useRef(false);
  const [section, setSection] = useState<QuestSection>("menu");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [builder, setBuilder] = useState<BuilderDraft | null>(null);
  const [orderChoice, setOrderChoice] = useState<OrderChoice | null>(null);
  const [infoItem, setInfoItem] = useState<MenuItem | null>(null);
  const [extraGarnishSkus, setExtraGarnishSkus] = useState<string[]>([]);
  const [menuData, setMenuData] = useState<MenuV2Response>(toFallbackMenuResponse("fallback"));
  const [raffleCampaign, setRaffleCampaign] = useState<RaffleCampaignPublicV2 | null>(null);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [showBoot, setShowBoot] = useState(true);
  const [customer, setCustomer] = useState<CustomerDraft>(() => createEmptyCustomer());
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderConfirmation, setOrderConfirmation] = useState<OrderConfirmation | null>(null);
  const total = useMemo(() => getCartTotal(cart, menuData.items), [cart, menuData.items]);
  const count = getCartCount(cart);
  const availableBurgerItems = useMemo(() => menuData.items.filter((item) => inferItemKind(item) === "burger" && item.isAvailable), [menuData.items]);
  const availableComboItems = useMemo(() => menuData.items.filter((item) => inferItemKind(item) === "combo" && item.isAvailable), [menuData.items]);
  const extras = menuData.items.filter((item) => item.category === "extras" && inferItemKind(item) !== "combo" && item.isAvailable);
  const garnishes = menuData.items.filter((item) => item.category === "guarniciones" && item.isAvailable);

  useEffect(() => { const frame = window.requestAnimationFrame(scrollToTop); return () => window.cancelAnimationFrame(frame); }, [section]);
  useEffect(() => {
    if (orderChoice === "combo" && availableComboItems.length === 0) {
      setOrderChoice(null);
      setBuilder((draft) => draft?.itemKind === "combo" ? null : draft);
    }
    if (orderChoice === "burger" && availableBurgerItems.length === 0) {
      setOrderChoice(null);
      setBuilder((draft) => draft?.itemKind === "burger" ? null : draft);
    }
  }, [availableBurgerItems.length, availableComboItems.length, orderChoice]);
  useEffect(() => {
    let mounted = true;
    const bootTimer = window.setTimeout(() => mounted && setShowBoot(false), reduce ? 250 : 1300);
    void loadActiveRaffleV2().then((campaign) => { if (mounted) setRaffleCampaign(campaign); });
    loadMenuV2().then((payload) => {
      if (!mounted) return;
      setMenuData(payload);
      setLoadingMenu(false);
      window.setTimeout(() => mounted && setShowBoot(false), reduce ? 0 : 250);
    });
    return () => { mounted = false; window.clearTimeout(bootTimer); };
  }, [reduce]);

  const navigate = (next: QuestSection) => setSection(next);
  const reindex = (entries: CartEntry[]) => {
    const seen = new Map<string, number>();
    return entries.map((entry) => { const next = (seen.get(entry.sku) ?? 0) + 1; seen.set(entry.sku, next); return { ...entry, itemDisplayIndex: next }; });
  };
  const beginQuest = () => { setOrderChoice(null); setBuilder(null); setExtraGarnishSkus([]); setCheckoutError(null); setOrderConfirmation(null); navigate("main"); };
  const startBuilder = (item: MenuItem, source?: CartEntry) => {
    if (!item.isAvailable) return;
    const itemKind = inferItemKind(item);
    if (itemKind !== "burger" && itemKind !== "combo") return;
    setOrderChoice(itemKind);
    setBuilder({ item, itemKind, quantity: 1, units: [makeUnit(item, itemKind, 1, source)], error: null, editLineKey: source?.lineKey });
    navigate("workbench");
  };
  const updateBuilderQuantity = (quantity: 1 | 2 | 3) => setBuilder((draft) => draft ? { ...draft, quantity, units: Array.from({ length: quantity }, (_, index) => makeUnit(draft.item, draft.itemKind, index + 1, draft.units[index])), error: null } : draft);
  const updateBuilderUnit = (index: number, unit: CartEntry) => setBuilder((draft) => draft ? { ...draft, units: draft.units.map((entry, entryIndex) => entryIndex === index ? unit : entry), error: null } : draft);
  const confirmBuilder = () => {
    if (!builder) return false;
    if (builder.itemKind === "combo" && builder.units.some((unit) => !unit.garnish)) {
      setBuilder({ ...builder, error: garnishes.length ? "El combo requiere elegir guarnición incluida." : "No hay guarniciones disponibles para confirmar este combo." });
      return false;
    }
    const units = builder.units.map((unit) => unit.itemKind === "burger" ? { ...unit, garnish: null } : unit);
    setCart((prev) => {
      const withoutEdited = builder.editLineKey ? prev.filter((entry) => entry.lineKey !== builder.editLineKey) : prev;
      return reindex([...withoutEdited, ...units]);
    });
    setCheckoutError(null);
    setOrderConfirmation(null);
    if (builder.editLineKey) { setBuilder(null); navigate("checkout"); } else { navigate("side"); }
    return true;
  };
  const addSideQuestAndCheckout = () => {
    const selectedGarnishes = garnishes.filter((item) => extraGarnishSkus.includes(item.sku));
    if (selectedGarnishes.length) {
      setCart((prev) => reindex([...prev, ...selectedGarnishes.map((item, index) => makeUnit(item, "garnish", prev.filter((entry) => entry.sku === item.sku).length + index + 1))]));
    }
    setExtraGarnishSkus([]);
    setBuilder(null);
    navigate("checkout");
  };
  const duplicateLine = (lineKey: string) => setCart((prev) => { const found = prev.find((entry) => entry.lineKey === lineKey); return found ? reindex([...prev, { ...found, lineKey: createId("line") }]) : prev; });
  const editLine = (lineKey: string) => {
    const found = cart.find((entry) => entry.lineKey === lineKey);
    const item = found ? menuData.items.find((menuItem) => menuItem.sku === found.sku) : null;
    if (found && item) startBuilder(item, found);
  };
  const removeLine = (lineKey: string) => setCart((prev) => {
    const next = reindex(prev.filter((entry) => entry.lineKey !== lineKey));
    if (!next.length) window.requestAnimationFrame(() => navigate("menu"));
    return next;
  });
  const handleCheckout = async () => {
    if (submittingRef.current) return;
    setCheckoutError(null);
    const validationError = validateCheckout(customer, cart, menuData.items);
    if (validationError) { setCheckoutError(validationError); return; }
    const payloadItems = cart.map((entry) => ({ sku: entry.sku, name: entry.name, qty: 1, lineKey: entry.lineKey, itemDisplayIndex: entry.itemDisplayIndex, itemKind: entry.itemKind, removedIngredients: entry.removedIngredients, extras: entry.extras, burgerNote: entry.burgerNote?.trim() || undefined, garnish: entry.garnish ?? null }));
    const notes = [`Ubicación: ${customer.location}`, customer.notes.trim()].filter(Boolean).join("\n");
    const idempotencyKey = getDraftIdempotencyKey({ customer, items: cart });
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const referralCode = customer.referralCode.trim().toUpperCase();
      const response = await createOrderV2({ customer: { name: customer.name.trim(), phone: normalizePhoneDigits(customer.phone) }, orderMode: orderModeForBackend, paymentMethod: customer.paymentMethod, notes, items: payloadItems, ...(referralCode ? { referralCode } : {}) }, idempotencyKey);
      const order = response.data?.order;
      if (!order) throw new Error("El backend no devolvió folio de confirmación.");
      setOrderConfirmation({ ...order, paymentMethod: customer.paymentMethod, location: customer.location, referralAccepted: response.data?.referralAccepted, customerReferralCode: response.data?.customerReferralCode, activeRaffleTitle: response.data?.activeRaffleTitle, earnedTickets: response.data?.earnedTickets });
      setCart([]);
      setCustomer(createEmptyCustomer());
      clearDraftIdempotencyKey();
      navigate("success");
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "No se pudo enviar el pedido. Intenta de nuevo.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  const handleCreateAnother = () => { setOrderConfirmation(null); setCheckoutError(null); setCart([]); setCustomer(createEmptyCustomer()); clearDraftIdempotencyKey(); setBuilder(null); setOrderChoice(null); setExtraGarnishSkus([]); navigate("menu"); };
  const primaryDisabled = (section === "main" && !builder) || (section === "workbench" && !builder) || (section === "checkout" && (submitting || !cart.length));
  const primaryAction = () => {
    if (section === "menu") beginQuest();
    else if (section === "main" && builder) navigate("workbench");
    else if (section === "workbench") confirmBuilder();
    else if (section === "side") addSideQuestAndCheckout();
    else if (section === "checkout") handleCheckout();
    else if (section === "success") handleCreateAnother();
  };

  return (
    <main className="app-shell">
      <LoadingOverlay loading={showBoot || loadingMenu} />
      <AppHeader count={count} total={total} />
      {section === "menu" ? <MenuSection menuData={menuData} raffleCampaign={raffleCampaign} onExplore={setInfoItem} onStart={beginQuest} reduce={reduce} /> : null}
      {section === "main" ? <MainQuest choice={orderChoice} availableBurgerItems={availableBurgerItems} availableComboItems={availableComboItems} builder={builder} onBack={() => navigate("menu")} onChoice={(choice) => { setOrderChoice(choice); setBuilder(null); }} onProduct={startBuilder} reduce={reduce} /> : null}
      {section === "workbench" ? <Workbench builder={builder} extras={extras} garnishes={garnishes} onBack={() => navigate("main")} onQuantity={updateBuilderQuantity} onUnitChange={updateBuilderUnit} /> : null}
      {section === "side" ? <SideQuest garnishes={garnishes} selected={extraGarnishSkus} onToggle={(sku) => setExtraGarnishSkus((prev) => prev.includes(sku) ? prev.filter((entry) => entry !== sku) : [...prev, sku])} onBack={() => navigate("workbench")} onSkip={() => { setExtraGarnishSkus([]); navigate("checkout"); }} reduce={reduce} /> : null}
      {section === "checkout" && cart.length ? <Checkout cart={cart} items={menuData.items} total={total} customer={customer} setCustomer={setCustomer} onBack={() => navigate(cart.length ? "side" : "menu")} onSubmit={handleCheckout} submitting={submitting} error={checkoutError} onEdit={editLine} onDuplicate={duplicateLine} onRemove={removeLine} /> : null}
      {section === "success" && orderConfirmation ? <Success order={orderConfirmation} onCreateAnother={handleCreateAnother} /> : null}
      <MenuInfoDialog item={infoItem} onClose={() => setInfoItem(null)} />
      <PersistentCta section={section} count={count} total={total} disabled={primaryDisabled} submitting={submitting} onClick={primaryAction} />
    </main>
  );
}
