import {
  type CreateOrderV2Response,
  type MenuCategory,
  type MenuItem,
  type MenuV2Response,
  type OrderV2Mode,
  type OrderV2Environment,
  type OrderV2PaymentMethod,
  type PromoCard,
  type RaffleCampaignPublicV2,
} from "@config/index";
import { EmptyState } from "@ui/index";
import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadMenuV2, toFallbackMenuResponse } from "../lib/menu-v2";
import { loadActiveRaffleV2 } from "../lib/raffles-v2";
import {
  type CartEntry,
  type TicketExtra,
  type TicketItemKind,
  formatCurrency,
  getCartCount,
  getCartTotal,
} from "../lib/order";
import { createOrderV2 } from "../lib/orders-v2";

type QuestSection = "menu" | "main" | "burgers" | "combos" | "combo-builder" | "workbench" | "customize" | "side" | "checkout" | "success";
type SideQuestEntryMode = "builder" | "direct" | "quickAdd";
type PaymentTiming = "" | "before" | "after";
type CustomerDraft = {
  name: string;
  phone: string;
  notes: string;
  referralCode: string;
  location: "" | "Torre GGA" | "Torre Valcob";
  paymentMethod: OrderV2PaymentMethod;
  paymentTiming: PaymentTiming;
};
type BuilderDraft = {
  item: MenuItem;
  itemKind: Extract<TicketItemKind, "burger" | "combo">;
  quantity: 1 | 2 | 3;
  units: CartEntry[];
  error: string | null;
  editLineKey?: string;
};
type ComboBuilderDraft = {
  combo: MenuItem;
  burgers: CartEntry[];
  includedGarnish: CartEntry["garnish"];
  includedDrink: TicketExtra | null;
  sideExtras: TicketExtra[];
  error: string | null;
  confirmed: boolean;
};
type OrderConfirmation = NonNullable<CreateOrderV2Response["data"]>["order"] & {
  paymentMethod: OrderV2PaymentMethod;
  location: CustomerDraft["location"];
  environment?: OrderV2Environment;
  referralAccepted?: boolean;
  customerReferralCode?: string;
  activeRaffleTitle?: string;
  earnedTickets?: NonNullable<CreateOrderV2Response["data"]>["earnedTickets"];
};
type DraftSnapshot = { customer: CustomerDraft; items: CartEntry[] };
type CheckoutField = "name" | "phone" | "location" | "paymentMethod" | "paymentTiming" | "notes" | "cart";
type CheckoutErrors = Partial<Record<CheckoutField, string>>;
type CheckoutStepIndex = 0 | 1 | 2;

const IDEMPOTENCY_KEY_STORAGE = "burgers-v2-order-draft-idempotency-key";
const IDEMPOTENCY_DRAFT_STORAGE = "burgers-v2-order-draft-idempotency-fingerprint";
const LOCATIONS = ["Torre GGA", "Torre Valcob"] as const;
const PAYMENT_METHODS = new Set<OrderV2PaymentMethod>(["cash", "transfer", "unknown"]);
const orderModeForBackend: OrderV2Mode = "pickup";
const resolvePublicOrderEnvironment = (): OrderV2Environment => {
  if (typeof window === "undefined") return "production";
  const params = new URLSearchParams(window.location.search);
  const raw =
    params.get("environment") ??
    params.get("env") ??
    params.get("preview") ??
    "";
  return raw.trim().toLowerCase() === "preview" || raw === "1"
    ? "preview"
    : "production";
};
const MENU_GROUPS: Array<{ key: MenuCategory["key"] | "combos"; label: string }> = [
  { key: "burgers", label: "Hamburguesas" },
  { key: "combos", label: "Combos" },
  { key: "guarniciones", label: "Guarniciones" },
];
const paymentMethodLabels: Record<OrderV2PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "No disponible",
  unknown: "Pago por confirmar en WhatsApp",
};
const paymentTimingLabels: Record<Exclude<PaymentTiming, "">, string> = {
  before: "Pagar antes",
  after: "Pagar después",
};
const TRANSFER_BANK_DETAILS = {
  bank: "BBVA",
  name: "Yolitzin Ameyali Zarate Otero",
  account: "012180015645465369",
} as const;
const CHECKOUT_NOTES_MAX_LENGTH = 500;
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
  paymentTiming: "",
});
const normalizePhoneDigits = (phone: string) => phone.replace(/\D/g, "");
const formatPhoneForDisplay = (phone: string) => {
  const digits = normalizePhoneDigits(phone);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)].filter(Boolean);
  return parts.join(" ");
};
const getPhoneError = (phone: string) => {
  const digitCount = normalizePhoneDigits(phone).length;
  if (digitCount === 10) return null;
  if (digitCount < 10) return `Faltan ${10 - digitCount} dígito${10 - digitCount === 1 ? "" : "s"}. Escribe 10 dígitos, ej. 2221234567.`;
  return `Sobran ${digitCount - 10} dígito${digitCount - 10 === 1 ? "" : "s"}. El teléfono debe tener exactamente 10 dígitos.`;
};
const scrollToTop = () => window.scrollTo({ top: 0, behavior: "auto" });
const createId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
const SAFE_IMAGE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:avif|jpe?g|png|webp)$/i;

