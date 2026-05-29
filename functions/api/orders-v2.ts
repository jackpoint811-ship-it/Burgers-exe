import type { OrderV2PaymentMethod, OrderV2Mode } from '../../packages/config/src';
import { errorResponse, fetchOrderBundle, generateFolio, generateId, json, normalizePhone, parseJsonObject } from './_orders-v2-utils';

type Env = { BOG_MENU_DB?: D1Database; ORDERS_V2_WRITE_ENABLED?: string };

type CatalogRow = {
  sku: string;
  name: string;
  price_cents: number;
  is_available: number;
  category_key: string;
  tags_json: string;
  badge: string | null;
  promo_label: string | null;
};

type NormalizedPayload = {
  customerName: string;
  customerPhone: string;
  orderMode: OrderV2Mode;
  paymentMethod: OrderV2PaymentMethod;
  notes: string | null;
  items: Array<{ sku: string; qty: number }>;
  idempotencyKey: string;
};

const ORDER_MODES = new Set<OrderV2Mode>(['pickup', 'delivery']);
const PAYMENT_METHODS = new Set<OrderV2PaymentMethod>(['cash', 'transfer', 'card', 'unknown']);

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeIdempotencyKey = (request: Request, body: Record<string, unknown>) => {
  const headerKey = normalizeString(request.headers.get('Idempotency-Key'));
  const bodyKey = normalizeString(body.idempotencyKey);
  const resolved = headerKey || bodyKey;
  return resolved || generateId('idem');
};

const validatePayload = (body: Record<string, unknown>, request: Request): NormalizedPayload | Response => {
  const customer = body.customer && typeof body.customer === 'object' && !Array.isArray(body.customer) ? body.customer as Record<string, unknown> : null;
  const customerName = normalizeString(customer?.name);
  const customerPhone = normalizePhone(customer?.phone);
  if (customerName.length < 2 || customerName.length > 80 || customerPhone.length < 10) {
    return errorResponse(400, 'INVALID_CUSTOMER', 'Nombre y teléfono de cliente son requeridos.');
  }

  const orderMode = normalizeString(body.orderMode) as OrderV2Mode;
  if (!ORDER_MODES.has(orderMode)) return errorResponse(400, 'INVALID_ORDER_MODE', 'Modo de entrega inválido.');

  const paymentMethod = (normalizeString(body.paymentMethod) || 'unknown') as OrderV2PaymentMethod;
  if (!PAYMENT_METHODS.has(paymentMethod)) return errorResponse(400, 'INVALID_PAYMENT_METHOD', 'Método de pago inválido.');

  const notesRaw = normalizeString(body.notes);
  if (notesRaw.length > 500) return errorResponse(400, 'INVALID_CUSTOMER', 'Notas exceden el máximo permitido.');

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
    return errorResponse(400, 'INVALID_ITEMS', 'Agrega entre 1 y 50 líneas de productos.');
  }

  const consolidated = new Map<string, number>();
  for (const rawItem of body.items) {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      return errorResponse(400, 'INVALID_ITEMS', 'Item inválido.');
    }
    const item = rawItem as Record<string, unknown>;
    const sku = normalizeString(item.sku);
    const qty = Number(item.qty);
    if (!sku || !Number.isInteger(qty) || qty < 1 || qty > 20) {
      return errorResponse(400, 'INVALID_ITEMS', 'SKU y cantidad son requeridos.');
    }
    const nextQty = (consolidated.get(sku) ?? 0) + qty;
    if (nextQty > 20) return errorResponse(400, 'INVALID_ITEMS', 'Cantidad máxima por SKU excedida.');
    consolidated.set(sku, nextQty);
  }

  return {
    customerName,
    customerPhone,
    orderMode,
    paymentMethod,
    notes: notesRaw || null,
    items: [...consolidated.entries()].map(([sku, qty]) => ({ sku, qty })),
    idempotencyKey: normalizeIdempotencyKey(request, body)
  };
};

const loadCatalogRows = async (db: D1Database, skus: string[]): Promise<CatalogRow[]> => {
  const placeholders = skus.map(() => '?').join(', ');
  const result = await db.prepare(
    `SELECT sku, name, price_cents, is_available, category_key, tags_json, badge, promo_label
     FROM menu_items
     WHERE sku IN (${placeholders})`
  ).bind(...skus).all<CatalogRow>();
  return result.results ?? [];
};

