import type { MenuCategory, MenuItem, SiteConfig } from "@config/index";
import { useMemo, useState } from "react";
import {
  type CatalogProduct,
  mapMenuItemsToCatalogProducts
} from "../lib/catalog-mode";
import { formatCurrency } from "../lib/order";

type CatalogModeAppProps = {
  items: MenuItem[];
  categories: MenuCategory[];
  siteConfig: SiteConfig;
};

const SAFE_IMAGE_KEY_PATTERN = /^[a-zA-Z0-9/_.,@-]+$/;

const isSafeSameOriginPath = (value: string) => {
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//") || value.includes("\\") || value.includes("..")) return false;
  return true;
};

const isSafeHttpsImageUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
};

const isSafeAssetKey = (value: string) => {
  const key = value.trim().replace(/^\/+/, "");
  if (!key || !SAFE_IMAGE_KEY_PATTERN.test(key) || key.includes("..") || key.includes("\\") || key.includes("//")) return false;
  return key.split("/").every((segment) => segment && segment !== "." && segment !== "..");
};

const resolveCatalogAssetUrl = (imageUrl?: string, imageKey?: string): string | undefined => {
  const trimmedKey = imageKey?.trim().replace(/^\/+/, "");
  if (trimmedKey && isSafeAssetKey(trimmedKey)) {
    return `/api/assets-v2/${trimmedKey.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;
  }

  const trimmedUrl = imageUrl?.trim();
  if (trimmedUrl && (isSafeSameOriginPath(trimmedUrl) || isSafeHttpsImageUrl(trimmedUrl))) return trimmedUrl;
  return undefined;
};

const PRODUCT_TYPE_LABELS: Record<CatalogProduct["type"], string> = {
  burger: "Burger fija",
  combo: "Combo",
  side: "Guarnicion",
  topping: "Topping separado",
  drink: "Bebida"
};

const CatalogProductCard = ({ product }: { product: CatalogProduct }) => {
  const src = resolveCatalogAssetUrl(product.imageUrl, product.imageKey);

  return (
    <article className={product.isAvailable ? "catalog-card" : "catalog-card catalog-card--disabled"}>
      <div className="catalog-card__image" aria-hidden={!src}>
        {src ? <img src={src} alt={product.name} loading="lazy" /> : <span>{product.type}</span>}
      </div>
      <div className="catalog-card__meta">
        <div className="catalog-card__eyebrow">
          <span>{PRODUCT_TYPE_LABELS[product.type]}</span>
          {product.badge ? <em>{product.badge}</em> : null}
        </div>
        <h3>{product.name}</h3>
        {product.description ? <p>{product.description}</p> : null}
        {product.type === "burger" ? <small>Ingredientes informativos. Esta burger no se modifica en Modo Catalogo.</small> : null}
        {product.type === "topping" ? <small>Se agrega como producto separado y no se integra directamente a la burger.</small> : null}
        <div className="catalog-card__footer">
          <strong>{formatCurrency(product.price)}</strong>
          <button type="button" disabled>{product.isAvailable ? "Agregar pronto" : "No disponible"}</button>
        </div>
      </div>
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

  const filteredProducts = activeCategory === "all"
    ? products
    : products.filter((product) => product.categoryKey === activeCategory);

  return (
    <main className="catalog-shell" aria-labelledby="catalogTitle">
      <section className="catalog-hero">
        <div>
          <span>Modo Catalogo</span>
          <h1 id="catalogTitle">{siteConfig.brandName}</h1>
          <p>Primer vistazo del catalogo visual. El flujo completo de pedido sigue protegido en Modo Flujo.</p>
        </div>
        <aside aria-label="Estado del catalogo">
          <strong>Catalogo en preparacion</strong>
          <small>Checkout y carrito operativo quedan para siguientes PRs.</small>
        </aside>
      </section>

      <nav className="catalog-category-nav" aria-label="Categorias de catalogo">
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
        <section className="catalog-grid" aria-label="Productos del catalogo">
          {filteredProducts.map((product) => <CatalogProductCard product={product} key={product.id} />)}
        </section>
      ) : (
        <section className="catalog-empty" role="status">
          <h2>Catalogo sin productos visibles</h2>
          <p>Cuando el menu publique productos disponibles, apareceran aqui sin afectar el Modo Flujo.</p>
        </section>
      )}

      <footer className="catalog-note">
        Catalogo en preparacion. El flujo de pedido completo sigue disponible en Modo Flujo.
      </footer>
    </main>
  );
}
