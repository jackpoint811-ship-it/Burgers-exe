import { validateAssetKey, validateImageUrl } from '../../_asset-utils';
import { mapD1ItemToMenuItem } from '../../_menu-v2-utils';
import { requireAdminToken, type AdminEnv } from '../../_orders-v2-utils';

type Env = AdminEnv;

type UpdatePayload = {
  name: string;
  description: string;
  price: number;
  isAvailable: boolean;
  isFeatured: boolean;
  badge: string | null;
  promoLabel: string | null;
  sortOrder: number;
  imageUrl: string | null;
  imageKey: string | null;
  stockManaged: boolean;
  stockLimit: number | null;
  stockRemaining: number | null;
  comboLinks: string[];
};

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const normalizeLinkArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const links = value
    .map((entry) => (typeof entry === 'string' ? entry.trim().toUpperCase() : ''))
    .filter((entry) => entry.length > 0);
  return [...new Set(links)];
};

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
  const isFeatured = body.isFeatured;
  const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : Number.NaN;
  const imageUrl = validateImageUrl(body.imageUrl);
  const imageKey = validateAssetKey(body.imageKey);
  const comboLinks = normalizeLinkArray(body.comboLinks);

  const stockManaged = Boolean(body.stockManaged);
  const stockRemainingRaw = body.stockRemaining == null || body.stockRemaining === '' ? null : Number(body.stockRemaining);
  const stockLimitRaw = body.stockLimit == null || body.stockLimit === '' ? stockRemainingRaw : Number(body.stockLimit);

  if (!name || !description || !Number.isFinite(price) || price < 0 || !Number.isInteger(sortOrder) || typeof isAvailable !== 'boolean' || typeof isFeatured !== 'boolean' || imageUrl === undefined || imageKey === undefined || comboLinks === null) {
    return null;
  }
  if (stockManaged && (stockRemainingRaw == null || !Number.isInteger(stockRemainingRaw) || stockRemainingRaw < 0)) return null;
  if (stockLimitRaw != null && (!Number.isInteger(stockLimitRaw) || stockLimitRaw < 0)) return null;

  return {
    name,
    description,
    price,
    isAvailable,
    isFeatured,
    badge: normalizeOptionalString(body.badge),
    promoLabel: normalizeOptionalString(body.promoLabel),
    sortOrder,
    imageUrl,
    imageKey,
    stockManaged,
    stockLimit: stockManaged ? stockLimitRaw : null,
    stockRemaining: stockManaged ? stockRemainingRaw : null,
    comboLinks
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
  const soldOutAt = payload.stockManaged && (payload.stockRemaining ?? 0) <= 0 ? new Date().toISOString() : null;

  const result = await env.BOG_MENU_DB.prepare(
    `UPDATE menu_items
     SET name = ?, description = ?, price_cents = ?, is_available = ?, is_featured = ?, badge = ?, promo_label = ?, sort_order = ?, image_url = ?, image_key = ?, combo_links_json = ?, stock_managed = ?, stock_limit = ?, stock_remaining = ?, sold_out_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE sku = ?`
  )
    .bind(payload.name, payload.description, priceCents, payload.isAvailable ? 1 : 0, payload.isFeatured ? 1 : 0, payload.badge, payload.promoLabel, payload.sortOrder, payload.imageUrl, payload.imageKey, JSON.stringify(payload.comboLinks), payload.stockManaged ? 1 : 0, payload.stockLimit, payload.stockRemaining, soldOutAt, sku)
    .run();

  if (!result.success || (result.meta?.changes ?? 0) < 1) return json(404, { ok: false, error: 'Invalid payload' });

  const itemRow = await env.BOG_MENU_DB.prepare(
    `SELECT sku, category_key AS category, name, description, price_cents AS price, tags_json, badge, promo_label AS promoLabel, is_available AS isAvailable,
            CASE WHEN stock_managed = 1 AND COALESCE(stock_remaining, 0) <= 0 THEN 0 ELSE is_available END AS effectiveIsAvailable,
            stock_managed AS stockManaged, stock_limit AS stockLimit, stock_remaining AS stockRemaining, sold_out_at AS soldOutAt,
            is_featured AS isFeatured, sort_order AS sortOrder, image_url AS imageUrl, image_key AS imageKey, combo_links_json, upsell_items_json, updated_at AS updatedAt FROM menu_items WHERE sku = ? LIMIT 1`
  )
    .bind(sku)
    .first();

  if (!itemRow) return json(404, { ok: false, error: 'Invalid payload' });

  return json(200, { ok: true, item: mapD1ItemToMenuItem(itemRow) });
};
