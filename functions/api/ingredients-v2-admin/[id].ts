import { errorResponse, json, parseJsonObject, requireAdminToken, type AdminEnv } from '../_orders-v2-utils';
import { mapD1Ingredient, normalizeIngredientPayload } from '../_ingredients-v2-utils';

type Env = AdminEnv;

export const onRequestPatch: PagesFunction<Env> = async ({ env, request, params }) => {
  if (!env.BOG_MENU_DB) return errorResponse(503, 'D1_NOT_CONFIGURED', 'BOG_MENU_DB no está configurado.');
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;
  const id = String(params.id ?? '').trim();
  if (!id) return errorResponse(400, 'INVALID_ID', 'Ingrediente inválido.');
  const existing = await env.BOG_MENU_DB.prepare('SELECT * FROM ingredients_v2 WHERE id = ? LIMIT 1').bind(id).first();
  if (!existing) return errorResponse(404, 'NOT_FOUND', 'Ingrediente no encontrado.');
  const body = await parseJsonObject(request);
  if (!body) return errorResponse(400, 'INVALID_JSON', 'JSON inválido.');
  const payload = normalizeIngredientPayload({
    name: body.name ?? existing.name,
    unit: body.unit ?? existing.unit,
    unitPriceCents: Object.prototype.hasOwnProperty.call(body, 'unitPriceCents') ? body.unitPriceCents : existing.unit_price_cents,
    isActive: Object.prototype.hasOwnProperty.call(body, 'isActive') ? body.isActive : Boolean(existing.is_active),
    sortOrder: body.sortOrder ?? existing.sort_order
  });
  if (payload instanceof Response) return payload;
  await env.BOG_MENU_DB.prepare(
    `UPDATE ingredients_v2 SET name = ?, unit = ?, unit_price_cents = ?, is_active = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(payload.name, payload.unit, payload.unitPriceCents, payload.isActive ? 1 : 0, payload.sortOrder, id).run();
  const row = await env.BOG_MENU_DB.prepare('SELECT * FROM ingredients_v2 WHERE id = ? LIMIT 1').bind(id).first();
  return json(200, { ok: true, data: { ingredient: mapD1Ingredient(row) } });
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'PATCH') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use PATCH.');
  return onRequestPatch(context);
};
