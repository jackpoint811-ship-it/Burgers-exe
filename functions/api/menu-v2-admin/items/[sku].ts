import { validateAssetKey, validateImageUrl } from '../../_asset-utils';
import { mapD1ItemToMenuItem } from '../../_menu-v2-utils';
import { requireAdminToken, type AdminEnv } from '../../_orders-v2-utils';

type Env = AdminEnv;

type UpdatePayload = {
  name: string;
  description: string;
  price: number;
  isAvailable: boolean;
  badge: string | null;
  promoLabel: string | null;
  sortOrder: number;
  imageUrl: string | null;
  imageKey: string | null;
};

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const normalizeOptionalString = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseBody = (input: unknown): UpdatePayload | null => {
  if (!input || typeof input !== 'object') return null;
  const body = input as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const price = typeof body.price === 'number' ? body.price : Number.NaN;
  const isAvailable = body.isAvailable;
  const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : Number.NaN;
  const imageUrl = validateImageUrl(body.imageUrl);
  const imageKey = validateAssetKey(body.imageKey);

  if (!name || !description || !Number.isFinite(price) || price <= 0 || !Number.isInteger(sortOrder) || typeof isAvailable !== 'boolean' || imageUrl === undefined || imageKey === undefined) {
    return null;
  }

  return {
    name,
    description,
    price,
    isAvailable,
    badge: normalizeOptionalString(body.badge),
    promoLabel: normalizeOptionalString(body.promoLabel),
    sortOrder,
    imageUrl,
    imageKey
  };
};

export const onRequestPatch: PagesFunction<Env> = async ({ env, params, request }) => {
  if (!env.BOG_MENU_DB) return json(503, { ok: false, error: 'Admin disabled' });
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;

  const sku = String(params.sku ?? '').trim();
  if (!sku) return json(400, { ok: false, error: 'Invalid payload' });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid payload' });
  }

  const payload = parseBody(raw);
  if (!payload) return json(400, { ok: false, error: 'Invalid payload' });

  const priceCents = Math.round(payload.price * 100);

  const result = await env.BOG_MENU_DB.prepare(
    `UPDATE menu_items
     SET name = ?, description = ?, price_cents = ?, is_available = ?, badge = ?, promo_label = ?, sort_order = ?, image_url = ?, image_key = ?, updated_at = CURRENT_TIMESTAMP
     WHERE sku = ?`
  )
    .bind(payload.name, payload.description, priceCents, payload.isAvailable ? 1 : 0, payload.badge, payload.promoLabel, payload.sortOrder, payload.imageUrl, payload.imageKey, sku)
    .run();

  if (!result.success || (result.meta?.changes ?? 0) < 1) return json(404, { ok: false, error: 'Invalid payload' });

  const itemRow = await env.BOG_MENU_DB.prepare(
    'SELECT sku, category_key AS category, name, description, price_cents AS price, tags_json, badge, promo_label AS promoLabel, is_available AS isAvailable, is_featured AS isFeatured, sort_order AS sortOrder, image_url AS imageUrl, image_key AS imageKey, combo_links_json, upsell_items_json, updated_at AS updatedAt FROM menu_items WHERE sku = ? LIMIT 1'
  )
    .bind(sku)
    .first();

  if (!itemRow) return json(404, { ok: false, error: 'Invalid payload' });

  return json(200, { ok: true, item: mapD1ItemToMenuItem(itemRow) });
};
