import type { MenuCategory, MenuItem, SiteConfig, CatalogBanner } from "@config/index";
import { useCallback, useMemo, useState } from "react";
import { CatalogProductDrawer } from "./CatalogProductDrawer";
import { CatalogCartDrawer } from "./CatalogCartDrawer";
import { CatalogCheckoutDrawer } from "./CatalogCheckoutDrawer";
import { CatalogCartBar } from "./CatalogCartBar";
import { CatalogCartProvider } from "./CatalogCartContext";
import { AnimatePresence } from "framer-motion";
import { CatalogBannerRail } from "./CatalogBannerRail";
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
  catalogBanners?: CatalogBanner[];
  source?: string;
};

const CatalogProductCard = ({ product, onOpen }: { product: CatalogProduct; onOpen: (product: CatalogProduct) => void }) => {
  const src = resolveCatalogAssetUrl(product.imageUrl, product.imageKey);

  return (
    <article className={product.isAvailable ? "catalog-card glass-card" : "catalog-card glass-card catalog-card--disabled"}>
      <button
        type="button"
        className="catalog-card__detail-trigger min-w-[44px] min-h-[44px]"
        onClick={() => onOpen(product)}
        aria-haspopup="dialog"
        aria-label={`Ver detalle de ${product.name}${product.isAvailable ? "" : ", no disponible"}`}
      >
        <div className="catalog-card__image" aria-hidden="true">
          {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span>{product.type}</span>}
        </div>
        <div className="catalog-card__meta">
          <div className="catalog-card__eyebrow">
            <span className="glow-neon-text">{PRODUCT_TYPE_LABELS[product.type]}</span>
            {product.badge ? <em className="glow-amber-text">{product.badge}</em> : null}
          </div>
          <h3 className="glow-neon-text">{product.name}</h3>
          {product.description ? <p>{product.description}</p> : null}
          <div className="catalog-card__footer">
            <strong className="glow-amber-text">{formatCurrency(product.price)}</strong>
            <span className="catalog-card__detail-action cyber-glow-border min-w-[44px] min-h-[44px] flex items-center justify-center">Ver detalle</span>
          </div>
        </div>
      </button>
    </article>
  );
};

function CatalogModeAppInner({ items, categories, siteConfig, catalogBanners = [], source }: CatalogModeAppProps) {
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
        <section className="catalog-hero glass-panel">
          <div>
            <span className="glow-neon-text">Menú</span>
            <h1 id="catalogTitle" className="glow-neon-text">{siteConfig.brandName}</h1>
            <p>Explora el menú, arma tu pedido y paga en minutos.</p>
          </div>
        </section>

        {source === "fallback" ? (
          <section className="menu-sync-notice glass-panel border-[#ffd166]/30" role="status" aria-live="polite">
            <strong className="glow-amber-text">Menú de respaldo activo</strong>
            <p>No pudimos confirmar el menú actualizado. Revisa tu conexión o recarga la página antes de ordenar.</p>
            <button type="button" className="quest-button ghost min-w-[44px] min-h-[44px]" onClick={() => window.location.reload()}>Reintentar carga</button>
          </section>
        ) : null}

        <CatalogBannerRail banners={catalogBanners} />

        <nav className="catalog-category-nav" aria-label="Categorías de catálogo">
          <button
            type="button"
            className={`glass-card min-w-[44px] min-h-[44px] ${activeCategory === "all" ? "active glass-card-active glow-neon" : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            Todos
          </button>
          {visibleCategories.map((category) => (
            <button
              type="button"
              className={`glass-card min-w-[44px] min-h-[44px] ${activeCategory === category.key ? "active glass-card-active glow-neon" : ""}`}
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
          <section className="catalog-empty glass-panel" role="status">
            <h2>Sin productos disponibles</h2>
            <p>Por el momento no hay productos publicados. Vuelve pronto.</p>
          </section>
        )}


      </main>

      <AnimatePresence>
        <CatalogCartBar key="cart-bar" onOpenCart={openCart} />
      </AnimatePresence>
      <AnimatePresence>
        {selectedProduct && <CatalogProductDrawer key="product-drawer" product={selectedProduct} onClose={closeProductDrawer} />}
      </AnimatePresence>
      <AnimatePresence>
        {isCartOpen && <CatalogCartDrawer key="cart-drawer" isOpen={isCartOpen} onClose={closeCart} onCheckout={openCheckout} />}
      </AnimatePresence>
      <AnimatePresence>
        {isCheckoutOpen && <CatalogCheckoutDrawer key="checkout-drawer" isOpen={isCheckoutOpen} onClose={closeCheckout} />}
      </AnimatePresence>
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
