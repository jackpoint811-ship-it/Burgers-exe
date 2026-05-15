import { jsonResponse, requireSession } from '../_shared/auth.js';

const ALLOWED_METHODS = new Set([
  'healthCheck','syncOrdersFromMaster','getAppOrders','getOrderDetail','getClientTicketData','updateOrderStatus','updateOrderOperationalData','updateOrderPayment','markOrderPaid','markOrderSideReady','updateOrderNotes','markTicketSent','getDailySummary','getBankConfig','getCloseDayPreview','writeDailySummary','archiveCompletedOrders','closeDay','getHistoryPreview','validateProductionReadiness','getProductionMigrationPreview','prepareProductionSheets','getHistoryOrders'
]);

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireSession(request, env);
  if (!auth.ok) return auth.response;
  if (!env.APPS_SCRIPT_INTERNAL_ENDPOINT || !env.INTERNAL_API_SHARED_SECRET) {
    return jsonResponse(500, { ok: false, error: { code: 'MISSING_ENV', message: 'Configuración interna incompleta.' } });
  }

  let body;
  try { body = await request.json(); } catch { return jsonResponse(400, { ok: false, error: { code: 'INVALID_JSON', message: 'Body JSON inválido.' } }); }
  const method = body && typeof body.method === 'string' ? body.method : '';
  const args = body && Array.isArray(body.args) ? body.args : null;
  if (!method || !ALLOWED_METHODS.has(method)) return jsonResponse(400, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' } });
  if (!args) return jsonResponse(400, { ok: false, error: { code: 'INVALID_ARGS', message: 'args debe ser un arreglo.' } });

  try {
    const upstreamResp = await fetch(env.APPS_SCRIPT_INTERNAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'internalApi', auth: { secret: env.INTERNAL_API_SHARED_SECRET, scheme: 'internal-shared-secret-v1' }, rpc: { method, args } })
    });
    const text = await upstreamResp.text();
    if (!upstreamResp.ok) {
      return jsonResponse(502, { ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Error en servicio interno.' }, details: { status: upstreamResp.status, body: text.slice(0, 500) } });
    }
    return new Response(text, { status: 200, headers: { 'Content-Type': upstreamResp.headers.get('Content-Type') || 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  } catch {
    return jsonResponse(502, { ok: false, error: { code: 'UPSTREAM_NETWORK', message: 'No se pudo conectar al servicio interno.' } });
  }
}
