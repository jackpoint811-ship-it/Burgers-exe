import { formatCurrency } from "../lib/order";
import { useCatalogCart } from "./CatalogCartContext";
import { motion, useReducedMotion } from "framer-motion";

type CatalogCartBarProps = {
  onOpenCart: () => void;
};

export function CatalogCartBar({ onOpenCart }: CatalogCartBarProps) {
  const { count, total } = useCatalogCart();
  const shouldReduceMotion = useReducedMotion();

  if (count === 0) return null;

  return (
    <motion.aside
      className="catalog-cart-bar glass-panel-strong"
      aria-label="Resumen del carrito"
      initial={shouldReduceMotion ? { opacity: 0 } : { y: 100, opacity: 0 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { y: 100, opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", damping: 25, stiffness: 200 }}
    >
      <div className="catalog-cart-bar__summary">
        <span className="catalog-cart-bar__count" aria-label={`${count} ${count === 1 ? "producto" : "productos"} en el carrito`}>
          {count}
        </span>
        <span className="catalog-cart-bar__label">
          {count === 1 ? "producto" : "productos"}
        </span>
      </div>
      <div className="catalog-cart-bar__total">
        {formatCurrency(total)}
      </div>
      <button
        type="button"
        className="catalog-cart-bar__cta min-w-[44px] min-h-[44px]"
        onClick={onOpenCart}
        aria-haspopup="dialog"
      >
        Ver carrito ({count})
      </button>
    </motion.aside>
  );
}
