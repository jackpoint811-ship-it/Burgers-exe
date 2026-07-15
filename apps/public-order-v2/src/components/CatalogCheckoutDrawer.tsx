import { useEffect, useId, useMemo, useRef, useState, type MouseEvent, type FormEvent } from "react";
import type { OrderV2PaymentMethod, OrderV2ItemKind } from "@config/index";
import { getPublicOrderEnvironment, DEFAULT_CATALOG_SETTINGS } from "@config/index";
import { formatCurrency } from "../lib/order";
import { useCatalogCart } from "./CatalogCartContext";
import { createOrderV2 } from "../lib/orders-v2";
import { motion, useReducedMotion } from "framer-motion";
import type { CatalogProductType } from "../lib/catalog-mode";

/** Map catalog product types to backend OrderV2ItemKind values. */
const catalogTypeToItemKind: Record<CatalogProductType, OrderV2ItemKind> = {
  burger: "burger",
  combo: "combo",
  side: "garnish",
  topping: "other",
  drink: "drink",
};

type CatalogCheckoutDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

const getMexicoCityTime = () => {
  const options = { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: false } as const;
  const timeString = new Intl.DateTimeFormat("es-MX", options).format(new Date());
  return timeString; // e.g. "10:30"
};

const isSameDayOrderingOpen = () => {
  const current = getMexicoCityTime();
  const start = DEFAULT_CATALOG_SETTINGS.orderWindow.startTime;
  const end = DEFAULT_CATALOG_SETTINGS.orderWindow.endTime;
  return current >= start && current <= end;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const normalizePhoneDigits = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("52")) {
    return digits.slice(2);
  }
  return digits;
};

type CheckoutState = {
  status: "idle" | "submitting" | "success" | "error";
  error?: string;
  folio?: string;
};

/** Generate a fresh idempotency key. */
const generateIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `catalog-${Date.now()}-${Math.random()}`;

