import {
  type CreateOrderV2Response,
  type MenuCategory,
  type MenuItem,
  type MenuV2Response,
  type OrderV2Mode,
  type OrderV2PaymentMethod,
} from "@config/index";
import { Button, EmptyState } from "@ui/index";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadMenuV2, toMockResponse } from "../lib/menu-v2";
import {
  CartEntry,
  TicketItemKind,
  formatCurrency,
  getCartCount,
  getCartTotal,
} from "../lib/order";
import { createOrderV2 } from "../lib/orders-v2";

type WindowMode = "MENU" | "ORDER" | "CHECKOUT";
type GuidedStep = "type" | "product" | "edit" | "garnishes";
type OrderChoice = "burger" | "combo";
type CustomerDraft = {
  name: string;
  phone: string;
  notes: string;
  location: "" | "Torre GGA" | "Torre Valcob";
  paymentMethod: OrderV2PaymentMethod;
};
type BuilderDraft = {
  item: MenuItem;
  itemKind: TicketItemKind;
  quantity: 1 | 2 | 3;
  units: CartEntry[];
  error: string | null;
  editLineKey?: string;
};
type OrderConfirmation = NonNullable<CreateOrderV2Response["data"]>["order"] & {
  paymentMethod: OrderV2PaymentMethod;
  location: CustomerDraft["location"];
};
type DraftSnapshot = { customer: CustomerDraft; items: CartEntry[] };

const IDEMPOTENCY_KEY_STORAGE = "burgers-v2-order-draft-idempotency-key";
const IDEMPOTENCY_DRAFT_STORAGE =
  "burgers-v2-order-draft-idempotency-fingerprint";
const PAYMENT_METHODS = new Set<OrderV2PaymentMethod>([
  "cash",
  "transfer",
  "card",
  "unknown",
]);
const LOCATIONS = ["Torre GGA", "Torre Valcob"] as const;
const REQUIRED_MENU: Array<{ key: MenuCategory["key"]; label: string }> = [
  { key: "burgers", label: "Hamburguesas" },
  { key: "extras", label: "Combos" },
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
  location: "",
  paymentMethod: "unknown",
});
const normalizePhoneDigits = (phone: string) => phone.replace(/\D/g, "");
const orderModeForBackend: OrderV2Mode = "pickup";

