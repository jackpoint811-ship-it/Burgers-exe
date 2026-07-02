import {
  buildSessionCookie,
  getClientIp,
  isIpAllowed,
  jsonResponse,
  SESSION_MAX_AGE,
  SESSION_SCOPE_NAME,
  signSession,
} from '../_shared/auth.js';

const attemptsByIp = new Map();
const RATE_LIMIT_MAX_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function consumeAttempt(ip) {
  const now = Date.now();
  const record = attemptsByIp.get(ip) || { count: 0, windowStart: now };

  if (now - record.windowStart >= RATE_LIMIT_WINDOW_MS) {
    record.count = 0;
    record.windowStart = now;
  }

  record.count += 1;
  attemptsByIp.set(ip, record);

  return record.count <= RATE_LIMIT_MAX_ATTEMPTS;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!isIpAllowed(request, env)) {
    return jsonResponse(403, {
      ok: false,
      error: { code: 'FORBIDDEN_IP', message: 'IP no permitida.' },
    });
  }

  if (!env.INTERNAL_PANEL_PIN || !env.INTERNAL_SESSION_SECRET) {
    return jsonResponse(500, {
      ok: false,
      error: { code: 'MISSING_ENV', message: 'Faltan variables de entorno requeridas.' },
    });
  }

  const clientIp = getClientIp(request) || 'unknown';
  if (!consumeAttempt(clientIp)) {
    return jsonResponse(429, {
      ok: false,
      error: { code: 'RATE_LIMITED', message: 'Intenta de nuevo en un minuto.' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, {
      ok: false,
      error: { code: 'INVALID_BODY', message: 'Body inválido.' },
    });
  }

  if (!body || body.pin !== env.INTERNAL_PANEL_PIN) {
    return jsonResponse(401, {
      ok: false,
      error: { code: 'INVALID_PIN', message: 'PIN inválido.' },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await signSession(
    {
      iat: now,
      exp: now + SESSION_MAX_AGE,
      scope: SESSION_SCOPE_NAME,
    },
    env.INTERNAL_SESSION_SECRET
  );

  return jsonResponse(
    200,
    { ok: true, data: { authenticated: true } },
    { 'Set-Cookie': buildSessionCookie(token) }
  );
}

export function onRequest(context) {
  if (context.request.method !== 'POST') {
    return jsonResponse(405, {
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' },
    });
  }

  return onRequestPost(context);
}