const buildOrderSummary = (order: NonNullable<Awaited<ReturnType<typeof fetchOrderBundle>>>, idempotencyKey: string) => ({
  id: order.id,
  folio: order.folio,
  status: order.status,
  subtotal: order.subtotal,
  total: order.total,
  currency: 'MXN' as const,
  createdAt: order.createdAt,
  idempotencyKey
});

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.BOG_MENU_DB) return errorResponse(503, 'MISSING_DB', 'BOG_MENU_DB no está configurado.');
  if (env.ORDERS_V2_WRITE_ENABLED === 'false') return errorResponse(403, 'ORDERING_DISABLED', 'Órdenes V2 deshabilitadas temporalmente.');

  const body = await parseJsonObject(request);
  if (!body) return errorResponse(400, 'INVALID_JSON', 'JSON inválido.');

  const parsed = validatePayload(body, request);
  if (parsed instanceof Response) return parsed;

  try {
    const existingRow = await env.BOG_MENU_DB.prepare('SELECT id FROM orders_v2 WHERE idempotency_key = ? LIMIT 1').bind(parsed.idempotencyKey).first<{ id: string }>();
    if (existingRow?.id) {
      const existingOrder = await fetchOrderBundle(env.BOG_MENU_DB, existingRow.id);
      if (!existingOrder) return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo recuperar la orden idempotente.');
      return json(200, { ok: true, data: { order: buildOrderSummary(existingOrder, parsed.idempotencyKey), idempotent: true } });
    }

    const skus = parsed.items.map((item) => item.sku);
    const catalogRows = await loadCatalogRows(env.BOG_MENU_DB, skus);
    const catalogBySku = new Map(catalogRows.map((row) => [row.sku, row]));
    for (const item of parsed.items) {
      const catalogItem = catalogBySku.get(item.sku);
      if (!catalogItem || Number(catalogItem.is_available) !== 1) {
        return errorResponse(400, 'ITEM_UNAVAILABLE', 'Uno o más productos no existen o no están disponibles.');
      }
    }

    const now = new Date().toISOString();
    const orderId = generateId('ord');
    const folio = generateFolio(new Date(now));
    const orderItems = parsed.items.map((item) => {
      const catalogItem = catalogBySku.get(item.sku)!;
      const unitPriceCents = Number(catalogItem.price_cents);
      const lineTotalCents = unitPriceCents * item.qty;
      return {
        id: generateId('oi'),
        orderId,
        sku: item.sku,
        name: catalogItem.name,
        qty: item.qty,
        unitPriceCents,
        lineTotalCents,
        snapshotJson: JSON.stringify({
          sku: catalogItem.sku,
          name: catalogItem.name,
          priceCents: unitPriceCents,
          category: catalogItem.category_key,
          tags: catalogItem.tags_json,
          badge: catalogItem.badge,
          promoLabel: catalogItem.promo_label
        })
      };
    });
    const subtotalCents = orderItems.reduce((acc, item) => acc + item.lineTotalCents, 0);
    const totalCents = subtotalCents;
    const eventId = generateId('evt');

    const statements: D1PreparedStatement[] = [
      env.BOG_MENU_DB.prepare(
        `INSERT INTO orders_v2 (id, folio, idempotency_key, customer_name, customer_phone, order_mode, payment_method, payment_status, notes, subtotal_cents, total_cents, status, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 'new', 'public-v2', ?, ?)`
      ).bind(orderId, folio, parsed.idempotencyKey, parsed.customerName, parsed.customerPhone, parsed.orderMode, parsed.paymentMethod, parsed.notes, subtotalCents, totalCents, now, now),
      ...orderItems.map((item) => env.BOG_MENU_DB!.prepare(
        `INSERT INTO order_items_v2 (id, order_id, sku, name, qty, unit_price_cents, line_total_cents, snapshot_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(item.id, item.orderId, item.sku, item.name, item.qty, item.unitPriceCents, item.lineTotalCents, item.snapshotJson, now)),
      env.BOG_MENU_DB.prepare(
        `INSERT INTO order_events_v2 (id, order_id, type, previous_status, next_status, detail_json, actor, created_at)
         VALUES (?, ?, 'ORDER_CREATED', NULL, 'new', ?, 'public-v2', ?)`
      ).bind(eventId, orderId, JSON.stringify({ source: 'public-v2', itemCount: orderItems.length, idempotencyKey: parsed.idempotencyKey }), now)
    ];

    const batchResult = await env.BOG_MENU_DB.batch(statements);
    if (!batchResult.every((entry) => entry.success)) return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo crear la orden.');

    const createdOrder = await fetchOrderBundle(env.BOG_MENU_DB, orderId);
    if (!createdOrder) return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo recuperar la orden creada.');
    return json(201, { ok: true, data: { order: buildOrderSummary(createdOrder, parsed.idempotencyKey) } });
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo crear la orden.');
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
  return onRequestPost(context);
};
