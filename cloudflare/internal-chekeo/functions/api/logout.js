import { buildLogoutCookie, jsonResponse } from '../_shared/auth.js';

export function onRequest(context) {
  if (context.request.method !== 'POST') {
    return jsonResponse(405, {
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' },
    });
  }

  return jsonResponse(200, { ok: true }, { 'Set-Cookie': buildLogoutCookie() });
}
