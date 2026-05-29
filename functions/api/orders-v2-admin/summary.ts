import { errorResponse, json, requireAdminToken, type AdminEnv } from '../_orders-v2-utils';

type Env = AdminEnv;

type CountRow = { status: string; order_count: number; gross_cents: number; delivered_cents: number; non_cancelled_count: number };
type GroupRow = { key_value: string; order_count: number; total_cents: number };
type TopItemRow = { sku: string; name: string; qty: number; total_cents: number; order_count: number };
type RecentOrderRow = {
  id: string;
  folio: string;
  created_at: string;
  status: string;
  customer_name: string;
  order_mode: string;
  payment_method: string;
  payment_status: string;
  total_cents: number;
};
type DurationsRow = { new_to_ready_avg_seconds: number | null; new_to_delivered_avg_seconds: number | null };

type StatusKey = 'new' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

const STATUS_KEYS: StatusKey[] = ['new', 'preparing', 'ready', 'delivered', 'cancelled'];
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseBoolean = (value: string | null, defaultValue: boolean) => {
  if (value === null) return defaultValue;
  return value === 'true' || value === '1';
};

const parseBoundedInteger = (value: string | null, defaultValue: number, max: number, errorCode: string, message: string): number | Response => {
  if (!value) return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) return errorResponse(400, errorCode, message);
  return parsed;
};

const centsToPrice = (value: unknown) => {
  const cents = Number(value);
  return Number.isFinite(cents) ? cents / 100 : 0;
};

const secondsOrNull = (value: unknown) => {
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : null;
};

