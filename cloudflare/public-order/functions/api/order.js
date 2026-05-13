const PRICE_TABLE = {
  OG: 85,
  BBQ: 85,
  PAPAS_OG: 20,
  PAPAS_ESPECIALES: 25,
  PAPAS_LEMON_PEPPER: 25,
  AROS_CEBOLLA: 30,
  EXTRA_PEPINILLOS: 5,
  EXTRA_QUESO_AMERICANO: 5,
  EXTRA_QUESO_MANCHEGO: 5,
  EXTRA_TOCINO: 5,
  EXTRA_CATSUP: 5,
  EXTRA_MOSTAZA: 5,
  EXTRA_TOMATE: 5
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function computeTotal(items) {
  return (items || []).reduce((acc, item) => {
    const qty = Number(item && item.qty ? item.qty : 0);
    const sku = item && item.sku ? String(item.sku) : '';
    const unit = PRICE_TABLE[sku] || 0;
    return acc + (qty > 0 ? qty * unit : 0);
  }, 0);
}

export async function onRequest(context) {
  const request = context.request;
  const env = context.env;

  if (request.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } });
  }

  let body;
  try {
    body = await request.json();
  } catch (_err) {
    return jsonResponse(400, { ok: false, error: { code: 'INVALID_JSON', message: 'JSON inválido' } });
  }

  const payload = body && body.payload ? body.payload : null;
  if (!payload || !payload.customerName || !payload.phone || !payload.location || !payload.paymentMethod) {
    return jsonResponse(400, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Faltan campos mínimos' } });
  }

  const total = computeTotal(payload.items || []);
  const normalized = {
    customerName: String(payload.customerName || '').trim(),
    phone: String(payload.phone || '').trim(),
    location: String(payload.location || '').trim(),
    paymentMethod: String(payload.paymentMethod || '').trim(),
    items: Array.isArray(payload.items) ? payload.items : [],
    note: String(payload.note || '').trim(),
    total
  };


  const writeEnabled = env.PUBLIC_ORDER_WRITE_ENABLED === 'true';
  const preparedPayload = {
    action: 'createPublicOrder',
    payload: normalized,
    auth: {
      secret: env.APPS_SCRIPT_SHARED_SECRET || '',
      scheme: 'shared-secret-body-v1'
    }
  };

  if (!writeEnabled) {
    return jsonResponse(200, {
      ok: true,
      data: {
        mode: 'dry-run',
        preparedPayload: {
          action: preparedPayload.action,
          payload: preparedPayload.payload,
          auth: { scheme: preparedPayload.auth.scheme }
        }
      }
    });
  }

  if (!env.APPS_SCRIPT_ORDER_ENDPOINT || !env.APPS_SCRIPT_SHARED_SECRET) {
    return jsonResponse(500, {
      ok: false,
      error: {
        code: 'MISSING_ENV',
        message: 'Configura APPS_SCRIPT_ORDER_ENDPOINT y APPS_SCRIPT_SHARED_SECRET en Cloudflare para modo write.'
      }
    });
  }

  try {
    const upstreamResp = await fetch(env.APPS_SCRIPT_ORDER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preparedPayload)
    });

    const upstreamData = await upstreamResp.json();
    if (!upstreamResp.ok || !upstreamData || upstreamData.ok !== true) {
      return jsonResponse(502, {
        ok: false,
        error: { code: 'UPSTREAM_ERROR', message: 'Apps Script rechazó la solicitud.' },
        data: upstreamData
      });
    }

    return jsonResponse(200, { ok: true, data: { total, upstream: upstreamData.data || null } });
  } catch (err) {
    return jsonResponse(502, {
      ok: false,
      error: { code: 'UPSTREAM_NETWORK', message: 'No se pudo contactar Apps Script.' },
      data: { detail: err && err.message ? err.message : 'Error desconocido' }
    });
  }
}
