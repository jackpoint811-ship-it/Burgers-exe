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

const CatalogProductCard = ({ product, onOpen, isFeatured }: { product: CatalogProduct; onOpen: (product: CatalogProduct) => void; isFeatured?: boolean }) => {
  const src = resolveCatalogAssetUrl(product.imageUrl, product.imageKey);
  const cardClass = `catalog-card glass-card ${!product.isAvailable ? "catalog-card--disabled" : ""} ${isFeatured ? "catalog-card--featured" : "catalog-card--compact"}`;

  return (
    <article className={cardClass}>
      <button
        type="button"
        className="catalog-card__detail-trigger min-w-[44px] min-h-[44px]"
        onClick={() => onOpen(product)}
        aria-haspopup="dialog"
        aria-label={`Ver detalle de ${product.name}${product.isAvailable ? "" : ", no disponible"}`}
      >
        <div className="catalog-card__meta">
          <div className="catalog-card__eyebrow">
            <span className="">{PRODUCT_TYPE_LABELS[product.type]}</span>
            {product.badge ? <em className="">{product.badge}</em> : null}
          </div>
          <h3 className="">{product.name}</h3>
          {product.description ? <p>{product.description}</p> : null}
          <div className="catalog-card__footer">
            <strong className="">{formatCurrency(product.price)}</strong>
          </div>
        </div>
        <div className="catalog-card__image" aria-hidden="true">
          {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span>{product.type}</span>}
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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const closeProductDrawer = useCallback(() => setSelectedProduct(null), []);
  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const openCheckout = useCallback(() => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  }, []);
  const closeCheckout = useCallback(() => setIsCheckoutOpen(false), []);
  const toggleMobileNav = useCallback(() => setIsMobileNavOpen((prev) => !prev), []);

  const sideProducts = useMemo(() => products.filter((p) => p.type === "side" && p.isAvailable), [products]);

  const filteredProducts = activeCategory === "all"
    ? products
    : products.filter((product) => product.categoryKey === activeCategory);

  return (
    <div className="catalog-layout-wrapper">
      <header className="catalog-topbar">
        <button className="catalog-topbar__menu-btn min-w-[44px] min-h-[44px]" onClick={toggleMobileNav} aria-label="Menú de categorías">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <h1 className="catalog-topbar__title">{siteConfig.brandName}</h1>
      </header>

      <div className={`catalog-sidebar-overlay ${isMobileNavOpen ? "open" : ""}`} onClick={() => setIsMobileNavOpen(false)} aria-hidden="true" />
      
      <aside className={`catalog-sidebar ${isMobileNavOpen ? "open" : ""}`}>
        <nav className="catalog-category-nav" aria-label="Categorías de catálogo">
          <div className="catalog-sidebar__header">
            <h2>Categorías</h2>
            <button className="catalog-sidebar__close min-w-[44px] min-h-[44px]" onClick={() => setIsMobileNavOpen(false)}>
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <button
            type="button"
            className={`catalog-category-btn min-w-[44px] min-h-[44px] ${activeCategory === "all" ? "active" : ""}`}
            onClick={() => { setActiveCategory("all"); setIsMobileNavOpen(false); }}
          >
            Todos
          </button>
          {visibleCategories.map((category) => (
            <button
              type="button"
              className={`catalog-category-btn min-w-[44px] min-h-[44px] ${activeCategory === category.key ? "active" : ""}`}
              key={category.key}
              onClick={() => { setActiveCategory(category.key); setIsMobileNavOpen(false); }}
            >
              {category.name}
            </button>
          ))}
        </nav>
      </aside>

      <main className="catalog-main-content" aria-labelledby="catalogTitle">
        {source === "fallback" ? (
          <section className="menu-sync-notice glass-panel" role="status" aria-live="polite">
            <strong>Menú de respaldo activo</strong>
            <p>No pudimos confirmar el menú actualizado.</p>
            <button type="button" className="quest-button min-w-[44px] min-h-[44px]" onClick={() => window.location.reload()}>Reintentar</button>
          </section>
        ) : null}

        <CatalogBannerRail banners={catalogBanners} />

        {filteredProducts.length ? (
          <section className="catalog-grid" aria-label="Productos del catálogo">
            {filteredProducts.map((product) => (
              <CatalogProductCard 
                product={product} 
                onOpen={setSelectedProduct} 
                key={product.id} 
                isFeatured={product.badge !== undefined || product.categoryKey === 'combos'} 
              />
            ))}
          </section>
        ) : (
          <section className="catalog-empty glass-panel" role="status">
            <h2>Sin productos</h2>
            <p>Por el momento no hay productos en esta categoría.</p>
          </section>
        )}
      </main>

      <div className="catalog-right-panel">
        <CatalogCartDrawer isOpen={true} onClose={closeCart} onCheckout={openCheckout} sides={sideProducts} isStaticPanel={true} />
      </div>

      <AnimatePresence>
        <CatalogCartBar key="cart-bar" onOpenCart={openCart} />
      </AnimatePresence>
      <AnimatePresence>
        {selectedProduct && <CatalogProductDrawer key="product-drawer" product={selectedProduct} onClose={closeProductDrawer} />}
      </AnimatePresence>
      <AnimatePresence>
        {isCartOpen && <CatalogCartDrawer key="cart-drawer-mobile" isOpen={isCartOpen} onClose={closeCart} onCheckout={openCheckout} sides={sideProducts} />}
      </AnimatePresence>
      <AnimatePresence>
        {isCheckoutOpen && <CatalogCheckoutDrawer key="checkout-drawer" isOpen={isCheckoutOpen} onClose={closeCheckout} />}
      </AnimatePresence>
    </div>
  );
}

export function CatalogModeApp(props: CatalogModeAppProps) {
  return (
    <CatalogCartProvider>
      <CatalogModeAppInner {...props} />
    </CatalogCartProvider>
  );
}
