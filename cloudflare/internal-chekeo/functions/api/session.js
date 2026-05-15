import { getSessionCookie, jsonResponse, verifySession } from '../_shared/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.INTERNAL_SESSION_SECRET) {
    return jsonResponse(500, { ok: false, error: { code: 'MISSING_ENV', message: 'Configuración interna incompleta.' } });
  }
  const cookie = getSessionCookie(request);
  const session = await verifySession(cookie, env.INTERNAL_SESSION_SECRET);
  return jsonResponse(200, { ok: true, data: { authenticated: Boolean(session) } });
}
