import { useEffect, useId, useRef, type MouseEvent } from "react";
import { formatCurrency } from "../lib/order";
import { resolveCatalogAssetUrl } from "../lib/catalog-mode";
import { CATALOG_CART_MAX_QTY } from "../lib/catalog-cart";
import { useCatalogCart } from "./CatalogCartContext";

type CatalogCartDrawerProps = {
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

export function CatalogCartDrawer({ isOpen, onClose }: CatalogCartDrawerProps) {
  const { items, total, setQty, removeItem } = useCatalogCart();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

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

  if (!isOpen) return null;

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="catalog-drawer-backdrop" role="presentation" onClick={handleBackdropClick}>
      <section
        ref={dialogRef}
        className="catalog-drawer catalog-cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="catalog-drawer__header catalog-cart-drawer__header">
          <h2 id={titleId} className="catalog-cart-drawer__title">Tu carrito</h2>
          <button
            ref={closeRef}
            type="button"
            className="catalog-drawer__close"
            onClick={onClose}
            aria-label="Cerrar carrito"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        {items.length === 0 ? (
          <div className="catalog-cart-drawer__empty">
            <p>Tu carrito está vacío.</p>
            <button type="button" className="catalog-cart-drawer__empty-cta" onClick={onClose}>
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
                      <p className="catalog-cart-item__price">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="catalog-cart-item__controls">
                      <button
                        type="button"
                        className="catalog-cart-item__qty-btn"
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
                        className="catalog-cart-item__qty-btn"
                        aria-label={`Aumentar cantidad de ${item.name}`}
                        disabled={item.qty >= CATALOG_CART_MAX_QTY}
                        onClick={() => setQty(item.productId, item.qty + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="catalog-cart-item__remove"
                      aria-label={`Eliminar ${item.name} del carrito`}
                      onClick={() => removeItem(item.productId)}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="catalog-cart-drawer__footer">
              <div className="catalog-cart-drawer__total">
                <span>Total</span>
                <strong>{formatCurrency(total)}</strong>
              </div>
              <button type="button" className="catalog-cart-drawer__checkout" disabled>
                Checkout próximamente
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
