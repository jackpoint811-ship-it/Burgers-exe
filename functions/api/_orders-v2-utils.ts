import type { OrderV2, OrderV2Event, OrderV2Item, OrderV2Status } from '../../packages/config/src';

export type ErrorEnvelope = { ok: false; error: { code: string; message: string } };
export type AdminEnv = { BOG_MENU_DB?: D1Database; BOG_MENU_ADMIN_TOKEN?: string; BOG_ORDERS_ADMIN_TOKEN?: string };

const TERMINAL_STATUSES = new Set<OrderV2Status>(['delivered', 'cancelled']);
const STATUS_TRANSITIONS: Record<OrderV2Status, OrderV2Status[]> = {
  new: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: []
};

export const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });

export const errorResponse = (status: number, code: string, message: string) => json(status, { ok: false, error: { code, message } });

export const parseJsonObject = async (request: Request): Promise<Record<string, unknown> | null> => {
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const centsToPrice = (cents: unknown): number => {
  const value = Number(cents);
  return Number.isFinite(value) ? value / 100 : 0;
};

export const priceToCents = (price: unknown): number => {
  const value = Number(price);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
};

const shortUuid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

export const generateId = (prefix: 'ord' | 'oi' | 'evt' | string) => `${prefix}_${crypto.randomUUID()}`;

export const generateFolio = (now = new Date()) => {
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `BX-${ymd}-${shortUuid().slice(0, 6).toUpperCase()}`;
};

export const normalizePhone = (value: unknown) => String(value ?? '').replace(/\D/g, '');

export const parseJsonDetail = (value: unknown): Record<string, unknown> | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
};

export const parseJsonSnapshot = (value: unknown): Record<string, unknown> | undefined => parseJsonDetail(value);

export const mapD1OrderItemToOrderV2Item = (row: any): OrderV2Item => ({
  id: String(row.id),
  orderId: String(row.order_id ?? row.orderId),
  sku: String(row.sku),
  name: String(row.name),
  qty: Number(row.qty),
  unitPrice: centsToPrice(row.unit_price_cents ?? row.unitPriceCents),
  lineTotal: centsToPrice(row.line_total_cents ?? row.lineTotalCents),
  snapshot: parseJsonSnapshot(row.snapshot_json ?? row.snapshotJson),
  createdAt: row.created_at ?? row.createdAt ? String(row.created_at ?? row.createdAt) : undefined
});

export const mapD1OrderEventToOrderV2Event = (row: any): OrderV2Event => ({
  id: String(row.id),
  orderId: String(row.order_id ?? row.orderId),
  type: String(row.type),
  previousStatus: row.previous_status ?? row.previousStatus ? String(row.previous_status ?? row.previousStatus) as OrderV2Status : undefined,
  nextStatus: row.next_status ?? row.nextStatus ? String(row.next_status ?? row.nextStatus) as OrderV2Status : undefined,
  detail: parseJsonDetail(row.detail_json ?? row.detailJson),
  actor: String(row.actor ?? 'system'),
  createdAt: String(row.created_at ?? row.createdAt)
});

export const mapD1OrderToOrderV2 = (row: any, items: OrderV2Item[] = [], events?: OrderV2Event[]): OrderV2 => ({
  id: String(row.id),
  folio: String(row.folio),
  customerName: String(row.customer_name ?? row.customerName),
  customerPhone: String(row.customer_phone ?? row.customerPhone),
  orderMode: String(row.order_mode ?? row.orderMode) as OrderV2['orderMode'],
  paymentMethod: String(row.payment_method ?? row.paymentMethod) as OrderV2['paymentMethod'],
  paymentStatus: String(row.payment_status ?? row.paymentStatus) as OrderV2['paymentStatus'],
  notes: row.notes ? String(row.notes) : undefined,
  subtotal: centsToPrice(row.subtotal_cents ?? row.subtotalCents),
  total: centsToPrice(row.total_cents ?? row.totalCents),
  status: String(row.status) as OrderV2Status,
  source: String(row.source) as OrderV2['source'],
  createdAt: String(row.created_at ?? row.createdAt),
  updatedAt: String(row.updated_at ?? row.updatedAt),
  items,
  events
});

export const validateStatusTransition = (current: OrderV2Status, next: OrderV2Status): boolean => {
  if (TERMINAL_STATUSES.has(current)) return false;
  return STATUS_TRANSITIONS[current]?.includes(next) ?? false;
};

const safeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i += 1) result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return result === 0;
};

export const requireAdminToken = (request: Request, env: AdminEnv): Response | null => {
  const expectedToken = (env.BOG_ORDERS_ADMIN_TOKEN || env.BOG_MENU_ADMIN_TOKEN || '').trim();
  if (!expectedToken) return errorResponse(503, 'ADMIN_DISABLED', 'Admin disabled.');
  const authHeader = request.headers.get('Authorization') || '';
  const providedToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!providedToken || !safeEqual(providedToken, expectedToken)) return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized.');
  return null;
};

export const fetchOrderBundle = async (db: D1Database, orderId: string): Promise<OrderV2 | null> => {
  const orderRow = await db.prepare('SELECT * FROM orders_v2 WHERE id = ? LIMIT 1').bind(orderId).first();
  if (!orderRow) return null;
  const [itemsResult, eventsResult] = await Promise.all([
    db.prepare('SELECT * FROM order_items_v2 WHERE order_id = ? ORDER BY created_at ASC').bind(orderId).all(),
    db.prepare('SELECT * FROM order_events_v2 WHERE order_id = ? ORDER BY created_at ASC').bind(orderId).all()
  ]);
  return mapD1OrderToOrderV2(
    orderRow,
    (itemsResult.results ?? []).map(mapD1OrderItemToOrderV2Item),
    (eventsResult.results ?? []).map(mapD1OrderEventToOrderV2Event)
  );
};
