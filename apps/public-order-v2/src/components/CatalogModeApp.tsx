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
      {/* ── Header fijo de la app (PR 2) ─────────────────────────────────────────── */}
      <header className="site-header" role="banner">
        <div className="site-header__container">
          <div className="site-header__brand">
            <a href="/" className="site-header__logo-link" aria-label="Burgers.exe — Inicio">
              <svg
                className="site-header__logo-icon"
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                aria-hidden="true"
              >
                <rect width="32" height="32" rx="10" fill="var(--color-accent-soft)" stroke="var(--color-accent-line)" />
                <path d="M 8 11 C 8 7, 24 7, 24 11 Z" fill="var(--color-accent)" />
                <rect x="7" y="14" width="18" height="3" rx="1.5" fill="var(--color-warning)" />
                <path d="M 8 20 H 24 C 24 23, 20 25, 16 25 C 12 25, 8 23, 8 20 Z" fill="var(--color-accent)" />
              </svg>
              <span className="site-header__logo-text">
                Burgers<span className="site-header__logo-ext">.exe</span>
              </span>
            </a>
          </div>

          <div className="site-header__status">
            <span
              className="store-status-badge store-status-badge--open"
              role="status"
              aria-label="Estado del servicio: Abierto"
            >
              <span className="store-status-badge__dot" aria-hidden="true" />
              <span>Abierto</span>
            </span>
          </div>

          <div className="site-header__actions">
            <a href="/tickets" className="site-header__tickets-btn" aria-label="Consultar tickets de rifas">
              <span aria-hidden="true">🎟️</span>
              <span className="site-header__tickets-label">Tickets</span>
            </a>
            <button
              id="dark-mode-toggle"
              type="button"
              className="site-header__theme-toggle"
              onClick={toggleDark}
              aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-pressed={isDark}
            >
              <span aria-hidden="true">{isDark ? "☀️" : "🌙"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="catalog-shell" aria-labelledby="catalogTitle">
        <section className="catalog-hero" id="catalog-hero">
          <div className="catalog-hero__content">
            <div className="catalog-hero__badge-row">
              <span className="catalog-hero__eyebrow">Menú Oficial</span>
              <span className="catalog-hero__schedule-badge" aria-label="Horario de atención: 13:00 a 22:30 hrs">
                <span aria-hidden="true">🕒</span> Horario: 13:00 - 22:30 hrs
              </span>
            </div>
            <h1 id="catalogTitle" className="catalog-hero__title">
              {siteConfig.brandName}
            </h1>
            <p className="catalog-hero__tagline">Hamburguesas Reales. Sabor Neón.</p>
            <div className="catalog-hero__actions">
              <a
                href="#catalog-category-nav"
                className="catalog-hero__cta-btn"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("catalog-category-nav")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Ver Menú
              </a>
            </div>
          </div>

          <div className="catalog-hero__illustration" aria-hidden="true">
            <div className="hero-burger-vector">
              <svg
                className="hero-burger-svg"
                viewBox="0 0 240 220"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <defs>
                  <filter id="neon-glow-bun" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="neon-glow-cheese" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <linearGradient id="bun-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#D97706" />
                  </linearGradient>
                  <linearGradient id="patty-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4A2511" />
                    <stop offset="100%" stopColor="#2A1207" />
                  </linearGradient>
                  <linearGradient id="cheese-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FBBF24" />
                    <stop offset="100%" stopColor="#F59E0B" />
                  </linearGradient>
                </defs>

                <ellipse cx="120" cy="188" rx="85" ry="14" fill="var(--color-accent-soft)" className="svg-shadow-aura" />

                <path
                  d="M 35 165 C 35 155, 205 155, 205 165 C 205 182, 175 190, 120 190 C 65 190, 35 182, 35 165 Z"
                  fill="url(#bun-gradient)"
                  stroke="var(--color-accent)"
                  strokeWidth="2.5"
                  className="svg-bun-bottom"
                />

                <path
                  d="M 28 142 C 28 134, 212 134, 212 142 C 212 156, 192 160, 120 160 C 48 160, 28 156, 28 142 Z"
                  fill="url(#patty-gradient)"
                  stroke="#9A3412"
                  strokeWidth="2"
                  className="svg-patty"
                />

                <path
                  d="M 30 132 L 210 132 L 195 148 L 170 136 L 140 156 L 115 135 L 85 152 L 60 134 Z"
                  fill="url(#cheese-gradient)"
                  stroke="var(--color-warning)"
                  strokeWidth="2.5"
                  className="svg-cheese"
                  filter="url(#neon-glow-cheese)"
                />

                <path
                  d="M 32 124 Q 50 114, 70 125 Q 90 135, 110 122 Q 130 112, 150 126 Q 170 136, 190 122 Q 208 114, 208 124 Q 120 134, 32 124 Z"
                  fill="#22C55E"
                  stroke="var(--color-accent)"
                  strokeWidth="2"
                  className="svg-lettuce"
                />

                <path
                  d="M 35 116 C 35 48, 205 48, 205 116 Z"
                  fill="url(#bun-gradient)"
                  stroke="var(--color-accent)"
                  strokeWidth="3"
                  className="svg-bun-top"
                  filter="url(#neon-glow-bun)"
                />

                <path
                  d="M 60 70 Q 120 52, 180 70"
                  stroke="rgba(255, 255, 255, 0.45)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />

                <g className="svg-sesame-seeds" fill="#FEF3C7">
                  <ellipse cx="85" cy="78" rx="4" ry="2" transform="rotate(-15 85 78)" />
                  <ellipse cx="120" cy="68" rx="4" ry="2" transform="rotate(5 120 68)" />
                  <ellipse cx="155" cy="76" rx="4" ry="2" transform="rotate(20 155 76)" />
                  <ellipse cx="98" cy="95" rx="4" ry="2" transform="rotate(-10 98 95)" />
                  <ellipse cx="142" cy="94" rx="4" ry="2" transform="rotate(15 142 94)" />
                  <ellipse cx="70" cy="98" rx="4" ry="2" transform="rotate(-25 70 98)" />
                  <ellipse cx="170" cy="96" rx="4" ry="2" transform="rotate(25 170 96)" />
                </g>

                <circle cx="22" cy="50" r="3" fill="var(--color-accent)" className="svg-sparkle-1" />
                <circle cx="218" cy="70" r="4" fill="var(--color-warning)" className="svg-sparkle-2" />
                <circle cx="205" cy="170" r="2.5" fill="var(--color-accent)" className="svg-sparkle-3" />
              </svg>
            </div>
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
