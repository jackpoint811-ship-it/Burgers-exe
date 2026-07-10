import { useEffect, useId, useRef, type MouseEvent } from "react";
import { type CatalogProduct, resolveCatalogAssetUrl } from "../lib/catalog-mode";
import { formatCurrency } from "../lib/order";

type CatalogProductDrawerProps = {
  product: CatalogProduct | null;
  onClose: () => void;
};

const PRODUCT_TYPE_LABELS: Record<CatalogProduct["type"], string> = {
  burger: "Burger fija",
  combo: "Combo",
  side: "Guarnición",
  topping: "Topping separado",
  drink: "Bebida"
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function CatalogProductDrawer({ product, onClose }: CatalogProductDrawerProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const src = product ? resolveCatalogAssetUrl(product.imageUrl, product.imageKey) : undefined;

  useEffect(() => {
    if (!product) return;

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

      const focusableElements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
      if (!focusableElements.length) {
        event.preventDefault();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || !dialogRef.current?.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !dialogRef.current?.contains(activeElement))) {
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
  }, [onClose, product]);

  if (!product) return null;

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="catalog-drawer-backdrop" role="presentation" onClick={handleBackdropClick}>
      <section
        ref={dialogRef}
        className="catalog-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={product.description ? descriptionId : undefined}
      >
        <div className="catalog-drawer__media" aria-hidden="true">
          {src ? <img src={src} alt="" decoding="async" /> : <span>{PRODUCT_TYPE_LABELS[product.type]}</span>}
        </div>

        <div className="catalog-drawer__content">
          <header className="catalog-drawer__header">
            <div>
              <div className="catalog-drawer__eyebrow">
                <span>{PRODUCT_TYPE_LABELS[product.type]}</span>
                {product.badge ? <em>{product.badge}</em> : null}
              </div>
              <h2 id={titleId}>{product.name}</h2>
            </div>
            <button ref={closeRef} type="button" className="catalog-drawer__close" onClick={onClose} aria-label={`Cerrar detalle de ${product.name}`}>
              <span aria-hidden="true">×</span>
            </button>
          </header>

          {product.description ? <p id={descriptionId} className="catalog-drawer__description">{product.description}</p> : null}

          <div className="catalog-drawer__details">
            <strong>{formatCurrency(product.price)}</strong>
            <span className={product.isAvailable ? "catalog-drawer__availability" : "catalog-drawer__availability catalog-drawer__availability--unavailable"}>
              {product.isAvailable ? "Disponible" : "No disponible"}
            </span>
          </div>

          {product.type === "burger" ? <p className="catalog-drawer__notice">Ingredientes informativos. Esta burger no se modifica en Modo Catálogo.</p> : null}
          {product.type === "topping" ? <p className="catalog-drawer__notice">Los toppings se entregan por separado.</p> : null}

          <div className="catalog-drawer__footer">
            <button type="button" disabled>Agregar próximamente</button>
          </div>
        </div>
      </section>
    </div>
  );
}
