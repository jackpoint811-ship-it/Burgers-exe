import type { OrderV2PaymentStatus, UpdateOrderV2PaymentPayload } from '../../../../packages/config/src';
import {
  assertOrderMatchesEnvironment,
  errorResponse,
  fetchOrderBundle,
  generateId,
  json,
  parseJsonObject,
  parseOrderEnvironment,
  requireAdminToken,
  type AdminEnv
} from '../../_orders-v2-utils';

type Env = AdminEnv;

const PAYMENT_STATUSES = new Set<OrderV2PaymentStatus>(['pending', 'paid', 'cancelled']);
const NOTES_MAX_LENGTH = 500;
const REASON_MAX_LENGTH = 200;

const hasOwn = (body: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(body, key);

const parsePayload = (body: Record<string, unknown>): UpdateOrderV2PaymentPayload | Response => {
  const paymentStatus = typeof body.paymentStatus === 'string' ? body.paymentStatus.trim() as OrderV2PaymentStatus : '' as OrderV2PaymentStatus;
  if (!PAYMENT_STATUSES.has(paymentStatus)) return errorResponse(400, 'INVALID_PAYMENT_STATUS', 'Payment status inválido.');

  const payload: UpdateOrderV2PaymentPayload = { paymentStatus };

  if (hasOwn(body, 'notes')) {
    if (typeof body.notes !== 'string') return errorResponse(400, 'INVALID_NOTES', 'Notas inválidas.');
    if (body.notes.length > NOTES_MAX_LENGTH) return errorResponse(400, 'INVALID_NOTES', 'Notas exceden el máximo permitido.');
    payload.notes = body.notes;
  }

  if (hasOwn(body, 'reason')) {
    if (typeof body.reason !== 'string') return errorResponse(400, 'INVALID_REASON', 'Razón inválida.');
    const reason = body.reason.trim();
    if (reason.length > REASON_MAX_LENGTH) return errorResponse(400, 'INVALID_REASON', 'Razón excede el máximo permitido.');
    payload.reason = reason || undefined;
  }
  const environment = parseOrderEnvironment(body.environment);
  if (!environment) return errorResponse(400, 'INVALID_ENVIRONMENT', 'Ambiente de orden inválido.');
  payload.environment = environment;

  return payload;
};

export const onRequestPatch: PagesFunction<Env> = async ({ env, params, request }) => {
  if (!env.BOG_MENU_DB) return errorResponse(503, 'D1_NOT_CONFIGURED', 'BOG_MENU_DB no está configurado.');
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
    if (!currentRow) return errorResponse(404, 'ORDER_NOT_FOUND', 'Orden no encontrada.');
    const environmentError = assertOrderMatchesEnvironment(currentRow, payload.environment ?? 'production');
    if (environmentError) return environmentError;

    const now = new Date().toISOString();
    const eventId = generateId('evt');
    const currentOrderStatus = String(currentRow.status);
    const previousPaymentStatus = String(currentRow.payment_status ?? 'pending') as OrderV2PaymentStatus;
    const notesUpdated = hasOwn(body, 'notes');
    const detail = JSON.stringify({
      previousPaymentStatus,
      nextPaymentStatus: payload.paymentStatus,
      notesUpdated,
      reason: payload.reason ?? '',
      source: 'internal-v2',
      environment: payload.environment ?? 'production'
    });

    const updateStatement = notesUpdated
      ? env.BOG_MENU_DB.prepare('UPDATE orders_v2 SET payment_status = ?, notes = ?, updated_at = ? WHERE id = ?').bind(payload.paymentStatus, payload.notes ?? '', now, id)
      : env.BOG_MENU_DB.prepare('UPDATE orders_v2 SET payment_status = ?, updated_at = ? WHERE id = ?').bind(payload.paymentStatus, now, id);

    const batchResult = await env.BOG_MENU_DB.batch([
      updateStatement,
      env.BOG_MENU_DB.prepare(
        `INSERT INTO order_events_v2 (id, order_id, type, previous_status, next_status, detail_json, actor, created_at)
         VALUES (?, ?, 'PAYMENT_UPDATED', ?, ?, ?, 'internal-v2', ?)`
      ).bind(eventId, id, currentOrderStatus, currentOrderStatus, detail, now)
    ]);
    if (!batchResult.every((entry) => entry.success)) return errorResponse(500, 'PAYMENT_UPDATE_FAILED', 'No se pudo actualizar el pago operativo.');

    const order = await fetchOrderBundle(env.BOG_MENU_DB, id);
    if (!order) return errorResponse(500, 'PAYMENT_UPDATE_FAILED', 'No se pudo recuperar la orden actualizada.');
    const event = order.events?.find((entry) => entry.id === eventId);
    return json(200, { ok: true, data: { order, event } });
  } catch {
    return errorResponse(500, 'PAYMENT_UPDATE_FAILED', 'No se pudo actualizar el pago operativo.');
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'PATCH') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use PATCH.');
  return onRequestPatch(context);
};
