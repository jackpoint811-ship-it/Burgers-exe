import type { OrderV2Status } from '../../packages/config/src';
import { errorResponse, json, mapD1OrderEventToOrderV2Event, mapD1OrderItemToOrderV2Item, mapD1OrderToOrderV2, requireAdminToken, type AdminEnv } from './_orders-v2-utils';

type Env = AdminEnv;

const ORDER_STATUSES = new Set<OrderV2Status>(['new', 'preparing', 'ready', 'delivered', 'cancelled']);
const TERMINAL_STATUSES = new Set<OrderV2Status>(['delivered', 'cancelled']);

const parseBoolean = (value: string | null) => value === 'true' || value === '1';

const parseLimit = (value: string | null) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 100);
};

const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.BOG_MENU_DB) return errorResponse(503, 'MISSING_DB', 'BOG_MENU_DB no está configurado.');
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;

  const url = new URL(request.url);
  const params = url.searchParams;
  const status = params.get('status')?.trim() as OrderV2Status | undefined;
  if (status && !ORDER_STATUSES.has(status)) return errorResponse(400, 'INVALID_STATUS', 'Estado inválido.');
  const includeTerminal = parseBoolean(params.get('includeTerminal'));
  const limit = parseLimit(params.get('limit'));
  const from = params.get('from')?.trim() ?? '';
  const to = params.get('to')?.trim() ?? '';
  if ((from && !isDateOnly(from)) || (to && !isDateOnly(to))) return errorResponse(400, 'INVALID_DATE', 'Fechas inválidas.');

  const conditions: string[] = [];
  const bindings: Array<string | number> = [];
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
    const ordersResult = await env.BOG_MENU_DB.prepare(`SELECT * FROM orders_v2 ${whereClause} ORDER BY created_at DESC LIMIT ?`).bind(...bindings).all();
    const orderRows = ordersResult.results ?? [];
    const orderIds = orderRows.map((row: any) => String(row.id));
    if (!orderIds.length) return json(200, { ok: true, data: { orders: [], source: 'd1' } });

    const placeholders = orderIds.map(() => '?').join(', ');
    const [itemsResult, eventsResult] = await Promise.all([
      env.BOG_MENU_DB.prepare(`SELECT * FROM order_items_v2 WHERE order_id IN (${placeholders}) ORDER BY created_at ASC`).bind(...orderIds).all(),
      env.BOG_MENU_DB.prepare(`SELECT * FROM order_events_v2 WHERE order_id IN (${placeholders}) ORDER BY created_at ASC`).bind(...orderIds).all()
    ]);

    const itemsByOrder = new Map<string, ReturnType<typeof mapD1OrderItemToOrderV2Item>[]>();
    (itemsResult.results ?? []).forEach((row: any) => {
      const item = mapD1OrderItemToOrderV2Item(row);
      const list = itemsByOrder.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    });

    const eventsByOrder = new Map<string, ReturnType<typeof mapD1OrderEventToOrderV2Event>[]>();
    (eventsResult.results ?? []).forEach((row: any) => {
      const event = mapD1OrderEventToOrderV2Event(row);
      const list = eventsByOrder.get(event.orderId) ?? [];
      if (list.length < 10) list.push(event);
      eventsByOrder.set(event.orderId, list);
    });

    const orders = orderRows
      .filter((row: any) => includeTerminal || status || !TERMINAL_STATUSES.has(String(row.status) as OrderV2Status))
      .map((row: any) => mapD1OrderToOrderV2(row, itemsByOrder.get(String(row.id)) ?? [], eventsByOrder.get(String(row.id)) ?? []));

    return json(200, { ok: true, data: { orders, source: 'd1' } });
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', 'No se pudieron listar las órdenes.');
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'GET') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use GET.');
  return onRequestGet(context);
};
