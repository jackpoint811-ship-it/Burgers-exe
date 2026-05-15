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

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      sku: String(item && item.sku ? item.sku : '').trim(),
      qty: Number(item && item.qty ? item.qty : 0)
    }))
    .filter((item) => item.sku && item.qty > 0 && Object.prototype.hasOwnProperty.call(PRICE_TABLE, item.sku));
}

function computeTotal(items) {
  return items.reduce((acc, item) => acc + item.qty * (PRICE_TABLE[item.sku] || 0), 0);
}


async function fetchOrderGate(env) {
  const endpoint = env && env.APPS_SCRIPT_ORDER_GATE_ENDPOINT;
  if (!endpoint) return { closed: false };

  const timeoutMs = 3000;
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve({ closed: false }), timeoutMs);
  });

  const requestPromise = (async () => {
    try {
      const upstreamResp = await fetch(endpoint, { method: 'GET' });
      if (!upstreamResp.ok) return { closed: false };
      const upstreamData = await upstreamResp.json();
      if (!upstreamData || upstreamData.ok !== true) return { closed: false };
      return { closed: upstreamData.closed === true };
    } catch (_error) {
      return { closed: false };
    }
  })();

  return Promise.race([requestPromise, timeoutPromise]);
}

function normalizePersonalizations(raw) {
  const ALLOWED_EXTRAS = {
    Pepinillos: true,
    'Queso americano': true,
    'Queso manchego': true,
    Tocino: true,
    Catsup: true,
    Mostaza: true,
    Tomate: true
  };
  const burgers = raw && Array.isArray(raw.burgers) ? raw.burgers : [];
  return {
    burgers: burgers
      .map((b) => ({
        sku: String(b && b.sku ? b.sku : '').trim(),
        burgerIndex: Number(b && b.burgerIndex ? b.burgerIndex : 0),
        without: Array.isArray(b && b.without) ? b.without.map((x) => String(x).trim()).filter(Boolean) : [],
        extras: Array.isArray(b && b.extras)
          ? b.extras.map((x) => String(x).trim()).filter((x) => x && ALLOWED_EXTRAS[x])
          : []
      }))
      .filter((b) => (b.sku === 'OG' || b.sku === 'BBQ') && b.burgerIndex > 0)
  };
}

export async function onRequest(context) {
  const request = context.request;
  const env = context.env;
  if (request.method !== 'POST') return jsonResponse(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } });

  const orderGate = await fetchOrderGate(env);
  if (orderGate.closed) {
    return jsonResponse(403, {
      ok: false,
      error: {
        code: 'ORDERING_CLOSED',
        message: 'Pedidos cerrados temporalmente.'
      }
    });
  }

  let body;
  try { body = await request.json(); } catch (_err) { return jsonResponse(400, { ok: false, error: { code: 'INVALID_JSON', message: 'JSON inválido' } }); }

  const payload = body && body.payload ? body.payload : null;
  if (!payload || !payload.customerName || !payload.phone || !payload.location || !payload.paymentMethod) {
    return jsonResponse(400, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Faltan campos mínimos' } });
  }

  const items = normalizeItems(payload.items);
  if (!items.length) return jsonResponse(400, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Agrega al menos un item válido' } });
  const total = computeTotal(items);
  const normalized = {
    customerName: String(payload.customerName || '').trim(),
    phone: String(payload.phone || '').trim(),
    location: String(payload.location || '').trim(),
    paymentMethod: String(payload.paymentMethod || '').trim(),
    note: String(payload.note || '').trim(),
    items,
    personalizations: normalizePersonalizations(payload.personalizations),
    timestamp: String(payload.timestamp || '')
  };

  const writeEnabled = env.PUBLIC_ORDER_WRITE_ENABLED === 'true';
  const preparedPayload = {
    action: 'createPublicOrder',
    payload: { ...normalized, total },
    auth: { secret: env.APPS_SCRIPT_SHARED_SECRET || '', scheme: 'shared-secret-body-v1' }
  };

  if (!writeEnabled) {
    return jsonResponse(200, { ok: true, data: { mode: 'dry-run', total, preparedPayload: { action: preparedPayload.action, payload: preparedPayload.payload, auth: { scheme: preparedPayload.auth.scheme } } } });
  }

  if (!env.APPS_SCRIPT_ORDER_ENDPOINT || !env.APPS_SCRIPT_SHARED_SECRET) {
    return jsonResponse(500, { ok: false, error: { code: 'MISSING_ENV', message: 'Configura APPS_SCRIPT_ORDER_ENDPOINT y APPS_SCRIPT_SHARED_SECRET en Cloudflare para modo write.' } });
  }

  try {
    const upstreamResp = await fetch(env.APPS_SCRIPT_ORDER_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preparedPayload) });
    const upstreamData = await upstreamResp.json();
    if (!upstreamResp.ok || !upstreamData || upstreamData.ok !== true) {
      return jsonResponse(502, { ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Apps Script rechazó la solicitud.' }, data: upstreamData });
    }
    return jsonResponse(200, { ok: true, data: { total, upstream: upstreamData.data || null } });
  } catch (err) {
    return jsonResponse(502, { ok: false, error: { code: 'UPSTREAM_NETWORK', message: 'No se pudo contactar Apps Script.' }, data: { detail: err && err.message ? err.message : 'Error desconocido' } });
  }
}