export function CatalogCheckoutDrawer({ isOpen, onClose }: CatalogCheckoutDrawerProps) {
  const { items, total, clear } = useCatalogCart();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const orderEnvironment = useMemo(getPublicOrderEnvironment, []);
  const isPreviewMode = orderEnvironment === "preview";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<OrderV2PaymentMethod>("unknown");
  const [location, setLocation] = useState<"" | "Torre GGA" | "Torre Valcob">("");
  const [wantsWhatsappGroup, setWantsWhatsappGroup] = useState(true);
  const [notes, setNotes] = useState("");
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ status: "idle" });
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    location?: string;
    deliveryDate?: string;
  }>({});

  const successHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const isSameDayOpen = isSameDayOrderingOpen();
  const futureDates = useMemo(() => {
    const dates = [];
    const now = new Date();
    for (let i = 1; i <= 3; i++) {
      const future = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const yyyy = future.getFullYear();
      const mm = String(future.getMonth() + 1).padStart(2, "0");
      const dd = String(future.getDate()).padStart(2, "0");

      const labelOptions = { timeZone: "America/Mexico_City", weekday: "long", day: "numeric", month: "long" } as const;
      const label = new Intl.DateTimeFormat("es-MX", labelOptions).format(future);

      dates.push({
        value: `${yyyy}-${mm}-${dd}`,
        label: label.charAt(0).toUpperCase() + label.slice(1),
      });
    }
    return dates;
  }, []);

  const [deliveryDate, setDeliveryDate] = useState<string>(isSameDayOpen ? "Hoy" : (futureDates[0]?.value || ""));

  const shouldReduceMotion = useReducedMotion();

  // Stable idempotency key: regenerated only when cart or customer data changes.
  const idempotencyKeyRef = useRef(generateIdempotencyKey());
  const prevSnapshotRef = useRef("");

  // Regenerate key when cart contents or customer info changes.
  const currentSnapshot = JSON.stringify({ items: items.map(i => `${i.productId}:${i.qty}`), name, phone, paymentMethod, location, wantsWhatsappGroup, notes, deliveryDate });
  if (currentSnapshot !== prevSnapshotRef.current) {
    prevSnapshotRef.current = currentSnapshot;
    idempotencyKeyRef.current = generateIdempotencyKey();
  }

  useEffect(() => {
    if (!isOpen) {
      // Reset state when closed
      setCheckoutState({ status: "idle" });
      setName("");
      setPhone("");
      setPaymentMethod("unknown");
      setLocation("");
      setWantsWhatsappGroup(true);
      setNotes("");
      setDeliveryDate(isSameDayOpen ? "Hoy" : (futureDates[0]?.value || ""));
      setErrors({});
      return;
    }

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []
      );
      if (!focusableElements.length) { event.preventDefault(); return; }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (checkoutState.status === "success") {
      successHeadingRef.current?.focus();
    }
  }, [checkoutState.status]);

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const validateForm = () => {
    const newErrors: {
      name?: string;
      phone?: string;
      location?: string;
      deliveryDate?: string;
    } = {};

    if (!name.trim()) {
      newErrors.name = "Por favor, ingresa tu nombre.";
    }

    const normalizedPhone = normalizePhoneDigits(phone);
    if (!phone.trim()) {
      newErrors.phone = "Por favor, ingresa tu teléfono.";
    } else if (normalizedPhone.length !== 10) {
      newErrors.phone = "El teléfono debe tener exactamente 10 dígitos.";
    }

    if (!location) {
      newErrors.location = "Por favor, elige tu ubicación de entrega.";
    }

    if (!deliveryDate) {
      newErrors.deliveryDate = "Por favor, elige una fecha de entrega.";
    }

    setErrors(newErrors);
    return newErrors;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      const firstErrorMessage = Object.values(validationErrors)[0];
      setCheckoutState({ status: "error", error: firstErrorMessage });
      setTimeout(() => {
        if (validationErrors.name) {
          dialogRef.current?.querySelector<HTMLInputElement>("#checkout-name")?.focus();
        } else if (validationErrors.phone) {
          dialogRef.current?.querySelector<HTMLInputElement>("#checkout-phone")?.focus();
        } else if (validationErrors.deliveryDate) {
          dialogRef.current?.querySelector<HTMLButtonElement>(".catalog-checkout-chips--dates button")?.focus();
        } else if (validationErrors.location) {
          dialogRef.current?.querySelector<HTMLButtonElement>("#location-label + .catalog-checkout-chips button")?.focus();
        }
      }, 0);
      return;
    }

    setCheckoutState({ status: "submitting" });

    try {
      const normalizedPhone = normalizePhoneDigits(phone);
      const payloadItems = items.map((item) => ({
        sku: item.productId,
        qty: item.qty,
        itemKind: catalogTypeToItemKind[item.type] ?? ("other" as OrderV2ItemKind),
        name: item.name,
      }));

      const formattedNotes = `Ubicación: ${location} | Fecha: ${deliveryDate}${notes.trim() ? ` | Notas: ${notes.trim()}` : ""}`;

      const response = await createOrderV2({
        customer: { name: name.trim(), phone: normalizedPhone },
        orderMode: "pickup",
        paymentMethod,
        notes: formattedNotes,
        items: payloadItems,
        ...(isPreviewMode ? { environment: orderEnvironment } : {}),
      }, idempotencyKeyRef.current);

      const order = response.data?.order;
      if (!order) {
        throw new Error(response.error?.message || "El backend no devolvió folio de confirmación.");
      }

      setCheckoutState({ status: "success", folio: order.folio });
      // Regenerate key so next order gets a fresh one.
      idempotencyKeyRef.current = generateIdempotencyKey();
      clear();
    } catch (error) {
      setCheckoutState({ 
        status: "error", 
        error: error instanceof Error ? error.message : "No se pudo enviar el pedido. Intenta de nuevo." 
      });
    }
  };

  return (
    <motion.div
      className="catalog-drawer-backdrop"
      role="presentation"
      onClick={handleBackdropClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.section
        ref={dialogRef as any}
        className="catalog-drawer catalog-checkout-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={shouldReduceMotion ? { opacity: 0 } : { y: "100%" }}
        animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
      >
        <header className="catalog-drawer__header catalog-cart-drawer__header">
          <h2
            ref={successHeadingRef}
            tabIndex={-1}
            id={titleId}
            className="catalog-cart-drawer__title focus:outline-none"
          >
            {checkoutState.status === "success" ? "Pedido recibido" : "Checkout"}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="catalog-drawer__close"
            onClick={onClose}
            aria-label="Cerrar checkout"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        {checkoutState.status === "success" ? (
          <div className="catalog-checkout-success">
            <p className="catalog-checkout-success__subcopy">Tu orden ha entrado a preparación.</p>
            <div className="catalog-checkout-success__folio-card">
              <span>Folio</span>
              <strong>{checkoutState.folio}</strong>
            </div>
            <p className="catalog-checkout-success__whatsapp-note">
               Te contactaremos por WhatsApp cualquier cosa.
            </p>
            {wantsWhatsappGroup && (
              <div className="catalog-checkout-success__whatsapp-group">
                <p className="catalog-checkout-success__group-desc">Únete a nuestro grupo oficial de WhatsApp para enterarte de dinámicas y novedades:</p>
                <a
                  href="https://chat.whatsapp.com/GycE5zALOypGPvJVaMfbPp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="catalog-checkout-success__whatsapp-btn"
                >
                  Unirme al Grupo de WhatsApp
                </a>
              </div>
            )}
            <button type="button" className="catalog-checkout__submit" onClick={onClose}>
              Cerrar y explorar menú
            </button>
          </div>
        ) : (
          <form className="catalog-checkout-form" onSubmit={handleSubmit} noValidate>
            <div className="catalog-checkout-form__fields">
              <label className="catalog-checkout-field">
                <span>Nombre</span>
                <input
                  id="checkout-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
                    if (checkoutState.status === "error") setCheckoutState({ status: "idle" });
                  }}
                  placeholder="Tu nombre"
                  className={`glass-input ${errors.name ? "error" : ""}`}
                  required
                  disabled={checkoutState.status === "submitting"}
                  aria-invalid={errors.name ? "true" : "false"}
                  aria-describedby={errors.name ? "name-error" : undefined}
                />
                {errors.name && (
                  <span id="name-error" className="catalog-checkout-error-inline" role="alert">
                    ⚠️ {errors.name}
                  </span>
                )}
              </label>
              
              <label className="catalog-checkout-field">
                <span>Teléfono (WhatsApp)</span>
                <input
                  id="checkout-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (errors.phone) setErrors(prev => ({ ...prev, phone: undefined }));
                    if (checkoutState.status === "error") setCheckoutState({ status: "idle" });
                  }}
                  placeholder="10 dígitos"
                  className={`glass-input ${errors.phone ? "error" : ""}`}
                  required
                  disabled={checkoutState.status === "submitting"}
                  aria-invalid={errors.phone ? "true" : "false"}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                />
                {errors.phone && (
                  <span id="phone-error" className="catalog-checkout-error-inline" role="alert">
                    ⚠️ {errors.phone}
                  </span>
                )}
              </label>

              <div className="catalog-checkout-field">
                <span id="date-label">Fecha de entrega</span>
                <div
                  className="catalog-checkout-chips catalog-checkout-chips--dates"
                  role="radiogroup"
                  aria-labelledby="date-label"
                  aria-invalid={errors.deliveryDate ? "true" : "false"}
                  aria-describedby={errors.deliveryDate ? "date-error" : undefined}
                >
                  {isSameDayOpen ? (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={deliveryDate === "Hoy"}
                      className={`catalog-checkout-chip ${deliveryDate === "Hoy" ? "active" : ""} ${errors.deliveryDate ? "error" : ""}`}
                      onClick={() => {
                        setDeliveryDate("Hoy");
                        if (errors.deliveryDate) setErrors(prev => ({ ...prev, deliveryDate: undefined }));
                        if (checkoutState.status === "error") setCheckoutState({ status: "idle" });
                      }}
                      disabled={checkoutState.status === "submitting"}
                    >
                      Hoy (Llega: 1:30 PM a 2:00 PM)
                    </button>
                  ) : (
                    <div className="catalog-checkout-closed-notice">
                      <span>Pedidos para el mismo día cerrados (Cierre: 11:33 AM). ¡Ordena para mañana!</span>
                    </div>
                  )}
                  {futureDates.map((date) => (
                    <button
                      type="button"
                      key={date.value}
                      role="radio"
                      aria-checked={deliveryDate === date.value}
                      className={`catalog-checkout-chip ${deliveryDate === date.value ? "active" : ""} ${errors.deliveryDate ? "error" : ""}`}
                      onClick={() => {
                        setDeliveryDate(date.value);
                        if (errors.deliveryDate) setErrors(prev => ({ ...prev, deliveryDate: undefined }));
                        if (checkoutState.status === "error") setCheckoutState({ status: "idle" });
                      }}
                      disabled={checkoutState.status === "submitting"}
                    >
                      {date.label} (1:30 PM)
                    </button>
                  ))}
                </div>
                {errors.deliveryDate && (
                  <span id="date-error" className="catalog-checkout-error-inline" role="alert">
                    ⚠️ {errors.deliveryDate}
                  </span>
                )}
              </div>

              <div className="catalog-checkout-field">
                <span id="location-label">Ubicación (Entrega)</span>
                <div
                  className="catalog-checkout-chips"
                  role="radiogroup"
                  aria-labelledby="location-label"
                  aria-invalid={errors.location ? "true" : "false"}
                  aria-describedby={errors.location ? "location-error" : undefined}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={location === "Torre GGA"}
                    className={`catalog-checkout-chip ${location === "Torre GGA" ? "active" : ""} ${errors.location ? "error" : ""}`}
                    onClick={() => {
                      setLocation("Torre GGA");
                      if (errors.location) setErrors(prev => ({ ...prev, location: undefined }));
                      if (checkoutState.status === "error") setCheckoutState({ status: "idle" });
                    }}
                    disabled={checkoutState.status === "submitting"}
                  >
                    Torre GGA
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={location === "Torre Valcob"}
                    className={`catalog-checkout-chip ${location === "Torre Valcob" ? "active" : ""} ${errors.location ? "error" : ""}`}
                    onClick={() => {
                      setLocation("Torre Valcob");
                      if (errors.location) setErrors(prev => ({ ...prev, location: undefined }));
                      if (checkoutState.status === "error") setCheckoutState({ status: "idle" });
                    }}
                    disabled={checkoutState.status === "submitting"}
                  >
                    Torre Valcob
                  </button>
                </div>
                {errors.location && (
                  <span id="location-error" className="catalog-checkout-error-inline" role="alert">
                    ⚠️ {errors.location}
                  </span>
                )}
              </div>

              <label className="catalog-checkout-field">
                <span>Nota adicional (Opcional)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Sin cebolla en la burger..."
                  className="glass-input"
                  maxLength={300}
                  disabled={checkoutState.status === "submitting"}
                  rows={2}
                />
              </label>

              <label className="catalog-checkout-whatsapp-optin">
                <input
                  type="checkbox"
                  checked={wantsWhatsappGroup}
                  onChange={(e) => setWantsWhatsappGroup(e.target.checked)}
                  disabled={checkoutState.status === "submitting"}
                />
                <span>Quiero unirme al grupo oficial de WhatsApp</span>
              </label>

              <div className="catalog-checkout-field">
                <span id="payment-label">Método de pago</span>
                <div className="catalog-checkout-chips" role="radiogroup" aria-labelledby="payment-label">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === "cash"}
                    className={`catalog-checkout-chip ${paymentMethod === "cash" ? "active" : ""}`}
                    onClick={() => setPaymentMethod("cash")}
                    disabled={checkoutState.status === "submitting"}
                  >
                    Efectivo
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === "transfer"}
                    className={`catalog-checkout-chip ${paymentMethod === "transfer" ? "active" : ""}`}
                    onClick={() => setPaymentMethod("transfer")}
                    disabled={checkoutState.status === "submitting"}
                  >
                    Transferencia
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === "unknown"}
                    className={`catalog-checkout-chip ${paymentMethod === "unknown" ? "active" : ""}`}
                    onClick={() => setPaymentMethod("unknown")}
                    disabled={checkoutState.status === "submitting"}
                  >
                    Confirmar por WA
                  </button>
                </div>
              </div>

              {checkoutState.status === "error" && (
                <div className="catalog-checkout-error" role="alert">
                  {checkoutState.error}
                </div>
              )}
            </div>

            <div className="catalog-cart-drawer__footer">
              <div className="catalog-checkout-payment-summary">
                <div className="catalog-checkout-payment-row">
                  <span>Total del pedido</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                {deliveryDate !== "Hoy" && deliveryDate !== "" ? (
                  <>
                    <div className="catalog-checkout-payment-row catalog-checkout-payment-row--highlight">
                      <span>Anticipo requerido (50%)</span>
                      <strong>{formatCurrency(total / 2)}</strong>
                    </div>
                    <div className="catalog-checkout-payment-row">
                      <span>Restante a la entrega</span>
                      <span>{formatCurrency(total / 2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="catalog-checkout-payment-row catalog-checkout-payment-row--highlight">
                    <span>Pago requerido (100%)</span>
                    <strong>{formatCurrency(total)}</strong>
                  </div>
                )}
              </div>
              <button 
                type="submit" 
                className={`catalog-checkout__submit ${checkoutState.status === "submitting" ? "loading" : ""}`}
                disabled={checkoutState.status === "submitting" || items.length === 0}
              >
                {checkoutState.status === "submitting" ? "Procesando..." : "Enviar pedido"}
              </button>
            </div>
          </form>
        )}
      </motion.section>
    </motion.div>
  );
}
