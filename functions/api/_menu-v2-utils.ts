import type { MenuCategoryBanner, MenuItem, PromoCard } from '../../packages/config/src';

export const parseJsonArray = (value: unknown): string[] => {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
};

export const mapD1ItemToMenuItem = (row: any): MenuItem => ({
  sku: row.sku,
  category: row.category,
  name: row.name,
  description: row.description,
  price: Number(row.price) / 100,
  tags: parseJsonArray(row.tags_json),
  badge: row.badge ?? undefined,
  promoLabel: row.promoLabel ?? undefined,
  isAvailable: Boolean(row.effectiveIsAvailable ?? row.isAvailable),
  stockManaged: Boolean(row.stockManaged ?? row.stock_managed ?? false),
  stockLimit: row.stockLimit ?? row.stock_limit ?? undefined,
  stockRemaining: row.stockRemaining ?? row.stock_remaining ?? undefined,
  soldOutAt: row.soldOutAt ?? row.sold_out_at ?? undefined,
  isFeatured: Boolean(row.isFeatured),
  sortOrder: Number(row.sortOrder),
  imageUrl: row.imageUrl ?? undefined,
  imageKey: row.imageKey ?? undefined,
  comboLinks: parseJsonArray(row.combo_links_json),
  upsellItems: parseJsonArray(row.upsell_items_json),
  updatedAt: row.updatedAt
});

export const mapD1PromoToPromoCard = (row: any): PromoCard => ({
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
    alt: row.asset_alt ?? row.title,
    placeholder: row.asset_placeholder ?? 'combo',
    imageUrl: row.asset_image_url ?? undefined,
    imageKey: row.asset_image_key ?? undefined
  },
  updatedAt: row.updatedAt
});


export const mapD1CategoryBanner = (row: any): MenuCategoryBanner => ({
  categoryKey: row.categoryKey ?? row.category_key,
  title: row.title ?? undefined,
  subtitle: row.subtitle ?? undefined,
  imageKey: row.imageKey ?? row.image_key ?? undefined,
  imageUrl: row.imageUrl ?? row.image_url ?? undefined,
  updatedAt: row.updatedAt ?? row.updated_at
});
