import type { MenuCategory, MenuItem, SiteConfig } from "@config/index";
import { useCallback, useMemo, useState } from "react";
import { CatalogProductDrawer } from "./CatalogProductDrawer";
import {
  type CatalogProduct,
  mapMenuItemsToCatalogProducts,
  resolveCatalogAssetUrl
} from "../lib/catalog-mode";
import { formatCurrency } from "../lib/order";

type CatalogModeAppProps = {
  items: MenuItem[];
  categories: MenuCategory[];
  siteConfig: SiteConfig;
};

const PRODUCT_TYPE_LABELS: Record<CatalogProduct["type"], string> = {
  burger: "Burger fija",
  combo: "Combo",
  side: "Guarnición",
  topping: "Topping separado",
  drink: "Bebida"
};

const CatalogProductCard = ({ product, onOpen }: { product: CatalogProduct; onOpen: (product: CatalogProduct) => void }) => {
  const src = resolveCatalogAssetUrl(product.imageUrl, product.imageKey);

  return (
    <article className={product.isAvailable ? "catalog-card" : "catalog-card catalog-card--disabled"}>
      <button
        type="button"
        className="catalog-card__detail-trigger"
        onClick={() => onOpen(product)}
        aria-haspopup="dialog"
        aria-label={`Ver detalle de ${product.name}${product.isAvailable ? "" : ", no disponible"}`}
      >
        <div className="catalog-card__image" aria-hidden="true">
          {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span>{product.type}</span>}
        </div>
        <div className="catalog-card__meta">
          <div className="catalog-card__eyebrow">
            <span>{PRODUCT_TYPE_LABELS[product.type]}</span>
            {product.badge ? <em>{product.badge}</em> : null}
          </div>
          <h3>{product.name}</h3>
          {product.description ? <p>{product.description}</p> : null}
          <div className="catalog-card__footer">
            <strong>{formatCurrency(product.price)}</strong>
            <span className="catalog-card__detail-action">Ver detalle</span>
          </div>
        </div>
      </button>
    </article>
  );
};

export function CatalogModeApp({ items, categories, siteConfig }: CatalogModeAppProps) {
  const products = useMemo(() => mapMenuItemsToCatalogProducts(items, categories), [items, categories]);
  const visibleCategories = useMemo(() => {
    const categoryKeys = new Set(products.map((product) => product.categoryKey));
    return categories
      .filter((category) => categoryKeys.has(category.key))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories, products]);
  const [activeCategory, setActiveCategory] = useState<MenuCategory["key"] | "all">("all");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const closeDrawer = useCallback(() => setSelectedProduct(null), []);

  const filteredProducts = activeCategory === "all"
    ? products
    : products.filter((product) => product.categoryKey === activeCategory);

  return (
    <>
      <main className="catalog-shell" aria-labelledby="catalogTitle">
        <section className="catalog-hero">
          <div>
            <span>Modo Catálogo</span>
            <h1 id="catalogTitle">{siteConfig.brandName}</h1>
            <p>Primer vistazo del catálogo visual. El flujo completo de pedido sigue protegido en Modo Flujo.</p>
          </div>
          <aside aria-label="Estado del catálogo">
            <strong>Catálogo en preparación</strong>
            <small>Checkout y carrito operativo quedan para siguientes PRs.</small>
          </aside>
        </section>

        <nav className="catalog-category-nav" aria-label="Categorías de catálogo">
          <button type="button" className={activeCategory === "all" ? "active" : ""} onClick={() => setActiveCategory("all")}>
            Todos
          </button>
          {visibleCategories.map((category) => (
            <button
              type="button"
              className={activeCategory === category.key ? "active" : ""}
              key={category.key}
              onClick={() => setActiveCategory(category.key)}
            >
              {category.name}
            </button>
          ))}
        </nav>

        {filteredProducts.length ? (
          <section className="catalog-grid" aria-label="Productos del catálogo">
            {filteredProducts.map((product) => <CatalogProductCard product={product} onOpen={setSelectedProduct} key={product.id} />)}
          </section>
        ) : (
          <section className="catalog-empty" role="status">
            <h2>Catálogo sin productos visibles</h2>
            <p>Cuando el menú publique productos disponibles, aparecerán aquí sin afectar el Modo Flujo.</p>
          </section>
        )}

        <footer className="catalog-note">
          Catálogo en preparación. El flujo de pedido completo sigue disponible en Modo Flujo.
        </footer>
      </main>

      <CatalogProductDrawer product={selectedProduct} onClose={closeDrawer} />
    </>
  );
}
