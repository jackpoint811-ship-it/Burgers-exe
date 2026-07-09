import { menuCategories, menuItems, promoCards, publicConfig, siteConfig, type MenuCategory, type MenuItem, type MenuV2Response, type PromoCard, type SiteConfig } from '../../packages/config/src';
import { mapD1CategoryBanner, mapD1ItemToMenuItem, mapD1PromoToPromoCard, parseJsonArray } from './_menu-v2-utils';

type Env = { BOG_MENU_DB?: D1Database };

type D1Result<T> = { results?: T[] };

const CATEGORY_LABELS: Record<MenuCategory['key'], string> = {
  burgers: 'Burgers',
  extras: 'Extras',
  guarniciones: 'Guarniciones',
  drinks: 'Bebidas',
  combos: 'Combos'
};

const fallbackPayload = (source: MenuV2Response['source']): MenuV2Response => ({
  categories: [...menuCategories].sort((a, b) => a.sortOrder - b.sortOrder),
  items: [...menuItems].sort((a, b) => a.sortOrder - b.sortOrder),
  promos: [...promoCards].sort((a, b) => a.sortOrder - b.sortOrder),
  categoryBanners: [],
  siteConfig,
  publicConfig,
  updatedAt: new Date().toISOString(),
  source
});

const json = (payload: MenuV2Response, cacheControl = 'no-store') =>
  new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cacheControl } });

const optionalAll = async <T>(query: D1PreparedStatement): Promise<T[]> => {
  try {
    const result = await query.all<T>();
    return result.results ?? [];
  } catch {
    return [];
  }
};

const optionalFirst = async <T>(query: D1PreparedStatement): Promise<T | null> => {
  try {
    return await query.first<T>();
  } catch {
    return null;
  }
};

const isMenuCategoryKey = (value: unknown): value is MenuCategory['key'] =>
  value === 'burgers' || value === 'combos' || value === 'extras' || value === 'guarniciones' || value === 'drinks';

const deriveCategoriesFromItems = (items: MenuItem[]): MenuCategory[] => {
  const firstSortByCategory = new Map<MenuCategory['key'], number>();
  for (const item of items) {
    if (!firstSortByCategory.has(item.category)) firstSortByCategory.set(item.category, item.sortOrder);
  }
  return [...firstSortByCategory.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([key], index) => ({ id: `cat-${key}`, key, name: CATEGORY_LABELS[key], sortOrder: index + 1 }));
};

const resolveCategories = (rows: any[], items: MenuItem[]): MenuCategory[] => {
  const categories = rows
    .filter((row) => isMenuCategoryKey(row.key))
    .map((row) => ({
      id: String(row.id ?? `cat-${row.key}`),
      key: row.key as MenuCategory['key'],
      name: String(row.name ?? CATEGORY_LABELS[row.key as MenuCategory['key']]),
      sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0),
      updatedAt: row.updatedAt ?? row.updated_at ?? undefined
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return categories.length ? categories : deriveCategoriesFromItems(items);
};

const resolveSiteConfig = (row: any | null): SiteConfig => {
  if (!row) return { ...siteConfig, notice: '' };
  return {
    brandName: row.brand_name ?? row.brandName ?? siteConfig.brandName,
    currency: row.currency === 'MXN' ? 'MXN' : siteConfig.currency,
    orderModes: (parseJsonArray(row.order_modes_json ?? row.orderModes).filter((mode) => mode === 'pickup' || mode === 'delivery') as SiteConfig['orderModes']).length
      ? parseJsonArray(row.order_modes_json ?? row.orderModes).filter((mode) => mode === 'pickup' || mode === 'delivery') as SiteConfig['orderModes']
      : siteConfig.orderModes,
    supportPhone: row.support_phone ?? row.supportPhone ?? siteConfig.supportPhone,
    heroCta: row.hero_cta ?? row.heroCta ?? siteConfig.heroCta,
    notice: row.notice ?? '',
    updatedAt: row.updatedAt ?? row.updated_at ?? undefined
  };
};

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.BOG_MENU_DB) return json(fallbackPayload('fallback'), 'no-store');
  try {
    const itemsResult = await env.BOG_MENU_DB.prepare(`
      SELECT
        sku,
        category_key AS category,
        name,
        description,
        price_cents AS price,
        is_available AS isAvailable,
        CASE WHEN stock_managed = 1 AND COALESCE(stock_remaining, 0) <= 0 THEN 0 ELSE is_available END AS effectiveIsAvailable,
        stock_managed AS stockManaged,
        stock_limit AS stockLimit,
        stock_remaining AS stockRemaining,
        sold_out_at AS soldOutAt,
        is_featured AS isFeatured,
        sort_order AS sortOrder,
        image_url AS imageUrl,
        image_key AS imageKey,
        tags_json,
        combo_links_json,
        upsell_items_json,
        badge,
        promo_label AS promoLabel,
        updated_at AS updatedAt
      FROM menu_items
      ORDER BY category_key ASC, sort_order ASC, sku ASC
    `).all();

    const items: MenuItem[] = ((itemsResult as D1Result<any>).results ?? [])
      .map((row: any) => mapD1ItemToMenuItem(row))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const [categoryRows, promoRows, bannerRows, configRow] = await Promise.all([
      optionalAll<any>(env.BOG_MENU_DB.prepare('SELECT id, key, name, sort_order AS sortOrder, updated_at AS updatedAt FROM menu_categories ORDER BY sort_order ASC')),
      optionalAll<any>(env.BOG_MENU_DB.prepare('SELECT id, title, description, badge, promo_label AS promoLabel, is_featured AS isFeatured, is_available AS isAvailable, sort_order AS sortOrder, tags_json, combo_links_json, asset_alt, asset_placeholder, asset_image_url, asset_image_key, updated_at AS updatedAt FROM promo_cards ORDER BY sort_order ASC')),
      optionalAll<any>(env.BOG_MENU_DB.prepare('SELECT category_key AS categoryKey, title, subtitle, image_key AS imageKey, image_url AS imageUrl, updated_at AS updatedAt FROM menu_category_banners ORDER BY category_key ASC')),
      optionalFirst<any>(env.BOG_MENU_DB.prepare('SELECT brand_name, currency, order_modes_json, support_phone, hero_cta, notice, updated_at AS updatedAt FROM site_config ORDER BY updated_at DESC LIMIT 1'))
    ]);

    const categories = resolveCategories(categoryRows, items);
    const promos: PromoCard[] = promoRows.map((row: any) => mapD1PromoToPromoCard(row));
    const categoryBanners = bannerRows.map((row: any) => mapD1CategoryBanner(row)).filter((banner) => isMenuCategoryKey(banner.categoryKey));
    const resolvedSiteConfig = resolveSiteConfig(configRow);

    const updatedAt = [
      ...items.map((item) => item.updatedAt ?? ''),
      ...promos.map((promo) => promo.updatedAt ?? ''),
      ...categoryBanners.map((banner) => banner.updatedAt ?? ''),
      resolvedSiteConfig.updatedAt ?? ''
    ].filter(Boolean).sort().at(-1) ?? new Date().toISOString();

    return json({ categories, items, promos, categoryBanners, siteConfig: resolvedSiteConfig, publicConfig, updatedAt, source: 'd1' });
  } catch {
    return json(fallbackPayload('fallback'), 'no-store');
  }
};
