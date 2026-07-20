import type { MenuCategory, MenuItem, SiteConfig, CatalogBanner } from "@config/index";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** ───────────────────────────────────────────────────
 * Hook: dark mode con persistencia en localStorage
 * y fallback a prefers-color-scheme del sistema.
 * Aplica .theme-dark en <html> para activar tokens.
 * ─────────────────────────────────────────────────── */
function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("pov2-theme");
      if (stored !== null) return stored === "dark";
    } catch { /* noop */ }
    return typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false;
  });

  const firstRun = useRef(true);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("theme-dark");
    } else {
      root.classList.remove("theme-dark");
    }
    if (firstRun.current) { firstRun.current = false; return; }
    try { localStorage.setItem("pov2-theme", isDark ? "dark" : "light"); } catch { /* noop */ }
  }, [isDark]);

  const toggle = useCallback(() => setIsDark((d) => !d), []);
  return { isDark, toggle };
}

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
  const { isDark, toggle: toggleDark } = useDarkMode();
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
      {/* ── Header fijo de la app ─────────────────────────────────────────── */}
      <header className="app-header" role="banner">
        <div className="app-header__inner">
          <a href="/" className="app-header__brand" aria-label="Burgers.exe — Inicio">
            {/* Logotipo SVG inline — burger icon + wordmark */}
            <svg
              className="app-header__icon"
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <rect width="28" height="28" rx="8" fill="var(--color-accent)" />
              <rect x="6" y="8" width="16" height="2.5" rx="1.25" fill="white" />
              <rect x="6" y="12.75" width="16" height="2.5" rx="1.25" fill="white" />
              <rect x="6" y="17.5" width="16" height="2.5" rx="1.25" fill="white" />
            </svg>
            <span className="app-header__wordmark">
              Burgers<span className="app-header__dot">.exe</span>
            </span>
          </a>

          {/* ── Dark mode toggle ───────────────────────────── */}
          <button
            id="dark-mode-toggle"
            type="button"
            className="app-header__theme-btn"
            onClick={toggleDark}
            aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            aria-pressed={isDark}
          >
            {isDark ? (
              /* Sol */
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="10" cy="10" r="4" fill="currentColor" />
                <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="10" y1="2" x2="10" y2="4" />
                  <line x1="10" y1="16" x2="10" y2="18" />
                  <line x1="2" y1="10" x2="4" y2="10" />
                  <line x1="16" y1="10" x2="18" y2="10" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="14.36" y1="14.36" x2="15.78" y2="15.78" />
                  <line x1="4.22" y1="15.78" x2="5.64" y2="14.36" />
                  <line x1="14.36" y1="5.64" x2="15.78" y2="4.22" />
                </g>
              </svg>
            ) : (
              /* Luna */
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="catalog-shell" aria-labelledby="catalogTitle">
        <section className="catalog-hero">
          <div>
            <span>Menú</span>
            <h1 id="catalogTitle">{siteConfig.brandName}</h1>
            <p>Explora el menú, arma tu pedido y paga en minutos.</p>
          </div>
        </section>

        {source === "fallback" ? (
          <section className="menu-sync-notice" role="status" aria-live="polite">
            <strong>Menú de respaldo activo</strong>
            <p>No pudimos confirmar el menú actualizado. Revisa tu conexión o recarga la página antes de ordenar.</p>
            <button type="button" className="quest-button ghost" onClick={() => window.location.reload()}>Reintentar carga</button>
          </section>
        ) : null}

        <CatalogBannerRail banners={catalogBanners} />

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
