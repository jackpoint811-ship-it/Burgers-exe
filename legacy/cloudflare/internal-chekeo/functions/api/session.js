import { isIpAllowed, jsonResponse, requireSession } from '../_shared/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!isIpAllowed(request, env)) {
    return jsonResponse(403, {
      ok: false,
      error: { code: 'FORBIDDEN_IP', message: 'IP no permitida.' },
    });
  }

  if (!env.INTERNAL_SESSION_SECRET) {
    return jsonResponse(500, {
      ok: false,
      error: { code: 'MISSING_ENV', message: 'Falta INTERNAL_SESSION_SECRET.' },
    });
  }

  const session = await requireSession(request, env);
  return jsonResponse(200, {
    ok: true,
    data: { authenticated: session.authenticated },
  });
}

export function onRequest(context) {
  if (context.request.method !== 'GET') {
    return jsonResponse(405, {
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' },
    });
  }

  return onRequestGet(context);
}
