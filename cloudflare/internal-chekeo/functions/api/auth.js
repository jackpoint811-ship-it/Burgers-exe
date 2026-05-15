import { buildSessionCookie, jsonResponse, isIpAllowed, SESSION_MAX_AGE_SECONDS, SESSION_SCOPE, signSession } from '../_shared/auth.js';

const attempts = new Map();

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isIpAllowed(request, env)) {
    return jsonResponse(403, { ok: false, error: { code: 'FORBIDDEN', message: 'Acceso no permitido.' } });
  }
  if (!env.INTERNAL_PANEL_PIN || !env.INTERNAL_SESSION_SECRET) {
    return jsonResponse(500, { ok: false, error: { code: 'MISSING_ENV', message: 'Configuración interna incompleta.' } });
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const nowMs = Date.now();
  const slot = attempts.get(ip) || { count: 0, resetAt: nowMs + 60000 };
  if (nowMs > slot.resetAt) {
    slot.count = 0;
    slot.resetAt = nowMs + 60000;
  }
  if (slot.count >= 10) {
    return jsonResponse(429, { ok: false, error: { code: 'RATE_LIMITED', message: 'Intenta de nuevo en un minuto.' } });
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
  if (!pin || pin !== env.INTERNAL_PANEL_PIN) {
    slot.count += 1;
    attempts.set(ip, slot);
    return jsonResponse(401, { ok: false, error: { code: 'INVALID_PIN', message: 'PIN inválido.' } });
  }

  attempts.delete(ip);
  const now = Math.floor(Date.now() / 1000);
  const token = await signSession({ iat: now, exp: now + SESSION_MAX_AGE_SECONDS, scope: SESSION_SCOPE }, env.INTERNAL_SESSION_SECRET);
  return jsonResponse(200, { ok: true, data: { authenticated: true } }, { 'Set-Cookie': buildSessionCookie(token) });
}
