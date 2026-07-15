import type { CatalogBanner } from "@config/index";
import { resolveCatalogAssetUrl } from "../lib/catalog-mode";

type CatalogBannerRailProps = {
  banners: CatalogBanner[];
};

export function CatalogBannerRail({ banners }: CatalogBannerRailProps) {
  const active = banners
    .filter((b) => b.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (!active.length) return null;

  return (
    <section className="catalog-banner-rail" aria-label="Promociones y destacados">
      <ul className="catalog-banner-rail__list" role="list">
        {active.map((banner) => {
          const src = resolveCatalogAssetUrl(banner.imageUrl, banner.imageKey);
          return (
            <li key={banner.id} className="catalog-banner-card glass-card">
              {src ? (
                <div className="catalog-banner-card__image" aria-hidden="true">
                  <img src={src} alt="" loading="lazy" decoding="async" />
                </div>
              ) : null}
              <div className="catalog-banner-card__body">
                <p className="catalog-banner-card__title">{banner.title}</p>
                {banner.subtitle ? (
                  <p className="catalog-banner-card__subtitle">{banner.subtitle}</p>
                ) : null}
                {banner.ctaLabel ? (
                  <span className="catalog-banner-card__cta" aria-hidden="true">
                    {banner.ctaLabel}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
