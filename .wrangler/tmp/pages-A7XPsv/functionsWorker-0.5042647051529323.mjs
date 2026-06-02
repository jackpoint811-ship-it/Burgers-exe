var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/bank-config.js
function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
__name(jsonResponse, "jsonResponse");
function readBankConfig(env) {
  if (!env || env.BANK_ENABLED !== "true") {
    return { enabled: false };
  }
  return {
    enabled: true,
    bankName: String(env.BANK_NAME || "").trim(),
    accountHolder: String(env.BANK_ACCOUNT_HOLDER || "").trim(),
    accountNumber: String(env.BANK_ACCOUNT_NUMBER || "").trim()
  };
}
__name(readBankConfig, "readBankConfig");
async function onRequest(context) {
  if (context.request.method !== "GET") {
    return jsonResponse(405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET" } });
  }
  return jsonResponse(200, {
    ok: true,
    data: readBankConfig(context.env)
  });
}
__name(onRequest, "onRequest");

// _shared/menu-catalog.js
var TYPE_BUCKETS = {
  Burger: "burgers",
  Guarnicion: "sides",
  Guarnici\u00F3n: "sides",
  Extra: "extras"
};
function normalizeType(value) {
  const raw = String(value || "").trim();
  if (raw.toLowerCase() === "guarnicion" || raw.toLowerCase() === "guarnici\xF3n") return "Guarnicion";
  if (raw.toLowerCase() === "burger") return "Burger";
  if (raw.toLowerCase() === "extra") return "Extra";
  return raw;
}
__name(normalizeType, "normalizeType");
function itemTypeFromCategory(categoryKey) {
  const key = String(categoryKey || "").trim().toLowerCase();
  if (key === "burgers") return "Burger";
  if (key === "guarniciones" || key === "sides") return "Guarnicion";
  if (key === "extras") return "Extra";
  return "";
}
__name(itemTypeFromCategory, "itemTypeFromCategory");
function normalizeMenuItem(row) {
  const itemType = normalizeType(row.item_type || row.tipo || itemTypeFromCategory(row.category_key));
  const priceCents = Number(row.price_cents != null ? row.price_cents : Math.round(Number(row.precio_publico || row.price || 0) * 100));
  const id = String(row.menu_item_id || row.producto_id || row.sku || "").trim();
  return {
    menu_item_id: id,
    producto_id: id,
    sku: id,
    item_type: itemType,
    tipo: itemType,
    name: String(row.name || row.nombre || "").trim(),
    nombre: String(row.name || row.nombre || "").trim(),
    description: String(row.description || row.descripcion || "").trim(),
    descripcion: String(row.description || row.descripcion || "").trim(),
    price_cents: Number.isFinite(priceCents) ? priceCents : 0,
    price: (Number.isFinite(priceCents) ? priceCents : 0) / 100,
    precio_publico: (Number.isFinite(priceCents) ? priceCents : 0) / 100,
    active: row.is_available != null ? Boolean(row.is_available) : row.activo !== false,
    activo: row.is_available != null ? Boolean(row.is_available) : row.activo !== false,
    sort_order: Number(row.sort_order || row.orden_visual || 999),
    orden_visual: Number(row.sort_order || row.orden_visual || 999),
    image_url: String(row.image_url || ""),
    image_key: String(row.image_key || row.imagen || ""),
    origin_cost_ref: String(row.origin_cost_ref || row.origen_costo_ref || ""),
    updated_at: String(row.updated_at || "")
  };
}
__name(normalizeMenuItem, "normalizeMenuItem");
function buildBuckets(rows) {
  const out = { burgers: [], sides: [], guarniciones: [], extras: [], all: [] };
  (Array.isArray(rows) ? rows : []).map(normalizeMenuItem).forEach((item) => {
    if (!item.menu_item_id) return;
    out.all.push(item);
    if (item.active !== true) return;
    const bucket = TYPE_BUCKETS[item.item_type];
    if (bucket) out[bucket].push(item);
  });
  out.guarniciones = out.sides;
  ["burgers", "sides", "extras"].forEach((bucket) => {
    out[bucket].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  });
  out.all.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  return out;
}
__name(buildBuckets, "buildBuckets");
async function readMenuRowsFromD1(env) {
  if (!env || !env.BOG_MENU_DB) {
    throw new Error("BOG_MENU_DB D1 binding no configurado.");
  }
  const result = await env.BOG_MENU_DB.prepare(`
    SELECT
      sku AS menu_item_id,
      sku AS producto_id,
      category_key,
      name,
      description,
      price_cents,
      is_available,
      sort_order,
      image_url,
      image_key,
      updated_at
    FROM menu_items
    WHERE category_key IN ('burgers', 'guarniciones', 'extras')
    ORDER BY sort_order ASC, name ASC
  `).all();
  return result && Array.isArray(result.results) ? result.results : [];
}
__name(readMenuRowsFromD1, "readMenuRowsFromD1");
async function getMenuCatalog(env) {
  const rows = await readMenuRowsFromD1(env);
  const data = buildBuckets(rows);
  return {
    ok: true,
    source: "d1",
    burgers: data.burgers,
    sides: data.sides,
    extras: data.extras,
    data,
    warnings: [],
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
__name(getMenuCatalog, "getMenuCatalog");
function buildPriceTableFromCatalog(catalog) {
  const priceTable = {};
  const data = catalog && catalog.data ? catalog.data : catalog;
  const sellableItems = [].concat(Array.isArray(data.burgers) ? data.burgers : []).concat(Array.isArray(data.sides) ? data.sides : []).concat(Array.isArray(data.guarniciones) ? data.guarniciones : []).concat(Array.isArray(data.extras) ? data.extras : []);
  sellableItems.forEach((raw) => {
    const item = normalizeMenuItem(raw);
    if (!item.menu_item_id || item.active !== true) return;
    if (!Number.isFinite(item.price_cents) || item.price_cents <= 0) return;
    priceTable[item.menu_item_id] = {
      menu_item_id: item.menu_item_id,
      sku: item.sku,
      item_type: item.item_type,
      name: item.name,
      unit_price_cents: item.price_cents,
      unit_price: item.price
    };
  });
  return priceTable;
}
__name(buildPriceTableFromCatalog, "buildPriceTableFromCatalog");

// api/menu.js
function jsonResponse2(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": status === 200 ? "public, max-age=60, stale-while-revalidate=60" : "no-store" }
  });
}
__name(jsonResponse2, "jsonResponse");
async function onRequest2(context) {
  if (context.request.method !== "GET") {
    return jsonResponse2(405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET" } });
  }
  try {
    const catalog = await getMenuCatalog(context.env);
    return jsonResponse2(200, {
      ok: true,
      source: catalog.source,
      burgers: catalog.burgers,
      sides: catalog.sides,
      extras: catalog.extras,
      data: catalog.data,
      warnings: catalog.warnings,
      timestamp: catalog.timestamp
    });
  } catch (error) {
    return jsonResponse2(500, {
      ok: false,
      error: {
        code: "MENU_D1_UNAVAILABLE",
        message: "No se pudo cargar el men\xFA desde D1.",
        detail: error && error.message ? error.message : "Error desconocido"
      }
    });
  }
}
__name(onRequest2, "onRequest");

// api/order.js
function jsonResponse3(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
__name(jsonResponse3, "jsonResponse");
function normalizeOrderItems(orderItems, legacyItems, priceTable) {
  const rawItems = Array.isArray(orderItems) && orderItems.length ? orderItems : legacyItems;
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((item) => {
    const menuItemId = String(item && (item.menu_item_id || item.sku) ? item.menu_item_id || item.sku : "").trim();
    const catalogItem = priceTable[menuItemId];
    const quantity = Number(item && (item.quantity != null ? item.quantity : item.qty));
    if (!menuItemId || !catalogItem || !Number.isFinite(quantity) || quantity <= 0) return null;
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
  }).filter(Boolean);
}
__name(normalizeOrderItems, "normalizeOrderItems");
function computeTotalCents(orderItems) {
  return orderItems.reduce((acc, item) => acc + item.quantity * item.unit_price_cents, 0);
}
__name(computeTotalCents, "computeTotalCents");
function toLegacyItems(orderItems) {
  return orderItems.map((item) => ({ sku: item.menu_item_id, qty: item.quantity }));
}
__name(toLegacyItems, "toLegacyItems");
async function fetchOrderGate(env) {
  const endpoint = env && env.APPS_SCRIPT_ORDER_GATE_ENDPOINT;
  if (!endpoint) return { closed: false };
  const timeoutMs = 3e3;
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve({ closed: false }), timeoutMs);
  });
  const requestPromise = (async () => {
    try {
      const upstreamResp = await fetch(endpoint, { method: "GET" });
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
__name(fetchOrderGate, "fetchOrderGate");
function normalizePersonalizations(raw) {
  const ALLOWED_EXTRAS = {
    Pepinillos: true,
    "Queso americano": true,
    "Queso manchego": true,
    Tocino: true,
    Catsup: true,
    Mostaza: true,
    Tomate: true
  };
  const burgers = raw && Array.isArray(raw.burgers) ? raw.burgers : [];
  return {
    burgers: burgers.map((b) => ({
      sku: String(b && b.sku ? b.sku : "").trim(),
      burgerIndex: Number(b && b.burgerIndex ? b.burgerIndex : 0),
      without: Array.isArray(b && b.without) ? b.without.map((x) => String(x).trim()).filter(Boolean) : [],
      extras: Array.isArray(b && b.extras) ? b.extras.map((x) => String(x).trim()).filter((x) => x && ALLOWED_EXTRAS[x]) : []
    })).filter((b) => (b.sku === "OG" || b.sku === "BBQ") && b.burgerIndex > 0)
  };
}
__name(normalizePersonalizations, "normalizePersonalizations");
async function onRequest3(context) {
  const request = context.request;
  const env = context.env;
  if (request.method !== "POST") return jsonResponse3(405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } });
  const orderGate = await fetchOrderGate(env);
  if (orderGate.closed) {
    return jsonResponse3(403, {
      ok: false,
      error: {
        code: "ORDERING_CLOSED",
        message: "Pedidos cerrados temporalmente."
      }
    });
  }
  let body;
  try {
    body = await request.json();
  } catch (_err) {
    return jsonResponse3(400, { ok: false, error: { code: "INVALID_JSON", message: "JSON inv\xE1lido" } });
  }
  const payload = body && body.payload ? body.payload : null;
  if (!payload || !payload.customerName || !payload.phone || !payload.location || !payload.paymentMethod) {
    return jsonResponse3(400, { ok: false, error: { code: "INVALID_PAYLOAD", message: "Faltan campos m\xEDnimos" } });
  }
  const catalog = await getMenuCatalog(env);
  const priceTable = buildPriceTableFromCatalog(catalog);
  const orderItems = normalizeOrderItems(payload.order_items, payload.items, priceTable);
  if (!orderItems.length) return jsonResponse3(400, { ok: false, error: { code: "INVALID_PAYLOAD", message: "Agrega al menos un item v\xE1lido" } });
  const hasPriceMismatch = orderItems.some((item) => item.client_unit_price_cents != null && item.client_unit_price_cents !== item.unit_price_cents);
  if (hasPriceMismatch) return jsonResponse3(409, { ok: false, error: { code: "PRICE_MISMATCH", message: "El precio del men\xFA cambi\xF3. Recarga el men\xFA e intenta de nuevo." } });
  const totalCents = computeTotalCents(orderItems);
  const total = totalCents / 100;
  const normalized = {
    customerName: String(payload.customerName || "").trim(),
    phone: String(payload.phone || "").trim(),
    location: String(payload.location || "").trim(),
    paymentMethod: String(payload.paymentMethod || "").trim(),
    note: String(payload.note || "").trim(),
    items: toLegacyItems(orderItems),
    order_items: orderItems.map((item) => ({
      menu_item_id: item.menu_item_id,
      item_type: item.item_type,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents
    })),
    personalizations: normalizePersonalizations(payload.personalizations),
    timestamp: String(payload.timestamp || "")
  };
  const writeEnabled = env.PUBLIC_ORDER_WRITE_ENABLED === "true";
  const preparedPayload = {
    action: "createPublicOrder",
    payload: { ...normalized, total, total_cents: totalCents },
    auth: { secret: env.APPS_SCRIPT_SHARED_SECRET || "", scheme: "shared-secret-body-v1" }
  };
  if (!writeEnabled) {
    return jsonResponse3(200, { ok: true, data: { mode: "dry-run", total, total_cents: totalCents, pricingSource: catalog.source, menuWarnings: catalog.warnings || [], preparedPayload: { action: preparedPayload.action, payload: preparedPayload.payload, auth: { scheme: preparedPayload.auth.scheme } } } });
  }
  if (!env.APPS_SCRIPT_ORDER_ENDPOINT || !env.APPS_SCRIPT_SHARED_SECRET) {
    return jsonResponse3(500, { ok: false, error: { code: "MISSING_ENV", message: "Configura APPS_SCRIPT_ORDER_ENDPOINT y APPS_SCRIPT_SHARED_SECRET en Cloudflare para modo write." } });
  }
  try {
    const upstreamResp = await fetch(env.APPS_SCRIPT_ORDER_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preparedPayload) });
    const upstreamData = await upstreamResp.json();
    if (!upstreamResp.ok || !upstreamData || upstreamData.ok !== true) {
      return jsonResponse3(502, { ok: false, error: { code: "UPSTREAM_ERROR", message: "Apps Script rechaz\xF3 la solicitud." }, data: upstreamData });
    }
    return jsonResponse3(200, { ok: true, data: { total, total_cents: totalCents, pricingSource: catalog.source, menuWarnings: catalog.warnings || [], upstream: upstreamData.data || null } });
  } catch (err) {
    return jsonResponse3(502, { ok: false, error: { code: "UPSTREAM_NETWORK", message: "No se pudo contactar Apps Script." }, data: { detail: err && err.message ? err.message : "Error desconocido" } });
  }
}
__name(onRequest3, "onRequest");

