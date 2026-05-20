import { isIpAllowed, jsonResponse, requireSession } from '../_shared/auth.js';

const ALLOWED_METHODS = new Set([
  'healthCheck',
  'getAppOrders',
  'getDailySummary',
  'getBankConfig',
  'getOrderDetail',
  'getClientTicketData',
  'getCloseDayPreview',
  'getHistoryPreview',
  'validateProductionReadiness',
  'getProductionMigrationPreview',
  'getHistoryOrders',
  'getNormalizedAppOrders',
  'getNormalizedOrderDetail',
  'previewNormalizedOrdersRead',
  'ensureNormalizedOperationalHeaders',
  'previewNormalizedOperationsReadiness',
  'ensureNormalizedKitchenHeaders',
  'previewNormalizedKitchenReadiness',
  'updateNormalizedBurgerStatus',
  'markNormalizedBurgersReady',
  'updateNormalizedGuarnicionStatus',
  'completeNormalizedOrderIfReady',
  'updateNormalizedProductionStatus',
  'updateNormalizedDeliveryStatus',
  'markNormalizedOrderDelivered',
  'getNormalizedOrderFinalizationState',
  'updateNormalizedOrderStatus',
  'updateNormalizedPaymentStatus',
  'markNormalizedOrderPaid',
  'markNormalizedGuarnicionDone',
  'updateNormalizedOrderNotes',
  'markNormalizedTicketSent',
  'previewNormalizedCloseDay',
  'archiveNormalizedCloseDayToDrive',
  'syncOrdersFromMaster',
  'updateOrderStatus',
  'updateOrderOperationalData',
  'updateOrderPayment',
  'markOrderPaid',
  'markOrderSideReady',
  'updateOrderNotes',
  'markTicketSent',
  'writeDailySummary',
  'archiveCompletedOrders',
  'closeDay',
]);

function hasRequiredEnv(env) {
  return Boolean(env?.APPS_SCRIPT_INTERNAL_ENDPOINT && env?.INTERNAL_API_SHARED_SECRET && env?.INTERNAL_SESSION_SECRET);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!hasRequiredEnv(env)) {
    return jsonResponse(500, { ok: false, error: { code: 'MISSING_ENV', message: 'Configuración interna incompleta.' } });
  }

  if (!isIpAllowed(request, env)) {
    return jsonResponse(403, { ok: false, error: { code: 'FORBIDDEN_IP', message: 'IP no permitida.' } });
  }

  const session = await requireSession(request, env);
  if (!session.authenticated) {
    return jsonResponse(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sesión requerida.' } });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { ok: false, error: { code: 'INVALID_ARGS', message: 'args debe ser un arreglo.' } });
  }

  const method = payload && payload.method;
  const args = payload && payload.args;

  if (typeof method !== 'string' || !ALLOWED_METHODS.has(method)) {
    return jsonResponse(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' } });
  }

  if (!Array.isArray(args)) {
    return jsonResponse(400, { ok: false, error: { code: 'INVALID_ARGS', message: 'args debe ser un arreglo.' } });
  }

  try {
    const upstreamResponse = await fetch(env.APPS_SCRIPT_INTERNAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'internalApi',
        auth: {
          secret: env.INTERNAL_API_SHARED_SECRET,
          scheme: 'internal-shared-secret-v1',
        },
        rpc: { method, args },
      }),
    });

    if (!upstreamResponse.ok) {
      return jsonResponse(502, { ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Error en servicio interno.' } });
    }

    const upstreamData = await upstreamResponse.json();
    return jsonResponse(200, upstreamData);
  } catch {
    return jsonResponse(502, { ok: false, error: { code: 'UPSTREAM_NETWORK', message: 'No se pudo conectar al servicio interno.' } });
  }
}

export function onRequest(context) {
  if (context.request.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' } });
  }

  return onRequestPost(context);
}
