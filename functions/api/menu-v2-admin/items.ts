import { validateAssetKey, validateImageUrl } from '../_asset-utils';
import { mapD1ItemToMenuItem } from '../_menu-v2-utils';
import { generateId, requireAdminToken, type AdminEnv } from '../_orders-v2-utils';
import type { MenuCategory } from '../../../packages/config/src';

type Env = AdminEnv;

const CATEGORIES = new Set<MenuCategory['key']>(['burgers', 'combos', 'guarniciones', 'drinks', 'extras']);
const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,48}[A-Z0-9]$/;

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const normalizeOptionalString = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeSku = (value: unknown) => typeof value === 'string'
  ? value.trim().toUpperCase().replace(/[^A-Z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '')
  : '';

const parseBody = (input: unknown) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const body = input as Record<string, unknown>;
  const sku = normalizeSku(body.sku);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const price = typeof body.price === 'number' ? body.price : Number.NaN;
  const category = typeof body.category === 'string' ? body.category : '';
  const isAvailable = body.isAvailable;
  const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : Number.NaN;
  const imageUrl = validateImageUrl(body.imageUrl);
  const imageKey = validateAssetKey(body.imageKey);
  const stockManaged = Boolean(body.stockManaged);
  const stockRemainingRaw = body.stockRemaining == null || body.stockRemaining === '' ? null : Number(body.stockRemaining);
  const stockLimitRaw = body.stockLimit == null || body.stockLimit === '' ? stockRemainingRaw : Number(body.stockLimit);

  if (!SKU_PATTERN.test(sku) || !name || !Number.isFinite(price) || price < 0 || !CATEGORIES.has(category as MenuCategory['key']) || !Number.isInteger(sortOrder) || typeof isAvailable !== 'boolean' || imageUrl === undefined || imageKey === undefined) return null;
  if (stockManaged && (stockRemainingRaw == null || !Number.isInteger(stockRemainingRaw) || stockRemainingRaw < 0)) return null;
  if (stockLimitRaw != null && (!Number.isInteger(stockLimitRaw) || stockLimitRaw < 0)) return null;

  return {
    sku,
    name,
    description,
    price,
    category: category as MenuCategory['key'],
    isAvailable,
    badge: normalizeOptionalString(body.badge),
    promoLabel: normalizeOptionalString(body.promoLabel),
    sortOrder,
    imageUrl,
    imageKey,
    stockManaged,
    stockLimit: stockManaged ? stockLimitRaw : null,
    stockRemaining: stockManaged ? stockRemainingRaw : null
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

  const existing = await env.BOG_MENU_DB.prepare('SELECT sku FROM menu_items WHERE sku = ? LIMIT 1').bind(payload.sku).first<{ sku: string }>();
  if (existing) return json(409, { ok: false, error: 'SKU ya existe' });

  const priceCents = Math.round(payload.price * 100);
  const soldOutAt = payload.stockManaged && (payload.stockRemaining ?? 0) <= 0 ? new Date().toISOString() : null;
  const result = await env.BOG_MENU_DB.prepare(
    `INSERT INTO menu_items (id, sku, category_key, name, description, price_cents, tags_json, badge, promo_label, is_available, is_featured, sort_order, image_url, image_key, combo_links_json, upsell_items_json, stock_managed, stock_limit, stock_remaining, sold_out_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, 0, ?, ?, ?, '[]', '[]', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(generateId('mi'), payload.sku, payload.category, payload.name, payload.description, priceCents, payload.badge, payload.promoLabel, payload.isAvailable ? 1 : 0, payload.sortOrder, payload.imageUrl, payload.imageKey, payload.stockManaged ? 1 : 0, payload.stockLimit, payload.stockRemaining, soldOutAt).run();

  if (!result.success) return json(500, { ok: false, error: 'No se pudo crear producto' });

  const itemRow = await env.BOG_MENU_DB.prepare(
    `SELECT sku, category_key AS category, name, description, price_cents AS price, tags_json, badge, promo_label AS promoLabel, is_available AS isAvailable,
            CASE WHEN stock_managed = 1 AND COALESCE(stock_remaining, 0) <= 0 THEN 0 ELSE is_available END AS effectiveIsAvailable,
            stock_managed AS stockManaged, stock_limit AS stockLimit, stock_remaining AS stockRemaining, sold_out_at AS soldOutAt,
            is_featured AS isFeatured, sort_order AS sortOrder, image_url AS imageUrl, image_key AS imageKey, combo_links_json, upsell_items_json, updated_at AS updatedAt
     FROM menu_items WHERE sku = ? LIMIT 1`
  ).bind(payload.sku).first();

  return itemRow ? json(201, { ok: true, item: mapD1ItemToMenuItem(itemRow) }) : json(500, { ok: false, error: 'No se pudo recuperar producto' });
};
