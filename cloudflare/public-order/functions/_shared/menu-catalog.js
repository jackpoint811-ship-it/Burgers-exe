const FALLBACK_ITEMS = [
  { producto_id: 'OG', tipo: 'Burger', nombre: 'OG', descripcion: 'Carne "Especial" 250g aprox, tocino, queso americano, queso manchego, jitomate, lechuga, pepinillos, catsup, mostaza y mayonesa.', precio_publico: 85, activo: true, orden_visual: 1, image_url: '', image_status: 'fallback_static' },
  { producto_id: 'BBQ', tipo: 'Burger', nombre: 'BBQ', descripcion: 'Carne "Especial" 250g aprox, tocino, queso americano, queso manchego, aros de cebolla, pepinillos y salsa BBQ.', precio_publico: 85, activo: true, orden_visual: 2, image_url: '', image_status: 'fallback_static' },
  { producto_id: 'PAPAS_OG', tipo: 'Guarnicion', nombre: 'Papas a la francesa OG', descripcion: 'papas clásicas, sal y crunch.', precio_publico: 20, activo: true, orden_visual: 1, image_url: '', image_status: 'fallback_static' },
  { producto_id: 'PAPAS_ESPECIALES', tipo: 'Guarnicion', nombre: 'Papas a la francesa Especiales', descripcion: 'papas con sazón especial de la casa.', precio_publico: 25, activo: true, orden_visual: 2, image_url: '', image_status: 'fallback_static' },
  { producto_id: 'PAPAS_LEMON_PEPPER', tipo: 'Guarnicion', nombre: 'Papas a la francesa Lemon&Pepper', descripcion: 'papas con toque cítrico y pimienta.', precio_publico: 25, activo: true, orden_visual: 3, image_url: '', image_status: 'fallback_static' },
  { producto_id: 'AROS_CEBOLLA', tipo: 'Guarnicion', nombre: 'Aros de Cebolla', descripcion: 'aros crujientes estilo burger joint.', precio_publico: 30, activo: true, orden_visual: 4, image_url: '', image_status: 'fallback_static' },
  { producto_id: 'EXTRA_PEPINILLOS', tipo: 'Extra', nombre: 'Pepinillos', descripcion: 'toque ácido/crunch.', precio_publico: 5, activo: true, orden_visual: 1, image_url: '', image_status: 'fallback_static' },
  { producto_id: 'EXTRA_QUESO_AMERICANO', tipo: 'Extra', nombre: 'Queso americano', descripcion: 'extra cremoso clásico.', precio_publico: 5, activo: true, orden_visual: 2, image_url: '', image_status: 'fallback_static' },
  { producto_id: 'EXTRA_QUESO_MANCHEGO', tipo: 'Extra', nombre: 'Queso manchego', descripcion: 'extra fundido intenso.', precio_publico: 5, activo: true, orden_visual: 3, image_url: '', image_status: 'fallback_static' },
  { producto_id: 'EXTRA_TOCINO', tipo: 'Extra', nombre: 'Tocino', descripcion: 'crunch ahumado.', precio_publico: 5, activo: true, orden_visual: 4, image_url: '', image_status: 'fallback_static' },
  { producto_id: 'EXTRA_CATSUP', tipo: 'Extra', nombre: 'Catsup', descripcion: 'dulce clásica.', precio_publico: 5, activo: true, orden_visual: 5, image_url: '', image_status: 'fallback_static' },
  { producto_id: 'EXTRA_MOSTAZA', tipo: 'Extra', nombre: 'Mostaza', descripcion: 'punch ácido.', precio_publico: 5, activo: true, orden_visual: 6, image_url: '', image_status: 'fallback_static' },
  { producto_id: 'EXTRA_TOMATE', tipo: 'Extra', nombre: 'Tomate', descripcion: 'frescura extra.', precio_publico: 5, activo: true, orden_visual: 7, image_url: '', image_status: 'fallback_static' }
];

export function parseBooleanLike(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  const normalized = String(value == null ? '' : value).trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === 'true' || normalized === 'si' || normalized === 'sí' || normalized === '1') return true;
  if (normalized === 'false' || normalized === 'no' || normalized === '0') return false;
  return false;
}

