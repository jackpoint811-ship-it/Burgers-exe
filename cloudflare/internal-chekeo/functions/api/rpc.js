import { jsonResponse, requireSession } from '../_shared/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireSession(request, env);
  if (!auth.ok) return auth.response;

  if (!env.APPS_SCRIPT_INTERNAL_ENDPOINT || !env.INTERNAL_API_SHARED_SECRET) {
    return jsonResponse(500, { ok: false, error: { code: 'MISSING_ENV', message: 'Configuración interna incompleta.' } });
  }

  let body;
  try { body = await request.json(); } catch { return jsonResponse(400, { ok: false, error: { code: 'INVALID_JSON', message: 'Body JSON inválido.' } }); }

  const upstreamResp = await fetch(env.APPS_SCRIPT_INTERNAL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, auth: { secret: env.INTERNAL_API_SHARED_SECRET, scheme: 'shared-secret-body-v1' } })
  });

  const text = await upstreamResp.text();
  return new Response(text, {
    status: upstreamResp.status,
    headers: {
      'Content-Type': upstreamResp.headers.get('Content-Type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}
