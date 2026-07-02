function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

const DEFAULT_GATE = {
  closed: false,
  title: 'PEDIDOS CERRADOS POR AHORA',
  message: 'Por el momento no estamos recibiendo pedidos. Únete al grupo de WhatsApp para enterarte cuando abramos pedidos otra vez.',
  whatsappUrl: 'https://chat.whatsapp.com/GycE5zALOypGPvJVaMfbPp'
};

function normalizeGatePayload(payload) {
  return {
    closed: payload && payload.closed === true,
    title: String((payload && payload.title) || DEFAULT_GATE.title).trim() || DEFAULT_GATE.title,
    message: String((payload && payload.message) || DEFAULT_GATE.message).trim() || DEFAULT_GATE.message,
    whatsappUrl: String((payload && payload.whatsappUrl) || DEFAULT_GATE.whatsappUrl).trim() || DEFAULT_GATE.whatsappUrl
  };
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return jsonResponse(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } });
  }

  const endpoint = context.env.APPS_SCRIPT_ORDER_GATE_ENDPOINT;
  if (!endpoint) {
    return jsonResponse(200, { ok: true, ...DEFAULT_GATE });
  }

  try {
    const upstreamResp = await fetch(endpoint, { method: 'GET' });
    const upstreamData = await upstreamResp.json();
    if (!upstreamResp.ok || !upstreamData || upstreamData.ok !== true) {
      return jsonResponse(200, { ok: true, ...DEFAULT_GATE });
    }

    const normalized = normalizeGatePayload(upstreamData);
    return jsonResponse(200, { ok: true, ...normalized });
  } catch (_error) {
    return jsonResponse(200, { ok: true, ...DEFAULT_GATE });
  }
}
