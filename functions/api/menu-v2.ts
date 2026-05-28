import { menuCategories, menuItems, promoCards, siteConfig, type MenuCategory, type MenuItem, type MenuV2Response, type PromoCard, type SiteConfig } from '../../packages/config/src';
import { mapD1ItemToMenuItem, parseJsonArray } from './_menu-v2-utils';

type Env = { BOG_MENU_DB?: D1Database };

const fallbackPayload = (source: MenuV2Response['source']): MenuV2Response => ({
  categories: [...menuCategories].sort((a, b) => a.sortOrder - b.sortOrder),
  items: [...menuItems].sort((a, b) => a.sortOrder - b.sortOrder),
  promos: [...promoCards].sort((a, b) => a.sortOrder - b.sortOrder),
  siteConfig,
  updatedAt: new Date().toISOString(),
  source
});

const json = (payload: MenuV2Response, cacheControl = 'public, max-age=60, stale-while-revalidate=60') =>
  new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cacheControl } });

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.BOG_MENU_DB) return json(fallbackPayload('fallback'), 'no-store');
  try {
    const [categoriesResult, itemsResult, promosResult, siteResult] = await Promise.all([
      env.BOG_MENU_DB.prepare('SELECT id, key, name, sort_order AS sortOrder FROM menu_categories ORDER BY sort_order ASC').all(),
      env.BOG_MENU_DB.prepare('SELECT sku, category_key AS category, name, description, price_cents AS price, tags_json, badge, promo_label AS promoLabel, is_available AS isAvailable, is_featured AS isFeatured, sort_order AS sortOrder, image_url AS imageUrl, image_key AS imageKey, combo_links_json, upsell_items_json, updated_at AS updatedAt FROM menu_items ORDER BY sort_order ASC').all(),
      env.BOG_MENU_DB.prepare('SELECT id, title, description, badge, promo_label AS promoLabel, is_featured AS isFeatured, is_available AS isAvailable, sort_order AS sortOrder, tags_json, combo_links_json, asset_alt, asset_placeholder, asset_image_url, asset_image_key, updated_at AS updatedAt FROM promo_cards ORDER BY sort_order ASC').all(),
      env.BOG_MENU_DB.prepare('SELECT brand_name, currency, order_modes_json, support_phone, hero_cta, notice, updated_at AS updatedAt FROM site_config ORDER BY updated_at DESC LIMIT 1').first()
    ]);

    const categories: MenuCategory[] = (categoriesResult.results ?? []).map((row: any) => ({ ...row }));
    const items: MenuItem[] = (itemsResult.results ?? []).map((row: any) => mapD1ItemToMenuItem(row));
    const promos: PromoCard[] = (promosResult.results ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      badge: row.badge ?? undefined,
      promoLabel: row.promoLabel ?? undefined,
      isFeatured: Boolean(row.isFeatured),
      isAvailable: Boolean(row.isAvailable),
      sortOrder: Number(row.sortOrder),
      tags: parseJsonArray(row.tags_json),
      comboLinks: parseJsonArray(row.combo_links_json),
      asset: {
        alt: row.asset_alt,
        placeholder: row.asset_placeholder,
        imageUrl: row.asset_image_url ?? undefined,
        imageKey: row.asset_image_key ?? undefined
      },
      updatedAt: row.updatedAt
    }));

    const configRow = siteResult as any;
    const resolvedSiteConfig: SiteConfig = configRow
      ? { brandName: configRow.brand_name, currency: configRow.currency, orderModes: parseJsonArray(configRow.order_modes_json) as SiteConfig['orderModes'], supportPhone: configRow.support_phone, heroCta: configRow.hero_cta, notice: configRow.notice, updatedAt: configRow.updatedAt }
      : siteConfig;

    const updatedAt = [
      ...items.map((item) => item.updatedAt ?? ''),
      ...promos.map((promo) => promo.updatedAt ?? ''),
      resolvedSiteConfig.updatedAt ?? ''
    ].filter(Boolean).sort().at(-1) ?? new Date().toISOString();

    return json({ categories, items, promos, siteConfig: resolvedSiteConfig, updatedAt, source: 'd1' });
  } catch {
    return json(fallbackPayload('fallback'), 'no-store');
  }
};
