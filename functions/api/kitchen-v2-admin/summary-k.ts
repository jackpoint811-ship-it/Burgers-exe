import { errorResponse, json, requireAdminToken, type AdminEnv } from '../_orders-v2-utils';

type Env = AdminEnv;
type ItemRow = { sku: string; name: string; qty: number; snapshot_json: string };
type IngredientRecipeRow = { product_sku: string; ingredient_id: string; name: string; unit: string; unit_price_cents: number | null; quantity_per_unit: number; sort_order: number };

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const SUMMARY_STATUSES = "('new', 'preparing', 'ready', 'delivered')";
const centsOrNull = (value: unknown) => {
  const cents = Number(value);
  return Number.isFinite(cents) ? cents : null;
};

const parseSnapshot = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const itemKindFromSnapshot = (row: ItemRow) => {
  const snapshot = parseSnapshot(row.snapshot_json);
  const kind = typeof snapshot.itemKind === 'string' ? snapshot.itemKind : '';
  const category = typeof snapshot.category === 'string' ? snapshot.category : '';
  if (kind === 'burger' || kind === 'combo' || kind === 'garnish') return kind;
  if (category === 'burgers' || category === 'combos') return category === 'combos' ? 'combo' : 'burger';
  if (category === 'guarniciones') return 'garnish';
  return 'other';
};

const addQty = (map: Map<string, { sku: string; name: string; quantity: number }>, sku: string, name: string, qty: number) => {
  const current = map.get(sku) ?? { sku, name, quantity: 0 };
  current.quantity += qty;
  map.set(sku, current);
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.BOG_MENU_DB) return errorResponse(503, 'D1_NOT_CONFIGURED', 'BOG_MENU_DB no está configurado.');
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;

  const url = new URL(request.url);
  const date = url.searchParams.get('date')?.trim() || new Date().toISOString().slice(0, 10);
  if (!DATE_ONLY_RE.test(date)) return errorResponse(400, 'INVALID_DATE', 'Fecha inválida. Usa YYYY-MM-DD.');
  const fromUtc = `${date}T00:00:00.000Z`;
  const toUtc = `${date}T23:59:59.999Z`;

  try {
    const recipeCountRow = await env.BOG_MENU_DB.prepare('SELECT COUNT(*) AS count FROM product_ingredient_recipes_v2').first<{ count: number }>();
    const hasRecipes = Number(recipeCountRow?.count) > 0;

    const itemsSql = `
      SELECT i.sku, i.name, SUM(i.qty) AS qty, i.snapshot_json
      FROM order_items_v2 i
      JOIN orders_v2 o ON o.id = i.order_id
      WHERE o.created_at >= ? AND o.created_at <= ?
        AND o.status IN ${SUMMARY_STATUSES}
        AND o.status != 'cancelled'
        AND o.archived_at IS NULL
      GROUP BY i.sku, i.name, i.snapshot_json`;

    const itemsResult = await env.BOG_MENU_DB.prepare(itemsSql).bind(fromUtc, toUtc).all<ItemRow>();

    const burgers = new Map<string, { sku: string; name: string; quantity: number }>();
    const garnishes = new Map<string, { sku: string; name: string; quantity: number }>();
    const consumedQtyBySku = new Map<string, number>();

    (itemsResult.results ?? []).forEach((row) => {
      const qty = Number(row.qty) || 0;
      const sku = String(row.sku);
      const kind = itemKindFromSnapshot(row);
      consumedQtyBySku.set(sku, (consumedQtyBySku.get(sku) ?? 0) + qty);
      if (kind === 'burger' || kind === 'combo') addQty(burgers, sku, String(row.name), qty);
      if (kind === 'garnish') addQty(garnishes, sku, String(row.name), qty);
      const snapshot = parseSnapshot(row.snapshot_json);
      const garnish = snapshot.garnish && typeof snapshot.garnish === 'object' ? snapshot.garnish as Record<string, unknown> : null;
      const garnishSku = typeof garnish?.sku === 'string' ? garnish.sku.trim() : '';
      const garnishName = typeof garnish?.name === 'string' ? garnish.name : '';
      if (garnishSku) consumedQtyBySku.set(garnishSku, (consumedQtyBySku.get(garnishSku) ?? 0) + qty);
      if ((kind === 'combo' || kind === 'burger') && garnishSku) addQty(garnishes, garnishSku, garnishName || garnishSku, qty);
    });

    const recipeRows = hasRecipes && consumedQtyBySku.size
      ? (await env.BOG_MENU_DB.prepare(`
          SELECT
            r.product_sku AS product_sku,
            r.ingredient_id AS ingredient_id,
            r.quantity_per_unit AS quantity_per_unit,
            ing.name AS name,
            ing.unit AS unit,
            ing.unit_price_cents AS unit_price_cents,
            ing.sort_order AS sort_order
          FROM product_ingredient_recipes_v2 r
          JOIN ingredients_v2 ing ON ing.id = r.ingredient_id
          WHERE r.product_sku IN (${[...consumedQtyBySku.keys()].map(() => '?').join(', ')})
            AND ing.is_active = 1
            AND ing.is_quantifiable = 1
          ORDER BY ing.sort_order ASC, ing.name ASC`
        ).bind(...consumedQtyBySku.keys()).all<IngredientRecipeRow>()).results ?? []
      : [];

    const ingredientsById = new Map<string, { ingredientId: string; name: string; unit: string; quantity: number; unitPriceCents: number | null; estimatedCostCents: number | null; sortOrder: number }>();
    recipeRows.forEach((row) => {
      const consumedQty = consumedQtyBySku.get(String(row.product_sku)) ?? 0;
      const quantity = consumedQty * (Number(row.quantity_per_unit) || 0);
      const ingredientId = String(row.ingredient_id);
      const current = ingredientsById.get(ingredientId) ?? {
        ingredientId,
        name: String(row.name),
        unit: String(row.unit),
        quantity: 0,
        unitPriceCents: centsOrNull(row.unit_price_cents),
        estimatedCostCents: centsOrNull(row.unit_price_cents) === null ? null : 0,
        sortOrder: Number(row.sort_order) || 0
      };
      current.quantity += quantity;
      if (current.unitPriceCents !== null) current.estimatedCostCents = Math.round(current.quantity * current.unitPriceCents);
      ingredientsById.set(ingredientId, current);
    });

    const ingredients = [...ingredientsById.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map(({ sortOrder: _sortOrder, ...ingredient }) => ingredient);
    const estimatedCosts = ingredients.map((ingredient) => ingredient.estimatedCostCents).filter((value): value is number => value !== null);

    return json(200, {
      ok: true,
      data: {
        source: 'd1',
        range: { date, fromUtc, toUtc },
        hasRecipes,
        totals: {
          burgers: [...burgers.values()].reduce((acc, item) => acc + item.quantity, 0),
          garnishes: [...garnishes.values()].reduce((acc, item) => acc + item.quantity, 0),
          ingredients: ingredients.length,
          estimatedCostCents: estimatedCosts.length ? estimatedCosts.reduce((acc, value) => acc + value, 0) : null
        },
        burgers: [...burgers.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)),
        garnishes: [...garnishes.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)),
        ingredients,
        generatedAt: new Date().toISOString()
      }
    });
  } catch {
    return errorResponse(500, 'SUMMARY_K_FAILED', 'No se pudo calcular Resumen K.');
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'GET') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use GET.');
  return onRequestGet(context);
};
