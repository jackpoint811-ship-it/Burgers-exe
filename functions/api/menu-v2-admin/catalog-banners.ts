import { validateAssetKey, validateImageUrl } from '../_asset-utils';
import { mapD1CatalogBanner } from '../_menu-v2-utils';
import { requireAdminToken, type AdminEnv } from '../_orders-v2-utils';

type Env = AdminEnv;

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
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const imageUrl = validateImageUrl(body.imageUrl);
  const imageKey = validateAssetKey(body.imageKey);
  if (!title || imageUrl === undefined || imageKey === undefined) return null;
  if (body.sortOrder !== undefined && (typeof body.sortOrder !== 'number' || !Number.isInteger(body.sortOrder))) return null;

  return {
    title,
    subtitle: normalizeOptionalString(body.subtitle),
    ctaLabel: normalizeOptionalString(body.ctaLabel),
    imageUrl,
    imageKey,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
    sortOrder: body.sortOrder ?? 0,
  };
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.BOG_MENU_DB) return json(503, { ok: false, error: 'Admin disabled' });
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;

  let raw: unknown;
  try { raw = await request.json(); } catch { return json(400, { ok: false, error: 'Invalid payload' }); }
  const payload = parseBody(raw);
  if (!payload) return json(400, { ok: false, error: 'Invalid payload' });

  const id = `cb-${crypto.randomUUID()}`;

  const result = await env.BOG_MENU_DB.prepare(
    `INSERT INTO catalog_banners (id, title, subtitle, cta_label, image_key, image_url, is_active, sort_order, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(
    id,
    payload.title,
    payload.subtitle,
    payload.ctaLabel,
    payload.imageKey,
    payload.imageUrl,
    payload.isActive ? 1 : 0,
    payload.sortOrder
  ).run();

  if (!result.success) return json(500, { ok: false, error: 'No se pudo crear el banner' });

  const row = await env.BOG_MENU_DB.prepare('SELECT id, title, subtitle, cta_label, image_key, image_url, is_active, sort_order, updated_at FROM catalog_banners WHERE id = ? LIMIT 1').bind(id).first();
  return row ? json(201, { ok: true, banner: mapD1CatalogBanner(row) }) : json(500, { ok: false, error: 'No se pudo recuperar el banner creado' });
};
