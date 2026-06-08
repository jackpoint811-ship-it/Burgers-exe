import { validateAssetKey, validateImageUrl } from '../_asset-utils';
import { mapD1CategoryBanner } from '../_menu-v2-utils';
import { requireAdminToken, type AdminEnv } from '../_orders-v2-utils';
import type { MenuCategory } from '../../../packages/config/src';

type Env = AdminEnv;

const CATEGORIES = new Set<MenuCategory['key']>(['burgers', 'combos', 'guarniciones', 'drinks', 'extras']);
const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const normalizeOptionalString = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const parseBody = (input: unknown) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const body = input as Record<string, unknown>;
  const categoryKey = typeof body.categoryKey === 'string' ? body.categoryKey : '';
  const imageUrl = validateImageUrl(body.imageUrl);
  const imageKey = validateAssetKey(body.imageKey);
  if (!CATEGORIES.has(categoryKey as MenuCategory['key']) || imageUrl === undefined || imageKey === undefined) return null;
  return {
    categoryKey: categoryKey as MenuCategory['key'],
    title: normalizeOptionalString(body.title),
    subtitle: normalizeOptionalString(body.subtitle),
    imageUrl,
    imageKey
  };
};

export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.BOG_MENU_DB) return json(503, { ok: false, error: 'Admin disabled' });
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;

  let raw: unknown;
  try { raw = await request.json(); } catch { return json(400, { ok: false, error: 'Invalid payload' }); }
  const payload = parseBody(raw);
  if (!payload) return json(400, { ok: false, error: 'Invalid payload' });

  const result = await env.BOG_MENU_DB.prepare(
    `INSERT INTO menu_category_banners (category_key, title, subtitle, image_key, image_url, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(category_key) DO UPDATE SET
       title = excluded.title,
       subtitle = excluded.subtitle,
       image_key = excluded.image_key,
       image_url = excluded.image_url,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(payload.categoryKey, payload.title, payload.subtitle, payload.imageKey, payload.imageUrl).run();
  if (!result.success) return json(500, { ok: false, error: 'No se pudo guardar banner' });

  const row = await env.BOG_MENU_DB.prepare('SELECT category_key AS categoryKey, title, subtitle, image_key AS imageKey, image_url AS imageUrl, updated_at AS updatedAt FROM menu_category_banners WHERE category_key = ? LIMIT 1').bind(payload.categoryKey).first();
  return row ? json(200, { ok: true, banner: mapD1CategoryBanner(row) }) : json(500, { ok: false, error: 'No se pudo recuperar banner' });
};
