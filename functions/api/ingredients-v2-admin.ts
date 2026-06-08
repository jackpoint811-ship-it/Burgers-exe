import { errorResponse, generateId, json, parseJsonObject, requireAdminToken, type AdminEnv } from './_orders-v2-utils';
import { mapD1Ingredient, normalizeIngredientPayload } from './_ingredients-v2-utils';

type Env = AdminEnv;

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.BOG_MENU_DB) return errorResponse(503, 'D1_NOT_CONFIGURED', 'BOG_MENU_DB no está configurado.');
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;
  const result = await env.BOG_MENU_DB.prepare('SELECT * FROM ingredients_v2 ORDER BY sort_order ASC, name ASC').all();
  return json(200, { ok: true, data: { ingredients: (result.results ?? []).map(mapD1Ingredient) } });
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.BOG_MENU_DB) return errorResponse(503, 'D1_NOT_CONFIGURED', 'BOG_MENU_DB no está configurado.');
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;
  const body = await parseJsonObject(request);
  if (!body) return errorResponse(400, 'INVALID_JSON', 'JSON inválido.');
  const payload = normalizeIngredientPayload(body);
  if (payload instanceof Response) return payload;
  const id = generateId('ing');
  await env.BOG_MENU_DB.prepare(
    `INSERT INTO ingredients_v2 (id, name, unit, unit_price_cents, is_quantifiable, is_active, sort_order)
     VALUES (?, ?, ?, ?, 1, ?, ?)`
  ).bind(id, payload.name, payload.unit, payload.unitPriceCents, payload.isActive ? 1 : 0, payload.sortOrder).run();
  const row = await env.BOG_MENU_DB.prepare('SELECT * FROM ingredients_v2 WHERE id = ? LIMIT 1').bind(id).first();
  return json(201, { ok: true, data: { ingredient: mapD1Ingredient(row) } });
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'GET') return onRequestGet(context);
  if (context.request.method === 'POST') return onRequestPost(context);
  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use GET o POST.');
};
