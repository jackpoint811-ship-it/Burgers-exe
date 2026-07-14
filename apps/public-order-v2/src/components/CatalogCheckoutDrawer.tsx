import { useEffect, useId, useMemo, useRef, useState, type MouseEvent, type FormEvent } from "react";
import type { OrderV2PaymentMethod, OrderV2ItemKind } from "@config/index";
import { getPublicOrderEnvironment } from "@config/index";
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
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ status: "idle" });

  const shouldReduceMotion = useReducedMotion();

  // Stable idempotency key: regenerated only when cart or customer data changes.
  const idempotencyKeyRef = useRef(generateIdempotencyKey());
  const prevSnapshotRef = useRef("");

  // Regenerate key when cart contents or customer info changes.
  const currentSnapshot = JSON.stringify({ items: items.map(i => `${i.productId}:${i.qty}`), name, phone, paymentMethod });
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

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    const normalizedPhone = normalizePhoneDigits(phone);
    if (normalizedPhone.length !== 10) {
      setCheckoutState({ status: "error", error: "El teléfono debe tener exactamente 10 dígitos." });
      return;
    }

    if (!name.trim()) {
      setCheckoutState({ status: "error", error: "Por favor, ingresa tu nombre." });
      return;
    }

    setCheckoutState({ status: "submitting" });

    try {
      const payloadItems = items.map((item) => ({
        sku: item.productId,
        qty: item.qty,
        itemKind: catalogTypeToItemKind[item.type] ?? ("other" as OrderV2ItemKind),
        name: item.name,
      }));

      const response = await createOrderV2({
        customer: { name: name.trim(), phone: normalizedPhone },
        orderMode: "pickup",
        paymentMethod,
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
        className="catalog-drawer catalog-checkout-drawer glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={shouldReduceMotion ? { opacity: 0 } : { y: "100%" }}
        animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
      >
        <header className="catalog-drawer__header catalog-cart-drawer__header">
          <h2 id={titleId} className="catalog-cart-drawer__title glow-neon-text">
            {checkoutState.status === "success" ? "Pedido recibido" : "Checkout"}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="catalog-drawer__close min-w-[44px] min-h-[44px]"
            onClick={onClose}
            aria-label="Cerrar checkout"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        {checkoutState.status === "success" ? (
          <div className="catalog-checkout-success">
            <p className="catalog-checkout-success__subcopy">Tu orden ha entrado a preparación.</p>
            <div className="catalog-checkout-success__folio-card glass-card glow-neon">
              <span>Folio</span>
              <strong className="glow-neon-text">{checkoutState.folio}</strong>
            </div>
            <p className="catalog-checkout-success__whatsapp-note">
              Te contactaremos por WhatsApp cualquier cosa.
            </p>
            <button type="button" className="catalog-checkout__submit min-w-[44px] min-h-[44px]" onClick={onClose}>
              Cerrar y explorar menú
            </button>
          </div>
        ) : (
          <form className="catalog-checkout-form" onSubmit={handleSubmit}>
            <div className="catalog-checkout-form__fields">
              <label className="catalog-checkout-field">
                <span>Nombre</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="glass-input"
                  required
                  disabled={checkoutState.status === "submitting"}
                />
              </label>
              
              <label className="catalog-checkout-field">
                <span>Teléfono (WhatsApp)</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10 dígitos"
                  className="glass-input"
                  required
                  disabled={checkoutState.status === "submitting"}
                />
              </label>

              <div className="catalog-checkout-field">
                <span id="payment-label">Método de pago</span>
                <div className="catalog-checkout-chips" role="radiogroup" aria-labelledby="payment-label">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === "cash"}
                    className={paymentMethod === "cash" ? "catalog-checkout-chip active glass-card glass-card-active min-w-[44px] min-h-[44px]" : "catalog-checkout-chip glass-card min-w-[44px] min-h-[44px]"}
                    onClick={() => setPaymentMethod("cash")}
                    disabled={checkoutState.status === "submitting"}
                  >
                    Efectivo
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === "transfer"}
                    className={paymentMethod === "transfer" ? "catalog-checkout-chip active glass-card glass-card-active min-w-[44px] min-h-[44px]" : "catalog-checkout-chip glass-card min-w-[44px] min-h-[44px]"}
                    onClick={() => setPaymentMethod("transfer")}
                    disabled={checkoutState.status === "submitting"}
                  >
                    Transferencia
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === "unknown"}
                    className={paymentMethod === "unknown" ? "catalog-checkout-chip active glass-card glass-card-active min-w-[44px] min-h-[44px]" : "catalog-checkout-chip glass-card min-w-[44px] min-h-[44px]"}
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
              <div className="catalog-cart-drawer__total">
                <span>Total a pagar</span>
                <strong className="glow-amber-text">{formatCurrency(total)}</strong>
              </div>
              <button
                type="submit"
                className="catalog-checkout__submit min-w-[44px] min-h-[44px]"
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
