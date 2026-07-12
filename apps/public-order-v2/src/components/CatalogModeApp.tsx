import type { MenuCategory, MenuItem, SiteConfig } from "@config/index";
import { useCallback, useMemo, useState } from "react";
import { CatalogProductDrawer } from "./CatalogProductDrawer";
import { CatalogCartDrawer } from "./CatalogCartDrawer";
import { CatalogCheckoutDrawer } from "./CatalogCheckoutDrawer";
import { CatalogCartBar } from "./CatalogCartBar";
import { CatalogCartProvider } from "./CatalogCartContext";
import {
  type CatalogProduct,
  PRODUCT_TYPE_LABELS,
  mapMenuItemsToCatalogProducts,
  resolveCatalogAssetUrl,
} from "../lib/catalog-mode";
import { formatCurrency } from "../lib/order";

type CatalogModeAppProps = {
  items: MenuItem[];
  categories: MenuCategory[];
  siteConfig: SiteConfig;
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

function CatalogModeAppInner({ items, categories, siteConfig }: CatalogModeAppProps) {
  const products = useMemo(() => mapMenuItemsToCatalogProducts(items, categories), [items, categories]);
  const visibleCategories = useMemo(() => {
    const categoryKeys = new Set(products.map((product) => product.categoryKey));
    return categories
      .filter((category) => categoryKeys.has(category.key))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories, products]);
  const [activeCategory, setActiveCategory] = useState<MenuCategory["key"] | "all">("all");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const closeProductDrawer = useCallback(() => setSelectedProduct(null), []);
  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const openCheckout = useCallback(() => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  }, []);
  const closeCheckout = useCallback(() => setIsCheckoutOpen(false), []);

  const filteredProducts = activeCategory === "all"
    ? products
    : products.filter((product) => product.categoryKey === activeCategory);

  return (
    <>
      <main className="catalog-shell" aria-labelledby="catalogTitle">
        <section className="catalog-hero">
          <div>
            <span>Menú</span>
            <h1 id="catalogTitle">{siteConfig.brandName}</h1>
            <p>Explora el menú, arma tu pedido y paga en minutos.</p>
          </div>
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
            <h2>Sin productos disponibles</h2>
            <p>Por el momento no hay productos publicados. Vuelve pronto.</p>
          </section>
        )}


      </main>

      <CatalogCartBar onOpenCart={openCart} />
      <CatalogProductDrawer product={selectedProduct} onClose={closeProductDrawer} />
      <CatalogCartDrawer isOpen={isCartOpen} onClose={closeCart} onCheckout={openCheckout} />
      <CatalogCheckoutDrawer isOpen={isCheckoutOpen} onClose={closeCheckout} />
    </>
  );
}

export function CatalogModeApp(props: CatalogModeAppProps) {
  return (
    <CatalogCartProvider>
      <CatalogModeAppInner {...props} />
    </CatalogCartProvider>
  );
}