export function normalizeMenuItem(raw) {
  const productoId = String(raw && (raw.producto_id || raw.sku) ? (raw.producto_id || raw.sku) : '').trim();
  const nombre = String(raw && (raw.nombre || raw.name) ? (raw.nombre || raw.name) : '').trim();
  const descripcion = String(raw && (raw.descripcion || raw.description) ? (raw.descripcion || raw.description) : '').trim();
  const tipo = String(raw && raw.tipo ? raw.tipo : '').trim();
  const precio = Number(raw && (raw.precio_publico != null ? raw.precio_publico : raw.price));
  const activo = parseBooleanLike(raw && raw.activo != null ? raw.activo : (raw ? raw.active : null));
  const ordenVisual = Number(raw && raw.orden_visual != null ? raw.orden_visual : 999);

  return {
    sku: productoId,
    producto_id: productoId,
    tipo,
    name: nombre,
    nombre,
    description: descripcion,
    descripcion,
    price: Number.isFinite(precio) ? precio : 0,
    precio_publico: Number.isFinite(precio) ? precio : 0,
    active: activo,
    activo,
    orden_visual: Number.isFinite(ordenVisual) ? ordenVisual : 999,
    image_url: String(raw && raw.image_url ? raw.image_url : ''),
    image_status: String(raw && raw.image_status ? raw.image_status : '')
  };
}

function buildBuckets(items) {
  const out = { burgers: [], guarniciones: [], extras: [], all: [] };
  (Array.isArray(items) ? items : []).map(normalizeMenuItem).forEach((item) => {
    if (!item.producto_id) return;
    out.all.push(item);
    if (item.active !== true) return;
    if (item.tipo === 'Burger') out.burgers.push(item);
    if (item.tipo === 'Guarnicion') out.guarniciones.push(item);
    if (item.tipo === 'Extra') out.extras.push(item);
  });
  return out;
}

export function buildFallbackMenuCatalog(warnings = []) {
  return {
    ok: true,
    source: 'fallback',
    data: buildBuckets(FALLBACK_ITEMS),
    warnings,
    timestamp: new Date().toISOString()
  };
}

async function fetchFromAppsScript(endpoint) {
  const body = JSON.stringify({ action: 'getPublicMenuLive' });
  const resp = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  if (!resp.ok) throw new Error('Upstream HTTP ' + resp.status);
  return resp.json();
}

export async function getMenuCatalog(env) {
  const endpoint = env && env.APPS_SCRIPT_MENU_ENDPOINT;
  if (!endpoint) {
    return buildFallbackMenuCatalog(['APPS_SCRIPT_MENU_ENDPOINT no configurado; usando menú estático fallback.']);
  }

  try {
    const timeoutMs = 3000;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs));
    const upstream = await Promise.race([fetchFromAppsScript(endpoint), timeoutPromise]);
    const data = upstream && upstream.data ? upstream.data : {};
    const normalized = buildBuckets(data.all || []);
    if ((!normalized.all.length) && (Array.isArray(data.burgers) || Array.isArray(data.guarniciones) || Array.isArray(data.extras))) {
      const merged = [].concat(data.burgers || [], data.guarniciones || [], data.extras || []);
      const rebuilt = buildBuckets(merged);
      normalized.burgers = rebuilt.burgers;
      normalized.guarniciones = rebuilt.guarniciones;
      normalized.extras = rebuilt.extras;
      normalized.all = rebuilt.all;
    }

    if (upstream && upstream.ok === true) {
      return {
        ok: true,
        source: 'apps-script',
        data: normalized,
        warnings: Array.isArray(upstream.warnings) ? upstream.warnings : [],
        timestamp: upstream.timestamp || new Date().toISOString()
      };
    }

    const warnings = ['Apps Script devolvió MENU_LIVE inválido; usando fallback estático.'];
    if (upstream && Array.isArray(upstream.warnings)) warnings.push(...upstream.warnings);
    return buildFallbackMenuCatalog(warnings);
  } catch (error) {
    return buildFallbackMenuCatalog(['No se pudo consultar Apps Script; usando menú estático fallback.', String(error && error.message ? error.message : 'Error desconocido')]);
  }
}

export function buildPriceTableFromCatalog(catalog) {
  const priceTable = {};
  const data = catalog && catalog.data ? catalog.data : {};
  const sellableItems = []
    .concat(Array.isArray(data.burgers) ? data.burgers : [])
    .concat(Array.isArray(data.guarniciones) ? data.guarniciones : [])
    .concat(Array.isArray(data.extras) ? data.extras : []);

  sellableItems.forEach((raw) => {
    const item = normalizeMenuItem(raw);
    if (!item.producto_id || item.active !== true) return;
    const price = Number(item.precio_publico != null ? item.precio_publico : item.price);
    if (!Number.isFinite(price) || price <= 0) return;
    priceTable[item.producto_id] = price;
  });

  return priceTable;
}