const isSafeSameOriginPath = (value: string) => value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
const isSafeHttpsImageUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
const isSafeAssetKey = (value: string) => {
  const key = value.trim().replace(/^\/+/, "");
  if (!key || !SAFE_IMAGE_KEY_PATTERN.test(key) || key.includes("..") || key.includes("\\") || key.includes("//")) return false;
  return key.split("/").every((segment) => segment && segment !== "." && segment !== "..");
};
const resolveAssetUrl = (imageUrl?: string, imageKey?: string): string | undefined => {
  const trimmedKey = imageKey?.trim().replace(/^\/+/, "");
  if (trimmedKey && isSafeAssetKey(trimmedKey)) {
    return `/api/assets-v2/${trimmedKey.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;
  }

  const trimmedUrl = imageUrl?.trim();
  if (trimmedUrl && (isSafeSameOriginPath(trimmedUrl) || isSafeHttpsImageUrl(trimmedUrl))) return trimmedUrl;
  return undefined;
};
const inferItemKind = (item: MenuItem): TicketItemKind => {
  const seed = `${item.category} ${item.name} ${item.tags.join(" ")}`.toLowerCase();
  if (item.category === "combos" || seed.includes("combo")) return "combo";
  if (item.category === "burgers") return "burger";
  if (item.category === "guarniciones") return "garnish";
  if (item.category === "drinks") return "drink";
  return "other";
};
const DRINK_CATEGORY_KEYS = new Set(["bebidas", "drinks", "drink", "beverage"]);
const isDrinkItem = (item: MenuItem) => DRINK_CATEGORY_KEYS.has(item.category) || inferItemKind(item) === "drink";
const isOnionRing = (item: MenuItem) => /aro|onion/i.test(`${item.name} ${item.sku} ${item.tags.join(" ")}`);
const getIncludedGarnishUpcharge = (item: MenuItem) => isOnionRing(item) ? 5 : 0;
const getLinkedItemsByKind = (combo: MenuItem, items: MenuItem[], kind: TicketItemKind) => {
  const itemBySku = new Map(items.map((item) => [normalizeMenuLink(item.sku), item]));
  return combo.comboLinks
    .map((link) => itemBySku.get(normalizeMenuLink(link)))
    .filter((item): item is MenuItem => Boolean(item && item.isAvailable && inferItemKind(item) === kind));
};
const comboIncludesKind = (combo: MenuItem, items: MenuItem[], kind: TicketItemKind) => getLinkedItemsByKind(combo, items, kind).length > 0 || combo.tags.some((tag) => normalizeCatalogKey(tag).includes(kind === "drink" ? "BEBIDA" : kind === "garnish" ? "GUARN" : "BURGER"));
const getComboBurgerItems = (combo: MenuItem, items: MenuItem[]) => {
  const linkedBurgers = getLinkedItemsByKind(combo, items, "burger");
  return linkedBurgers.length ? linkedBurgers : [combo];
};
const toggleTicketExtra = (extras: TicketExtra[], item: MenuItem, source: TicketExtra["source"] = "side-extra") => {
  const index = extras.findIndex((extra) => extra.sku === item.sku && extra.source === source);
  if (index >= 0) return extras.filter((_, extraIndex) => extraIndex !== index);
  return [...extras, { sku: item.sku, name: item.name, price: item.price, source }];
};
const OG_REMOVABLE_INGREDIENTS = [
  "Tocino",
  "Queso americano",
  "Queso manchego",
  "Jitomate",
  "Lechuga",
  "Pepinillos",
  "Catsup",
  "Mostaza",
  "Mayonesa",
] as const;
const BBQ_REMOVABLE_INGREDIENTS = [
  "Tocino",
  "Queso americano",
  "Queso manchego",
  "Aros de cebolla",
  "Pepinillos",
  "Salsa BBQ",
] as const;
const OG_PRODUCT_INGREDIENTS = [
  "Carne Especial 250g aprox",
  "Tocino",
  "Queso americano",
  "Queso manchego",
  "Jitomate",
  "Lechuga",
  "Pepinillos",
  "Catsup",
  "Mostaza",
  "Mayonesa",
] as const;
const BBQ_PRODUCT_INGREDIENTS = [
  "Carne Especial 250g aprox",
  "Tocino",
  "Queso americano",
  "Queso manchego",
  "Aros de cebolla",
  "Pepinillos",
  "Salsa BBQ",
] as const;
const REMOVABLE_INGREDIENTS_BY_SKU: Record<string, readonly string[]> = {
  "BRG-OG": OG_REMOVABLE_INGREDIENTS,
  "BURGER-OG": OG_REMOVABLE_INGREDIENTS,
  "COMBO-OG": OG_REMOVABLE_INGREDIENTS,
  "PROMO-COMBO-OG": OG_REMOVABLE_INGREDIENTS,
  OG: OG_REMOVABLE_INGREDIENTS,
  "BRG-BBQ": BBQ_REMOVABLE_INGREDIENTS,
  "BURGER-BBQ": BBQ_REMOVABLE_INGREDIENTS,
  "COMBO-BBQ": BBQ_REMOVABLE_INGREDIENTS,
  "PROMO-COMBO-BBQ": BBQ_REMOVABLE_INGREDIENTS,
  BBQ: BBQ_REMOVABLE_INGREDIENTS,
};
const normalizeCatalogKey = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
const getRemovableIngredients = (item: MenuItem): string[] => {
  const skuIngredients = REMOVABLE_INGREDIENTS_BY_SKU[normalizeCatalogKey(item.sku)];
  if (skuIngredients) return [...skuIngredients];

  const nameKey = normalizeCatalogKey(item.name);
  if (/^(?:BURGER-|HAMBURGUESA-|COMBO-)?OG$/.test(nameKey)) return [...OG_REMOVABLE_INGREDIENTS];
  if (/^(?:BURGER-|HAMBURGUESA-|COMBO-)?BBQ$/.test(nameKey)) return [...BBQ_REMOVABLE_INGREDIENTS];
  return [];
};
const getKnownProductIngredients = (item: MenuItem): readonly string[] | null => {
  if (inferItemKind(item) === "combo") return null;

  const skuKey = normalizeCatalogKey(item.sku);
  const nameKey = normalizeCatalogKey(item.name);
  if (/(^|-)OG($|-)/.test(skuKey) || /^(?:BURGER-|HAMBURGUESA-)?OG$/.test(nameKey)) return OG_PRODUCT_INGREDIENTS;
  if (/(^|-)BBQ($|-)/.test(skuKey) || /^(?:BURGER-|HAMBURGUESA-)?BBQ$/.test(nameKey)) return BBQ_PRODUCT_INGREDIENTS;
  return null;
};
const getProductSalesCopy = (item: MenuItem): string => {
  const description = item.description.trim();
  if (!description) return "Drop especial del sistema, listo para entrar a tu ticket.";
  return description.length > 118 ? `${description.slice(0, 115).trim()}…` : description;
};

const getProductIngredientBullets = (item: MenuItem): string[] => {
  const knownIngredients = getKnownProductIngredients(item);
  if (knownIngredients) return [...knownIngredients].slice(0, 8);

  const description = item.description.trim();
  if (!description) return [];

  const parts = description
    .split(/\s*(?:,|\s+y\s+)\s*/i)
    .map((part) => part.trim().replace(/[.;]+$/g, ""))
    .filter((part) => part.length > 0);
  const uniqueParts = parts.filter((part, index) => parts.findIndex((candidate) => candidate.toLocaleLowerCase("es-MX") === part.toLocaleLowerCase("es-MX")) === index);
  return uniqueParts.length > 1 ? uniqueParts.slice(0, 8) : [];
};
const getComboIncludes = (combo: MenuItem, items: MenuItem[]): string[] => {
  const itemBySku = new Map(items.map((item) => [normalizeMenuLink(item.sku), item]));
  const linkedItems = combo.comboLinks
    .map((link) => itemBySku.get(normalizeMenuLink(link)))
    .filter((item): item is MenuItem => Boolean(item));
  const linkedLabels = linkedItems.map((item) => {
    const kind = inferItemKind(item);
    const prefix = kind === "garnish" ? "Guarnición" : kind === "drink" ? "Bebida" : kind === "burger" ? "Burger" : "Item";
    return `${prefix}: ${item.name}`;
  });

  const fallbackLabels = combo.tags.length
    ? combo.tags.map((tag) => tag.trim()).filter(Boolean)
    : getProductIngredientBullets(combo);
  const source = linkedLabels.length ? linkedLabels : fallbackLabels;
  const unique = source.filter((label, index) => source.findIndex((candidate) => candidate.toLocaleLowerCase("es-MX") === label.toLocaleLowerCase("es-MX")) === index);
  return unique.slice(0, 5);
};
const makeUnit = (item: MenuItem, itemKind: TicketItemKind, index: number, source?: Partial<CartEntry>): CartEntry => ({
  sku: item.sku,
  name: item.name,
  qty: 1,
  lineKey: source?.lineKey ?? createId("line"),
  itemDisplayIndex: index,
  itemKind,
  removedIngredients: (source?.removedIngredients ?? []).filter((ingredient) => getRemovableIngredients(item).includes(ingredient)),
  extras: [...(source?.extras ?? [])],
  burgerNote: source?.burgerNote ?? "",
  garnish: itemKind === "burger" ? null : (source?.garnish ?? null),
  includedDrink: source?.includedDrink ?? null,
  sideQuestExtras: [...(source?.sideQuestExtras ?? [])],
  comboBurgers: source?.comboBurgers ? source.comboBurgers.map((burger) => ({ ...burger, removedIngredients: [...burger.removedIngredients], extras: [...burger.extras] })) : undefined,
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
      paymentTiming: snapshot.customer.paymentTiming,
    },
    items: snapshot.items.map(({ lineKey, sku, itemDisplayIndex, itemKind, removedIngredients, extras, burgerNote, garnish, includedDrink, sideQuestExtras, comboBurgers }) => ({
      lineKey,
      sku,
      itemDisplayIndex,
      itemKind,
      removedIngredients,
      extras,
      burgerNote,
      garnish,
      includedDrink,
      sideQuestExtras,
      comboBurgers,
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
const buildCheckoutNotes = (customer: CustomerDraft): string => {
  const paymentNotes = [
    `Pago: ${paymentMethodLabels[customer.paymentMethod]}`,
    customer.paymentMethod === "transfer" && customer.paymentTiming ? `Momento de pago: ${paymentTimingLabels[customer.paymentTiming]}` : "",
  ].filter(Boolean);
  return [`Ubicación: ${customer.location}`, ...paymentNotes, customer.notes.trim()].filter(Boolean).join("\n");
};
const validateCheckout = (customer: CustomerDraft, cart: CartEntry[], items: MenuItem[]): { global: string | null; fields: CheckoutErrors } => {
  const fields: CheckoutErrors = {};
  if (cart.length === 0) fields.cart = "Agrega al menos un producto al ticket.";
  if (customer.name.trim().length < 2) fields.name = "Escribe tu nombre con al menos dos caracteres.";
  const phoneError = getPhoneError(customer.phone);
  if (phoneError) fields.phone = phoneError;
  if (!customer.location) fields.location = "Elige Torre GGA o Torre Valcob.";
  if (!PAYMENT_METHODS.has(customer.paymentMethod)) fields.paymentMethod = "Elige un método de pago.";
  if (customer.paymentMethod === "transfer" && !customer.paymentTiming) fields.paymentTiming = "Elige si pagarás antes o después.";
  if (buildCheckoutNotes(customer).length > CHECKOUT_NOTES_MAX_LENGTH) fields.notes = "La nota general es demasiado larga. Deja espacio para los datos de pago.";
  const unavailable = cart.find((entry) => !items.find((item) => item.sku === entry.sku && item.isAvailable));
  if (unavailable) fields.cart = "Uno de los productos ya no está disponible. Actualiza el ticket antes de enviar.";
  const firstError = checkoutErrorOrder.map((field) => fields[field]).find(Boolean) ?? null;
  return { global: firstError, fields };
};
const validateCheckoutDataStep = (customer: CustomerDraft): CheckoutErrors => {
  const fields: CheckoutErrors = {};
  if (customer.name.trim().length < 2) fields.name = "Escribe tu nombre con al menos dos caracteres.";
  const phoneError = getPhoneError(customer.phone);
  if (phoneError) fields.phone = phoneError;
  if (!customer.location) fields.location = "Elige Torre GGA o Torre Valcob.";
  return fields;
};
const checkoutStepForErrors = (fields: CheckoutErrors): CheckoutStepIndex => {
  if (fields.cart) return 0;
  if (fields.name || fields.phone || fields.location || fields.notes) return 1;
  return 2;
};
const checkoutErrorOrder: CheckoutField[] = ["cart", "name", "phone", "location", "notes", "paymentMethod", "paymentTiming"];
const checkoutFieldTargetIds: Record<CheckoutField, string> = {
  cart: "checkoutCartSummary",
  name: "checkoutName",
  phone: "checkoutPhone",
  location: "checkoutLocation",
  paymentMethod: "checkoutPaymentMethod",
  paymentTiming: "checkoutPaymentTiming",
  notes: "checkoutNotes",
};
const focusFirstCheckoutError = (fields: CheckoutErrors) => {
  const firstField = checkoutErrorOrder.find((field) => fields[field]);
  if (!firstField) return;
  window.requestAnimationFrame(() => {
    const target = document.getElementById(checkoutFieldTargetIds[firstField]);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (target instanceof HTMLElement) target.focus({ preventScroll: true });
  });
};

const QuestButton = ({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...props} className={`quest-button ${className}`}>{children}</button>
);

const normalizeMenuLink = (value: string) => value.trim().toUpperCase();

const LoadingOverlay = ({ loading }: { loading: boolean }) => loading ? (
  <div className="boot-overlay" role="status" aria-live="polite">
    <div className="boot-window">
      <h1>Burgers.exe</h1>
      <p>Cargando menú actualizado… Si tarda unos segundos, estamos sincronizando la quest.</p>
      <div className="boot-bar"><span /></div>
    </div>
  </div>
) : null;

const AppHeader = ({ section, count, total, builder }: { section: QuestSection; count: number; total: number; builder: BuilderDraft | null }) => {
  const summary = section === "success"
    ? "Pedido confirmado"
    : count > 0
      ? `Ticket: ${count} item${count === 1 ? "" : "s"} · ${formatCurrency(total)}`
      : builder
        ? `Personalizando: ${builder.item.name}`
        : "Arma tu pedido";

  return (
    <header className="quest-header">
      <strong>Burgers.exe</strong>
      <span>{summary}</span>
    </header>
  );
};

const PublicPreviewBanner = () => (
  <section className="public-preview-banner" role="status" aria-live="polite">
    <strong>MODO PREVIEW</strong>
    <span>Pedido de prueba. No preparar. No genera tickets ni referidos reales.</span>
  </section>
);

const ticketLabel = (count: number) => `${count} ticket${count === 1 ? "" : "s"}`;

const RaffleBanner = ({ campaign }: { campaign: RaffleCampaignPublicV2 | null }) => {
  if (!campaign) return null;
  const src = resolveAssetUrl(campaign.bannerImageUrl, campaign.bannerImageKey);
  const detailSrc = resolveAssetUrl(campaign.detailImageUrl, campaign.detailImageKey);
  return (
    <section className={`raffle-banner ${src ? "" : "raffle-banner-no-media"}`} aria-label="Sorteo activo">
      {src ? (
        <div className="raffle-banner-media">
          <img src={src} alt={campaign.title} loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; }} />
        </div>
      ) : null}
      <div className="raffle-banner-copy">
        <span className="raffle-kicker">Sorteo activo · loot disponible</span>
        <h2>{campaign.title}</h2>
        {campaign.description ? (
          <div className="raffle-prize-card">
            <span>Qué puedes ganar</span>
            <p>{campaign.description}</p>
          </div>
        ) : null}
        {campaign.rulesText ? <p className="raffle-rules"><strong>Reglas del servidor:</strong> {campaign.rulesText}</p> : null}
        {detailSrc ? <img className="raffle-detail-image" src={detailSrc} alt={`Detalles de ${campaign.title}`} loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
      </div>
    </section>
  );
};

const PromoRail = ({ promos, items, onViewCombo, label = "Promos y concursos", variant = "inline" }: { promos: PromoCard[]; items: MenuItem[]; onViewCombo: (item: MenuItem) => void; label?: string; variant?: "featured" | "inline" }) => {
  const itemBySku = new Map(items.map((item) => [normalizeMenuLink(item.sku), item]));
  const active = promos.filter((promo) => promo.isAvailable).sort((a, b) => a.sortOrder - b.sortOrder);
  if (!active.length) return null;
  return (
    <section className={`promo-rail promo-rail-${variant}`} aria-label={label}>
      {active.map((promo) => {
        const src = resolveAssetUrl(promo.asset.imageUrl, promo.asset.imageKey);
        const linkedCombo = promo.comboLinks.map((link) => itemBySku.get(normalizeMenuLink(link))).find((item): item is MenuItem => Boolean(item && inferItemKind(item) === "combo"));
        return (
          <article className="promo-card" key={promo.id}>
            {src ? <img src={src} alt={promo.asset.alt || promo.title} loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
            <div className="promo-card-copy">
              <span>{promo.badge || promo.promoLabel || "Promo"}</span>
              <h3>{promo.title}</h3>
              <p>{promo.description}</p>
              {linkedCombo ? <QuestButton className="ghost promo-card-cta" onClick={() => onViewCombo(linkedCombo)}>Ver combo</QuestButton> : null}
            </div>
          </article>
        );
      })}
    </section>
  );
};


const ProductCard = ({ item, mode, onClick, reduce, descriptionMode = "paragraph" }: { item: MenuItem; mode: "info" | "select"; onClick: (item: MenuItem) => void; reduce: boolean; descriptionMode?: "paragraph" | "ingredients" }) => {
  const src = resolveAssetUrl(item.imageUrl, item.imageKey);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(src) && !imageFailed;
  const kind = inferItemKind(item);
  const ingredientBullets = descriptionMode === "ingredients" ? getProductIngredientBullets(item) : [];
  const visualClassName = showImage ? "kiosk-visual" : `kiosk-visual no-image no-image-${kind}`;
  return (
    <motion.button
      type="button"
      whileTap={reduce ? undefined : { scale: 0.98 }}
      className="kiosk-card"
      onClick={() => onClick(item)}
      aria-label={`${mode === "info" ? "Ver información de" : "Elegir"} ${item.name}`}
      disabled={mode === "select" && !item.isAvailable}
    >
      <div className={visualClassName}>
        {showImage && src ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)} /> : <span>{item.name}</span>}
      </div>
      <div className="kiosk-body">
        <span>{kind === "combo" ? "Combo" : item.category}</span>
        <h3>{item.name}</h3>
        {ingredientBullets.length ? (
          <ul className="kiosk-ingredients-list">
            {ingredientBullets.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}
          </ul>
        ) : <p>{item.description}</p>}
        <footer>
          <strong>{formatCurrency(item.price)}</strong>
          <em>{item.isAvailable ? "Disponible" : "Agotado"}</em>
        </footer>
      </div>
    </motion.button>
  );
};


const TicketsLookupCta = () => (
  <section className="raffle-lookup-cta" aria-labelledby="raffleLookupCtaTitle">
    <div>
      <span>Consulta privada</span>
      <h3 id="raffleLookupCtaTitle">¿Ya participas?</h3>
      <p>Revisa tus tickets y comparte tu código sin llenar formularios en el menú.</p>
    </div>
    <a href="/tickets" aria-label="Consulta tus tickets en una página dedicada">Consulta tus tickets</a>
  </section>
);

const RouteVisual = ({ title, src }: { title: string; src?: string }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(src) && !imageFailed;

  return (
    <div className={showImage ? "route-card-visual" : "route-card-visual no-image"} aria-hidden="true">
      {showImage && src ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)} /> : <span>{title}</span>}
    </div>
  );
};

const MenuSection = ({ menuData, raffleCampaign, onExplore, onStart, reduce }: { menuData: MenuV2Response; raffleCampaign: RaffleCampaignPublicV2 | null; onExplore: (item: MenuItem) => void; onStart: () => void; reduce: boolean }) => {
  const bonusZoneRef = useRef<HTMLElement | null>(null);
  const activePromos = menuData.promos.filter((promo) => promo.isAvailable);
  const usingFallbackMenu = menuData.source === "fallback";
  const featuredPromo = activePromos.filter((promo) => promo.isFeatured).sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 1);
  const inlinePromos = activePromos.filter((promo) => !promo.isFeatured);
  const hasBonusContent = Boolean(raffleCampaign);
  const visibleItems = menuData.items.filter((item) => item.category !== "extras" && !isDrinkItem(item));
  const comboItems = menuData.items.filter((item) => inferItemKind(item) === "combo");
  const byGroup = (key: MenuCategory["key"] | "combos") => key === "combos" ? comboItems : visibleItems.filter((item) => item.category === key);
  const promosForItems = (items: MenuItem[]) => {
    const skus = new Set(items.map((item) => normalizeMenuLink(item.sku)));
    return inlinePromos.filter((promo) => promo.comboLinks.some((link) => skus.has(normalizeMenuLink(link))));
  };
  const scrollToBonusZone = () => {
    const bonusZone = bonusZoneRef.current;
    if (!bonusZone) return;
    bonusZone.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    window.setTimeout(() => bonusZone.focus({ preventScroll: true }), reduce ? 0 : 450);
  };
  return (
    <section className="quest-panel hero-panel">
      {hasBonusContent ? (
        <button type="button" className="menu-bonus-anchor" aria-label="Ir al sorteo" onClick={scrollToBonusZone}>
          <span className="menu-bonus-anchor-emoji" aria-hidden="true">🎁</span>
          <span className="menu-bonus-anchor-text">Sorteo</span>
        </button>
      ) : null}
      <div className="hero-copy-block">
        <span className="eyebrow">Menu</span>
        <div className="hero-brand-lockup">
          <h1 className="hero-brand-title" data-text="Burgers.exe" aria-label="Burgers.exe">
            <span className="hero-brand-name" aria-hidden="true">Burgers</span>
            <span className="hero-brand-exe" aria-hidden="true">.exe</span>
            <span className="hero-brand-cursor" aria-hidden="true" />
          </h1>
          <p className="hero-brand-status">&gt; order system online</p>
        </div>
        <p>Carga tu burger, desbloquea upgrades y manda tu orden al sistema.</p>
        <QuestButton onClick={onStart}>ARMAR MI PEDIDO</QuestButton>
      </div>
      {usingFallbackMenu ? (
        <section className="menu-sync-notice" role="status" aria-live="polite">
          <strong>Menú de respaldo activo</strong>
          <p>No pudimos confirmar el menú actualizado. Revisa tu conexión o recarga la página antes de ordenar.</p>
          <button type="button" className="quest-button ghost" onClick={() => window.location.reload()}>Reintentar carga</button>
        </section>
      ) : null}
      {featuredPromo.length ? <PromoRail promos={featuredPromo} items={menuData.items} onViewCombo={onExplore} label="Promo destacada" variant="featured" /> : null}
      {MENU_GROUPS.map(({ key, label }) => {
        const list = byGroup(key).sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <section className="menu-cluster" key={key}>
            <h2>{label}</h2>
            {list.length ? <div className="kiosk-grid">{list.map((item) => <ProductCard key={item.sku} item={item} mode="info" onClick={onExplore} reduce={reduce} />)}</div> : <EmptyState title={key === "combos" ? "Combos en carga… el sistema está preparando el siguiente drop." : key === "guarniciones" ? "Side quests disponibles pronto." : `${label} en carga…`} description="Vuelve a revisar el menú para desbloquear el siguiente drop." />}
            <PromoRail promos={promosForItems(list)} items={menuData.items} onViewCombo={onExplore} label={`Promos de ${label}`} />
          </section>
        );
      })}
      <aside ref={bonusZoneRef} className="menu-bonus-zone" aria-label="Bonus de tickets y referidos" tabIndex={-1}>
        <span className="eyebrow">Bonus secundario</span>
        <RaffleBanner campaign={raffleCampaign} />
        <TicketsLookupCta />
      </aside>
    </section>
  );
};

const MenuInfoDialog = ({ item, onClose, onChooseInFlow }: { item: MenuItem | null; onClose: () => void; onChooseInFlow: (item: MenuItem) => void }) => {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = "menu-info-title";
  const src = item ? resolveAssetUrl(item.imageUrl, item.imageKey) : undefined;
  const kind = item ? inferItemKind(item) : "other";
  const canEnterOrderFlow = Boolean(item?.isAvailable && (kind === "burger" || kind === "combo" || kind === "garnish"));
  const orderFlowLabel = kind === "burger" ? "Elegir en Burgers" : kind === "combo" ? "Armar combo" : "Elegir en Guarniciones";
  const ingredientBullets = item ? getProductIngredientBullets(item) : [];
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
        {src ? <img src={src} alt={item.name} loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
        <div>
          <span className="eyebrow">Intel de producto</span>
          <h2 id={titleId}>{item.name}</h2>
          <p className="info-dialog-sales-copy">{getProductSalesCopy(item)}</p>
          {ingredientBullets.length ? (
            <ul className="info-dialog-ingredients" aria-label={`Ingredientes de ${item.name}`}>
              {ingredientBullets.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}
            </ul>
          ) : null}
          <div className="info-dialog-meta">
            <strong>{formatCurrency(item.price)}</strong>
            <span className={item.isAvailable ? "availability-pill" : "availability-pill off"}>{item.isAvailable ? "Disponible" : "Agotado"}</span>
          </div>
          <div className="info-dialog-actions" aria-label={`Acciones para ${item.name}`}>
            {canEnterOrderFlow ? <button type="button" className="quest-button" aria-label={`${orderFlowLabel}: ${item.name}`} onClick={() => { onClose(); onChooseInFlow(item); }}>{orderFlowLabel}</button> : null}
            <button ref={closeRef} type="button" className="quest-button ghost" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </section>
    </div>
  );
};

const MainQuest = ({ categoryBanners, burgerItems, comboItems, garnishes, onBack, onBurgers, onCombos, onSideQuest }: { categoryBanners?: MenuV2Response["categoryBanners"]; burgerItems: MenuItem[]; comboItems: MenuItem[]; garnishes: MenuItem[]; onBack: () => void; onBurgers: () => void; onCombos: () => void; onSideQuest: () => void }) => {
  const routes: Array<{ key: "burgers" | "combos" | "side"; categoryKey: MenuCategory["key"]; number: string; title: string; description: string; cta: string; action: () => void; fallbackItem?: MenuItem }> = [
    { key: "burgers", categoryKey: "burgers", number: "01", title: "Burgers", description: "Elige tipos y cantidades; después puedes personalizar cada burger.", cta: "Elegir burgers", action: onBurgers, fallbackItem: burgerItems[0] },
    { key: "combos", categoryKey: "combos", number: "02", title: "Combos", description: "Arma una ruta completa con burger incluida, guarnición y extras opcionales.", cta: "Armar combo", action: onCombos, fallbackItem: comboItems[0] },
    { key: "side", categoryKey: "guarniciones", number: "03", title: "Guarniciones", description: "Guarniciones / Side Quest: ve directo por papas o aros sin armar burger.", cta: "Ver guarniciones", action: onSideQuest, fallbackItem: garnishes[0] },
  ];
  return (
    <section className="quest-panel main-quest-panel">
      <QuestButton className="back-button" onClick={onBack}>← Volver al menú</QuestButton>
      <span className="eyebrow">Main Quest · cómo pedir</span>
      <h2>Elige tu ruta</h2>
      <p className="muted section-subcopy">Elige cómo quieres pedir: burgers, combos o guarniciones. La quest te guía paso a paso.</p>
      <div className="route-grid" role="list" aria-label="Rutas del pedido">
        {routes.map((route) => {
          const banner = categoryBanners?.find((entry) => entry.categoryKey === route.categoryKey);
          const src = resolveAssetUrl(banner?.imageUrl ?? route.fallbackItem?.imageUrl, banner?.imageKey ?? route.fallbackItem?.imageKey);
          return (
            <article className={`route-card route-card-${route.key}`} key={route.key} role="listitem">
              <RouteVisual title={route.title} src={src} />
              <div className="route-card-copy">
                <span className="route-chip">{route.number}</span>
                <h3>{route.title}</h3>
                <p>{route.description}</p>
              </div>
              <QuestButton onClick={route.action}>{route.cta}</QuestButton>
            </article>
          );
        })}
      </div>
    </section>
  );
};

const ComboCard = ({ combo, items, onBuild, reduce }: { combo: MenuItem; items: MenuItem[]; onBuild: (item: MenuItem) => void; reduce: boolean }) => {
  const includes = getComboIncludes(combo, items);
  const src = resolveAssetUrl(combo.imageUrl, combo.imageKey);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(src) && !imageFailed;
  return (
    <motion.article className="combo-card" whileTap={reduce ? undefined : { scale: 0.99 }}>
      <div className={showImage ? "combo-card-visual" : "combo-card-visual no-image"} aria-hidden="true">
        {showImage && src ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)} /> : <span>Combo</span>}
      </div>
      <div className="combo-card-body">
        <div className="combo-card-kickers">
          {combo.badge ? <span>{combo.badge}</span> : null}
          {combo.promoLabel ? <span>{combo.promoLabel}</span> : null}
          {!combo.badge && !combo.promoLabel ? <span>Combo activo</span> : null}
        </div>
        <div className="combo-card-title-row">
          <h3>{combo.name}</h3>
          <strong>{formatCurrency(combo.price)}</strong>
        </div>
        <p>{getProductSalesCopy(combo)}</p>
        <div className="combo-includes" aria-label={`Incluye ${combo.name}`}>
          <span>Incluye</span>
          {includes.length ? (
            <ul>
              {includes.map((include) => <li key={include}>{include}</li>)}
            </ul>
          ) : (
            <p>Base de combo lista para configurar en el siguiente paso.</p>
          )}
        </div>
        <QuestButton onClick={() => onBuild(combo)} disabled={!combo.isAvailable} aria-label={`Armar combo ${combo.name}`}>Armar combo</QuestButton>
      </div>
    </motion.article>
  );
};

const CombosSelectionView = ({ items, allItems, onBack, onBuild, reduce }: { items: MenuItem[]; allItems: MenuItem[]; onBack: () => void; onBuild: (item: MenuItem) => void; reduce: boolean }) => (
  <section className="quest-panel combos-panel">
    <QuestButton className="back-button" onClick={onBack}>← Volver a Main</QuestButton>
    <span className="eyebrow">Combos</span>
    <h2>Arma tu combo</h2>
    <p className="muted section-subcopy">Cada card muestra el precio y lo que incluye antes de entrar al editor. Sin descuentos ocultos: eliges el combo y luego personalizas.</p>
    {items.length ? (
      <div className="combo-selection-grid">
        {items.map((combo) => <ComboCard key={combo.sku} combo={combo} items={allItems} onBuild={onBuild} reduce={reduce} />)}
      </div>
    ) : (
      <section className="combos-empty-panel" aria-live="polite">
        <EmptyState title="Combos disponibles próximamente" description="El laboratorio Burgers.exe está compilando el siguiente drop. Mientras tanto, arma una burger y desbloquea tu side quest." />
      </section>
    )}
  </section>
);

const BurgerSelectionView = ({ items, cart, error, onBack, onAdd, onQuantity, reduce }: { items: MenuItem[]; cart: CartEntry[]; error: string | null; onBack: () => void; onAdd: (item: MenuItem) => void; onQuantity: (item: MenuItem, quantity: number) => void; reduce: boolean }) => {
  const burgerEntries = cart.filter((entry) => entry.itemKind === "burger");
  const totalSelected = burgerEntries.length;
  const counts = new Map<string, number>();
  burgerEntries.forEach((entry) => counts.set(entry.sku, (counts.get(entry.sku) ?? 0) + 1));
  return (
    <section className="quest-panel burger-selection-panel">
      <QuestButton className="back-button" onClick={onBack}>← Volver a Main</QuestButton>
      <span className="eyebrow">Burgers</span>
      <h2>Selecciona tus burgers</h2>
      <p className="muted section-subcopy">Toca una tarjeta o usa + para agregar unidades. Podrás personalizar cada burger en el siguiente paso.</p>
      <div className="selection-summary" role="status" aria-live="polite">
        <span>Total seleccionado</span>
        <strong>{totalSelected}</strong>
      </div>
      {items.length ? <div className="burger-selection-grid">{items.map((item) => {
        const quantity = counts.get(item.sku) ?? 0;
        const src = resolveAssetUrl(item.imageUrl, item.imageKey);
        return (
          <motion.article className={quantity ? "burger-pick-card active" : "burger-pick-card"} key={item.sku} whileTap={reduce ? undefined : { scale: 0.99 }}>
            <button type="button" className="burger-pick-main" onClick={() => onAdd(item)} aria-label={`Agregar ${item.name}`}>
              {src ? <img src={src} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span aria-hidden="true">B</span>}
              <span className="burger-pick-copy"><strong>{item.name}</strong><em>{formatCurrency(item.price)}</em></span>
            </button>
            <div className="burger-pick-controls">
              <QuantityControl value={quantity} min={0} max={10} label={`Cantidad de ${item.name}`} onChange={(nextQty) => onQuantity(item, nextQty)} />
              <span className="burger-count-badge" aria-label={`${quantity} seleccionadas de ${item.name}`}>x{quantity}</span>
            </div>
          </motion.article>
        );
      })}</div> : <div className="compact-empty"><EmptyState title="Burgers disponibles pronto" description="Vuelve a revisar esta ruta más tarde." /></div>}
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
      <div className="burger-selection-actions burger-selection-secondary-actions">
        <QuestButton className="ghost" onClick={onBack}>Volver a Main</QuestButton>
      </div>
    </section>
  );
};

const QuantityControl = ({ value, onChange, min = 1, max = 3, label = "Cantidad de unidades" }: { value: number; onChange: (qty: number) => void; min?: number; max?: number; label?: string }) => (
  <div className="qty-control" role="group" aria-label={label}>
    <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>−</button>
    <strong>x{value}</strong>
    <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>+</button>
  </div>
);

const UnitEditor = ({ unit, index, item, extras, garnishes, onChange }: { unit: CartEntry; index: number; item: MenuItem; extras: MenuItem[]; garnishes: MenuItem[]; onChange: (unit: CartEntry) => void }) => {
  const ingredients = getRemovableIngredients(item);
  const isBurgerLike = unit.itemKind === "burger" || unit.itemKind === "combo";
  const [openPanels, setOpenPanels] = useState({ mod: true, upgrades: true, combo: true });
  const changeSummary = getUnitChangeSummary(unit);
  const removedSummary = changeSummary.removed.length ? `Quitado: ${changeSummary.removed.join(", ")}` : "Burger original";
  const extrasSummaryText = changeSummary.extras.length ? changeSummary.extras.map((entry) => `${entry.name} x${entry.quantity}`).join(", ") : "Sin upgrades";
  const upgradeTotal = unit.extras.reduce((sum, extra) => sum + (extra.price ?? 0), 0);
  const upgradeTotalLabel = `Upgrade actual: ${upgradeTotal ? `+${formatCurrency(upgradeTotal)}` : formatCurrency(0)}`;
  const togglePanel = (panel: keyof typeof openPanels) => setOpenPanels((current) => ({ ...current, [panel]: !current[panel] }));

  return (
    <article className="unit-editor">
      <header className="unit-editor-header">
        <div>
          <h3>Burger #{index + 1}</h3>
          <span className="product-chip">{unit.name}</span>
        </div>
        <strong className="status-badge">Personalizando</strong>
      </header>
      {isBurgerLike ? (
        <section className="builder-block mod-block custom-accordion-block">
          <button type="button" className="custom-accordion-trigger" aria-expanded={openPanels.mod} onClick={() => togglePanel("mod")}>
            <span>
              <strong>Quita ingredientes de tu burger</strong>
              <em>{removedSummary}</em>
            </span>
            <b aria-hidden="true">{openPanels.mod ? "−" : "+"}</b>
          </button>
          {openPanels.mod ? (
            <div className="custom-accordion-panel">
              <p className="builder-hint">Selecciona lo que quieres quitar. Toca de nuevo para regresarlo.</p>
              {ingredients.length ? (
                <div className="chip-grid mod-chip-grid">
                  {ingredients.map((ingredient) => {
                    const active = unit.removedIngredients.includes(ingredient);
                    return <button type="button" key={ingredient} className={active ? "chip mod-chip active" : "chip mod-chip"} aria-pressed={active} aria-label={active ? `${ingredient} quitado. Toca para regresarlo.` : `Quitar ${ingredient}`} onClick={() => onChange({ ...unit, removedIngredients: active ? unit.removedIngredients.filter((entry) => entry !== ingredient) : [...unit.removedIngredients, ingredient] })}><span>{ingredient}</span>{active ? <strong>✓ Quitado</strong> : <em>Quitar</em>}</button>;
                  })}
                </div>
              ) : <p className="muted unavailable-mod-copy">Esta burger no tiene MOD disponible por ahora.</p>}
            </div>
          ) : null}
        </section>
      ) : null}
      {isBurgerLike ? (
        <section className="builder-block upgrade-block custom-accordion-block" aria-labelledby={`upgrade-title-${unit.lineKey}`}>
          <button type="button" className="custom-accordion-trigger upgrade-accordion-trigger" aria-expanded={openPanels.upgrades} onClick={() => togglePanel("upgrades")}>
            <span>
              <strong id={`upgrade-title-${unit.lineKey}`}>Extras / LEVEL UP de burger</strong>
              <em>{extrasSummaryText}</em>
            </span>
            <b aria-hidden="true">{openPanels.upgrades ? "−" : "+"}</b>
          </button>
          {openPanels.upgrades ? (
            <div className="custom-accordion-panel upgrade-panel">
              <div className="upgrade-copy-block">
                <p className="builder-hint upgrade-hint">Agrega extras por pieza y arma una burger más potente.</p>
                <strong className={upgradeTotal ? "upgrade-money active" : "upgrade-money"} aria-live="polite">{upgradeTotalLabel}</strong>
              </div>
              {extras.length ? (
                <div className="upgrade-grid">
                  {extras.map((extra) => {
                    const quantity = unit.extras.filter((entry) => entry.sku === extra.sku).length;
                    const extraTotal = quantity * (extra.price ?? 0);
                    return (
                      <div className={quantity ? "upgrade-card active" : "upgrade-card"} key={extra.sku}>
                        <button type="button" className={quantity ? "chip upgrade-chip active" : "chip upgrade-chip"} aria-pressed={quantity > 0} onClick={() => onChange({ ...unit, extras: [...unit.extras, { sku: extra.sku, name: extra.name, price: extra.price }] })}>
                          <span className="upgrade-chip-name">+ {extra.name}</span>
                          <strong className="upgrade-chip-price">+{formatCurrency(extra.price)}</strong>
                          {quantity ? <em className="upgrade-chip-status">{quantity} en esta burger · +{formatCurrency(extraTotal)}</em> : null}
                        </button>
                        {quantity ? (
                          <div className="upgrade-controls">
                            <QuantityControl value={quantity} min={0} max={10} label={`Cantidad de ${extra.name}`} onChange={(nextQty) => {
                              if (nextQty > quantity) onChange({ ...unit, extras: [...unit.extras, ...Array.from({ length: nextQty - quantity }, () => ({ sku: extra.sku, name: extra.name, price: extra.price }))] });
                              else if (nextQty < quantity) {
                                const remainingToRemove = quantity - nextQty;
                                let removedCount = 0;
                                onChange({ ...unit, extras: unit.extras.filter((entry) => {
                                  if (entry.sku === extra.sku && removedCount < remainingToRemove) { removedCount += 1; return false; }
                                  return true;
                                }) });
                              }
                            }} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : <p className="muted">Sin extras disponibles.</p>}
            </div>
          ) : null}
        </section>
      ) : null}
      {unit.itemKind === "combo" ? <section className="builder-block custom-accordion-block"><button type="button" className="custom-accordion-trigger" aria-expanded={openPanels.combo} onClick={() => togglePanel("combo")}><span><strong>Guarnición incluida</strong><em>{unit.garnish?.name ?? "Elige una guarnición"}</em></span><b aria-hidden="true">{openPanels.combo ? "−" : "+"}</b></button>{openPanels.combo ? <div className="custom-accordion-panel">{garnishes.length ? <div className="chip-grid">{garnishes.map((garnish) => <button type="button" key={garnish.sku} className={unit.garnish?.sku === garnish.sku ? "chip active" : "chip"} onClick={() => onChange({ ...unit, garnish: { sku: garnish.sku, name: garnish.name } })}>{garnish.name}</button>)}</div> : <p className="inline-error">No hay guarniciones disponibles para confirmar este combo.</p>}</div> : null}</section> : null}
      {isBurgerLike ? <label className="field-label burger-note-label">Nota por burger opcional<textarea maxLength={220} value={unit.burgerNote ?? ""} onChange={(event) => onChange({ ...unit, burgerNote: event.target.value })} placeholder="Ej. bien cocida" /></label> : null}
      {isBurgerLike ? (
        <section className="change-summary-card" aria-live="polite" aria-labelledby={`change-summary-title-${unit.lineKey}`}>
          <div className="change-summary-head">
            <span className="eyebrow">Cambios antes de guardar</span>
            <h4 id={`change-summary-title-${unit.lineKey}`}>Esto se guardará en tu burger</h4>
          </div>
          {changeSummary.hasChanges ? (
            <dl className="change-summary-list">
              <div>
                <dt>Ingredientes quitados</dt>
                <dd>{changeSummary.removed.length ? changeSummary.removed.map((ingredient) => <span className="change-pill removed" key={ingredient}>✓ {ingredient}</span>) : <span className="summary-empty">Ninguno</span>}</dd>
              </div>
              <div className="change-summary-upgrades">
                <dt>Extras agregados</dt>
                <dd>{changeSummary.extras.length ? changeSummary.extras.map((extra) => <span className="change-pill extra" key={extra.name}>⚡ {extra.name}{extra.quantity > 1 ? ` x${extra.quantity}` : ""} · +{formatCurrency(extra.total)}</span>) : <span className="summary-empty">Ninguno</span>}</dd>
              </div>
              <div>
                <dt>Nota de burger</dt>
                <dd>{changeSummary.note ? <span className="change-note">“{changeSummary.note}”</span> : <span className="summary-empty">Sin nota</span>}</dd>
              </div>
            </dl>
          ) : <p className="summary-empty-state">Sin cambios por ahora · Burger original</p>}
        </section>
      ) : null}
    </article>
  );
};


type WorkbenchProps = {
  builder: BuilderDraft | null;
  onBack: () => void;
  onQuantity: (qty: number) => void;
  onContinue: () => void;
};

const Workbench = ({ builder, onBack, onQuantity, onContinue }: WorkbenchProps) => {
  const src = builder ? resolveAssetUrl(builder.item.imageUrl, builder.item.imageKey) : undefined;
  const unitLabel = builder?.quantity === 1 ? "1 pieza" : `${builder?.quantity ?? 0} piezas`;
  return (
    <section className="quest-panel workbench-panel">
      <QuestButton className="back-button" onClick={onBack}>← Volver a elegir</QuestButton>
      <span className="eyebrow">Cantidad / Workbench</span>
      <h2>{builder ? builder.item.name : "Selecciona producto"}</h2>
      <p className="muted section-subcopy">Selecciona cuántas piezas quieres agregar antes de personalizar.</p>
      {builder ? <div className="workbench-summary-card">
        {src ? <img src={src} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
        <div className="workbench-summary-copy">
          <span className="product-chip">{builder.itemKind === "combo" ? "Combo" : "Burger"}</span>
          <h3>{builder.item.name}</h3>
          <p>{builder.item.description}</p>
          <strong>{formatCurrency(builder.item.price)} · {unitLabel}</strong>
        </div>
        <QuantityControl value={builder.quantity} onChange={onQuantity} />
        {builder.error ? <p className="inline-error" role="alert">{builder.error}</p> : null}
        <div className="workbench-actions">
          <QuestButton onClick={onContinue}>Continuar</QuestButton>
          <QuestButton className="ghost" onClick={onBack}>Volver a elegir</QuestButton>
        </div>
      </div> : <EmptyState title="Sin producto activo" description="Regresa a Main Quest y elige una hamburguesa o combo." />}
    </section>
  );
};

const unitHasChanges = (unit: CartEntry) => Boolean(unit.removedIngredients.length || unit.extras.length || unit.burgerNote?.trim());

const groupExtras = (unit: CartEntry) => unit.extras.reduce<Record<string, { name: string; quantity: number; total: number }>>((acc, extra) => {
  const key = extra.sku ?? extra.name;
  acc[key] = { name: extra.name, quantity: (acc[key]?.quantity ?? 0) + 1, total: (acc[key]?.total ?? 0) + (extra.price ?? 0) };
  return acc;
}, {});

const getUnitChangeSummary = (unit: CartEntry) => {
  const removed = unit.removedIngredients;
  const extras = Object.values(groupExtras(unit));
  const note = unit.burgerNote?.trim() ?? "";

  return { removed, extras, note, hasChanges: Boolean(removed.length || extras.length || note) };
};

const summarizeUnitCustomization = (unit: CartEntry) => {
  const parts: string[] = [];
  const changes = getUnitChangeSummary(unit);
  if (changes.removed.length) parts.push(`Sin ${changes.removed.join(", ")}`);
  if (changes.extras.length) {
    parts.push(...changes.extras.map((extra) => `+ ${extra.name}${extra.quantity > 1 ? ` x${extra.quantity}` : ""}`));
  }
  if (changes.note) parts.push("Nota");
  if (unit.itemKind === "combo") parts.push(`Guarnición: ${unit.garnish?.name ?? "pendiente"}`);
  if (!parts.length) return "Original";
  if (unit.itemKind === "combo" && !unitHasChanges(unit)) return `Burger original · ${parts.join(" · ")}`;
  return parts.join(" · ");
};

const restoreOriginalUnit = (item: MenuItem, unit: CartEntry, index: number): CartEntry => ({
  ...makeUnit(item, unit.itemKind, index + 1, unit),
  lineKey: unit.lineKey,
  removedIngredients: [],
  extras: [],
  burgerNote: "",
  garnish: unit.itemKind === "combo" ? unit.garnish : null,
});

const CustomizationReview = ({ builder, extras, garnishes, onBack, onUnitChange, onContinue }: { builder: BuilderDraft | null; extras: MenuItem[]; garnishes: MenuItem[]; onBack: () => void; onUnitChange: (index: number, unit: CartEntry) => void; onContinue: () => void }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftUnit, setDraftUnit] = useState<CartEntry | null>(null);
  const editorTitleRef = useRef<HTMLHeadingElement | null>(null);
  const src = builder ? resolveAssetUrl(builder.item.imageUrl, builder.item.imageKey) : undefined;

  const closeEditor = useCallback(() => {
    setEditingIndex(null);
    setDraftUnit(null);
  }, []);

  useEffect(() => {
    if (editingIndex === null) return;
    const frame = window.requestAnimationFrame(() => editorTitleRef.current?.focus({ preventScroll: true }));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEditor();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeEditor, editingIndex]);

  if (!builder) {
    return (
      <section className="quest-panel customization-review-panel">
        <QuestButton className="back-button" onClick={onBack}>← Volver</QuestButton>
        <EmptyState title="Sin producto activo" description="Regresa a Main Quest y elige una hamburguesa o combo." />
      </section>
    );
  }

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setDraftUnit({ ...builder.units[index], removedIngredients: [...builder.units[index].removedIngredients], extras: [...builder.units[index].extras] });
  };
  const saveEditing = () => {
    if (editingIndex === null || !draftUnit) return;
    onUnitChange(editingIndex, draftUnit);
    closeEditor();
  };
  const restoreEditing = () => {
    if (editingIndex === null || !draftUnit) return;
    setDraftUnit(restoreOriginalUnit(builder.item, draftUnit, editingIndex));
  };

  return (
    <section className="quest-panel customization-review-panel">
      <QuestButton className="back-button" onClick={onBack}>← Volver a cantidad</QuestButton>
      <span className="eyebrow">Personalización opcional</span>
      <h2>¿Quieres personalizar tu burger?</h2>
      <p className="muted section-subcopy">Desinstala ingredientes o hazle un upgrade. También puedes continuar sin cambios.</p>
      <div className="customization-unit-list">
        {builder.units.map((unit, index) => {
          const changed = unitHasChanges(unit) || (unit.itemKind === "combo" && Boolean(unit.garnish));
          return (
            <article className="customization-unit-card" key={unit.lineKey}>
              {src ? <img src={src} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="customization-unit-fallback" aria-hidden="true">B</div>}
              <div className="customization-unit-summary">
                <h3>{unit.name} #{index + 1}</h3>
                <p>{summarizeUnitCustomization(unit)}</p>
              </div>
              <QuestButton className="ghost" onClick={() => startEditing(index)}>{changed ? "Editar" : builder.itemKind === "combo" ? "Personalizar combo" : "Personalizar"}</QuestButton>
            </article>
          );
        })}
      </div>
      {builder.error ? <p className="inline-error" role="alert">{builder.error}</p> : null}
      {editingIndex !== null && draftUnit ? <section className="customization-editor" aria-labelledby="customization-editor-title">
        <header className="customization-editor-header">
          <div>
            <span className="eyebrow">Editor enfocado</span>
            <h3 id="customization-editor-title" ref={editorTitleRef} tabIndex={-1}>Personalizando {builder.item.name} #{editingIndex + 1}</h3>
          </div>
          <QuestButton className="ghost editor-close-action" aria-label="Cerrar editor y descartar cambios" onClick={closeEditor}>Cerrar</QuestButton>
        </header>
        <UnitEditor unit={draftUnit} index={editingIndex} item={builder.item} extras={extras} garnishes={garnishes} onChange={setDraftUnit} />
        <div className="customization-actions customization-editor-actions">
          <QuestButton className="editor-save-action" onClick={saveEditing}>Guardar cambios</QuestButton>
          <QuestButton className="ghost danger-action" onClick={restoreEditing}>Restaurar original</QuestButton>
        </div>
      </section> : null}
      {editingIndex === null ? <div className="customization-actions review-actions">
        <QuestButton onClick={onContinue}>Todo bien, continuar</QuestButton>
        <QuestButton className="ghost" onClick={onBack}>Volver</QuestButton>
      </div> : null}
    </section>
  );
};

const ComboBuilder = ({ draft, allItems, extras, garnishes, drinks, onBack, onBurgerChange, onGarnish, onDrink, onSideExtraToggle, onReview, onReturnToMain, onCheckout, reduce }: { draft: ComboBuilderDraft | null; allItems: MenuItem[]; extras: MenuItem[]; garnishes: MenuItem[]; drinks: MenuItem[]; onBack: () => void; onBurgerChange: (index: number, unit: CartEntry) => void; onGarnish: (item: MenuItem) => void; onDrink: (item: MenuItem) => void; onSideExtraToggle: (item: MenuItem) => void; onReview: () => void; onReturnToMain: () => void; onCheckout: () => void; reduce: boolean }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftUnit, setDraftUnit] = useState<CartEntry | null>(null);
  const editorTitleRef = useRef<HTMLHeadingElement | null>(null);

  const closeEditor = useCallback(() => { setEditingIndex(null); setDraftUnit(null); }, []);
  useEffect(() => {
    if (editingIndex === null) return;
    const frame = window.requestAnimationFrame(() => editorTitleRef.current?.focus({ preventScroll: true }));
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeEditor(); };
    document.addEventListener("keydown", onKeyDown);
    return () => { window.cancelAnimationFrame(frame); document.removeEventListener("keydown", onKeyDown); };
  }, [closeEditor, editingIndex]);

  if (!draft) return <section className="quest-panel combo-builder-panel"><QuestButton className="back-button" onClick={onBack}>← Volver a Combos</QuestButton><EmptyState title="Sin combo activo" description="Elige un combo para armarlo individualmente." /></section>;

  const combo = draft.combo;
  const src = resolveAssetUrl(combo.imageUrl, combo.imageKey);
  const includedGarnishRequired = comboIncludesKind(combo, allItems, "garnish");
  const includedDrinkRequired = comboIncludesKind(combo, allItems, "drink") && drinks.length > 0;
  const sideQuestTotal = draft.sideExtras.reduce((sum, extra) => sum + (extra.price ?? 0), 0);
  const burgerExtrasTotal = draft.burgers.reduce((sum, burger) => sum + burger.extras.reduce((extraSum, extra) => extraSum + (extra.price ?? 0), 0), 0);
  const garnishUpcharge = draft.includedGarnish?.upcharge ?? 0;
  const total = combo.price + burgerExtrasTotal + garnishUpcharge + sideQuestTotal;
  const startEditing = (index: number) => { setEditingIndex(index); setDraftUnit({ ...draft.burgers[index], removedIngredients: [...draft.burgers[index].removedIngredients], extras: [...draft.burgers[index].extras] }); };
  const saveEditing = () => { if (editingIndex === null || !draftUnit) return; onBurgerChange(editingIndex, draftUnit); closeEditor(); };
  const restoreEditing = () => { if (editingIndex === null || !draftUnit) return; const item = allItems.find((menuItem) => menuItem.sku === draftUnit.sku) ?? combo; setDraftUnit(restoreOriginalUnit(item, draftUnit, editingIndex)); };
  const selectedSideExtra = (item: MenuItem) => draft.sideExtras.some((extra) => extra.sku === item.sku);

  return (
    <section className="quest-panel combo-builder-panel">
      <QuestButton className="back-button" onClick={onBack}>← Volver a Combos</QuestButton>
      <header className="combo-builder-hero">
        {src ? <img src={src} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
        <div>
          <span className="eyebrow">Combo Builder</span>
          <h2>{combo.name}</h2>
          <p>{getProductSalesCopy(combo)}</p>
          <div className="combo-builder-badges">
            <strong>{formatCurrency(combo.price)} base</strong>
            {combo.badge ? <span>{combo.badge}</span> : null}
            {combo.promoLabel ? <span>{combo.promoLabel}</span> : null}
          </div>
          <p className="combo-builder-instruction">Arma este combo antes de agregarlo al carrito. Cada combo se confirma individualmente.</p>
        </div>
      </header>

      {draft.confirmed ? (
        <section className="combo-success-card" role="status" aria-live="polite">
          <span className="eyebrow">Combo agregado</span>
          <h3>{combo.name} ya está en tu carrito.</h3>
          <p>Si quieres otro combo, vuelve a Main Quest y arma uno nuevo desde cero.</p>
          <div className="combo-confirm-actions">
            <QuestButton onClick={onReturnToMain}>Volver a Main Quest</QuestButton>
            <QuestButton className="ghost" onClick={onCheckout}>Ver carrito</QuestButton>
          </div>
        </section>
      ) : null}

      {!draft.confirmed ? <>
        <section className="combo-builder-section" aria-labelledby="comboBurgerTitle">
          <div className="combo-section-heading"><span>Incluido</span><h3 id="comboBurgerTitle">Burger incluida</h3><p>Edita y guarda cada burger dentro de este combo temporal.</p></div>
          <div className="combo-included-list">
            {draft.burgers.map((burger, index) => {
              const burgerItem = allItems.find((item) => item.sku === burger.sku) ?? combo;
              const burgerSrc = resolveAssetUrl(burgerItem.imageUrl, burgerItem.imageKey);
              return <article className="combo-included-card" key={burger.lineKey}>{burgerSrc ? <img src={burgerSrc} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span aria-hidden="true">B</span>}<div><strong>{burger.name} #{index + 1}</strong><p>{summarizeUnitCustomization(burger)}</p></div><QuestButton className="ghost" onClick={() => startEditing(index)}>Editar burger</QuestButton></article>;
            })}
          </div>
        </section>

        {editingIndex !== null && draftUnit ? <section className="customization-editor combo-burger-editor" aria-labelledby="combo-editor-title"><header className="customization-editor-header"><div><span className="eyebrow">Burger del combo</span><h3 id="combo-editor-title" ref={editorTitleRef} tabIndex={-1}>Editando burger #{editingIndex + 1}</h3></div><QuestButton className="ghost editor-close-action" onClick={closeEditor}>Cerrar</QuestButton></header><UnitEditor unit={draftUnit} index={editingIndex} item={allItems.find((item) => item.sku === draftUnit.sku) ?? combo} extras={extras} garnishes={[]} onChange={setDraftUnit} /><div className="customization-actions customization-editor-actions"><QuestButton onClick={saveEditing}>Guardar burger</QuestButton><QuestButton className="ghost danger-action" onClick={restoreEditing}>Restaurar original</QuestButton></div></section> : null}

        {includedGarnishRequired ? <section className="combo-builder-section" aria-labelledby="comboGarnishTitle"><div className="combo-section-heading"><span>Obligatorio</span><h3 id="comboGarnishTitle">Guarnición incluida</h3><p>Papas van incluidas. Aros de cebolla suman +$5.</p></div>{garnishes.length ? <div className="side-option-grid">{garnishes.map((garnish) => { const active = draft.includedGarnish?.sku === garnish.sku; const upcharge = getIncludedGarnishUpcharge(garnish); return <motion.button type="button" whileTap={reduce ? undefined : { scale: 0.98 }} className={active ? "side-option-card active" : "side-option-card"} key={garnish.sku} onClick={() => onGarnish(garnish)} aria-pressed={active}><strong>{garnish.name}</strong><span>{upcharge ? "+$5" : "Incluida"}</span></motion.button>; })}</div> : <p className="inline-error">No hay guarniciones activas para confirmar este combo.</p>}</section> : null}

        {includedDrinkRequired ? <section className="combo-builder-section" aria-labelledby="comboDrinkTitle"><div className="combo-section-heading"><span>Obligatorio</span><h3 id="comboDrinkTitle">Bebida incluida</h3><p>Elige una bebida activa. Todas cuentan como incluidas.</p></div><div className="side-option-grid">{drinks.map((drink) => <motion.button type="button" whileTap={reduce ? undefined : { scale: 0.98 }} className={draft.includedDrink?.sku === drink.sku ? "side-option-card active" : "side-option-card"} key={drink.sku} onClick={() => onDrink(drink)} aria-pressed={draft.includedDrink?.sku === drink.sku}><strong>{drink.name}</strong><span>Incluida</span></motion.button>)}</div></section> : null}

        {(garnishes.length || drinks.length) ? <section className="combo-builder-section combo-side-extra-section" aria-labelledby="comboSideTitle"><div className="combo-section-heading"><span>Opcional</span><h3 id="comboSideTitle">¿Quieres subir de nivel tu combo?</h3><p>Guarnición extra / Side Quest: agrega acompañamientos o bebidas aparte del combo.</p></div>{garnishes.length ? <div className="side-section-card"><h4>Guarniciones extra</h4><p>El acompañamiento que convierte tu burger en misión completa.</p><div className="side-option-grid">{garnishes.map((item) => <button type="button" className={selectedSideExtra(item) ? "side-option-card active" : "side-option-card"} key={item.sku} onClick={() => onSideExtraToggle(item)} aria-pressed={selectedSideExtra(item)}><strong>{item.name}</strong><span>Extra · {formatCurrency(item.price)}</span></button>)}</div></div> : null}{drinks.length ? <div className="side-section-card"><h4>Bebidas extra</h4><p>Cierra tu partida con algo frío.</p><div className="side-option-grid">{drinks.map((item) => <button type="button" className={selectedSideExtra(item) ? "side-option-card active" : "side-option-card"} key={item.sku} onClick={() => onSideExtraToggle(item)} aria-pressed={selectedSideExtra(item)}><strong>{item.name}</strong><span>Extra · {formatCurrency(item.price)}</span></button>)}</div></div> : null}</section> : null}

        <section className="combo-builder-section combo-confirm-card" aria-labelledby="comboConfirmTitle"><div className="combo-section-heading"><span>Confirmación combo</span><h3 id="comboConfirmTitle">Confirma tu combo antes de enviarlo a cocina.</h3></div><div className="combo-summary-list"><div><span>Combo</span><strong>{combo.name} · {formatCurrency(combo.price)}</strong></div>{draft.burgers.map((burger, index) => <div key={burger.lineKey}><span>Burger #{index + 1}</span><strong>{summarizeUnitCustomization(burger)}</strong></div>)}{includedGarnishRequired ? <div><span>Guarnición incluida</span><strong>{draft.includedGarnish ? `${draft.includedGarnish.name}${garnishUpcharge ? ` · +${formatCurrency(garnishUpcharge)}` : " · incluida"}` : "Pendiente"}</strong></div> : null}{includedDrinkRequired ? <div><span>Bebida incluida</span><strong>{draft.includedDrink?.name ?? "Pendiente"}</strong></div> : null}<div><span>Guarnición extra / Side Quest</span><strong>{draft.sideExtras.length ? `${draft.sideExtras.map((extra) => extra.name).join(", ")} · +${formatCurrency(sideQuestTotal)}` : "Sin extras opcionales"}</strong></div><div className="combo-total-row"><span>Total</span><strong>{formatCurrency(total)}</strong></div></div>{draft.error ? <p className="inline-error" role="alert">{draft.error}</p> : null}<div className="combo-confirm-actions"><QuestButton onClick={onReview}>Agregar combo</QuestButton><QuestButton className="ghost" onClick={onBack}>Volver</QuestButton></div></section>
      </> : null}
    </section>
  );
};

const CartCustomizationReview = ({ cart, items, extras, garnishes, error, onBack, onUnitChange, onContinue }: { cart: CartEntry[]; items: MenuItem[]; extras: MenuItem[]; garnishes: MenuItem[]; error: string | null; onBack: () => void; onUnitChange: (lineKey: string, unit: CartEntry) => void; onContinue: () => void }) => {
  const editableUnits = cart.filter((entry) => entry.itemKind === "burger" || entry.itemKind === "combo");
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [draftUnit, setDraftUnit] = useState<CartEntry | null>(null);
  const editorTitleRef = useRef<HTMLHeadingElement | null>(null);
  const editingUnit = editingLineKey ? editableUnits.find((entry) => entry.lineKey === editingLineKey) ?? null : null;
  const editingItem = editingUnit ? items.find((item) => item.sku === editingUnit.sku) ?? null : null;

  const closeEditor = useCallback(() => {
    setEditingLineKey(null);
    setDraftUnit(null);
  }, []);

  useEffect(() => {
    if (!editingLineKey) return;
    const frame = window.requestAnimationFrame(() => editorTitleRef.current?.focus({ preventScroll: true }));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEditor();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeEditor, editingLineKey]);

  const startEditing = (unit: CartEntry) => {
    setEditingLineKey(unit.lineKey);
    setDraftUnit({ ...unit, removedIngredients: [...unit.removedIngredients], extras: [...unit.extras] });
  };
  const saveEditing = () => {
    if (!editingLineKey || !draftUnit) return;
    onUnitChange(editingLineKey, draftUnit);
    closeEditor();
  };
  const restoreEditing = () => {
    if (!draftUnit || !editingItem) return;
    setDraftUnit(restoreOriginalUnit(editingItem, draftUnit, draftUnit.itemDisplayIndex - 1));
  };

  return (
    <section className="quest-panel customization-review-panel">
      <QuestButton className="back-button" onClick={onBack}>← Volver a burgers</QuestButton>
      <span className="eyebrow">Personalización opcional</span>
      <h2>Revisa cada burger</h2>
      <p className="muted section-subcopy">Puedes tocar una unidad para quitar ingredientes, agregar extras o dejarla original.</p>
      {editableUnits.length ? <div className="customization-unit-list">{editableUnits.map((unit) => {
        const item = items.find((menuItem) => menuItem.sku === unit.sku);
        const src = item ? resolveAssetUrl(item.imageUrl, item.imageKey) : undefined;
        const changed = unitHasChanges(unit) || (unit.itemKind === "combo" && Boolean(unit.garnish));
        return (
          <article className="customization-unit-card" key={unit.lineKey}>
            {src ? <img src={src} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="customization-unit-fallback" aria-hidden="true">B</div>}
            <div className="customization-unit-summary">
              <h3>{unit.name} #{unit.itemDisplayIndex}</h3>
              <p>{summarizeUnitCustomization(unit)}</p>
            </div>
            <QuestButton className="ghost" disabled={!item} onClick={() => startEditing(unit)}>{changed ? "Editar" : unit.itemKind === "combo" ? "Personalizar combo" : "Personalizar"}</QuestButton>
          </article>
        );
      })}</div> : <EmptyState title="Sin burgers para personalizar" description="Agrega al menos una burger antes de continuar." />}
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
      {editingLineKey && draftUnit && editingItem ? <section className="customization-editor" aria-labelledby="customization-editor-title">
        <header className="customization-editor-header">
          <div>
            <span className="eyebrow">Editor enfocado</span>
            <h3 id="customization-editor-title" ref={editorTitleRef} tabIndex={-1}>Personalizando {draftUnit.name} #{draftUnit.itemDisplayIndex}</h3>
          </div>
          <QuestButton className="ghost editor-close-action" aria-label="Cerrar editor y descartar cambios" onClick={closeEditor}>Cerrar</QuestButton>
        </header>
        <UnitEditor unit={draftUnit} index={draftUnit.itemDisplayIndex - 1} item={editingItem} extras={extras} garnishes={garnishes} onChange={setDraftUnit} />
        <div className="customization-actions customization-editor-actions">
          <QuestButton className="editor-save-action" onClick={saveEditing}>Guardar cambios</QuestButton>
          <QuestButton className="ghost danger-action" onClick={restoreEditing}>Restaurar original</QuestButton>
        </div>
      </section> : null}
      {!editingLineKey ? <div className="customization-actions review-actions">
        <QuestButton onClick={onContinue} disabled={!editableUnits.length}>Todo bien, continuar</QuestButton>
        <QuestButton className="ghost" onClick={onBack}>Volver</QuestButton>
      </div> : null}
    </section>
  );
};

const SideQuest = ({ garnishes, drinks, selected, onQuantity, onBack, canSkip, error, reduce, entryMode }: { garnishes: MenuItem[]; drinks: MenuItem[]; selected: Record<string, number>; onQuantity: (sku: string, quantity: number) => void; onBack: () => void; canSkip: boolean; error: string | null; reduce: boolean; entryMode: SideQuestEntryMode }) => {
  const isDirectEntry = entryMode === "direct";
  const backLabel = isDirectEntry ? "← Volver a Main" : "← Volver a personalizar";
  const hasSelection = [...garnishes, ...drinks].some((item) => (selected[item.sku] ?? 0) > 0);
  const renderOptions = (items: MenuItem[], kind: "garnish" | "drink") => (
    <div className="side-option-grid">
      {items.map((item) => {
        const quantity = selected[item.sku] ?? 0;
        return (
          <motion.article className={quantity ? "side-card active" : "side-card"} key={item.sku} whileTap={reduce ? undefined : { scale: 0.99 }}>
            <button type="button" className="side-card-main" onClick={() => onQuantity(item.sku, quantity + 1)} aria-label={`Agregar ${item.name}`}>
              <span className="side-card-kind">{kind === "drink" ? "Bebida" : "Guarnición"}</span>
              <strong>{item.name}</strong>
              <em>{formatCurrency(item.price)}</em>
            </button>
            <QuantityControl value={quantity} min={0} max={10} label={`Cantidad de ${item.name}`} onChange={(nextQty) => onQuantity(item.sku, nextQty)} />
          </motion.article>
        );
      })}
    </div>
  );

  return (
    <section className="quest-panel side-quest-panel">
      <QuestButton className="back-button" onClick={onBack}>{backLabel}</QuestButton>
      <span className="eyebrow">Guarniciones / Side Quest</span>
      <h2>Elige tus guarniciones</h2>
      <p className="muted section-subcopy">Side Quest = acompañamientos opcionales. Completa tu pedido con algo crujiente, fresco o extra brutal.</p>
      {garnishes.length ? <section className="side-section-card" aria-labelledby="sideGarnishTitle"><div><span>Opcional</span><h3 id="sideGarnishTitle">Guarniciones</h3><p>El acompañamiento que convierte tu burger en misión completa.</p></div>{renderOptions(garnishes, "garnish")}</section> : null}
      {drinks.length ? <section className="side-section-card" aria-labelledby="sideDrinkTitle"><div><span>Opcional</span><h3 id="sideDrinkTitle">Bebidas</h3><p>Cierra tu partida con algo frío.</p></div>{renderOptions(drinks, "drink")}</section> : null}
      {!garnishes.length && !drinks.length ? <div className="compact-empty"><EmptyState title="Sin guarniciones disponibles" description={canSkip ? "Puedes continuar sin guarnición." : "Vuelve a elegir otra opción del menú."} /></div> : null}
      <p className="side-quest-cta-copy">{hasSelection ? "Continuar con mi pedido" : "Continuar sin guarnición"}</p>
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
    </section>
  );
};

const TicketList = ({ cart, items, onEdit, onDuplicate, onRemove }: { cart: CartEntry[]; items: MenuItem[]; onEdit: (lineKey: string) => void; onDuplicate: (lineKey: string) => void; onRemove: (lineKey: string) => void }) => (
  <div className="ticket-list">
    {cart.map((entry) => {
      const price = items.find((item) => item.sku === entry.sku)?.price ?? 0;
      const extrasTotal = entry.extras.reduce((sum, extra) => sum + (extra.price ?? 0), 0);
      const sideExtras = entry.sideQuestExtras ?? [];
      const sideExtrasTotal = sideExtras.reduce((sum, extra) => sum + (extra.price ?? 0), 0);
      const garnishUpcharge = entry.garnish?.upcharge ?? 0;
      const lineTotal = price + extrasTotal + sideExtrasTotal + garnishUpcharge;
      const isCombo = entry.itemKind === "combo";
      const personalizationRows = [
        ...entry.removedIngredients.map((ingredient) => `Sin ${ingredient}`),
        entry.garnish ? `Guarnición incluida: ${entry.garnish.name}${entry.garnish.upcharge ? ` (+${formatCurrency(entry.garnish.upcharge)})` : ""}` : null,
        entry.includedDrink ? `Bebida incluida: ${entry.includedDrink.name}` : null,
        entry.burgerNote ? `Nota: ${entry.burgerNote}` : null,
      ].filter((row): row is string => Boolean(row));
      const comboBurgerRows = (entry.comboBurgers ?? []).map((burger, burgerIndex) => {
        const summary = summarizeUnitCustomization({ ...entry, name: burger.name, removedIngredients: burger.removedIngredients, extras: burger.extras, burgerNote: burger.burgerNote, itemKind: "burger" });
        return {
          key: `${burger.name}-${burgerIndex}`,
          label: `${burger.name}${(entry.comboBurgers?.length ?? 0) > 1 ? ` #${burgerIndex + 1}` : ""}`,
          summary: summary === "Burger original" ? "Sin cambios" : summary,
        };
      });
      const hasAnyDetail = personalizationRows.length || entry.extras.length || sideExtras.length || comboBurgerRows.length;
      return <article className="ticket-item" key={entry.lineKey}>
        <div className="ticket-item-head">
          <div>
            <span className="ticket-item-kind">{isCombo ? "Combo" : entry.itemKind === "burger" ? "Burger" : "Item"}</span>
            <h3>{entry.name} #{entry.itemDisplayIndex}</h3>
          </div>
          <strong>{formatCurrency(lineTotal)}</strong>
        </div>
        <div className="ticket-item-breakdown">
          <div className="ticket-item-base-row"><span>{isCombo ? "Base del combo" : "Precio base"}</span><strong>{formatCurrency(price)}</strong></div>
          {isCombo ? (
            <div className="ticket-item-detail-block ticket-item-combo-block">
              <span>Personalizaciones</span>
              <ul>
                {comboBurgerRows.length ? comboBurgerRows.map((row) => <li key={row.key}><span>{row.label}</span><strong>{row.summary}</strong></li>) : <li>Sin cambios</li>}
                {personalizationRows.map((row) => <li className="ticket-item-note-row" key={row}>{row}</li>)}
              </ul>
            </div>
          ) : personalizationRows.length ? (
            <div className="ticket-item-detail-block">
              <span>Personalizaciones</span>
              <ul>{personalizationRows.map((row) => <li key={row}>{row}</li>)}</ul>
            </div>
          ) : null}
          {entry.extras.length || isCombo ? (
            <div className="ticket-item-detail-block ticket-item-extras-block">
              <span>Extras de burger</span>
              {entry.extras.length ? <ul>{entry.extras.map((extra, extraIndex) => <li key={`${extra.sku ?? extra.name}-${extraIndex}`}><span>{extra.name}</span><strong>{extra.price ? `+${formatCurrency(extra.price)}` : "Incluido"}</strong></li>)}</ul> : <p>Sin extras de burger</p>}
            </div>
          ) : null}
          {sideExtras.length || isCombo ? (
            <div className="ticket-item-detail-block ticket-item-side-block">
              <span>Guarnición extra / Side Quest</span>
              {sideExtras.length ? <ul>{sideExtras.map((extra, extraIndex) => <li key={`${extra.sku ?? extra.name}-side-${extraIndex}`}><span>{extra.name}</span><strong>+{formatCurrency(extra.price ?? 0)}</strong></li>)}</ul> : <p>Sin guarniciones extra</p>}
            </div>
          ) : null}
          {!isCombo && !hasAnyDetail ? <p>Sin cambios - precio unitario</p> : null}
          <div className="ticket-item-total-row"><span>Total</span><strong>{formatCurrency(lineTotal)}</strong></div>
        </div>
        {isCombo ? <p className="ticket-item-combo-note">Para cambiar este combo, elimínalo y vuelve a armarlo desde Main Quest.</p> : null}
        <footer>{entry.itemKind === "burger" ? <button type="button" onClick={() => onEdit(entry.lineKey)}>Editar</button> : null}{entry.itemKind !== "combo" ? <button type="button" onClick={() => onDuplicate(entry.lineKey)}>Duplicar</button> : null}<button type="button" onClick={() => onRemove(entry.lineKey)}>Eliminar</button></footer>
      </article>;
    })}
  </div>
);


const REFERRAL_SHARE_TEXT = "Usa mi código al pedir en Burgers.exe. Si compras al menos 1 burger, me das tickets extra.";

type ShareActionStatus = "idle" | "copiedLink" | "copiedMessage" | "shared" | "downloaded" | "error";

const buildReferralPublicLink = (code: string) => {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.searchParams.set("ref", code);
  url.hash = "";
  return url.toString();
};

const buildReferralShareMessage = (code: string, link: string) => [`${REFERRAL_SHARE_TEXT}`, `Código: ${code}`, link].filter(Boolean).join("\n");

const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("Clipboard unavailable");
};

const drawWrappedCanvasText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let cursorY = y;
  words.forEach((word, index) => {
    const nextLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
      return;
    }
    line = nextLine;
    if (index === words.length - 1 && line) ctx.fillText(line, x, cursorY);
  });
  return cursorY + lineHeight;
};

const downloadReferralShareImage = async (params: { code: string; raffleTitle?: string; link: string }) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, "#05130a");
  gradient.addColorStop(0.52, "#080b0f");
  gradient.addColorStop(1, "#151002");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1350);

  ctx.strokeStyle = "rgba(57, 255, 136, 0.35)";
  ctx.lineWidth = 6;
  ctx.strokeRect(54, 54, 972, 1242);
  ctx.strokeStyle = "rgba(255, 184, 77, 0.32)";
  ctx.lineWidth = 2;
  for (let y = 130; y < 1240; y += 72) {
    ctx.beginPath();
    ctx.moveTo(90, y);
    ctx.lineTo(990, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#39ff88";
  ctx.font = "900 74px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Burgers.exe", 540, 190);

  if (params.raffleTitle) {
    ctx.fillStyle = "#d1fae5";
    ctx.font = "800 42px Inter, Arial, sans-serif";
    drawWrappedCanvasText(ctx, params.raffleTitle, 540, 285, 820, 54);
  }

  ctx.fillStyle = "rgba(57, 255, 136, 0.12)";
  ctx.strokeStyle = "rgba(57, 255, 136, 0.48)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(108, 450, 864, 305, 44);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fff7d6";
  ctx.font = "950 102px Inter, Arial, sans-serif";
  drawWrappedCanvasText(ctx, params.code, 540, 590, 780, 112);

  ctx.fillStyle = "#d1fae5";
  ctx.font = "800 45px Inter, Arial, sans-serif";
  drawWrappedCanvasText(ctx, "Pide tu burger y usa mi código", 540, 885, 820, 62);
  ctx.fillStyle = "#fbbf24";
  ctx.font = "800 34px Inter, Arial, sans-serif";
  drawWrappedCanvasText(ctx, REFERRAL_SHARE_TEXT, 540, 1015, 830, 48);
  ctx.fillStyle = "#8ef7b5";
  ctx.font = "700 30px Inter, Arial, sans-serif";
  drawWrappedCanvasText(ctx, params.link, 540, 1215, 850, 40);

  const blob = await new Promise<Blob>((resolve, reject) => {
    if (!canvas.toBlob) {
      reject(new Error("Canvas download unavailable"));
      return;
    }
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not render share image")), "image/png");
  });
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = `burgers-exe-${params.code}.png`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1200);
};

type CopyTransferStatus = "idle" | "copiedName" | "copiedAccount" | "error";

const TransferDetailsModal = ({ onClose }: { onClose: () => void }) => {
  const [status, setStatus] = useState<CopyTransferStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const copyDetail = async (value: string, nextStatus: Exclude<CopyTransferStatus, "idle" | "error">) => {
    try {
      await copyTextToClipboard(value);
      setError(null);
      setStatus(nextStatus);
    } catch {
      setError("No se pudo copiar automáticamente. Selecciona el dato y cópialo manualmente.");
      setStatus("error");
    }
  };

  return (
    <div className="transfer-modal-backdrop" role="presentation">
      <section className="transfer-modal" role="dialog" aria-modal="true" aria-labelledby="transfer-modal-title">
        <span className="eyebrow">Transferencia</span>
        <h3 id="transfer-modal-title">Datos para transferencia</h3>
        <p>Copia el nombre y la cuenta para hacer tu transferencia. Después guarda tu comprobante.</p>
        <dl className="transfer-detail-list">
          <div><dt>Banco</dt><dd>{TRANSFER_BANK_DETAILS.bank}</dd></div>
          <div><dt>Nombre</dt><dd>{TRANSFER_BANK_DETAILS.name}</dd></div>
          <div><dt>Cuenta</dt><dd>{TRANSFER_BANK_DETAILS.account}</dd></div>
        </dl>
        <small>Si pagas antes, puedes enviar tu comprobante por WhatsApp.</small>
        <div className="transfer-modal-actions">
          <QuestButton className="ghost" onClick={() => copyDetail(TRANSFER_BANK_DETAILS.name, "copiedName")}>Copiar nombre</QuestButton>
          <QuestButton className="ghost" onClick={() => copyDetail(TRANSFER_BANK_DETAILS.account, "copiedAccount")}>Copiar cuenta</QuestButton>
          <QuestButton onClick={onClose}>Cerrar</QuestButton>
        </div>
        {status === "copiedName" ? <p className="success-copy-status">Nombre copiado.</p> : null}
        {status === "copiedAccount" ? <p className="success-copy-status">Cuenta copiada.</p> : null}
        {error ? <p className="success-copy-status error">{error}</p> : null}
      </section>
    </div>
  );
};

const checkoutSteps = ["Resumen", "Datos", "Pago"] as const;

const Checkout = ({ cart, items, total, customer, setCustomer, checkoutStep, setCheckoutStep, onDataStepBlocked, onBack, onSubmit, submitting, error, fieldErrors, clearFieldError, clearCheckoutError, onEdit, onDuplicate, onRemove }: { cart: CartEntry[]; items: MenuItem[]; total: number; customer: CustomerDraft; setCustomer: (customer: CustomerDraft) => void; checkoutStep: CheckoutStepIndex; setCheckoutStep: (step: CheckoutStepIndex) => void; onDataStepBlocked: (fields: CheckoutErrors) => void; onBack: () => void; onSubmit: () => void; submitting: boolean; error: string | null; fieldErrors: CheckoutErrors; clearFieldError: (field: CheckoutField) => void; clearCheckoutError: () => void; onEdit: (lineKey: string) => void; onDuplicate: (lineKey: string) => void; onRemove: (lineKey: string) => void }) => {
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const updatePaymentMethod = (paymentMethod: OrderV2PaymentMethod) => {
    clearFieldError("paymentMethod");
    if (paymentMethod !== "transfer") clearFieldError("paymentTiming");
    setCustomer({ ...customer, paymentMethod, paymentTiming: paymentMethod === "transfer" ? customer.paymentTiming : "" });
  };
  const goToStep = (step: CheckoutStepIndex) => {
    if (step === 2 && checkoutStep !== 2) {
      const dataFields = validateCheckoutDataStep(customer);
      if (Object.keys(dataFields).length) {
        onDataStepBlocked(dataFields);
        return;
      }
      clearCheckoutError();
    }
    setCheckoutStep(step);
    window.requestAnimationFrame(() => document.getElementById("checkoutWizard")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const nextStep = () => goToStep(Math.min(2, checkoutStep + 1) as CheckoutStepIndex);
  const prevStep = () => checkoutStep === 0 ? onBack() : goToStep(Math.max(0, checkoutStep - 1) as CheckoutStepIndex);

  return (
    <section className="quest-panel checkout-panel" id="checkoutWizard">
      <QuestButton className="back-button" onClick={prevStep}>{checkoutStep === 0 ? "← Volver a guarniciones" : "← Paso anterior"}</QuestButton>
      <span className="eyebrow">Checkout</span>
      <h2>{checkoutSteps[checkoutStep]}</h2>
      <p className="muted section-subcopy">Checkout 3 pasos: revisa, deja tus datos y confirma pago sin cambiar tu pedido.</p>
      <nav className="checkout-progress" aria-label="Progreso de checkout">
        {checkoutSteps.map((label, index) => <button key={label} type="button" className={checkoutStep === index ? "active" : ""} aria-current={checkoutStep === index ? "step" : undefined} onClick={() => goToStep(index as CheckoutStepIndex)}><span>{index + 1}</span>{label}</button>)}
      </nav>
      {checkoutStep === 0 ? <section className="checkout-step-panel" aria-labelledby="checkoutSummaryTitle">
        <div className="checkout-step-heading"><span>01</span><h3 id="checkoutSummaryTitle">Resumen del ticket</h3></div>
        <div id="checkoutCartSummary" tabIndex={-1}>
          <TicketList cart={cart} items={items} onEdit={onEdit} onDuplicate={onDuplicate} onRemove={onRemove} />
        </div>
        {fieldErrors.cart ? <p className="inline-error" role="alert">{fieldErrors.cart}</p> : null}
        <div className="checkout-total"><span>Total</span><strong>{formatCurrency(total)}</strong></div>
        <QuestButton onClick={nextStep} disabled={!cart.length}>Continuar a datos</QuestButton>
      </section> : null}
      {checkoutStep === 1 ? <section className="checkout-step-panel" aria-labelledby="checkoutDataTitle">
        <div className="checkout-step-heading"><span>02</span><h3 id="checkoutDataTitle">Datos del pedido</h3></div>
        <p className="muted section-subcopy">Completa los campos obligatorios para identificar tu pedido y coordinar entrega.</p>
        {error ? <p className="checkout-error-summary" role="alert">Revisa el dato marcado: {error}</p> : null}
        <div className="checkout-grid">
          <label className="field-label" htmlFor="checkoutName">
            <span>Nombre <em>obligatorio</em></span>
            <input id="checkoutName" value={customer.name} onChange={(event) => { clearFieldError("name"); clearCheckoutError(); setCustomer({ ...customer, name: event.target.value }); }} placeholder="Ej. Alex" aria-invalid={fieldErrors.name ? "true" : "false"} aria-describedby={`checkoutNameHelp${fieldErrors.name ? " checkoutNameError" : ""}`} />
            <small id="checkoutNameHelp">Lo usamos para identificar tu pedido al entregarlo. Mínimo 2 caracteres.</small>
            {fieldErrors.name ? <span className="inline-error" id="checkoutNameError" role="alert">{fieldErrors.name}</span> : null}
          </label>
          <label className="field-label" htmlFor="checkoutPhone">
            <span>Teléfono <em>obligatorio</em></span>
            <input id="checkoutPhone" inputMode="numeric" autoComplete="tel" value={customer.phone} onChange={(event) => { clearFieldError("phone"); clearCheckoutError(); setCustomer({ ...customer, phone: formatPhoneForDisplay(event.target.value) }); }} placeholder="222 123 4567" aria-invalid={fieldErrors.phone ? "true" : "false"} aria-describedby={`checkoutPhoneHelp${fieldErrors.phone ? " checkoutPhoneError" : ""}`} />
            <small id="checkoutPhoneHelp">Escribe 10 dígitos. Ej. 2221234567.</small>
            {fieldErrors.phone ? <span className="inline-error" id="checkoutPhoneError" role="alert">{fieldErrors.phone}</span> : null}
          </label>
          <label className="field-label wide field-label-optional" htmlFor="checkoutNotes">
            <span>Nota general <em>opcional</em></span>
            <textarea id="checkoutNotes" maxLength={500} value={customer.notes} onChange={(event) => { clearFieldError("notes"); clearCheckoutError(); setCustomer({ ...customer, notes: event.target.value }); }} placeholder="Ej. Sin servilletas extra" aria-invalid={fieldErrors.notes ? "true" : "false"} aria-describedby={`checkoutNotesHelp${fieldErrors.notes ? " checkoutNotesError" : ""}`} />
            <small id="checkoutNotesHelp">Aplica para todo el pedido. Los cambios por burger van en personalización.</small>
            {fieldErrors.notes ? <span className="inline-error" id="checkoutNotesError" role="alert">{fieldErrors.notes}</span> : null}
          </label>
          <label className="field-label wide referral-code-field" htmlFor="checkoutReferralCode">
            <span>Código de referido <em>opcional</em></span>
            <input id="checkoutReferralCode" value={customer.referralCode} onChange={(event) => setCustomer({ ...customer, referralCode: event.target.value.toUpperCase() })} placeholder="CARLOS-BURGER-27" maxLength={32} aria-describedby="checkoutReferralHelp" />
            <small id="checkoutReferralHelp">Si alguien te compartió su código, escríbelo aquí. Puede sumar tickets o beneficios según la promo activa.</small>
          </label>
          <div className="builder-block location-block" id="checkoutLocation" tabIndex={-1} aria-describedby={`checkoutLocationHelp${fieldErrors.location ? " checkoutLocationError" : ""}`} aria-invalid={fieldErrors.location ? "true" : "false"}>
            <h4>Ubicación <em>obligatoria</em></h4>
            <p className="field-helper" id="checkoutLocationHelp">Selecciona dónde recogerás o recibirás tu pedido.</p>
            <div className="chip-grid location-chip-grid">{LOCATIONS.map((location) => <button type="button" key={location} className={customer.location === location ? "chip location-chip active" : "chip location-chip"} onClick={() => { clearFieldError("location"); clearCheckoutError(); setCustomer({ ...customer, location }); }} aria-pressed={customer.location === location}>{customer.location === location ? "✓ " : ""}{location}</button>)}</div>
            {fieldErrors.location ? <p className="inline-error" id="checkoutLocationError" role="alert">{fieldErrors.location}</p> : null}
          </div>
        </div>
        <QuestButton onClick={nextStep}>Continuar a pago</QuestButton>
      </section> : null}
      {checkoutStep === 2 ? <section className="checkout-step-panel" aria-labelledby="checkoutPaymentTitle">
        <div className="checkout-step-heading"><span>03</span><h3 id="checkoutPaymentTitle">Pago</h3></div>
        <div className="builder-block payment-block" id="checkoutPaymentMethod" tabIndex={-1}>
          <h4>Método de pago</h4>
          <div className="chip-grid payment-chip-grid">
            <button type="button" className={customer.paymentMethod === "unknown" ? "chip active" : "chip"} onClick={() => updatePaymentMethod("unknown")}>Confirmar por WhatsApp</button>
            <button type="button" className={customer.paymentMethod === "cash" ? "chip active" : "chip"} onClick={() => updatePaymentMethod("cash")}>Efectivo</button>
            <button type="button" className={customer.paymentMethod === "transfer" ? "chip active" : "chip"} onClick={() => updatePaymentMethod("transfer")}>Transferencia</button>
          </div>
          {customer.paymentMethod === "unknown" ? <p className="field-helper">No es un error: te confirmamos el método de pago por WhatsApp al recibir tu pedido.</p> : null}
          {fieldErrors.paymentMethod ? <p className="inline-error" id="checkoutPaymentMethodError" role="alert">{fieldErrors.paymentMethod}</p> : null}
          {customer.paymentMethod === "transfer" ? (
            <div className="payment-timing-panel" id="checkoutPaymentTiming" tabIndex={-1}>
              <h5>Momento de pago</h5>
              <div className="chip-grid payment-chip-grid">
                <button type="button" className={customer.paymentTiming === "before" ? "chip active" : "chip"} onClick={() => { clearFieldError("paymentTiming"); setCustomer({ ...customer, paymentTiming: "before" }); }} aria-pressed={customer.paymentTiming === "before"}>Pagar antes</button>
                <button type="button" className={customer.paymentTiming === "after" ? "chip active" : "chip"} onClick={() => { clearFieldError("paymentTiming"); setCustomer({ ...customer, paymentTiming: "after" }); }} aria-pressed={customer.paymentTiming === "after"}>Pagar después</button>
              </div>
              {fieldErrors.paymentTiming ? <p className="inline-error" id="checkoutPaymentTimingError" role="alert">{fieldErrors.paymentTiming}</p> : null}
              {customer.paymentTiming === "before" ? <QuestButton className="ghost transfer-details-button" onClick={() => setTransferModalOpen(true)}>Ver datos de transferencia</QuestButton> : null}
            </div>
          ) : null}
        </div>
        <div className="checkout-total"><span>Total</span><strong>{formatCurrency(total)}</strong></div>
        <QuestButton onClick={onSubmit} disabled={submitting || !cart.length}>{submitting ? "Enviando pedido..." : "Confirmar pedido"}</QuestButton>
        {error ? <p className="inline-error" role="alert">{error}</p> : null}
      </section> : null}
      {transferModalOpen ? <TransferDetailsModal onClose={() => setTransferModalOpen(false)} /> : null}
    </section>
  );
};

const ReferralShareModal = ({ code, raffleTitle, onClose }: { code: string; raffleTitle?: string; onClose: () => void }) => {
  const [status, setStatus] = useState<ShareActionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const link = useMemo(() => buildReferralPublicLink(code), [code]);
  const message = useMemo(() => buildReferralShareMessage(code, link), [code, link]);
  const shareData = useMemo(() => ({ title: raffleTitle ? `Burgers.exe · ${raffleTitle}` : "Burgers.exe", text: message, url: link }), [link, message, raffleTitle]);
  const showError = (text: string) => { setError(text); setStatus("error"); };

  const copyLink = async () => {
    try {
      await copyTextToClipboard(link);
      setError(null);
      setStatus("copiedLink");
    } catch {
      showError("No se pudo copiar el link automático. Puedes copiarlo manualmente desde aquí.");
    }
  };
  const copyMessage = async () => {
    try {
      await copyTextToClipboard(message);
      setError(null);
      setStatus("copiedMessage");
    } catch {
      showError("No se pudo copiar el mensaje automático. Puedes seleccionarlo y copiarlo manualmente.");
    }
  };
  const shareReferral = async () => {
    if (!navigator.share) {
      showError("Tu navegador no tiene share sheet nativo. Usa Copiar mensaje o Copiar link.");
      return;
    }
    try {
      await navigator.share(shareData);
      setError(null);
      setStatus("shared");
    } catch {
      showError("No se pudo abrir compartir. El link y mensaje siguen disponibles para copiar manualmente.");
    }
  };
  const downloadImage = async () => {
    try {
      await downloadReferralShareImage({ code, raffleTitle, link });
      setError(null);
      setStatus("downloaded");
    } catch {
      showError("No se pudo descargar la imagen en este navegador. Puedes copiar el mensaje o link.");
    }
  };

  return (
    <div className="referral-modal-backdrop" role="presentation">
      <section className="referral-modal" role="dialog" aria-modal="true" aria-labelledby="referral-share-title">
        <button type="button" className="referral-modal-close" onClick={onClose} aria-label="Cerrar modal de compartir">×</button>
        <span className="eyebrow">Compartir código</span>
        <h3 id="referral-share-title">Invita a tu crew</h3>
        {raffleTitle ? <p className="success-raffle-title">Sorteo: {raffleTitle}</p> : null}
        <strong className="referral-modal-code">{code}</strong>
        <p>{REFERRAL_SHARE_TEXT}</p>
        <label className="referral-manual-copy">Link de la página pública<textarea readOnly value={link} rows={2} /></label>
        <label className="referral-manual-copy">Mensaje<textarea readOnly value={message} rows={5} /></label>
        <div className="referral-modal-actions">
          <QuestButton className="ghost" onClick={copyLink}>Copiar link</QuestButton>
          <QuestButton className="ghost" onClick={copyMessage}>Copiar mensaje</QuestButton>
          <QuestButton className="ghost" onClick={shareReferral}>Compartir</QuestButton>
          <QuestButton onClick={downloadImage}>Descargar imagen</QuestButton>
        </div>
        {status === "copiedLink" ? <p className="success-copy-status">Link copiado.</p> : null}
        {status === "copiedMessage" ? <p className="success-copy-status">Mensaje copiado.</p> : null}
        {status === "shared" ? <p className="success-copy-status">Share sheet abierto.</p> : null}
        {status === "downloaded" ? <p className="success-copy-status">Imagen generada.</p> : null}
        {error ? <p className="success-copy-status error">{error}</p> : null}
      </section>
    </div>
  );
};

const Success = ({ order, campaign, onCreateAnother }: { order: OrderConfirmation; campaign: RaffleCampaignPublicV2 | null; onCreateAnother: () => void }) => {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const isPreviewMode = order.environment === "preview";
  const earnedTickets = order.earnedTickets;
  const hasEarnedTickets = (earnedTickets?.totalTickets ?? 0) > 0;
  const raffleTitle = order.activeRaffleTitle ?? campaign?.title;
  const referralRewardCopy = campaign ? `${ticketLabel(campaign.ticketPerReferral)} extra` : "tickets extra";
  const referralLeadCopy = hasEarnedTickets
    ? `Comparte este código. Si tu compa lo usa y ordena al menos 1 burger pagada, tú ganas ${referralRewardCopy}.`
    : "Este pedido no sumó tickets porque no incluye burger, pero puedes compartir tu código para ganar tickets cuando tus invitados pidan burger.";
  const copyReferralCode = async () => {
    if (!order.customerReferralCode) return;
    try {
      await copyTextToClipboard(order.customerReferralCode);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };

  return (
    <section className="quest-panel success-panel" aria-live="polite">
      <section className="success-operational-block" aria-labelledby="successOrderTitle">
        <span className="eyebrow">{isPreviewMode ? "Preview operativo" : "Confirmación operativa"}</span>
        <h2 id="successOrderTitle">{isPreviewMode ? "Pedido preview recibido" : "Pedido recibido"}</h2>
        <p className="muted section-subcopy">
          {isPreviewMode ? "Tu orden entró como prueba interna. No preparar." : "Tu orden ya entró a cocina."}
        </p>
        <div className="success-folio-card">
          <span>Folio</span>
          <strong>{order.folio}</strong>
        </div>
        <dl className="success-details">
          <div><dt>Total</dt><dd>{formatCurrency(order.total)}</dd></div>
          <div><dt>Ubicación</dt><dd>{order.location}</dd></div>
          <div><dt>Pago</dt><dd>{paymentMethodLabels[order.paymentMethod]}</dd></div>
          <div><dt>Estado</dt><dd>{statusLabels[order.status] ?? order.status}</dd></div>
          <div><dt>Tiempo estimado</dt><dd>15–25 min</dd></div>
        </dl>
        <p className="success-whatsapp">
          {isPreviewMode ? "Modo preview: este folio es solo para validar cambios." : "Te avisaremos por WhatsApp cuando tu pedido esté listo."}
        </p>
      </section>
      <section className="success-bonus-block" aria-labelledby="successBonusTitle">
        <span className="eyebrow">Bonus secundario</span>
        <h3 id="successBonusTitle">Tickets / referido</h3>
      {isPreviewMode ? <p className="success-note muted">Preview no genera tickets, referidos ni métricas reales.</p> : null}
      {!isPreviewMode && hasEarnedTickets && earnedTickets ? <article className="success-reward-card">
        <span className="eyebrow">Loot desbloqueado</span>
        <strong className="success-ticket-total">+{earnedTickets.totalTickets} tickets</strong>
        {raffleTitle ? <p className="success-raffle-title">Van para: {raffleTitle}</p> : null}
        <ul>
          <li>Burgers/combos de tu pedido: +{earnedTickets.burgerTickets}</li>
          {earnedTickets.referralUsedTickets > 0 ? <li>Código de invitado aplicado: +{earnedTickets.referralUsedTickets}</li> : null}
        </ul>
        {order.referralAccepted === true && earnedTickets.referralUsedTickets === 0 ? <p>Tu código invitado quedó aplicado. Los tickets de referido se asignan a quien te compartió el código.</p> : null}
      </article> : null}
      {!isPreviewMode && order.customerReferralCode ? <article className="success-referral-card">
        <span className="eyebrow">Power-up de invitado</span>
        <p className="success-referral-lead">{referralLeadCopy}</p>
        <strong className="success-referral-code">{order.customerReferralCode}</strong>
        {raffleTitle ? <p>Sorteo activo: {raffleTitle}</p> : null}
        <div className="success-referral-actions">
          <QuestButton className="ghost" onClick={copyReferralCode}>{copyStatus === "copied" ? "Código copiado ✅" : "Copiar código"}</QuestButton>
          <QuestButton onClick={() => setShareModalOpen(true)}>Compartir mi código</QuestButton>
        </div>
        {copyStatus === "idle" ? <p className="success-copy-status muted">Toca copiar y pégalo en WhatsApp, Discord o donde armen la raid.</p> : null}
        {copyStatus === "copied" ? <p className="success-copy-status">Copiado al portapapeles. GG.</p> : null}
        {copyStatus === "error" ? <p className="success-copy-status error">No se pudo copiar automático. Mantén presionado el código para copiarlo manualmente.</p> : null}
        {shareModalOpen ? <ReferralShareModal code={order.customerReferralCode} raffleTitle={raffleTitle} onClose={() => setShareModalOpen(false)} /> : null}
      </article> : null}
      {!isPreviewMode && order.referralAccepted === true && !earnedTickets ? <p className="success-note">Código de invitado aplicado.</p> : null}
      {!isPreviewMode && order.referralAccepted === false ? <p className="success-note muted">Pedido recibido. El código de invitado no aplicó.</p> : null}
        {!isPreviewMode && !hasEarnedTickets && !order.customerReferralCode ? <p className="success-note muted">Tickets y referido quedan como bonus secundario cuando el sistema los confirme.</p> : null}
      </section>
      <QuestButton onClick={onCreateAnother}>Nuevo pedido</QuestButton>
    </section>
  );
};

const PersistentCta = ({ section, count, total, disabled, submitting, onClick, builder, sideHasSelection, hasBurgerOrCombo }: { section: QuestSection; count: number; total: number; disabled?: boolean; submitting?: boolean; onClick: () => void; builder: BuilderDraft | null; sideHasSelection: boolean; hasBurgerOrCombo: boolean }) => {
  if (section === "success" || section === "checkout") return null;
  const label = section === "menu"
    ? count > 0
      ? "Continuar pedido"
      : "Armar mi pedido"
    : section === "burgers"
      ? "Continuar a personalizar"
      : section === "workbench"
        ? "Continuar"
        : section === "customize"
          ? "Todo bien, continuar"
          : section === "side" && hasBurgerOrCombo && !sideHasSelection
          ? "Continuar sin guarnición"
          : "Ir a checkout";
  const title = count > 0 ? "Ticket" : builder ? "En edición" : "Quest";
  const summary = count > 0 ? `${count} item${count === 1 ? "" : "s"} · ${formatCurrency(total)}` : builder ? builder.item.name : "Arma tu pedido";
  return <aside className="persistent-cta"><div><span>{title}</span><strong>{summary}</strong></div><QuestButton disabled={disabled || submitting} onClick={onClick}>{label}</QuestButton></aside>;
};

export function PublicOrderApp() {
  const reduce = useReducedMotion() ?? false;
  const submittingRef = useRef(false);
  const orderEnvironment = useMemo(resolvePublicOrderEnvironment, []);
  const isPreviewMode = orderEnvironment === "preview";
  const [section, setSection] = useState<QuestSection>("menu");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [builder, setBuilder] = useState<BuilderDraft | null>(null);
  const [comboBuilder, setComboBuilder] = useState<ComboBuilderDraft | null>(null);
  const [infoItem, setInfoItem] = useState<MenuItem | null>(null);
  const [sideQuestEntryMode, setSideQuestEntryMode] = useState<SideQuestEntryMode>("builder");
  const [sideQuestError, setSideQuestError] = useState<string | null>(null);
  const sectionRef = useRef<QuestSection>("menu");
  const infoItemRef = useRef<MenuItem | null>(null);
  const sideQuestEntryModeRef = useRef<SideQuestEntryMode>("builder");
  const builderRef = useRef<BuilderDraft | null>(null);
  const [extraGarnishQuantities, setExtraGarnishQuantities] = useState<Record<string, number>>({});
  const [menuData, setMenuData] = useState<MenuV2Response>(toFallbackMenuResponse("fallback"));
  const [raffleCampaign, setRaffleCampaign] = useState<RaffleCampaignPublicV2 | null>(null);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [showBoot, setShowBoot] = useState(true);
  const [customer, setCustomer] = useState<CustomerDraft>(() => createEmptyCustomer());
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutFieldErrors, setCheckoutFieldErrors] = useState<CheckoutErrors>({});
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStepIndex>(0);
  const [orderConfirmation, setOrderConfirmation] = useState<OrderConfirmation | null>(null);
  const [burgerSelectionError, setBurgerSelectionError] = useState<string | null>(null);
  const [cartCustomizationError, setCartCustomizationError] = useState<string | null>(null);
  const total = useMemo(() => getCartTotal(cart, menuData.items), [cart, menuData.items]);
  const count = getCartCount(cart);
  const availableBurgerItems = useMemo(() => menuData.items.filter((item) => inferItemKind(item) === "burger" && item.isAvailable), [menuData.items]);
  const availableComboItems = useMemo(() => menuData.items.filter((item) => inferItemKind(item) === "combo" && item.isAvailable), [menuData.items]);
  const extras = menuData.items.filter((item) => item.category === "extras" && inferItemKind(item) !== "combo" && item.isAvailable);
  const garnishes = menuData.items.filter((item) => item.category === "guarniciones" && item.isAvailable);
  const drinks = menuData.items.filter((item) => isDrinkItem(item) && item.isAvailable);
  const hasBurgerOrComboInCart = cart.some((entry) => entry.itemKind === "burger" || entry.itemKind === "combo");
  const sideHasSelection = Object.values(extraGarnishQuantities).some((quantity) => quantity > 0);
  const clearCheckoutErrorMessage = () => setCheckoutError(null);
  const clearCheckoutFieldError = (field: CheckoutField) => setCheckoutFieldErrors((prev) => {
    if (!prev[field]) return prev;
    const next = { ...prev };
    delete next[field];
    return next;
  });
  const focusCheckoutErrorsOnStep = (fields: CheckoutErrors, step: CheckoutStepIndex) => {
    setCheckoutStep(step);
    window.requestAnimationFrame(() => focusFirstCheckoutError(fields));
  };
  const blockCheckoutDataStep = (fields: CheckoutErrors) => {
    setCheckoutError(checkoutErrorOrder.map((field) => fields[field]).find(Boolean) ?? null);
    setCheckoutFieldErrors((current) => ({ ...current, ...fields }));
    focusCheckoutErrorsOnStep(fields, 1);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const codeFromUrl = (new URLSearchParams(window.location.search).get("ref") ?? "").trim().toUpperCase().slice(0, 32);
    if (!codeFromUrl) return;
    setCustomer((current) => current.referralCode ? current : { ...current, referralCode: codeFromUrl });
  }, []);

  useEffect(() => { sectionRef.current = section; }, [section]);
  useEffect(() => { infoItemRef.current = infoItem; }, [infoItem]);
  useEffect(() => { sideQuestEntryModeRef.current = sideQuestEntryMode; }, [sideQuestEntryMode]);
  useEffect(() => { builderRef.current = builder; }, [builder]);
  useEffect(() => { const frame = window.requestAnimationFrame(scrollToTop); return () => window.cancelAnimationFrame(frame); }, [section]);
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

  const navigate = useCallback((next: QuestSection, options: { replace?: boolean } = {}) => {
    setSection(next);
    if (typeof window === "undefined") return;
    const state = { burgersExePublicSection: next };
    const url = `${window.location.pathname}${window.location.search}#${next}`;
    if (options.replace) window.history.replaceState(state, "", url);
    else window.history.pushState(state, "", url);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.replaceState({ burgersExePublicSection: sectionRef.current }, "", `${window.location.pathname}${window.location.search}#${sectionRef.current}`);
    const onPopState = (event: PopStateEvent) => {
      const current = sectionRef.current;
      if (infoItemRef.current) {
        setInfoItem(null);
        window.history.pushState({ burgersExePublicSection: current }, "", `${window.location.pathname}${window.location.search}#${current}`);
        return;
      }
      const stateSection = (event.state as { burgersExePublicSection?: QuestSection } | null)?.burgersExePublicSection;
      if (stateSection) {
        setSection(stateSection);
        return;
      }
      if (current === "menu") return;
      const sideBackTarget: QuestSection = sideQuestEntryModeRef.current === "direct" ? "main" : "customize";
      const customizeBackTarget: QuestSection = builderRef.current ? "workbench" : "burgers";
      const fallback: QuestSection = current === "checkout" ? "side" : current === "side" ? sideBackTarget : current === "customize" ? customizeBackTarget : current === "combo-builder" ? "combos" : current === "burgers" || current === "combos" || current === "workbench" ? "main" : "menu";
      navigate(fallback, { replace: true });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [navigate]);
  const reindex = (entries: CartEntry[]) => {
    const seen = new Map<string, number>();
    return entries.map((entry) => { const next = (seen.get(entry.sku) ?? 0) + 1; seen.set(entry.sku, next); return { ...entry, itemDisplayIndex: next }; });
  };
  const beginQuest = () => { setComboBuilder(null); setBuilder(null); setBurgerSelectionError(null); setCartCustomizationError(null); setExtraGarnishQuantities({}); setSideQuestError(null); setSideQuestEntryMode("builder"); setCheckoutError(null); setOrderConfirmation(null); navigate("main"); };
  const startBurgerSelection = () => { setComboBuilder(null); setBuilder(null); setBurgerSelectionError(null); setCartCustomizationError(null); setSideQuestError(null); setSideQuestEntryMode("builder"); setCheckoutError(null); setOrderConfirmation(null); navigate("burgers"); };
  const startComboSelection = () => { setComboBuilder(null); setBuilder(null); setBurgerSelectionError(null); setCartCustomizationError(null); setSideQuestError(null); setSideQuestEntryMode("builder"); setCheckoutError(null); setOrderConfirmation(null); navigate("combos"); };
  const startDirectSideQuest = () => { setComboBuilder(null); setBuilder(null); setBurgerSelectionError(null); setCartCustomizationError(null); setExtraGarnishQuantities({}); setSideQuestError(null); setSideQuestEntryMode("direct"); navigate("side"); };
  const startComboBuilder = (combo: MenuItem) => {
    if (!combo.isAvailable || inferItemKind(combo) !== "combo") return;
    const burgerItems = getComboBurgerItems(combo, menuData.items);
    setBuilder(null);
    setComboBuilder({
      combo,
      burgers: burgerItems.map((item, index) => makeUnit(item, "burger", index + 1)),
      includedGarnish: null,
      includedDrink: null,
      sideExtras: [],
      error: null,
      confirmed: false,
    });
    setCheckoutError(null);
    setOrderConfirmation(null);
    navigate("combo-builder");
  };
  const startBuilder = (item: MenuItem, source?: CartEntry, nextSection: QuestSection = "workbench") => {
    if (!item.isAvailable) return;
    const itemKind = inferItemKind(item);
    if (itemKind === "combo" && !source) {
      startComboBuilder(item);
      return;
    }
    if (itemKind !== "burger" && itemKind !== "combo") return;
    setComboBuilder(null);
    setBuilder({ item, itemKind, quantity: 1, units: [makeUnit(item, itemKind, 1, source)], error: null, editLineKey: source?.lineKey });
    navigate(nextSection);
  };
  const updateComboBurger = (index: number, unit: CartEntry) => setComboBuilder((draft) => draft ? { ...draft, burgers: draft.burgers.map((entry, entryIndex) => entryIndex === index ? unit : entry), error: null } : draft);
  const chooseComboGarnish = (item: MenuItem) => setComboBuilder((draft) => draft ? { ...draft, includedGarnish: { sku: item.sku, name: item.name, upcharge: getIncludedGarnishUpcharge(item) }, error: null } : draft);
  const chooseComboDrink = (item: MenuItem) => setComboBuilder((draft) => draft ? { ...draft, includedDrink: { sku: item.sku, name: item.name, price: 0, source: "included-drink" }, error: null } : draft);
  const toggleComboSideExtra = (item: MenuItem) => setComboBuilder((draft) => draft ? { ...draft, sideExtras: toggleTicketExtra(draft.sideExtras, item, "side-extra"), error: null } : draft);
  const confirmComboBuilder = () => {
    if (!comboBuilder) return;
    const needsGarnish = comboIncludesKind(comboBuilder.combo, menuData.items, "garnish");
    const needsDrink = comboIncludesKind(comboBuilder.combo, menuData.items, "drink") && drinks.length > 0;
    if (!comboBuilder.burgers.length) { setComboBuilder({ ...comboBuilder, error: "Este combo requiere confirmar al menos una burger incluida." }); return; }
    if (needsGarnish && !comboBuilder.includedGarnish) { setComboBuilder({ ...comboBuilder, error: "Elige la guarnición incluida para confirmar tu combo." }); return; }
    if (needsDrink && !comboBuilder.includedDrink) { setComboBuilder({ ...comboBuilder, error: "Elige la bebida incluida para confirmar tu combo." }); return; }
    const burgerExtras = comboBuilder.burgers.flatMap((burger) => burger.extras.map((extra) => ({ ...extra, source: "burger" as const })));
    const comboEntry: CartEntry = {
      ...makeUnit(comboBuilder.combo, "combo", 1),
      garnish: comboBuilder.includedGarnish,
      includedDrink: comboBuilder.includedDrink,
      sideQuestExtras: comboBuilder.sideExtras,
      extras: burgerExtras,
      comboBurgers: comboBuilder.burgers.map((burger) => ({ sku: burger.sku, name: burger.name, removedIngredients: [...burger.removedIngredients], extras: [...burger.extras], burgerNote: burger.burgerNote })),
    };
    setCart((prev) => reindex([...prev, comboEntry]));
    setComboBuilder({ ...comboBuilder, confirmed: true, error: null });
    setCheckoutError(null);
    setOrderConfirmation(null);
  };
  const setBurgerQuantity = (item: MenuItem, quantity: number) => {
    if (!item.isAvailable || inferItemKind(item) !== "burger") return;
    const nextQuantity = Math.min(10, Math.max(0, quantity));
    setCart((prev) => {
      const current = prev.filter((entry) => entry.sku === item.sku && entry.itemKind === "burger");
      if (nextQuantity === current.length) return prev;
      if (nextQuantity < current.length) {
        const removeKeys = new Set(current.slice(nextQuantity).map((entry) => entry.lineKey));
        return reindex(prev.filter((entry) => !removeKeys.has(entry.lineKey)));
      }
      const additions = Array.from({ length: nextQuantity - current.length }, (_, index) => makeUnit(item, "burger", current.length + index + 1));
      return reindex([...prev, ...additions]);
    });
    setBurgerSelectionError(null);
    setCartCustomizationError(null);
    setCheckoutError(null);
    setOrderConfirmation(null);
  };
  const continueFromBurgerSelection = () => {
    if (!cart.some((entry) => entry.itemKind === "burger")) {
      setBurgerSelectionError("Agrega al menos 1 burger para continuar.");
      return;
    }
    setBuilder(null);
    setBurgerSelectionError(null);
    setCartCustomizationError(null);
    navigate("customize");
  };
  const updateCartUnit = (lineKey: string, unit: CartEntry) => {
    setCart((prev) => reindex(prev.map((entry) => entry.lineKey === lineKey ? { ...unit, lineKey } : entry)));
    setCartCustomizationError(null);
    setCheckoutError(null);
    setOrderConfirmation(null);
  };
  const continueCartCustomization = () => {
    if (!cart.some((entry) => entry.itemKind === "burger" || entry.itemKind === "combo")) {
      setCartCustomizationError("Agrega al menos una burger o combo para continuar.");
      return;
    }
    setSideQuestEntryMode("quickAdd");
    setSideQuestError(null);
    navigate("side");
  };
  const updateBuilderQuantity = (quantity: number) => setBuilder((draft) => draft ? { ...draft, quantity: Math.min(3, Math.max(1, quantity)) as 1 | 2 | 3, units: Array.from({ length: Math.min(3, Math.max(1, quantity)) }, (_, index) => makeUnit(draft.item, draft.itemKind, index + 1, draft.units[index])), error: null } : draft);
  const updateBuilderUnit = (index: number, unit: CartEntry) => setBuilder((draft) => draft ? { ...draft, units: draft.units.map((entry, entryIndex) => entryIndex === index ? unit : entry), error: null } : draft);
  const saveBuilderToCart = () => {
    if (!builder) return false;
    if (builder.itemKind === "combo" && builder.units.some((unit) => !unit.garnish)) {
      setBuilder({ ...builder, error: garnishes.length ? "El combo requiere elegir guarnición incluida." : "No hay guarniciones disponibles para confirmar este combo." });
      return false;
    }
    const units = builder.units.map((unit) => unit.itemKind === "burger" ? { ...unit, garnish: null } : unit);
    setCart((prev) => {
      const builderLineKeys = new Set(builder.units.map((unit) => unit.lineKey));
      const withoutEdited = builder.editLineKey
        ? prev.filter((entry) => entry.lineKey !== builder.editLineKey)
        : prev.filter((entry) => !builderLineKeys.has(entry.lineKey));
      return reindex([...withoutEdited, ...units]);
    });
    setCheckoutError(null);
    setOrderConfirmation(null);
    return true;
  };
  const confirmBuilder = () => {
    if (!saveBuilderToCart()) return false;
    if (builder?.editLineKey) { setBuilder(null); setCheckoutStep(0); navigate("checkout"); } else { setSideQuestEntryMode("builder"); setSideQuestError(null); navigate("side"); }
    return true;
  };
  const addSideQuestAndCheckout = () => {
    const selectedGarnishes = garnishes.flatMap((item) => Array.from({ length: extraGarnishQuantities[item.sku] ?? 0 }, () => item));
    const selectedDrinks = drinks.flatMap((item) => Array.from({ length: extraGarnishQuantities[item.sku] ?? 0 }, () => item));
    if (!selectedGarnishes.length && !selectedDrinks.length && !cart.length) {
      setSideQuestError("Agrega al menos una guarnición o vuelve a Main Quest para elegir burger o combo.");
      return;
    }
    setSideQuestError(null);
    if (selectedGarnishes.length || selectedDrinks.length) {
      setCart((prev) => reindex([...prev, ...selectedGarnishes.map((item, index) => makeUnit(item, "garnish", prev.filter((entry) => entry.sku === item.sku).length + index + 1)), ...selectedDrinks.map((item, index) => makeUnit(item, "drink", prev.filter((entry) => entry.sku === item.sku).length + index + 1))]));
    }
    setExtraGarnishQuantities({});
    setBuilder(null);
    setCheckoutStep(0);
    navigate("checkout");
  };
  const duplicateLine = (lineKey: string) => setCart((prev) => { const found = prev.find((entry) => entry.lineKey === lineKey); return found ? reindex([...prev, { ...found, lineKey: createId("line") }]) : prev; });
  const editLine = (lineKey: string) => {
    const found = cart.find((entry) => entry.lineKey === lineKey);
    const item = found ? menuData.items.find((menuItem) => menuItem.sku === found.sku) : null;
    if (found && item) startBuilder(item, found, "customize");
  };
  const removeLine = (lineKey: string) => setCart((prev) => {
    const next = reindex(prev.filter((entry) => entry.lineKey !== lineKey));
    if (!next.length) window.requestAnimationFrame(() => navigate("menu"));
    return next;
  });
  const handleCheckout = async () => {
    if (submittingRef.current) return;
    setCheckoutError(null);
    setCheckoutFieldErrors({});
    const validation = validateCheckout(customer, cart, menuData.items);
    if (validation.global) {
      const targetStep = checkoutStepForErrors(validation.fields);
      setCheckoutError(validation.global);
      setCheckoutFieldErrors(validation.fields);
      focusCheckoutErrorsOnStep(validation.fields, targetStep);
      return;
    }
    const payloadItems = cart.map((entry) => ({
      sku: entry.sku,
      name: entry.name,
      qty: 1,
      lineKey: entry.lineKey,
      itemDisplayIndex: entry.itemDisplayIndex,
      itemKind: entry.itemKind,
      removedIngredients: entry.removedIngredients,
      extras: entry.extras,
      burgerNote: entry.burgerNote?.trim() || undefined,
      garnish: entry.garnish ? { sku: entry.garnish.sku, name: entry.garnish.name, upcharge: entry.garnish.upcharge } : null,
      includedDrink: entry.includedDrink ? { sku: entry.includedDrink.sku, name: entry.includedDrink.name } : null,
      sideQuestExtras: (entry.sideQuestExtras ?? []).map((extra) => {
        const menuItem = extra.sku ? menuData.items.find((item) => item.sku === extra.sku) : null;
        const kind = menuItem ? inferItemKind(menuItem) : "other";
        return { sku: extra.sku, name: extra.name, price: extra.price, itemKind: kind === "drink" ? "drink" as const : "garnish" as const };
      }),
      comboBurgers: entry.comboBurgers ?? []
    }));
    const notes = buildCheckoutNotes(customer);
    const idempotencyKey = getDraftIdempotencyKey({ customer, items: cart });
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const referralCode = customer.referralCode.trim().toUpperCase();
      const response = await createOrderV2({ customer: { name: customer.name.trim(), phone: normalizePhoneDigits(customer.phone) }, orderMode: orderModeForBackend, paymentMethod: customer.paymentMethod, notes, items: payloadItems, ...(referralCode ? { referralCode } : {}), ...(isPreviewMode ? { environment: orderEnvironment } : {}) }, idempotencyKey);
      const order = response.data?.order;
      if (!order) throw new Error("El backend no devolvió folio de confirmación.");
      setOrderConfirmation({ ...order, paymentMethod: customer.paymentMethod, location: customer.location, environment: orderEnvironment, referralAccepted: response.data?.referralAccepted, customerReferralCode: response.data?.customerReferralCode, activeRaffleTitle: response.data?.activeRaffleTitle, earnedTickets: response.data?.earnedTickets });
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
  const handleCreateAnother = () => { setOrderConfirmation(null); setCheckoutError(null); setCheckoutFieldErrors({}); setCheckoutStep(0); setCart([]); setCustomer(createEmptyCustomer()); clearDraftIdempotencyKey(); setBuilder(null); setExtraGarnishQuantities({}); setSideQuestError(null); setSideQuestEntryMode("builder"); navigate("menu"); };
  const openInfoDialog = (item: MenuItem) => {
    setInfoItem(item);
    window.history.pushState({ burgersExePublicSection: sectionRef.current, modal: "menu-info" }, "", `${window.location.pathname}${window.location.search}#${sectionRef.current}-info`);
  };
  const chooseInfoDialogItemInFlow = (item: MenuItem) => {
    const itemKind = inferItemKind(item);
    if (itemKind === "burger") {
      startBurgerSelection();
      return;
    }
    if (itemKind === "combo") {
      startBuilder(item);
      return;
    }
    if (itemKind === "garnish") {
      startDirectSideQuest();
    }
  };
  const primaryDisabled = ((section === "workbench" || (section === "customize" && builder)) && !builder) || (section === "burgers" && !cart.some((entry) => entry.itemKind === "burger")) || (section === "checkout" && (submitting || !cart.length));
  const showPersistentCta = section !== "success" && section !== "checkout" && section !== "customize" && section !== "main" && section !== "combos" && section !== "combo-builder";
  const primaryAction = () => {
    if (section === "menu") beginQuest();
    else if (section === "burgers") continueFromBurgerSelection();
    else if (section === "workbench") navigate("customize");
    else if (section === "customize" && builder) confirmBuilder();
    else if (section === "side") addSideQuestAndCheckout();
    else if (section === "checkout") handleCheckout();
    else if (section === "success") handleCreateAnother();
  };

  return (
    <main className={`app-shell public-section-${section} ${showPersistentCta ? "has-persistent-cta" : ""}`}>
      <LoadingOverlay loading={showBoot || loadingMenu} />
      <AppHeader section={section} count={count} total={total} builder={builder} />
      {isPreviewMode ? <PublicPreviewBanner /> : null}
      {section === "menu" ? <MenuSection menuData={menuData} raffleCampaign={raffleCampaign} onExplore={openInfoDialog} onStart={beginQuest} reduce={reduce} /> : null}
      {section === "main" ? <MainQuest categoryBanners={menuData.categoryBanners} burgerItems={availableBurgerItems} comboItems={availableComboItems} garnishes={garnishes} onBack={() => navigate("menu")} onBurgers={startBurgerSelection} onCombos={startComboSelection} onSideQuest={startDirectSideQuest} /> : null}
      {section === "burgers" ? <BurgerSelectionView items={availableBurgerItems} cart={cart} error={burgerSelectionError} onBack={() => navigate("main")} onAdd={(item) => setBurgerQuantity(item, (cart.filter((entry) => entry.sku === item.sku && entry.itemKind === "burger").length) + 1)} onQuantity={setBurgerQuantity} reduce={reduce} /> : null}
      {section === "combos" ? <CombosSelectionView items={availableComboItems} allItems={menuData.items} onBack={() => navigate("main")} onBuild={startBuilder} reduce={reduce} /> : null}
      {section === "combo-builder" ? <ComboBuilder draft={comboBuilder} allItems={menuData.items} extras={extras} garnishes={garnishes} drinks={drinks} onBack={() => navigate("combos")} onBurgerChange={updateComboBurger} onGarnish={chooseComboGarnish} onDrink={chooseComboDrink} onSideExtraToggle={toggleComboSideExtra} onReview={confirmComboBuilder} onReturnToMain={() => { setComboBuilder(null); navigate("main"); }} onCheckout={() => { setComboBuilder(null); setCheckoutStep(0); navigate("checkout"); }} reduce={reduce} /> : null}
      {section === "workbench" ? <Workbench builder={builder} onBack={() => navigate("main")} onQuantity={updateBuilderQuantity} onContinue={() => navigate("customize")} /> : null}
      {section === "customize" ? (builder ? <CustomizationReview builder={builder} extras={extras} garnishes={garnishes} onBack={() => navigate("workbench")} onUnitChange={updateBuilderUnit} onContinue={confirmBuilder} /> : <CartCustomizationReview cart={cart} items={menuData.items} extras={extras} garnishes={garnishes} error={cartCustomizationError} onBack={() => navigate("burgers")} onUnitChange={updateCartUnit} onContinue={continueCartCustomization} />) : null}
      {section === "side" ? <SideQuest garnishes={garnishes} drinks={drinks} selected={extraGarnishQuantities} onQuantity={(sku, quantity) => { setSideQuestError(null); setExtraGarnishQuantities((prev) => ({ ...prev, [sku]: Math.min(10, Math.max(0, quantity)) })); }} onBack={() => navigate(sideQuestEntryMode === "direct" ? "main" : "customize")} canSkip={hasBurgerOrComboInCart} error={sideQuestError} reduce={reduce} entryMode={sideQuestEntryMode} /> : null}
      {section === "checkout" && cart.length ? <Checkout cart={cart} items={menuData.items} total={total} customer={customer} setCustomer={setCustomer} checkoutStep={checkoutStep} setCheckoutStep={setCheckoutStep} onDataStepBlocked={blockCheckoutDataStep} onBack={() => navigate("side") } onSubmit={handleCheckout} submitting={submitting} error={checkoutError} fieldErrors={checkoutFieldErrors} clearFieldError={clearCheckoutFieldError} clearCheckoutError={clearCheckoutErrorMessage} onEdit={editLine} onDuplicate={duplicateLine} onRemove={removeLine} /> : null}
      {section === "success" && orderConfirmation ? <Success order={orderConfirmation} campaign={raffleCampaign} onCreateAnother={handleCreateAnother} /> : null}
      <MenuInfoDialog item={infoItem} onClose={() => setInfoItem(null)} onChooseInFlow={chooseInfoDialogItemInFlow} />
      {showPersistentCta ? <PersistentCta section={section} count={count} total={total} disabled={primaryDisabled} submitting={submitting} onClick={primaryAction} builder={builder} sideHasSelection={sideHasSelection} hasBurgerOrCombo={hasBurgerOrComboInCart} /> : null}
    </main>
  );
}
