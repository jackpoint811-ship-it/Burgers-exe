import type { OrderV2Status, UpdateOrderV2StatusPayload } from '../../../../packages/config/src';
import {
  assertOrderMatchesEnvironment,
  errorResponse,
  fetchOrderBundle,
  generateId,
  json,
  parseJsonObject,
  parseOrderEnvironment,
  requireAdminToken,
  validateStatusTransition,
  type AdminEnv
} from '../../_orders-v2-utils';

type Env = AdminEnv;

const ORDER_STATUSES = new Set<OrderV2Status>(['new', 'preparing', 'ready', 'delivered', 'cancelled']);

const parsePayload = (body: Record<string, unknown>): UpdateOrderV2StatusPayload | Response => {
  const status = typeof body.status === 'string' ? body.status.trim() as OrderV2Status : '' as OrderV2Status;
  if (!ORDER_STATUSES.has(status)) return errorResponse(400, 'INVALID_STATUS', 'Estado inválido.');
  const reason = typeof body.reason === 'string' ? body.reason.trim() : undefined;
  if (reason && reason.length > 500) return errorResponse(400, 'INVALID_REASON', 'Razón excede el máximo permitido.');
  const environment = parseOrderEnvironment(body.environment);
  if (!environment) return errorResponse(400, 'INVALID_ENVIRONMENT', 'Ambiente de orden inválido.');
  return { status, reason: reason || undefined, environment };
};

export const onRequestPatch: PagesFunction<Env> = async ({ env, params, request }) => {
  if (!env.BOG_MENU_DB) return errorResponse(503, 'MISSING_DB', 'BOG_MENU_DB no está configurado.');
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;

  const id = String(params.id ?? '').trim();
  if (!id) return errorResponse(400, 'INVALID_ORDER_ID', 'Order id requerido.');

  const body = await parseJsonObject(request);
  if (!body) return errorResponse(400, 'INVALID_JSON', 'JSON inválido.');
  const payload = parsePayload(body);
  if (payload instanceof Response) return payload;

  try {
    const currentRow = await env.BOG_MENU_DB.prepare('SELECT * FROM orders_v2 WHERE id = ? LIMIT 1').bind(id).first<any>();
    if (!currentRow) return errorResponse(404, 'NOT_FOUND', 'Orden no encontrada.');
    const environmentError = assertOrderMatchesEnvironment(currentRow, payload.environment ?? 'production');
    if (environmentError) return environmentError;
    const currentStatus = String(currentRow.status) as OrderV2Status;
    if (!validateStatusTransition(currentStatus, payload.status)) {
      return errorResponse(400, 'INVALID_STATUS_TRANSITION', 'Transición de estado inválida.');
    }

    const now = new Date().toISOString();
    const eventId = generateId('evt');
    const eventType = payload.status === 'cancelled' ? 'ORDER_CANCELLED' : 'STATUS_CHANGED';
    const detail = JSON.stringify({ reason: payload.reason ?? '', source: 'internal-v2', environment: payload.environment ?? 'production' });
    const batchResult = await env.BOG_MENU_DB.batch([
      env.BOG_MENU_DB.prepare('UPDATE orders_v2 SET status = ?, updated_at = ? WHERE id = ?').bind(payload.status, now, id),
      env.BOG_MENU_DB.prepare(
        `INSERT INTO order_events_v2 (id, order_id, type, previous_status, next_status, detail_json, actor, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'internal-v2', ?)`
      ).bind(eventId, id, eventType, currentStatus, payload.status, detail, now)
    ]);
    if (!batchResult.every((entry) => entry.success)) return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo actualizar la orden.');

    const order = await fetchOrderBundle(env.BOG_MENU_DB, id);
    if (!order) return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo recuperar la orden actualizada.');
    const event = order.events?.find((entry) => entry.id === eventId);
    return json(200, { ok: true, data: { order, event } });
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo actualizar la orden.');
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'PATCH') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use PATCH.');
  return onRequestPatch(context);
};
