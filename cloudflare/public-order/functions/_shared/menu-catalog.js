const TYPE_BUCKETS = {
  Burger: 'burgers',
  Guarnicion: 'sides',
  Guarnición: 'sides',
  Extra: 'extras'
};

function normalizeType(value) {
  const raw = String(value || '').trim();
  if (raw.toLowerCase() === 'guarnicion' || raw.toLowerCase() === 'guarnición') return 'Guarnicion';
  if (raw.toLowerCase() === 'burger') return 'Burger';
  if (raw.toLowerCase() === 'extra') return 'Extra';
  return raw;
}

function itemTypeFromCategory(categoryKey) {
  const key = String(categoryKey || '').trim().toLowerCase();
  if (key === 'burgers') return 'Burger';
  if (key === 'guarniciones' || key === 'sides') return 'Guarnicion';
  if (key === 'extras') return 'Extra';
  return '';
}

function categoryFromType(tipo) {
  const normalized = normalizeType(tipo);
  if (normalized === 'Burger') return 'burgers';
  if (normalized === 'Guarnicion') return 'guarniciones';
  if (normalized === 'Extra') return 'extras';
  return '';
}

function normalizeMenuItem(row) {
  const itemType = normalizeType(row.item_type || row.tipo || itemTypeFromCategory(row.category_key));
  const priceCents = Number(row.price_cents != null ? row.price_cents : Math.round(Number(row.precio_publico || row.price || 0) * 100));
  const id = String(row.menu_item_id || row.producto_id || row.sku || '').trim();
  return {
    menu_item_id: id,
    producto_id: id,
    sku: id,
    item_type: itemType,
    tipo: itemType,
    name: String(row.name || row.nombre || '').trim(),
    nombre: String(row.name || row.nombre || '').trim(),
    description: String(row.description || row.descripcion || '').trim(),
    descripcion: String(row.description || row.descripcion || '').trim(),
    price_cents: Number.isFinite(priceCents) ? priceCents : 0,
    price: (Number.isFinite(priceCents) ? priceCents : 0) / 100,
    precio_publico: (Number.isFinite(priceCents) ? priceCents : 0) / 100,
    active: row.is_available != null ? Boolean(row.is_available) : row.activo !== false,
    activo: row.is_available != null ? Boolean(row.is_available) : row.activo !== false,
    sort_order: Number(row.sort_order || row.orden_visual || 999),
    orden_visual: Number(row.sort_order || row.orden_visual || 999),
    image_url: String(row.image_url || ''),
    image_key: String(row.image_key || row.imagen || ''),
    origin_cost_ref: String(row.origin_cost_ref || row.origen_costo_ref || ''),
    updated_at: String(row.updated_at || '')
  };
}

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
  ['burgers', 'sides', 'extras'].forEach((bucket) => {
    out[bucket].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  });
  out.all.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  return out;
}

async function readMenuRowsFromD1(env) {
  if (!env || !env.BOG_MENU_DB) {
    throw new Error('BOG_MENU_DB D1 binding no configurado.');
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

export async function getMenuCatalog(env) {
  const rows = await readMenuRowsFromD1(env);
  const data = buildBuckets(rows);
  return {
    ok: true,
    source: 'd1',
    burgers: data.burgers,
    sides: data.sides,
    extras: data.extras,
    data,
    warnings: [],
    timestamp: new Date().toISOString()
  };
}

export function buildPriceTableFromCatalog(catalog) {
  const priceTable = {};
  const data = catalog && catalog.data ? catalog.data : catalog;
  const sellableItems = []
    .concat(Array.isArray(data.burgers) ? data.burgers : [])
    .concat(Array.isArray(data.sides) ? data.sides : [])
    .concat(Array.isArray(data.guarniciones) ? data.guarniciones : [])
    .concat(Array.isArray(data.extras) ? data.extras : []);

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

export function getCategoryFromItemType(itemType) {
  return categoryFromType(itemType);
}