const buildWhereClause = (includeTerminal: boolean, fromUtc: string, toUtc: string) => {
  const conditions: string[] = [];
  const bindings: Array<string | number> = [];

  if (!includeTerminal) conditions.push("o.status NOT IN ('delivered', 'cancelled')");
  if (fromUtc) {
    conditions.push('o.created_at >= ?');
    bindings.push(fromUtc);
  }
  if (toUtc) {
    conditions.push('o.created_at <= ?');
    bindings.push(toUtc);
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', bindings };
};

const initialStatusCounts = (): Record<StatusKey, number> => ({ new: 0, preparing: 0, ready: 0, delivered: 0, cancelled: 0 });

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.BOG_MENU_DB) return errorResponse(503, 'D1_NOT_CONFIGURED', 'BOG_MENU_DB no está configurado.');
  const authError = requireAdminToken(request, env);
  if (authError) return authError;

  const url = new URL(request.url);
  const params = url.searchParams;
  const from = params.get('from')?.trim() ?? '';
  const to = params.get('to')?.trim() ?? '';

  if ((from && !DATE_ONLY_RE.test(from)) || (to && !DATE_ONLY_RE.test(to))) {
    return errorResponse(400, 'INVALID_DATE', 'Fechas inválidas. Usa YYYY-MM-DD.');
  }
  if (from && to && from > to) return errorResponse(400, 'INVALID_DATE_RANGE', 'El rango de fechas es inválido.');

  const includeTerminal = parseBoolean(params.get('includeTerminal'), true);
  const limit = parseBoundedInteger(params.get('limit'), 1000, 5000, 'INVALID_LIMIT', 'Limit inválido. Usa un entero entre 1 y 5000.');
  if (limit instanceof Response) return limit;
  const topLimit = parseBoundedInteger(params.get('topLimit'), 10, 50, 'INVALID_TOP_LIMIT', 'Top limit inválido. Usa un entero entre 1 y 50.');
  if (topLimit instanceof Response) return topLimit;

  const fromUtc = from ? `${from}T00:00:00.000Z` : '';
  const toUtc = to ? `${to}T23:59:59.999Z` : '';
  const { where, bindings } = buildWhereClause(includeTerminal, fromUtc, toUtc);

  try {
    const byStatusSql = `
      SELECT
        o.status AS status,
        COUNT(*) AS order_count,
        SUM(CASE WHEN o.status != 'cancelled' THEN o.total_cents ELSE 0 END) AS gross_cents,
        SUM(CASE WHEN o.status = 'delivered' THEN o.total_cents ELSE 0 END) AS delivered_cents,
        SUM(CASE WHEN o.status != 'cancelled' THEN 1 ELSE 0 END) AS non_cancelled_count
      FROM orders_v2 o
      ${where}
      GROUP BY o.status`;

    const byPaymentSql = `
      SELECT
        o.payment_method AS key_value,
        COUNT(*) AS order_count,
        SUM(CASE WHEN o.status != 'cancelled' THEN o.total_cents ELSE 0 END) AS total_cents
      FROM orders_v2 o
      ${where}
      GROUP BY o.payment_method
      ORDER BY total_cents DESC, order_count DESC`;

    const byModeSql = `
      SELECT
        o.order_mode AS key_value,
        COUNT(*) AS order_count,
        SUM(CASE WHEN o.status != 'cancelled' THEN o.total_cents ELSE 0 END) AS total_cents
      FROM orders_v2 o
      ${where}
      GROUP BY o.order_mode
      ORDER BY total_cents DESC, order_count DESC`;

    const topItemsSql = `
      SELECT
        i.sku AS sku,
        i.name AS name,
        SUM(i.qty) AS qty,
        SUM(i.line_total_cents) AS total_cents,
        COUNT(DISTINCT i.order_id) AS order_count
      FROM order_items_v2 i
      JOIN orders_v2 o ON o.id = i.order_id
      ${where ? `${where} AND o.status != 'cancelled'` : "WHERE o.status != 'cancelled'"}
      GROUP BY i.sku, i.name
      ORDER BY qty DESC, total_cents DESC, name ASC
      LIMIT ?`;

    const recentOrdersSql = `
      SELECT
        o.id,
        o.folio,
        o.created_at,
        o.status,
        o.customer_name,
        o.order_mode,
        o.payment_method,
        o.payment_status,
        o.total_cents
      FROM orders_v2 o
      ${where}
      ORDER BY o.created_at DESC
      LIMIT ?`;

    const durationsSql = `
      WITH filtered_orders AS (
        SELECT o.id
        FROM orders_v2 o
        ${where}
      ), transitions AS (
        SELECT
          e.order_id,
          MIN(CASE WHEN e.next_status = 'new' THEN e.created_at END) AS new_at,
          MIN(CASE WHEN e.next_status = 'ready' THEN e.created_at END) AS ready_at,
          MIN(CASE WHEN e.next_status = 'delivered' THEN e.created_at END) AS delivered_at
        FROM order_events_v2 e
        JOIN filtered_orders f ON f.id = e.order_id
        GROUP BY e.order_id
      )
      SELECT
        AVG(CASE WHEN new_at IS NOT NULL AND ready_at IS NOT NULL THEN strftime('%s', ready_at) - strftime('%s', new_at) END) AS new_to_ready_avg_seconds,
        AVG(CASE WHEN new_at IS NOT NULL AND delivered_at IS NOT NULL THEN strftime('%s', delivered_at) - strftime('%s', new_at) END) AS new_to_delivered_avg_seconds
      FROM transitions`;

    const [statusResult, paymentResult, modeResult, topItemsResult, recentOrdersResult, durationsRow] = await Promise.all([
      env.BOG_MENU_DB.prepare(byStatusSql).bind(...bindings).all<CountRow>(),
      env.BOG_MENU_DB.prepare(byPaymentSql).bind(...bindings).all<GroupRow>(),
      env.BOG_MENU_DB.prepare(byModeSql).bind(...bindings).all<GroupRow>(),
      env.BOG_MENU_DB.prepare(topItemsSql).bind(...bindings, topLimit).all<TopItemRow>(),
      env.BOG_MENU_DB.prepare(recentOrdersSql).bind(...bindings, limit).all<RecentOrderRow>(),
      env.BOG_MENU_DB.prepare(durationsSql).bind(...bindings).first<DurationsRow>()
    ]);

    const byStatus = initialStatusCounts();
    let grossSales = 0;
    let deliveredSales = 0;
    let nonCancelledOrders = 0;

    (statusResult.results ?? []).forEach((row) => {
      const status = String(row.status) as StatusKey;
      if (STATUS_KEYS.includes(status)) byStatus[status] = Number(row.order_count) || 0;
      grossSales += centsToPrice(row.gross_cents);
      deliveredSales += centsToPrice(row.delivered_cents);
      nonCancelledOrders += Number(row.non_cancelled_count) || 0;
    });

    const activeOrders = byStatus.new + byStatus.preparing + byStatus.ready;
    const averageTicket = nonCancelledOrders > 0 ? grossSales / nonCancelledOrders : 0;

    return json(200, {
      ok: true,
      data: {
        source: 'd1',
        range: { from, to, fromUtc, toUtc },
        totals: {
          orders: STATUS_KEYS.reduce((acc, key) => acc + byStatus[key], 0),
          activeOrders,
          deliveredOrders: byStatus.delivered,
          cancelledOrders: byStatus.cancelled,
          grossSales,
          deliveredSales,
          averageTicket
        },
        byStatus,
        byPaymentMethod: (paymentResult.results ?? []).map((row) => ({
          paymentMethod: String(row.key_value),
          orders: Number(row.order_count) || 0,
          total: centsToPrice(row.total_cents)
        })),
        byOrderMode: (modeResult.results ?? []).map((row) => ({
          orderMode: String(row.key_value),
          orders: Number(row.order_count) || 0,
          total: centsToPrice(row.total_cents)
        })),
        topItems: (topItemsResult.results ?? []).map((row) => ({
          sku: String(row.sku),
          name: String(row.name),
          qty: Number(row.qty) || 0,
          total: centsToPrice(row.total_cents),
          orders: Number(row.order_count) || 0
        })),
        recentOrders: (recentOrdersResult.results ?? []).map((row) => ({
          id: String(row.id),
          folio: String(row.folio),
          createdAt: String(row.created_at),
          status: String(row.status),
          customerName: String(row.customer_name),
          orderMode: String(row.order_mode),
          paymentMethod: String(row.payment_method),
          paymentStatus: String(row.payment_status),
          total: centsToPrice(row.total_cents)
        })),
        durations: {
          newToReadyAvgSeconds: secondsOrNull(durationsRow?.new_to_ready_avg_seconds),
          newToDeliveredAvgSeconds: secondsOrNull(durationsRow?.new_to_delivered_avg_seconds)
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch {
    return errorResponse(500, 'SUMMARY_FAILED', 'No se pudo calcular el cierre operativo.');
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'GET') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use GET.');
  return onRequestGet(context);
};
