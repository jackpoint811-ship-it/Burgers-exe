import { menuCategories, menuItems, promoCards, publicConfig, siteConfig, type MenuV2Response } from '@config/index';

const toFallbackMenuResponse = (source: MenuV2Response['source']): MenuV2Response => ({
  categories: [...menuCategories],
  items: [...menuItems],
  promos: [...promoCards],
  siteConfig,
  publicConfig,
  updatedAt: new Date().toISOString(),
  source
});

export async function loadMenuV2(): Promise<MenuV2Response> {
  try {
    const response = await fetch('/api/menu-v2', { cache: 'no-store', headers: { accept: 'application/json' } });
    if (!response.ok) return toFallbackMenuResponse('fallback');
    const data = (await response.json()) as MenuV2Response;
    if (!Array.isArray(data?.items) || !Array.isArray(data?.promos) || !Array.isArray(data?.categories)) {
      return toFallbackMenuResponse('fallback');
    }
    return { ...data, publicConfig: data.publicConfig ?? publicConfig };
  } catch {
    return toFallbackMenuResponse('fallback');
  }
}

export { toFallbackMenuResponse };
