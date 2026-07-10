import { formatCurrency } from "../lib/order";
import { useCatalogCart } from "./CatalogCartContext";

type CatalogCartBarProps = {
  onOpenCart: () => void;
};

export function CatalogCartBar({ onOpenCart }: CatalogCartBarProps) {
  const { count, total } = useCatalogCart();

  if (count === 0) return null;

  return (
    <aside className="catalog-cart-bar" aria-label="Resumen del carrito">
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
        className="catalog-cart-bar__cta"
        onClick={onOpenCart}
        aria-haspopup="dialog"
      >
        Ver carrito
      </button>
    </aside>
  );
}
