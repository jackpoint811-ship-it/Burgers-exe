import { buildPriceTableFromCatalog, getMenuCatalog } from '../_shared/menu-catalog.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function normalizeItems(items, priceTable) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      sku: String(item && item.sku ? item.sku : '').trim(),
      qty: Number(item && item.qty ? item.qty : 0)
    }))
    .filter((item) => item.sku && item.qty > 0 && Object.prototype.hasOwnProperty.call(priceTable, item.sku));
}

function computeTotal(items, priceTable) {
  return items.reduce((acc, item) => acc + item.qty * (priceTable[item.sku] || 0), 0);
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

  const catalog = await getMenuCatalog(env);
  const priceTable = buildPriceTableFromCatalog(catalog);

  const items = normalizeItems(payload.items, priceTable);
  if (!items.length) return jsonResponse(400, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Agrega al menos un item válido' } });
  const total = computeTotal(items, priceTable);
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
    return jsonResponse(200, { ok: true, data: { mode: 'dry-run', total, pricingSource: catalog.source, menuWarnings: catalog.warnings || [], preparedPayload: { action: preparedPayload.action, payload: preparedPayload.payload, auth: { scheme: preparedPayload.auth.scheme } } } });
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
    return jsonResponse(200, { ok: true, data: { total, pricingSource: catalog.source, menuWarnings: catalog.warnings || [], upstream: upstreamData.data || null } });
  } catch (err) {
    return jsonResponse(502, { ok: false, error: { code: 'UPSTREAM_NETWORK', message: 'No se pudo contactar Apps Script.' }, data: { detail: err && err.message ? err.message : 'Error desconocido' } });
  }
}
