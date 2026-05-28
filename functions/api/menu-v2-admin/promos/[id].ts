import { validateAssetKey, validateImageUrl } from '../../_asset-utils';
import { mapD1PromoToPromoCard } from '../../_menu-v2-utils';

/* PATCH /api/menu-v2-admin/promos/:id */
type Env = { BOG_MENU_DB?: D1Database; BOG_MENU_ADMIN_TOKEN?: string };

type UpdatePayload = {
  title: string;
  description: string;
  badge: string | null;
  promoLabel: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder: number;
  imageUrl: string | null;
  imageKey: string | null;
};

const PROMO_SELECT =
  'SELECT id, title, description, badge, promo_label AS promoLabel, is_featured AS isFeatured, is_available AS isAvailable, sort_order AS sortOrder, tags_json, combo_links_json, asset_alt, asset_placeholder, asset_image_url, asset_image_key, updated_at AS updatedAt FROM promo_cards WHERE id = ? LIMIT 1';

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const safeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i += 1) result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return result === 0;
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getAuthorizedId = (env: Env, params: EventContext<Env, string, unknown>['params'], request: Request): { id: string } | Response => {
  if (!env.BOG_MENU_ADMIN_TOKEN || !env.BOG_MENU_DB) return json(503, { ok: false, error: 'Admin disabled' });

  const authHeader = request.headers.get('Authorization');
  const providedToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!providedToken || !safeEqual(providedToken, env.BOG_MENU_ADMIN_TOKEN)) return json(401, { ok: false, error: 'Unauthorized' });

  const id = String(params.id ?? '').trim();
  if (!id) return json(400, { ok: false, error: 'Invalid promo id' });
  return { id };
};

const parseBody = (input: unknown): UpdatePayload | null => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const body = input as Record<string, unknown>;
  if ('id' in body) return null;

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const isAvailable = body.isAvailable;
  const isFeatured = body.isFeatured;
  const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : Number.NaN;
  const imageUrl = validateImageUrl(body.imageUrl);
  const imageKey = validateAssetKey(body.imageKey);

  if (!title || !description || typeof isAvailable !== 'boolean' || typeof isFeatured !== 'boolean' || !Number.isInteger(sortOrder) || imageUrl === undefined || imageKey === undefined) {
    return null;
  }

  return {
    title,
    description,
    badge: normalizeOptionalString(body.badge),
    promoLabel: normalizeOptionalString(body.promoLabel),
    isAvailable,
    isFeatured,
    sortOrder,
    imageUrl,
    imageKey
  };
};

export const onRequestPatch: PagesFunction<Env> = async ({ env, params, request }) => {
  const auth = getAuthorizedId(env, params, request);
  if (auth instanceof Response) return auth;
  const db = env.BOG_MENU_DB;
  if (!db) return json(503, { ok: false, error: 'Admin disabled' });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid payload' });
  }

  const payload = parseBody(raw);
  if (!payload) return json(400, { ok: false, error: 'Invalid payload' });

  const result = await db.prepare(
    `UPDATE promo_cards
     SET title = ?, description = ?, badge = ?, promo_label = ?, is_available = ?, is_featured = ?, sort_order = ?, asset_image_url = ?, asset_image_key = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  )
    .bind(payload.title, payload.description, payload.badge, payload.promoLabel, payload.isAvailable ? 1 : 0, payload.isFeatured ? 1 : 0, payload.sortOrder, payload.imageUrl, payload.imageKey, auth.id)
    .run();

  if (!result.success || (result.meta?.changes ?? 0) < 1) return json(404, { ok: false, error: 'Promo not found' });

  const promoRow = await db.prepare(PROMO_SELECT).bind(auth.id).first();
  if (!promoRow) return json(404, { ok: false, error: 'Promo not found' });

  return json(200, { ok: true, promo: mapD1PromoToPromoCard(promoRow) });
};
