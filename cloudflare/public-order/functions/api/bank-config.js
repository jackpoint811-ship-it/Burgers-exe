function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return jsonResponse(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } });
  }

  return jsonResponse(200, {
    ok: true,
    data: {
      enabled: false,
      message: 'Stub Fase 1. En Fase 2 leerá configuración bancaria segura desde backend.'
    }
  });
}
