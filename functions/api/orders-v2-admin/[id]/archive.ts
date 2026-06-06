import { errorResponse, fetchOrderBundle, generateId, json, requireAdminToken, type AdminEnv } from '../../_orders-v2-utils';

export const onRequestPatch: PagesFunction<AdminEnv> = async ({ env, request, params }) => {
  if (!env.BOG_MENU_DB) return errorResponse(503, 'MISSING_DB', 'BOG_MENU_DB no está configurado.');
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;

  const id = String(params.id ?? '').trim();
  if (!id) return errorResponse(400, 'INVALID_ORDER_ID', 'Order id requerido.');

  try {
    const currentRow = await env.BOG_MENU_DB.prepare('SELECT * FROM orders_v2 WHERE id = ? LIMIT 1').bind(id).first<any>();
    if (!currentRow) return errorResponse(404, 'NOT_FOUND', 'Orden no encontrada.');
    if (String(currentRow.status) !== 'cancelled') return errorResponse(400, 'ORDER_NOT_CANCELLED', 'Solo se pueden ocultar órdenes canceladas.');
    if (currentRow.archived_at) return errorResponse(409, 'ORDER_ALREADY_ARCHIVED', 'La orden cancelada ya está oculta.');

    const now = new Date().toISOString();
    const eventId = generateId('evt');
    const detail = JSON.stringify({ source: 'internal-v2', archiveType: 'soft' });
    const result = await env.BOG_MENU_DB.batch([
      env.BOG_MENU_DB.prepare('UPDATE orders_v2 SET archived_at = ?, updated_at = ? WHERE id = ? AND status = \'cancelled\' AND archived_at IS NULL').bind(now, now, id),
      env.BOG_MENU_DB.prepare(
        `INSERT INTO order_events_v2 (id, order_id, type, previous_status, next_status, detail_json, actor, created_at)
         VALUES (?, ?, 'ORDER_ARCHIVED', 'cancelled', 'cancelled', ?, 'internal-v2', ?)`
      ).bind(eventId, id, detail, now)
    ]);
    if (!result.every((entry) => entry.success)) return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo ocultar la orden cancelada.');

    const order = await fetchOrderBundle(env.BOG_MENU_DB, id);
    if (!order) return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo recuperar la orden ocultada.');
    const event = order.events?.find((entry) => entry.id === eventId);
    return json(200, { ok: true, data: { order, event } });
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo ocultar la orden cancelada.');
  }
};

export const onRequest: PagesFunction<AdminEnv> = async (context) => {
  if (context.request.method !== 'PATCH') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use PATCH.');
  return onRequestPatch(context);
};
