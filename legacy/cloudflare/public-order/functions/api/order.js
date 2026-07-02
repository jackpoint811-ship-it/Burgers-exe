import { buildPriceTableFromCatalog, getMenuCatalog } from '../_shared/menu-catalog.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function normalizeOrderItems(orderItems, legacyItems, priceTable) {
  const rawItems = Array.isArray(orderItems) && orderItems.length ? orderItems : legacyItems;
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((item) => {
      const menuItemId = String(item && (item.menu_item_id || item.sku) ? (item.menu_item_id || item.sku) : '').trim();
      const catalogItem = priceTable[menuItemId];
      const quantity = Number(item && (item.quantity != null ? item.quantity : item.qty));
      if (!menuItemId || !catalogItem || !Number.isFinite(quantity) || quantity <= 0) return null;
      // Client price is accepted only as an optimistic concurrency check.
      // Source of truth for totals is always catalogItem.unit_price_cents from D1.
      const clientUnitPriceCents = Number(item && item.unit_price_cents != null ? item.unit_price_cents : catalogItem.unit_price_cents);
      return {
        menu_item_id: menuItemId,
        sku: menuItemId,
        item_type: String(item && item.item_type ? item.item_type : catalogItem.item_type),
        quantity: Math.floor(quantity),
        qty: Math.floor(quantity),
        unit_price_cents: catalogItem.unit_price_cents,
        unit_price: catalogItem.unit_price,
        name: catalogItem.name,
        client_unit_price_cents: Number.isFinite(clientUnitPriceCents) ? clientUnitPriceCents : null
      };
    })
    .filter(Boolean);
}

function computeTotalCents(orderItems) {
  return orderItems.reduce((acc, item) => acc + item.quantity * item.unit_price_cents, 0);
}

function toLegacyItems(orderItems) {
  return orderItems.map((item) => ({ sku: item.menu_item_id, qty: item.quantity }));
}

function normalizeReferral(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const code = String(source.code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
  return {
    code,
    source: code && source.source === 'url' ? 'url' : ''
  };
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

  const orderItems = normalizeOrderItems(payload.order_items, payload.items, priceTable);
  if (!orderItems.length) return jsonResponse(400, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Agrega al menos un item válido' } });
  const hasPriceMismatch = orderItems.some((item) => item.client_unit_price_cents != null && item.client_unit_price_cents !== item.unit_price_cents);
  if (hasPriceMismatch) return jsonResponse(409, { ok: false, error: { code: 'PRICE_MISMATCH', message: 'El precio del menú cambió. Recarga el menú e intenta de nuevo.' } });
  const totalCents = computeTotalCents(orderItems);
  const total = totalCents / 100;
  const normalized = {
    customerName: String(payload.customerName || '').trim(),
    phone: String(payload.phone || '').trim(),
    location: String(payload.location || '').trim(),
    paymentMethod: String(payload.paymentMethod || '').trim(),
    note: String(payload.note || '').trim(),
    items: toLegacyItems(orderItems),
    order_items: orderItems.map((item) => ({
      menu_item_id: item.menu_item_id,
      item_type: item.item_type,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents
    })),
    personalizations: normalizePersonalizations(payload.personalizations),
    referral: normalizeReferral(payload.referral),
    timestamp: String(payload.timestamp || '')
  };

  const writeEnabled = env.PUBLIC_ORDER_WRITE_ENABLED === 'true';
  const preparedPayload = {
    action: 'createPublicOrder',
    payload: { ...normalized, total, total_cents: totalCents },
    auth: { secret: env.APPS_SCRIPT_SHARED_SECRET || '', scheme: 'shared-secret-body-v1' }
  };

  if (!writeEnabled) {
    return jsonResponse(200, { ok: true, data: { mode: 'dry-run', total, total_cents: totalCents, pricingSource: catalog.source, menuWarnings: catalog.warnings || [], preparedPayload: { action: preparedPayload.action, payload: preparedPayload.payload, auth: { scheme: preparedPayload.auth.scheme } } } });
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
    return jsonResponse(200, { ok: true, data: { total, total_cents: totalCents, pricingSource: catalog.source, menuWarnings: catalog.warnings || [], upstream: upstreamData.data || null } });
  } catch (err) {
    return jsonResponse(502, { ok: false, error: { code: 'UPSTREAM_NETWORK', message: 'No se pudo contactar Apps Script.' }, data: { detail: err && err.message ? err.message : 'Error desconocido' } });
  }
}
