import { mapD1ItemToMenuItem } from '../../../_menu-v2-utils';
import { requireAdminToken, type AdminEnv } from '../../../_orders-v2-utils';

type Env = AdminEnv;

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const ITEM_SELECT =
  `SELECT sku, category_key AS category, name, description, price_cents AS price, tags_json, badge, promo_label AS promoLabel, is_available AS isAvailable,
          CASE WHEN stock_managed = 1 AND COALESCE(stock_remaining, 0) <= 0 THEN 0 ELSE is_available END AS effectiveIsAvailable,
          stock_managed AS stockManaged, stock_limit AS stockLimit, stock_remaining AS stockRemaining, sold_out_at AS soldOutAt,
          is_featured AS isFeatured, sort_order AS sortOrder, image_url AS imageUrl, image_key AS imageKey, combo_links_json, upsell_items_json, updated_at AS updatedAt FROM menu_items WHERE sku = ? LIMIT 1`;

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

  const isAvailable = raw && typeof raw === 'object' ? (raw as { isAvailable?: unknown }).isAvailable : undefined;
  if (typeof isAvailable !== 'boolean') return json(400, { ok: false, error: 'Invalid payload' });

  const result = await env.BOG_MENU_DB.prepare(
    'UPDATE menu_items SET is_available = ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?'
  )
    .bind(isAvailable ? 1 : 0, sku)
    .run();

  if (!result.success || (result.meta?.changes ?? 0) < 1) return json(404, { ok: false, error: 'Item not found' });

  const itemRow = await env.BOG_MENU_DB.prepare(ITEM_SELECT).bind(sku).first();
  if (!itemRow) return json(404, { ok: false, error: 'Item not found' });

  return json(200, { ok: true, item: mapD1ItemToMenuItem(itemRow) });
};
