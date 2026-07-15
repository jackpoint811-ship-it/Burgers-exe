import { useEffect, useId, useRef, type MouseEvent } from "react";
import { formatCurrency } from "../lib/order";
import { resolveCatalogAssetUrl, type CatalogProduct } from "../lib/catalog-mode";
import { CATALOG_CART_MAX_QTY } from "../lib/catalog-cart";
import { useCatalogCart } from "./CatalogCartContext";
import { motion, useReducedMotion } from "framer-motion";

type CatalogCartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
  sides?: CatalogProduct[];
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function CatalogCartDrawer({ isOpen, onClose, onCheckout, sides = [] }: CatalogCartDrawerProps) {
  const { items, total, setQty, removeItem, addItem } = useCatalogCart();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const shouldReduceMotion = useReducedMotion();

  const hasBurger = items.some((item) => item.type === "burger");
  const hasSide = items.some((item) => item.type === "side");
  const showUpsell = hasBurger && !hasSide && sides.length > 0;

  useEffect(() => {
    if (!isOpen) return;

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

  return (
    <motion.div
      className="catalog-drawer-backdrop"
      role="presentation"
      onClick={handleBackdropClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
    >
      <motion.section
        ref={dialogRef as any}
        className="catalog-drawer catalog-cart-drawer glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={shouldReduceMotion ? { opacity: 0 } : { y: "100%" }}
        animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { y: "100%" }}
        transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", damping: 25, stiffness: 200 }}
      >
        <header className="catalog-drawer__header catalog-cart-drawer__header">
          <h2 id={titleId} className="catalog-cart-drawer__title glow-neon-text">Tu carrito</h2>
          <button
            ref={closeRef}
            type="button"
            className="catalog-drawer__close min-w-[44px] min-h-[44px]"
            onClick={onClose}
            aria-label="Cerrar carrito"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        {items.length === 0 ? (
          <div className="catalog-cart-drawer__empty">
            <p>Tu carrito está vacío.</p>
            <button type="button" className="catalog-cart-drawer__empty-cta cyber-glow-border min-w-[44px] min-h-[44px]" onClick={onClose}>
              Seguir explorando
            </button>
          </div>
        ) : (
          <>
            <ul className="catalog-cart-drawer__list" aria-label="Productos en el carrito">
              {items.map((item) => {
                const src = resolveCatalogAssetUrl(item.imageUrl, item.imageKey);
                return (
                  <li key={item.productId} className="catalog-cart-item">
                    <div className="catalog-cart-item__image" aria-hidden="true">
                      {src
                        ? <img src={src} alt="" decoding="async" loading="lazy" />
                        : <span className="catalog-cart-item__image-placeholder" />
                      }
                    </div>
                    <div className="catalog-cart-item__info">
                      <p className="catalog-cart-item__name">{item.name}</p>
                      <p className="catalog-cart-item__price glow-amber-text">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="catalog-cart-item__controls">
                      <button
                        type="button"
                        className="catalog-cart-item__qty-btn min-w-[44px] min-h-[44px]"
                        aria-label={`Reducir cantidad de ${item.name}`}
                        onClick={() => setQty(item.productId, item.qty - 1)}
                      >
                        −
                      </button>
                      <span className="catalog-cart-item__qty" aria-label={`Cantidad: ${item.qty}`}>
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        className="catalog-cart-item__qty-btn min-w-[44px] min-h-[44px]"
                        aria-label={`Aumentar cantidad de ${item.name}`}
                        disabled={item.qty >= CATALOG_CART_MAX_QTY}
                        onClick={() => setQty(item.productId, item.qty + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="catalog-cart-item__remove min-w-[44px] min-h-[44px]"
                      aria-label={`Eliminar ${item.name} del carrito`}
                      onClick={() => removeItem(item.productId)}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {showUpsell && (
              <div className="catalog-cart-upsell">
                <h4 className="catalog-cart-upsell__title">¿Te gustaría acompañar tu hamburguesa?</h4>
                <div className="catalog-cart-upsell__carousel">
                  {sides.map((side) => {
                    const sideSrc = resolveCatalogAssetUrl(side.imageUrl, side.imageKey);
                    return (
                      <div key={side.id} className="catalog-cart-upsell-item">
                        <div className="catalog-cart-upsell-item__image">
                          {sideSrc ? (
                            <img src={sideSrc} alt="" decoding="async" loading="lazy" />
                          ) : (
                            <span className="catalog-cart-upsell-item__image-placeholder" />
                          )}
                        </div>
                        <div className="catalog-cart-upsell-item__info">
                          <p className="catalog-cart-upsell-item__name">{side.name}</p>
                          <p className="catalog-cart-upsell-item__price">{formatCurrency(side.price)}</p>
                        </div>
                        <button
                          type="button"
                          className="catalog-cart-upsell-item__add"
                          onClick={() => addItem(side)}
                        >
                          + Agregar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="catalog-cart-drawer__footer">
              <div className="catalog-cart-drawer__total">
                <span>Total</span>
                <strong className="glow-amber-text">{formatCurrency(total)}</strong>
              </div>
              <button type="button" className="catalog-cart-drawer__checkout catalog-checkout__submit min-w-[44px] min-h-[44px]" onClick={onCheckout}>
                Ir a Checkout
              </button>
            </div>
          </>
        )}
      </motion.section>
    </motion.div>
  );
}
