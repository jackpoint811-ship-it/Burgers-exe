import type { OrderV2Status } from '../../../packages/config/src';
import {
  buildOrderEnvironmentCondition,
  errorResponse,
  parseOrderEnvironmentFromRequest,
  requireAdminToken,
  type AdminEnv
} from '../_orders-v2-utils';

type Env = AdminEnv;

type OrderExportRow = {
  id: string;
  folio: string;
  customer_name: string;
  customer_phone: string;
  order_mode: string;
  payment_method: string;
  payment_status: string;
  notes: string | null;
  subtotal_cents: number;
  total_cents: number;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
};

type ItemExportRow = {
  order_id: string;
  sku: string;
  name: string;
  qty: number;
  created_at: string;
};

type EventCountRow = {
  order_id: string;
  event_count: number;
};

const ORDER_STATUSES = new Set<OrderV2Status>(['new', 'preparing', 'ready', 'delivered', 'cancelled']);
const CSV_HEADERS = [
  'folio',
  'order_id',
  'created_at',
  'updated_at',
  'status',
  'customer_name',
  'customer_phone',
  'order_mode',
  'payment_method',
  'payment_status',
  'notes',
  'subtotal',
  'total',
  'items_summary',
  'item_skus',
  'item_qtys',
  'event_count',
  'source'
] as const;

const parseBoolean = (value: string | null) => value === 'true' || value === '1';
const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const parseLimit = (value: string | null): number | Response => {
  if (!value) return 500;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 1000) {
    return errorResponse(400, 'INVALID_LIMIT', 'Limit inválido. Usa un entero entre 1 y 1000.');
  }
  return parsed;
};

const centsToFixedPrice = (cents: unknown) => {
  const value = Number(cents);
  return Number.isFinite(value) ? (value / 100).toFixed(2) : '0.00';
};

const normalizeCellValue = (value: unknown) => String(value ?? '');

const protectCsvInjection = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);

const escapeCsvCell = (value: unknown) => {
  const safeValue = protectCsvInjection(normalizeCellValue(value));
  const escaped = safeValue.replace(/"/g, '""');
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
};

const buildItemsSummary = (items: ItemExportRow[]) => items.map((item) => `${Number(item.qty) || 0}x ${item.name}`).join('; ');
const buildItemSkus = (items: ItemExportRow[]) => items.map((item) => item.sku).join('|');
const buildItemQtys = (items: ItemExportRow[]) => items.map((item) => String(Number(item.qty) || 0)).join('|');

const buildCsv = (orders: OrderExportRow[], itemsByOrder: Map<string, ItemExportRow[]>, eventCountsByOrder: Map<string, number>) => {
  const rows = [CSV_HEADERS.join(',')];

  orders.forEach((order) => {
    const items = itemsByOrder.get(order.id) ?? [];
    const values = [
      order.folio,
      order.id,
      order.created_at,
      order.updated_at,
      order.status,
      order.customer_name,
      order.customer_phone,
      order.order_mode,
      order.payment_method,
      order.payment_status,
      order.notes ?? '',
      centsToFixedPrice(order.subtotal_cents),
      centsToFixedPrice(order.total_cents),
      buildItemsSummary(items),
      buildItemSkus(items),
      buildItemQtys(items),
      String(eventCountsByOrder.get(order.id) ?? 0),
      order.source
    ];
    rows.push(values.map(escapeCsvCell).join(','));
  });

  return `\uFEFF${rows.join('\r\n')}\r\n`;
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.BOG_MENU_DB) return errorResponse(503, 'D1_NOT_CONFIGURED', 'BOG_MENU_DB no está configurado.');
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;

  const url = new URL(request.url);
  const params = url.searchParams;
  const status = params.get('status')?.trim() as OrderV2Status | undefined;
  if (status && !ORDER_STATUSES.has(status)) return errorResponse(400, 'INVALID_STATUS', 'Estado inválido.');

  const includeTerminal = parseBoolean(params.get('includeTerminal'));
  const environment = parseOrderEnvironmentFromRequest(request);
  if (!environment) return errorResponse(400, 'INVALID_ENVIRONMENT', 'Ambiente de orden inválido.');
  const from = params.get('from')?.trim() ?? '';
  const to = params.get('to')?.trim() ?? '';
  if ((from && !isDateOnly(from)) || (to && !isDateOnly(to))) return errorResponse(400, 'INVALID_DATE', 'Fechas inválidas. Usa YYYY-MM-DD.');

  const limit = parseLimit(params.get('limit'));
  if (limit instanceof Response) return limit;

  const conditions: string[] = ['archived_at IS NULL'];
  const bindings: Array<string | number> = [];
  const environmentCondition = buildOrderEnvironmentCondition(environment);
  conditions.push(environmentCondition.condition);
  bindings.push(environmentCondition.binding);
  if (status) {
    conditions.push('status = ?');
    bindings.push(status);
  } else if (!includeTerminal) {
    conditions.push("status NOT IN ('delivered', 'cancelled')");
  }
  if (from) {
    conditions.push('created_at >= ?');
    bindings.push(`${from}T00:00:00.000Z`);
  }
  if (to) {
    conditions.push('created_at <= ?');
    bindings.push(`${to}T23:59:59.999Z`);
  }
  bindings.push(limit);

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const ordersResult = await env.BOG_MENU_DB.prepare(`SELECT * FROM orders_v2 ${whereClause} ORDER BY created_at DESC LIMIT ?`).bind(...bindings).all<OrderExportRow>();
    const orderRows = ordersResult.results ?? [];
    const orderIds = orderRows.map((row) => String(row.id));

    const itemsByOrder = new Map<string, ItemExportRow[]>();
    const eventCountsByOrder = new Map<string, number>();

    if (orderIds.length) {
      const placeholders = orderIds.map(() => '?').join(', ');
      const [itemsResult, eventsResult] = await Promise.all([
        env.BOG_MENU_DB.prepare(`SELECT order_id, sku, name, qty, created_at FROM order_items_v2 WHERE order_id IN (${placeholders}) ORDER BY created_at ASC`).bind(...orderIds).all<ItemExportRow>(),
        env.BOG_MENU_DB.prepare(`SELECT order_id, COUNT(*) AS event_count FROM order_events_v2 WHERE order_id IN (${placeholders}) GROUP BY order_id`).bind(...orderIds).all<EventCountRow>()
      ]);

      (itemsResult.results ?? []).forEach((item) => {
        const orderId = String(item.order_id);
        const list = itemsByOrder.get(orderId) ?? [];
        list.push({ ...item, order_id: orderId });
        itemsByOrder.set(orderId, list);
      });

      (eventsResult.results ?? []).forEach((eventCount) => {
        eventCountsByOrder.set(String(eventCount.order_id), Number(eventCount.event_count) || 0);
      });
    }

    const csv = buildCsv(orderRows, itemsByOrder, eventCountsByOrder);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="orders-v2-export.csv"',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch {
    return errorResponse(500, 'EXPORT_FAILED', 'No se pudo exportar órdenes V2.');
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET.' } }), {
      status: 405,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        Allow: 'GET'
      }
    });
  }
  return onRequestGet(context);
};