// api/order-gate.js
function jsonResponse4(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
__name(jsonResponse4, "jsonResponse");
var DEFAULT_GATE = {
  closed: false,
  title: "PEDIDOS CERRADOS POR AHORA",
  message: "Por el momento no estamos recibiendo pedidos. \xDAnete al grupo de WhatsApp para enterarte cuando abramos pedidos otra vez.",
  whatsappUrl: "https://chat.whatsapp.com/GycE5zALOypGPvJVaMfbPp"
};
function normalizeGatePayload(payload) {
  return {
    closed: payload && payload.closed === true,
    title: String(payload && payload.title || DEFAULT_GATE.title).trim() || DEFAULT_GATE.title,
    message: String(payload && payload.message || DEFAULT_GATE.message).trim() || DEFAULT_GATE.message,
    whatsappUrl: String(payload && payload.whatsappUrl || DEFAULT_GATE.whatsappUrl).trim() || DEFAULT_GATE.whatsappUrl
  };
}
__name(normalizeGatePayload, "normalizeGatePayload");
async function onRequest4(context) {
  if (context.request.method !== "GET") {
    return jsonResponse4(405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET" } });
  }
  const endpoint = context.env.APPS_SCRIPT_ORDER_GATE_ENDPOINT;
  if (!endpoint) {
    return jsonResponse4(200, { ok: true, ...DEFAULT_GATE });
  }
  try {
    const upstreamResp = await fetch(endpoint, { method: "GET" });
    const upstreamData = await upstreamResp.json();
    if (!upstreamResp.ok || !upstreamData || upstreamData.ok !== true) {
      return jsonResponse4(200, { ok: true, ...DEFAULT_GATE });
    }
    const normalized = normalizeGatePayload(upstreamData);
    return jsonResponse4(200, { ok: true, ...normalized });
  } catch (_error) {
    return jsonResponse4(200, { ok: true, ...DEFAULT_GATE });
  }
}
__name(onRequest4, "onRequest");

// ../../../.wrangler/tmp/pages-A7XPsv/functionsRoutes-0.005438681793792921.mjs
var routes = [
  {
    routePath: "/api/bank-config",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/menu",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/order",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  },
  {
    routePath: "/api/order-gate",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest4]
  }
];

// ../../../node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../../../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../../../.wrangler/tmp/bundle-DJb707/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../../../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../../../.wrangler/tmp/bundle-DJb707/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.5042647051529323.mjs.map
