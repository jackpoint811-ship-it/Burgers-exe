import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { type CatalogProduct, PRODUCT_TYPE_LABELS, resolveCatalogAssetUrl } from "../lib/catalog-mode";
import { CATALOG_CART_MAX_QTY } from "../lib/catalog-cart";
import { formatCurrency } from "../lib/order";
import { useCatalogCart } from "./CatalogCartContext";
import { motion, useReducedMotion } from "framer-motion";

type CatalogProductDrawerProps = {
  product: CatalogProduct;
  onClose: () => void;
};

const ADDED_FEEDBACK_MS = 1400;

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function CatalogProductDrawer({ product, onClose }: CatalogProductDrawerProps) {
  const { items, addItem } = useCatalogCart();
  const [justAdded, setJustAdded] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const shouldReduceMotion = useReducedMotion();
  const src = product ? resolveCatalogAssetUrl(product.imageUrl, product.imageKey) : undefined;

  const currentItem = items.find((i) => i.productId === product?.id);
  const isAtMax = currentItem ? currentItem.qty >= CATALOG_CART_MAX_QTY : false;

  useEffect(() => {
    setJustAdded(false);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, [product?.id]);

  useEffect(() => {
    return () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); };
  }, []);

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

  const handleAddToCart = () => {
    if (isAtMax) return;
    addItem(product);
    setJustAdded(true);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setJustAdded(false), ADDED_FEEDBACK_MS);
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
        className="catalog-drawer glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={product.description ? descriptionId : undefined}
        initial={shouldReduceMotion ? { opacity: 0 } : { y: "100%" }}
        animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { y: "100%" }}
        transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", damping: 25, stiffness: 200 }}
      >
        <div className="catalog-drawer__media" aria-hidden="true">
          {src ? <img src={src} alt="" decoding="async" /> : <span>{PRODUCT_TYPE_LABELS[product.type]}</span>}
        </div>

        <div className="catalog-drawer__content">
          <header className="catalog-drawer__header">
            <div>
              <div className="catalog-drawer__eyebrow">
                <span className="glow-neon-text">{PRODUCT_TYPE_LABELS[product.type]}</span>
                {product.badge ? <em className="glow-amber-text">{product.badge}</em> : null}
              </div>
              <h2 id={titleId} className="glow-neon-text">{product.name}</h2>
            </div>
            <button ref={closeRef} type="button" className="catalog-drawer__close min-w-[44px] min-h-[44px]" onClick={onClose} aria-label={`Cerrar detalle de ${product.name}`}>
              <span aria-hidden="true">×</span>
            </button>
          </header>

          {product.description ? <p id={descriptionId} className="catalog-drawer__description">{product.description}</p> : null}

          <div className="catalog-drawer__details">
            <strong className="glow-amber-text">{formatCurrency(product.price)}</strong>
            <span className={product.isAvailable ? "catalog-drawer__availability cyber-glow-border" : "catalog-drawer__availability catalog-drawer__availability--unavailable cyber-glow-border"}>
              {product.isAvailable ? "Disponible" : "No disponible"}
            </span>
          </div>

          {product.type === "burger" ? <p className="catalog-drawer__notice">Ingredientes informativos. Esta burger no se modifica en Modo Catálogo.</p> : null}
          {product.type === "topping" ? <p className="catalog-drawer__notice">Los toppings se entregan por separado.</p> : null}

          <div className="catalog-drawer__footer">
            {product.isAvailable ? (
              <button
                type="button"
                className={`catalog-drawer__add-btn${justAdded ? " catalog-drawer__add-btn--added" : ""}${isAtMax && !justAdded ? " catalog-drawer__add-btn--unavailable" : ""} min-w-[44px] min-h-[44px]`}
                onClick={handleAddToCart}
                aria-live="polite"
                disabled={isAtMax && !justAdded}
              >
                {justAdded ? "¡Agregado!" : isAtMax ? "Límite alcanzado" : "Agregar al carrito"}
              </button>
            ) : (
              <button type="button" className="catalog-drawer__add-btn catalog-drawer__add-btn--unavailable min-w-[44px] min-h-[44px]" disabled>
                No disponible
              </button>
            )}
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
