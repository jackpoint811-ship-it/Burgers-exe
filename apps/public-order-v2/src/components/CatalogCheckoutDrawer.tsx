import { useEffect, useId, useRef, useState, type MouseEvent, type FormEvent } from "react";
import type { OrderV2PaymentMethod } from "@config/index";
import { formatCurrency } from "../lib/order";
import { useCatalogCart } from "./CatalogCartContext";
import { createOrderV2 } from "../lib/orders-v2";

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

const normalizePhoneDigits = (phone: string) => phone.replace(/\D/g, "");

type CheckoutState = {
  status: "idle" | "submitting" | "success" | "error";
  error?: string;
  folio?: string;
};

export function CatalogCheckoutDrawer({ isOpen, onClose }: CatalogCheckoutDrawerProps) {
  const { items, total, clear } = useCatalogCart();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<OrderV2PaymentMethod>("unknown");
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ status: "idle" });

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

  if (!isOpen) return null;

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
      }));

      const idempotencyKey = typeof crypto !== "undefined" && "randomUUID" in crypto 
        ? crypto.randomUUID() 
        : `catalog-${Date.now()}-${Math.random()}`;

      const response = await createOrderV2({
        customer: { name: name.trim(), phone: normalizedPhone },
        orderMode: "pickup",
        paymentMethod,
        items: payloadItems,
      }, idempotencyKey);

      const order = response.data?.order;
      if (!order) {
        throw new Error(response.error?.message || "El backend no devolvió folio de confirmación.");
      }

      setCheckoutState({ status: "success", folio: order.folio });
      clear();
    } catch (error) {
      setCheckoutState({ 
        status: "error", 
        error: error instanceof Error ? error.message : "No se pudo enviar el pedido. Intenta de nuevo." 
      });
    }
  };

  return (
    <div className="catalog-drawer-backdrop" role="presentation" onClick={handleBackdropClick}>
      <section
        ref={dialogRef}
        className="catalog-drawer catalog-checkout-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="catalog-drawer__header catalog-cart-drawer__header">
          <h2 id={titleId} className="catalog-cart-drawer__title">
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
            <button type="button" className="catalog-checkout__submit" onClick={onClose}>
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
                    className={paymentMethod === "cash" ? "catalog-checkout-chip active" : "catalog-checkout-chip"}
                    onClick={() => setPaymentMethod("cash")}
                    disabled={checkoutState.status === "submitting"}
                  >
                    Efectivo
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === "transfer"}
                    className={paymentMethod === "transfer" ? "catalog-checkout-chip active" : "catalog-checkout-chip"}
                    onClick={() => setPaymentMethod("transfer")}
                    disabled={checkoutState.status === "submitting"}
                  >
                    Transferencia
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === "unknown"}
                    className={paymentMethod === "unknown" ? "catalog-checkout-chip active" : "catalog-checkout-chip"}
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
                <strong>{formatCurrency(total)}</strong>
              </div>
              <button 
                type="submit" 
                className="catalog-checkout__submit" 
                disabled={checkoutState.status === "submitting" || items.length === 0}
              >
                {checkoutState.status === "submitting" ? "Procesando..." : "Enviar pedido"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