const createId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createDraftFingerprint = (snapshot: DraftSnapshot) =>
  JSON.stringify({
    customer: {
      name: snapshot.customer.name.trim(),
      phone: normalizePhoneDigits(snapshot.customer.phone),
      notes: snapshot.customer.notes.trim(),
      location: snapshot.customer.location,
      paymentMethod: snapshot.customer.paymentMethod,
    },
    items: snapshot.items.map(
      ({
        lineKey,
        sku,
        itemDisplayIndex,
        itemKind,
        removedIngredients,
        extras,
        burgerNote,
        garnish,
      }) => ({
        lineKey,
        sku,
        itemDisplayIndex,
        itemKind,
        removedIngredients,
        extras,
        burgerNote,
        garnish,
      }),
    ),
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

const resolveAssetUrl = (
  imageUrl?: string,
  imageKey?: string,
): string | undefined => {
  const trimmedUrl = imageUrl?.trim();
  if (
    trimmedUrl &&
    ((trimmedUrl.startsWith("/") && !trimmedUrl.startsWith("//")) ||
      trimmedUrl.startsWith("https://"))
  )
    return trimmedUrl;
  const trimmedKey = imageKey?.trim();
  if (!trimmedKey) return undefined;
  return `/api/assets-v2/${trimmedKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
};

const inferItemKind = (item: MenuItem): TicketItemKind => {
  const seed =
    `${item.category} ${item.name} ${item.tags.join(" ")}`.toLowerCase();
  if (seed.includes("combo")) return "combo";
  if (item.category === "burgers") return "burger";
  if (item.category === "guarniciones") return "garnish";
  if (item.category === "drinks") return "drink";
  return "other";
};

const inferIngredients = (item: MenuItem) => {
  const stop = new Set([
    "burger",
    "burgers",
    "smash",
    "signature",
    "spicy",
    "combo",
    "hot",
    "best seller",
  ]);
  return item.description
    .replace(/[.]/g, "")
    .split(/,|\+| y | con /i)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part.length > 2 &&
        !/\bpan\b/i.test(part) &&
        !stop.has(part.toLowerCase()),
    );
};

const makeUnit = (
  item: MenuItem,
  itemKind: TicketItemKind,
  index: number,
  source?: Partial<CartEntry>,
): CartEntry => ({
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

const isPrimaryBuilderItem = (item: MenuItem) => {
  const kind = inferItemKind(item);
  return kind === "burger" || kind === "combo";
};

const validateCheckout = (
  customer: CustomerDraft,
  cart: CartEntry[],
  items: MenuItem[],
) => {
  if (cart.length === 0) return "Agrega al menos un producto al ticket.";
  if (customer.name.trim().length < 2)
    return "Escribe tu nombre con al menos 2 caracteres.";
  if (normalizePhoneDigits(customer.phone).length < 10)
    return "Escribe un teléfono válido con al menos 10 dígitos.";
  if (!customer.location) return "Elige Torre GGA o Torre Valcob.";
  if (
    !PAYMENT_METHODS.has(customer.paymentMethod) ||
    customer.paymentMethod === "unknown"
  )
    return "Elige un método de pago.";
  if (customer.notes.trim().length > 500)
    return "La nota general no puede superar 500 caracteres.";
  const unavailable = cart.find(
    (entry) =>
      !items.find((item) => item.sku === entry.sku && item.isAvailable),
  );
  if (unavailable)
    return "Uno de los productos ya no está disponible. Actualiza el ticket antes de enviar.";
  return null;
};

const TerminalButton = ({
  children,
  className = "",
  ...props
}: React.ComponentProps<typeof Button>) => (
  <Button {...props} className={`terminal-button ${className}`}>
    {children}
  </Button>
);

const LoadingOverlay = ({ loading }: { loading: boolean }) =>
  loading ? (
    <div className="boot-overlay" role="status" aria-live="polite">
      <div className="boot-window">
        <p className="terminal-path">Menú oficial</p>
        <h1>Burgers.exe</h1>
        <p className="boot-status">Preparando tu experiencia...</p>
        <div className="boot-bar">
          <span />
        </div>
      </div>
    </div>
  ) : null;

const AppChrome = ({
  current,
  count,
  total,
  onNavigate,
}: {
  current: WindowMode;
  count: number;
  total: number;
  onNavigate: (mode: WindowMode) => void;
}) => (
  <header className="terminal-window terminal-hero">
    <p className="terminal-path">Burgers.exe · Menú oficial</p>
    <div className="hero-grid">
      <div>
        <p className="status-line">Dark kitchen · gamer premium</p>
        <h1>Burgers.exe</h1>
        <p className="hero-copy">
          Elige tu burger, personaliza cada unidad y confirma tu ticket en
          minutos.
        </p>
      </div>
      <div className="ticket-chip">
        <span>Ticket actual</span>
        <strong>
          {count} item{count === 1 ? "" : "s"}
        </strong>
        <em>{formatCurrency(total)}</em>
      </div>
    </div>
    <nav className="window-tabs" aria-label="Flujo del pedido">
      <button
        type="button"
        className={current === "MENU" ? "active" : ""}
        onClick={() => onNavigate("MENU")}
      >
        Menú
      </button>
      <button
        type="button"
        className={current === "CHECKOUT" ? "active" : ""}
        onClick={() => onNavigate("CHECKOUT")}
        disabled={!count}
      >
        Checkout
      </button>
    </nav>
  </header>
);

const MenuCard = ({
  item,
  onExplore,
  reduce,
}: {
  item: MenuItem;
  onExplore: (item: MenuItem) => void;
  reduce: boolean;
}) => {
  const src = resolveAssetUrl(item.imageUrl, item.imageKey);
  const kind = inferItemKind(item);
  return (
    <motion.article
      whileTap={reduce ? undefined : { scale: 0.98 }}
      className="menu-card"
      role="button"
      tabIndex={0}
      onClick={() => onExplore(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onExplore(item);
        }
      }}
      aria-label={`Ver información de ${item.name}`}
    >
      <div className="menu-visual">
        {src ? (
          <img
            src={src}
            alt={item.name}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span>{item.name}</span>
        )}
      </div>
      <div className="menu-card-body">
        <p className="status-line">
          {kind === "combo" ? "Combo" : item.category}
        </p>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <div className="card-footer">
          <strong>{formatCurrency(item.price)}</strong>
          <span className={item.isAvailable ? "availability-pill" : "availability-pill off"}>
            {item.isAvailable ? "Disponible" : "Agotado"}
          </span>
        </div>
      </div>
    </motion.article>
  );
};

const MenuWindow = ({
  categories,
  items,
  onExplore,
  reduce,
}: {
  categories: MenuV2Response["categories"];
  items: MenuItem[];
  onExplore: (item: MenuItem) => void;
  reduce: boolean;
}) => {
  const comboItems = items.filter((item) => inferItemKind(item) === "combo");
  const byKey = (key: MenuCategory["key"]) =>
    items.filter((item) => item.category === key && key !== "extras");
  const hasCategory = (key: MenuCategory["key"]) =>
    categories.some((category) => category.key === key);
  return (
    <section className="terminal-window flow-window" id="menu">
      <div className="section-title">
        <span>Menú → Ordenar → Checkout</span>
        <h2>Menú</h2>
        <p>
          Explora el catálogo visual. Las cards solo muestran información; presiona Ordenar para iniciar el flujo guiado.
        </p>
      </div>
      {REQUIRED_MENU.map(({ key, label }) => {
        const list = key === "extras" ? comboItems : byKey(key);
        if (!hasCategory(key) && key !== "extras") return null;
        return (
          <div className="menu-category" id={`menu-${key}`} key={key}>
            <h3>{label}</h3>
            {list.length > 0 ? (
              <div className="menu-grid">
                {list.map((item) => (
                  <MenuCard
                    key={item.sku}
                    item={item}
                    onExplore={onExplore}
                    reduce={reduce}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title={`${label}: sin productos configurados`}
                description="El catálogo real no expone productos disponibles para esta sección."
              />
            )}
          </div>
        );
      })}
    </section>
  );
};

const QuantitySelector = ({
  value,
  onChange,
}: {
  value: 1 | 2 | 3;
  onChange: (qty: 1 | 2 | 3) => void;
}) => (
  <div className="quantity-selector">
    <div
      className="quantity-modes"
      role="group"
      aria-label="Cantidad de hamburguesas"
    >
      {(
        [
          { qty: 1, label: "1 hamburguesa" },
          { qty: 2, label: "2 hamburguesas" },
          { qty: 3, label: "3 hamburguesas" },
        ] as const
      ).map((option) => (
        <button
          key={option.qty}
          type="button"
          className={`q${option.qty} ${value === option.qty ? "active" : ""}`}
          onClick={() => onChange(option.qty)}
        >
          {option.label}
        </button>
      ))}
    </div>
    <p className="quantity-help">
      No cambia el tamaño ni la carne; solo la cantidad.
    </p>
  </div>
);


const getBurgerQuantityCopy = (quantity: 1 | 2 | 3) => {
  if (quantity === 1) return "Vas a pedir 1 hamburguesa editable.";
  if (quantity === 2)
    return "Vas a pedir 2 hamburguesas. Cada una se puede editar por separado.";
  return "Vas a pedir 3 hamburguesas. Cada una se puede editar por separado.";
};

const UnitEditor = ({
  unit,
  index,
  item,
  extras,
  garnishes,
  onChange,
}: {
  unit: CartEntry;
  index: number;
  item: MenuItem;
  extras: MenuItem[];
  garnishes: MenuItem[];
  onChange: (unit: CartEntry) => void;
}) => {
  const ingredients = inferIngredients(item);
  const isBurgerLike = unit.itemKind === "burger" || unit.itemKind === "combo";
  return (
    <article className="unit-editor">
      <div className="unit-header">
        <h3>
          {unit.name} #{index + 1}
        </h3>
        <span>{unit.itemKind === "combo" ? "Combo" : "Burger"}</span>
      </div>
      {isBurgerLike ? (
        <p className="locked-pan">Pan incluido · no editable</p>
      ) : null}
      {isBurgerLike ? (
        <div className="builder-block">
          <h4>Quitar ingredientes</h4>
          {ingredients.length > 0 ? (
            <div className="chip-grid">
              {ingredients.map((ingredient) => {
                const active = unit.removedIngredients.includes(ingredient);
                return (
                  <button
                    type="button"
                    key={ingredient}
                    className={active ? "chip active" : "chip"}
                    onClick={() =>
                      onChange({
                        ...unit,
                        removedIngredients: active
                          ? unit.removedIngredients.filter(
                              (entry) => entry !== ingredient,
                            )
                          : [...unit.removedIngredients, ingredient],
                      })
                    }
                  >
                    {active ? "SIN " : ""}
                    {ingredient}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="empty-line">
              Sin ingredientes editables configurados para esta burger.
            </p>
          )}
        </div>
      ) : null}
      {isBurgerLike ? (
        <div className="builder-block">
          <h4>Extras por burger</h4>
          {extras.length > 0 ? (
            <>
              <div className="chip-grid">
                {extras.map((extra) => {
                  const active = unit.extras.some(
                    (entry) => entry.sku === extra.sku,
                  );
                  return (
                    <button
                      type="button"
                      key={extra.sku}
                      className={active ? "chip active" : "chip"}
                      onClick={() =>
                        onChange({
                          ...unit,
                          extras: active
                            ? unit.extras.filter(
                                (entry) => entry.sku !== extra.sku,
                              )
                            : [
                                ...unit.extras,
                                {
                                  sku: extra.sku,
                                  name: extra.name,
                                  price: extra.price,
                                },
                              ],
                        })
                      }
                    >
                      {extra.name}
                    </button>
                  );
                })}
              </div>
              <p className="empty-line">
                Los extras se guardan para cocina; el total confirmado se
                calcula desde catálogo.
              </p>
            </>
          ) : (
            <p className="empty-line">Sin extras configurados.</p>
          )}
        </div>
      ) : null}
      {unit.itemKind === "combo" ? (
        <div className="builder-block">
          <h4>Guarnición obligatoria</h4>
          {garnishes.length > 0 ? (
            <div className="chip-grid">
              {garnishes.map((garnish) => (
                <button
                  type="button"
                  key={garnish.sku}
                  className={
                    unit.garnish?.sku === garnish.sku ? "chip active" : "chip"
                  }
                  onClick={() =>
                    onChange({
                      ...unit,
                      garnish: { sku: garnish.sku, name: garnish.name },
                    })
                  }
                >
                  {garnish.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-line error">
              No hay guarniciones configuradas en el catálogo real.
            </p>
          )}
        </div>
      ) : null}
      {isBurgerLike ? (
        <label className="terminal-label">
          Nota por burger opcional
          <textarea
            maxLength={220}
            value={unit.burgerNote ?? ""}
            onChange={(event) =>
              onChange({ ...unit, burgerNote: event.target.value })
            }
            placeholder="Ej. bien cocida"
          />
        </label>
      ) : null}
    </article>
  );
};

const BuilderDialog = ({
  draft,
  extras,
  garnishes,
  total,
  count,
  onQuantity,
  onUnitChange,
  onConfirm,
  onCancel,
  onCheckout,
}: {
  draft: BuilderDraft | null;
  extras: MenuItem[];
  garnishes: MenuItem[];
  total: number;
  count: number;
  onQuantity: (qty: 1 | 2 | 3) => void;
  onUnitChange: (index: number, unit: CartEntry) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onCheckout: () => void;
}) => {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = "order-builder-title";
  const quantityCopy = draft ? getBurgerQuantityCopy(draft.quantity) : "";
  const builderTotal = draft ? draft.units.length * draft.item.price : 0;

  useEffect(() => {
    if (!draft) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [draft?.item.sku, draft?.editLineKey]);

  if (!draft) return null;

  return (
    <div className="order-dialog-backdrop" role="presentation">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="order-drawer"
        role="dialog"
      >
        <header className="order-drawer-header">
          <div>
            <p className="status-line">
              {draft.itemKind === "combo"
                ? "Combo con guarnición obligatoria"
                : "Burger personalizada"}
            </p>
            <h2 id={titleId}>{draft.item.name}</h2>
            <p className="muted">{draft.item.description}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="drawer-close"
            aria-label="Cerrar panel de ordenar"
            onClick={onCancel}
          >
            Cerrar
          </button>
        </header>
        <div className="order-drawer-body">
          <div className="builder-intro">
            <span>Ordenar</span>
            <p>{quantityCopy}</p>
            {!draft.editLineKey ? (
              <QuantitySelector value={draft.quantity} onChange={onQuantity} />
            ) : (
              <p className="empty-line">
                Editando una unidad existente del ticket.
              </p>
            )}
          </div>
          <div className="unit-stack">
            {draft.units.map((unit, index) => (
              <UnitEditor
                key={unit.lineKey}
                unit={unit}
                index={index}
                item={draft.item}
                extras={extras}
                garnishes={garnishes}
                onChange={(next) => onUnitChange(index, next)}
              />
            ))}
          </div>
          {draft.error ? (
            <p className="inline-error" role="alert">
              {draft.error}
            </p>
          ) : null}
        </div>
        <footer className="order-drawer-footer">
          <div>
            <span>{quantityCopy}</span>
            <strong>{formatCurrency(builderTotal)}</strong>
          </div>
          <p className="drawer-total-note">
            Extras guardados para cocina; total confirmado desde catálogo.
          </p>
          <div className="drawer-footer-actions">
            {count > 0 ? (
              <TerminalButton className="secondary" onClick={onCheckout}>
                Ver ticket · {formatCurrency(total)}
              </TerminalButton>
            ) : null}
            <TerminalButton onClick={onConfirm}>
              Confirmar al ticket
            </TerminalButton>
          </div>
        </footer>
      </section>
    </div>
  );
};


const MenuInfoDialog = ({
  item,
  onClose,
}: {
  item: MenuItem | null;
  onClose: () => void;
}) => {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = "menu-info-title";
  const src = item ? resolveAssetUrl(item.imageUrl, item.imageKey) : undefined;

  useEffect(() => {
    if (!item) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [item?.sku, onClose]);

  if (!item) return null;

  return (
    <div className="order-dialog-backdrop info-backdrop" role="presentation">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="info-dialog"
        role="dialog"
      >
        {src ? (
          <img
            src={src}
            alt={item.name}
            className="info-dialog-image"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        <div className="info-dialog-body">
          <p className="status-line">Vista de menú</p>
          <h2 id={titleId}>{item.name}</h2>
          <p className="muted">{item.description}</p>
          <div className="info-dialog-meta">
            <strong>{formatCurrency(item.price)}</strong>
            <span className={item.isAvailable ? "availability-pill" : "availability-pill off"}>
              {item.isAvailable ? "Disponible" : "Agotado"}
            </span>
          </div>
          <button ref={closeRef} type="button" className="terminal-button" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </section>
    </div>
  );
};

const GuidedOrderWindow = ({
  step,
  orderChoice,
  items,
  builder,
  extras,
  garnishes,
  extraGarnishSkus,
  onChoice,
  onProduct,
  onQuantity,
  onUnitChange,
  onToggleExtraGarnish,
  onSkipGarnishes,
  onBack,
}: {
  step: GuidedStep;
  orderChoice: OrderChoice | null;
  items: MenuItem[];
  builder: BuilderDraft | null;
  extras: MenuItem[];
  garnishes: MenuItem[];
  extraGarnishSkus: string[];
  onChoice: (choice: OrderChoice) => void;
  onProduct: (item: MenuItem) => void;
  onQuantity: (qty: 1 | 2 | 3) => void;
  onUnitChange: (index: number, unit: CartEntry) => void;
  onToggleExtraGarnish: (sku: string) => void;
  onSkipGarnishes: () => void;
  onBack: () => void;
}) => {
  const title =
    step === "type"
      ? "¿Qué quieres ordenar?"
      : step === "product"
        ? orderChoice === "combo"
          ? "Escoge tu combo"
          : "Escoge tu hamburguesa"
        : step === "edit"
          ? "Edita cada unidad"
          : "Guarniciones opcionales";
  const filteredItems = items.filter((item) => {
    const kind = inferItemKind(item);
    if (orderChoice === "burger") return kind === "burger" && item.isAvailable;
    if (orderChoice === "combo") return kind === "combo" && item.isAvailable;
    return false;
  });
  const quantityCopy = builder
    ? getBurgerQuantityCopy(builder.quantity)
    : "Selecciona un producto para editar unidades.";

  return (
    <section className="terminal-window flow-window guided-flow" id="order-flow">
      <div className="guided-flow-heading">
        <TerminalButton className="secondary guided-back" onClick={onBack}>
          Regresar
        </TerminalButton>
        <div className="section-title">
          <span>Ordenar · flujo guiado</span>
          <h2>{title}</h2>
          <p>
            Primero eliges el tipo y producto; después eliges cuántas hamburguesas
            quieres, editas cada una por separado, agregas guarniciones y pasas a
            checkout.
          </p>
        </div>
      </div>

      {step === "type" ? (
        <div className="choice-grid" role="group" aria-label="¿Qué quieres ordenar?">
          <button
            type="button"
            className={orderChoice === "burger" ? "choice-card active" : "choice-card"}
            onClick={() => onChoice("burger")}
          >
            <span>Hamburguesa</span>
            <strong>Burger personalizada</strong>
            <em>Pan fijo, ingredientes editables, extras por burger.</em>
          </button>
          <button
            type="button"
            className={orderChoice === "combo" ? "choice-card active" : "choice-card"}
            onClick={() => onChoice("combo")}
          >
            <span>Combo</span>
            <strong>Combo con guarnición incluida</strong>
            <em>Debe elegir guarnición incluida por cada combo.</em>
          </button>
        </div>
      ) : null}

      {step === "product" ? (
        <div className="product-pick-grid">
          {filteredItems.length ? (
            filteredItems.map((item) => {
              const src = resolveAssetUrl(item.imageUrl, item.imageKey);
              return (
                <button
                  type="button"
                  key={item.sku}
                  className={builder?.item.sku === item.sku ? "product-pick active" : "product-pick"}
                  onClick={() => onProduct(item)}
                >
                  {src ? <img src={src} alt="" loading="lazy" /> : null}
                  <span>{item.name}</span>
                  <strong>{formatCurrency(item.price)}</strong>
                </button>
              );
            })
          ) : (
            <EmptyState
              title="Sin productos disponibles"
              description="El catálogo real no tiene productos disponibles para esta elección."
            />
          )}
        </div>
      ) : null}

      {step === "edit" && builder ? (
        <div className="builder-layout">
          <div className="builder-intro">
            <span>{builder.itemKind === "combo" ? "Combo" : "Hamburguesa"}</span>
            <p>{quantityCopy}</p>
            {!builder.editLineKey ? <QuantitySelector value={builder.quantity} onChange={onQuantity} /> : null}
          </div>
          <div className="unit-stack">
            {builder.units.map((unit, index) => (
              <UnitEditor
                key={unit.lineKey}
                unit={unit}
                index={index}
                item={builder.item}
                extras={extras}
                garnishes={garnishes}
                onChange={(next) => onUnitChange(index, next)}
              />
            ))}
          </div>
          {builder.error ? <p className="inline-error" role="alert">{builder.error}</p> : null}
        </div>
      ) : null}

      {step === "garnishes" ? (
        <div className="garnish-step">
          <p className="muted">
            Guarniciones extra opcionales: se agregan como línea separada con itemKind="garnish" y precio propio.
          </p>
          <TerminalButton className="secondary" onClick={onSkipGarnishes}>
            No quiero guarnición · Saltar guarniciones
          </TerminalButton>
          {garnishes.length ? (
            <div className="product-pick-grid">
              {garnishes.map((item) => {
                const active = extraGarnishSkus.includes(item.sku);
                const src = resolveAssetUrl(item.imageUrl, item.imageKey);
                return (
                  <button
                    type="button"
                    key={item.sku}
                    className={active ? "product-pick active" : "product-pick"}
                    onClick={() => onToggleExtraGarnish(item.sku)}
                  >
                    {src ? <img src={src} alt="" loading="lazy" /> : null}
                    <span>{item.name}</span>
                    <strong>{formatCurrency(item.price)}</strong>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="Sin guarniciones reales"
              description="No se inventan guarniciones; solo se usan las configuradas en catálogo."
            />
          )}
        </div>
      ) : null}
    </section>
  );
};

const PersistentOrderCta = ({
  label,
  detail,
  disabled,
  onClick,
}: {
  label: string;
  detail: string;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <aside className="persistent-cta" aria-label="Acción principal">
    <div>
      <span>Siguiente paso</span>
      <strong>{detail}</strong>
    </div>
    <TerminalButton disabled={disabled} onClick={onClick}>
      {label}
    </TerminalButton>
  </aside>
);

const TicketList = ({
  cart,
  items,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  cart: CartEntry[];
  items: MenuItem[];
  onEdit: (lineKey: string) => void;
  onDuplicate: (lineKey: string) => void;
  onRemove: (lineKey: string) => void;
}) => (
  <div className="ticket-list">
    {cart.length === 0 ? (
      <EmptyState
        title="Ticket vacío"
        description="Agrega productos desde Menú."
      />
    ) : (
      cart.map((entry) => {
        const price = items.find((item) => item.sku === entry.sku)?.price ?? 0;
        return (
          <article className="ticket-item" key={entry.lineKey}>
            <div className="ticket-main">
              <h3>
                {entry.name} #{entry.itemDisplayIndex}
              </h3>
              <strong>{formatCurrency(price)} c/u</strong>
            </div>
            <ul>
              {entry.removedIngredients.map((ingredient) => (
                <li key={ingredient}>Sin {ingredient}</li>
              ))}
              {entry.extras.map((extra) => (
                <li key={extra.sku ?? extra.name}>Extra {extra.name}</li>
              ))}
              {entry.garnish ? <li>Guarnición: {entry.garnish.name}</li> : null}
              {entry.burgerNote ? <li>Nota: {entry.burgerNote}</li> : null}
              {!entry.removedIngredients.length &&
              !entry.extras.length &&
              !entry.garnish &&
              !entry.burgerNote ? (
                <li>Unidad separada · precio unitario</li>
              ) : null}
            </ul>
            <div className="ticket-actions">
              {entry.itemKind === "burger" || entry.itemKind === "combo" ? (
                <button type="button" onClick={() => onEdit(entry.lineKey)}>
                  Editar
                </button>
              ) : null}
              <button type="button" onClick={() => onDuplicate(entry.lineKey)}>
                Duplicar
              </button>
              <button type="button" onClick={() => onRemove(entry.lineKey)}>
                Eliminar
              </button>
            </div>
          </article>
        );
      })
    )}
  </div>
);

const CheckoutWindow = ({
  cart,
  items,
  total,
  customer,
  setCustomer,
  onSubmit,
  submitting,
  error,
  confirmation,
  onEdit,
  onDuplicate,
  onRemove,
  onMenu,
  onCreateAnother,
}: {
  cart: CartEntry[];
  items: MenuItem[];
  total: number;
  customer: CustomerDraft;
  setCustomer: (v: CustomerDraft) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
  confirmation: OrderConfirmation | null;
  onEdit: (lineKey: string) => void;
  onDuplicate: (lineKey: string) => void;
  onRemove: (lineKey: string) => void;
  onMenu: () => void;
  onCreateAnother: () => void;
}) => {
  const customerReady =
    customer.name.trim().length >= 2 &&
    normalizePhoneDigits(customer.phone).length >= 10;
  const locationReady =
    Boolean(customer.location) && customer.paymentMethod !== "unknown";
  return (
    <section className="terminal-window flow-window">
      <div className="section-title">
        <span>Checkout</span>
        <h2>Confirmar pedido</h2>
        <p>Revisa ticket, datos, ubicación y pago antes de confirmar.</p>
      </div>
      <div className="checkout-grid">
        <div className="checkout-step">
          <span>1 · Ticket</span>
          <TicketList
            cart={cart}
            items={items}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
          />
          <TerminalButton className="secondary" onClick={onMenu}>
            Volver al menú
          </TerminalButton>
        </div>
        <div className={cart.length ? "checkout-step" : "checkout-step locked"}>
          <span>2 · Datos</span>
          <label className="terminal-label">
            Nombre
            <input
              value={customer.name}
              onChange={(event) =>
                setCustomer({ ...customer, name: event.target.value })
              }
              placeholder="Tu nombre"
            />
          </label>
          <label className="terminal-label">
            Teléfono
            <input
              inputMode="tel"
              value={customer.phone}
              onChange={(event) =>
                setCustomer({ ...customer, phone: event.target.value })
              }
              placeholder="55 0000 0000"
            />
          </label>
          <label className="terminal-label">
            Nota general opcional
            <textarea
              maxLength={500}
              value={customer.notes}
              onChange={(event) =>
                setCustomer({ ...customer, notes: event.target.value })
              }
              placeholder="Nota general del pedido"
            />
          </label>
        </div>
        <div
          className={customerReady ? "checkout-step" : "checkout-step locked"}
        >
          <span>3 · Ubicación y pago</span>
          <div className="chip-grid">
            {LOCATIONS.map((location) => (
              <button
                type="button"
                key={location}
                className={
                  customer.location === location ? "chip active" : "chip"
                }
                onClick={() => setCustomer({ ...customer, location })}
              >
                {location}
              </button>
            ))}
          </div>
          <label className="terminal-label">
            Pago
            <select
              value={customer.paymentMethod}
              onChange={(event) =>
                setCustomer({
                  ...customer,
                  paymentMethod: event.target.value as OrderV2PaymentMethod,
                })
              }
            >
              <option value="unknown">Seleccionar</option>
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="card">Tarjeta</option>
            </select>
          </label>
        </div>
        <div
          className={
            locationReady
              ? "checkout-step confirm"
              : "checkout-step locked confirm"
          }
        >
          <span>4 · Confirmar</span>
          <p className="total-line">Total {formatCurrency(total)}</p>
          <p className="muted">
            Confirmamos precios desde el catálogo. No se realiza ningún cobro en
            línea.
          </p>
          <TerminalButton
            onClick={onSubmit}
            disabled={submitting || !cart.length}
          >
            {" "}
            {submitting ? "Enviando pedido..." : "Confirmar pedido"}
          </TerminalButton>
          {error ? (
            <p className="inline-error" role="alert">
              {error}
            </p>
          ) : null}
          {confirmation ? (
            <OrderSuccess
              order={confirmation}
              onCreateAnother={onCreateAnother}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
};

const OrderSuccess = ({
  order,
  onCreateAnother,
}: {
  order: OrderConfirmation;
  onCreateAnother: () => void;
}) => (
  <section className="success-box" aria-live="polite">
    <h3>Pedido recibido</h3>
    <p>
      Folio: <strong>{order.folio}</strong>
    </p>
    <p>Estado: {statusLabels[order.status] ?? order.status}</p>
    <p>
      Total confirmado: {formatCurrency(order.total)} {order.currency}
    </p>
    <p>Pago: {paymentMethodLabels[order.paymentMethod]}</p>
    <p>Ubicación: {order.location}</p>
    <TerminalButton onClick={onCreateAnother}>Nuevo pedido</TerminalButton>
  </section>
);

const FloatingCart = ({
  count,
  total,
  onCheckout,
}: {
  count: number;
  total: number;
  onCheckout: () => void;
}) =>
  count > 0 ? (
    <aside className="floating-cart" aria-label="Ticket flotante">
      <div>
        <span>Ticket</span>
        <strong>
          {count} item{count === 1 ? "" : "s"} · {formatCurrency(total)}
        </strong>
      </div>
      <TerminalButton onClick={onCheckout}>Checkout</TerminalButton>
    </aside>
  ) : null;

const TrustSection = () => (
  <section className="terminal-window trust-grid">
    <article>
      <h3>Catálogo real</h3>
      <p>
        Productos, precios y disponibilidad se confirman desde la fuente
        operativa.
      </p>
    </article>
    <article>
      <h3>Torres disponibles</h3>
      <p>Ubicación operativa limitada a Torre GGA y Torre Valcob.</p>
    </article>
    <article>
      <h3>Pago al confirmar</h3>
      <p>Confirmación sin cobro en línea ni automatización de mensajes.</p>
    </article>
  </section>
);

export function PublicOrderApp() {
  const reduce = useReducedMotion() ?? false;
  const submittingRef = useRef(false);
  const [windowMode, setWindowMode] = useState<WindowMode>("MENU");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [builder, setBuilder] = useState<BuilderDraft | null>(null);
  const [guidedStep, setGuidedStep] = useState<GuidedStep>("type");
  const [orderChoice, setOrderChoice] = useState<OrderChoice | null>(null);
  const [infoItem, setInfoItem] = useState<MenuItem | null>(null);
  const [extraGarnishSkus, setExtraGarnishSkus] = useState<string[]>([]);
  const [menuData, setMenuData] = useState<MenuV2Response>(
    toMockResponse("fallback"),
  );
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [showBoot, setShowBoot] = useState(true);
  const [customer, setCustomer] = useState<CustomerDraft>(() =>
    createEmptyCustomer(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderConfirmation, setOrderConfirmation] =
    useState<OrderConfirmation | null>(null);
  const total = useMemo(
    () => getCartTotal(cart, menuData.items),
    [cart, menuData.items],
  );
  const count = getCartCount(cart);
  const extras = menuData.items.filter(
    (item) =>
      item.category === "extras" &&
      inferItemKind(item) !== "combo" &&
      item.isAvailable,
  );
  const garnishes = menuData.items.filter(
    (item) => item.category === "guarniciones" && item.isAvailable,
  );

  useEffect(() => {
    let mounted = true;
    const bootTimer = window.setTimeout(
      () => mounted && setShowBoot(false),
      reduce ? 250 : 1100,
    );
    loadMenuV2().then((payload) => {
      if (!mounted) return;
      setMenuData(payload);
      setLoadingMenu(false);
      window.setTimeout(() => mounted && setShowBoot(false), reduce ? 0 : 250);
    });
    return () => {
      mounted = false;
      window.clearTimeout(bootTimer);
    };
  }, [reduce]);

  const reindex = (entries: CartEntry[]) => {
    const seen = new Map<string, number>();
    return entries.map((entry) => {
      const next = (seen.get(entry.sku) ?? 0) + 1;
      seen.set(entry.sku, next);
      return { ...entry, itemDisplayIndex: next };
    });
  };

  const startBuilder = (item: MenuItem, source?: CartEntry) => {
    if (!item.isAvailable) return;
    const itemKind = inferItemKind(item);
    if (itemKind !== "burger" && itemKind !== "combo") return;
    setOrderChoice(itemKind === "combo" ? "combo" : "burger");
    setBuilder({
      item,
      itemKind,
      quantity: 1,
      units: [makeUnit(item, itemKind, 1, source)],
      error: null,
      editLineKey: source?.lineKey,
    });
    setGuidedStep(source ? "edit" : "edit");
    setWindowMode("ORDER");
  };

  const updateBuilderQuantity = (quantity: 1 | 2 | 3) => {
    setBuilder((draft) => {
      if (!draft) return draft;
      const units = Array.from({ length: quantity }, (_, index) =>
        makeUnit(draft.item, draft.itemKind, index + 1, draft.units[index]),
      );
      return { ...draft, quantity, units, error: null };
    });
  };

  const updateBuilderUnit = (index: number, unit: CartEntry) =>
    setBuilder((draft) =>
      draft
        ? {
            ...draft,
            units: draft.units.map((entry, entryIndex) =>
              entryIndex === index ? unit : entry,
            ),
            error: null,
          }
        : draft,
    );

  const confirmBuilder = () => {
    if (!builder) return;
    if (
      builder.itemKind === "combo" &&
      builder.units.some((unit) => !unit.garnish)
    ) {
      setBuilder({
        ...builder,
        error: garnishes.length
          ? "El combo requiere elegir guarnición."
          : "No hay guarniciones configuradas para confirmar este combo.",
      });
      return;
    }
    const units = builder.units.map((unit) =>
      unit.itemKind === "burger" ? { ...unit, garnish: null } : unit,
    );
    setCart((prev) => {
      const withoutEdited = builder.editLineKey
        ? prev.filter((entry) => entry.lineKey !== builder.editLineKey)
        : prev;
      return reindex([...withoutEdited, ...units]);
    });
    setBuilder(builder.editLineKey ? null : { ...builder, error: null });
    setCheckoutError(null);
    setOrderConfirmation(null);
    if (builder.editLineKey) {
      setWindowMode("CHECKOUT");
    } else {
      setGuidedStep("garnishes");
      setWindowMode("ORDER");
    }
  };

  const beginGuidedOrder = () => {
    setBuilder(null);
    setOrderChoice(null);
    setExtraGarnishSkus([]);
    setCheckoutError(null);
    setOrderConfirmation(null);
    setGuidedStep("type");
    setWindowMode("ORDER");
  };

  const continueGuidedOrder = () => {
    if (guidedStep === "type") {
      if (!orderChoice) return;
      setGuidedStep("product");
      return;
    }
    if (guidedStep === "product") {
      if (!builder) return;
      setGuidedStep("edit");
      return;
    }
    if (guidedStep === "edit") {
      confirmBuilder();
      return;
    }
    if (guidedStep === "garnishes") {
      const selectedGarnishes = garnishes.filter((item) =>
        extraGarnishSkus.includes(item.sku),
      );
      if (selectedGarnishes.length) {
        setCart((prev) =>
          reindex([
            ...prev,
            ...selectedGarnishes.map((item, index) =>
              makeUnit(
                item,
                "garnish",
                prev.filter((entry) => entry.sku === item.sku).length + index + 1,
              ),
            ),
          ]),
        );
      }
      setExtraGarnishSkus([]);
      setBuilder(null);
      setWindowMode("CHECKOUT");
    }
  };

  const goBackGuidedOrder = () => {
    if (guidedStep === "type") {
      setWindowMode("MENU");
      return;
    }
    if (guidedStep === "product") {
      setBuilder(null);
      setGuidedStep("type");
      return;
    }
    if (guidedStep === "edit") {
      setBuilder(null);
      setGuidedStep("product");
      return;
    }
    if (guidedStep === "garnishes") {
      setExtraGarnishSkus([]);
      setCart((prev) =>
        builder
          ? reindex(
              prev.filter(
                (entry) =>
                  !builder.units.some((unit) => unit.lineKey === entry.lineKey),
              ),
            )
          : prev,
      );
      setGuidedStep("edit");
    }
  };

  const toggleExtraGarnish = (sku: string) =>
    setExtraGarnishSkus((prev) =>
      prev.includes(sku) ? prev.filter((entry) => entry !== sku) : [...prev, sku],
    );

  const duplicateLine = (lineKey: string) => {
    setCart((prev) => {
      const found = prev.find((entry) => entry.lineKey === lineKey);
      if (!found) return prev;
      return reindex([...prev, { ...found, lineKey: createId("line") }]);
    });
  };

  const editLine = (lineKey: string) => {
    const found = cart.find((entry) => entry.lineKey === lineKey);
    const item = found
      ? menuData.items.find((menuItem) => menuItem.sku === found.sku)
      : null;
    if (found && item) startBuilder(item, found);
  };

  const removeLine = (lineKey: string) =>
    setCart((prev) =>
      reindex(prev.filter((entry) => entry.lineKey !== lineKey)),
    );

  const handleCheckout = async () => {
    if (submittingRef.current) return;
    setCheckoutError(null);
    setOrderConfirmation(null);
    const validationError = validateCheckout(customer, cart, menuData.items);
    if (validationError) {
      setCheckoutError(validationError);
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
      garnish: entry.garnish ?? null,
    }));
    const notes = [`Ubicación: ${customer.location}`, customer.notes.trim()]
      .filter(Boolean)
      .join("\n");
    const idempotencyKey = getDraftIdempotencyKey({ customer, items: cart });
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const response = await createOrderV2(
        {
          customer: {
            name: customer.name.trim(),
            phone: normalizePhoneDigits(customer.phone),
          },
          orderMode: orderModeForBackend,
          paymentMethod: customer.paymentMethod,
          notes,
          items: payloadItems,
        },
        idempotencyKey,
      );
      const order = response.data?.order;
      if (!order)
        throw new Error("El backend no devolvió folio de confirmación.");
      setOrderConfirmation({
        ...order,
        paymentMethod: customer.paymentMethod,
        location: customer.location,
      });
      setCart([]);
      setCustomer(createEmptyCustomer());
      clearDraftIdempotencyKey();
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "No se pudo enviar el pedido. Intenta de nuevo.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleCreateAnother = () => {
    setOrderConfirmation(null);
    setCheckoutError(null);
    setCart([]);
    setCustomer(createEmptyCustomer());
    clearDraftIdempotencyKey();
    setWindowMode("MENU");
  };

  const primaryLabel =
    windowMode === "MENU"
      ? "Ordenar"
      : windowMode === "CHECKOUT"
        ? "Confirmar pedido"
        : guidedStep === "garnishes"
          ? "Ir a checkout"
          : "Continuar";
  const primaryDetail =
    windowMode === "MENU"
      ? "Abrir flujo guiado"
      : windowMode === "CHECKOUT"
        ? `Ticket · ${formatCurrency(total)}`
        : guidedStep === "type"
          ? "Elige Hamburguesa o Combo"
          : guidedStep === "product"
            ? "Escoge producto disponible"
            : guidedStep === "edit"
              ? "Edita unidades separadas"
              : "Guarniciones extra opcionales";
  const primaryDisabled =
    (windowMode === "ORDER" && guidedStep === "type" && !orderChoice) ||
    (windowMode === "ORDER" && guidedStep === "product" && !builder) ||
    (windowMode === "CHECKOUT" && (submitting || !cart.length));
  const handlePrimaryAction = () => {
    if (windowMode === "MENU") {
      beginGuidedOrder();
      return;
    }
    if (windowMode === "ORDER") {
      continueGuidedOrder();
      return;
    }
    handleCheckout();
  };

  return (
    <main className="app-shell">
      <LoadingOverlay loading={showBoot || loadingMenu} />
      <AppChrome
        current={windowMode}
        count={count}
        total={total}
        onNavigate={setWindowMode}
      />
      {windowMode === "MENU" ? (
        <MenuWindow
          categories={menuData.categories}
          items={menuData.items}
          onExplore={setInfoItem}
          reduce={reduce}
        />
      ) : null}
      {windowMode === "ORDER" ? (
        <GuidedOrderWindow
          step={guidedStep}
          orderChoice={orderChoice}
          items={menuData.items}
          builder={builder}
          extras={extras}
          garnishes={garnishes}
          extraGarnishSkus={extraGarnishSkus}
          onChoice={(choice) => {
            setOrderChoice(choice);
            setBuilder(null);
          }}
          onProduct={(item) => {
            if (!item.isAvailable) return;
            const itemKind = inferItemKind(item);
            if (itemKind !== "burger" && itemKind !== "combo") return;
            setBuilder({
              item,
              itemKind,
              quantity: 1,
              units: [makeUnit(item, itemKind, 1)],
              error: null,
            });
          }}
          onQuantity={updateBuilderQuantity}
          onUnitChange={updateBuilderUnit}
          onToggleExtraGarnish={toggleExtraGarnish}
          onSkipGarnishes={() => {
            setExtraGarnishSkus([]);
            setBuilder(null);
            setWindowMode("CHECKOUT");
          }}
          onBack={goBackGuidedOrder}
        />
      ) : null}
      <MenuInfoDialog item={infoItem} onClose={() => setInfoItem(null)} />
      {windowMode === "CHECKOUT" ? (
        <CheckoutWindow
          cart={cart}
          items={menuData.items}
          total={total}
          customer={customer}
          setCustomer={setCustomer}
          onSubmit={handleCheckout}
          submitting={submitting}
          error={checkoutError}
          confirmation={orderConfirmation}
          onEdit={editLine}
          onDuplicate={duplicateLine}
          onRemove={removeLine}
          onMenu={() => setWindowMode("MENU")}
          onCreateAnother={handleCreateAnother}
        />
      ) : null}
      <TrustSection />
      <PersistentOrderCta
        label={primaryLabel}
        detail={primaryDetail}
        disabled={primaryDisabled}
        onClick={handlePrimaryAction}
      />
    </main>
  );
}
