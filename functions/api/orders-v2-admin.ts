import type { OrderV2Item, OrderV2Status } from '../../packages/config/src';
import {
  buildOrderEnvironmentCondition,
  errorResponse,
  json,
  mapD1OrderEventToOrderV2Event,
  mapD1OrderItemToOrderV2Item,
  mapD1OrderToOrderV2,
  parseOrderEnvironmentFromRequest,
  requireAdminToken,
  type AdminEnv
} from './_orders-v2-utils';

type Env = AdminEnv;

const ORDER_STATUSES = new Set<OrderV2Status>(['new', 'preparing', 'ready', 'delivered', 'cancelled']);
const TERMINAL_STATUSES = new Set<OrderV2Status>(['delivered', 'cancelled']);
const SIDE_QUEST_LINE_KEY_PREFIX = '::sidequest-';

type SnapshotRecord = Record<string, unknown>;
type SideQuestSource = 'included-garnish' | 'sidequest-extra';

const parseBoolean = (value: string | null) => value === 'true' || value === '1';

const parseLimit = (value: string | null) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 100);
};

const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const asRecord = (value: unknown): SnapshotRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as SnapshotRecord : null;

const getOptionalString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const getOptionalNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getParentLineKey = (item: OrderV2Item) =>
  getOptionalString(item.snapshot?.lineKey) ?? item.id;

const buildSideQuestLineKey = (
  parentLineKey: string,
  source: SideQuestSource,
  index = 0,
) => `${parentLineKey}${SIDE_QUEST_LINE_KEY_PREFIX}${source === 'included-garnish' ? 'included-garnish' : `extra-${index}`}`;

const createKitchenSideQuestItem = (
  parent: OrderV2Item,
  entry: SnapshotRecord,
  source: SideQuestSource,
  index = 0,
): OrderV2Item | null => {
  const name = getOptionalString(entry.name);
  if (!name) return null;

  const parentLineKey = getParentLineKey(parent);
  const lineKey = buildSideQuestLineKey(parentLineKey, source, index);
  const sku = getOptionalString(entry.sku) ?? `${parent.sku}-${source}-${index}`;
  const suffix = lineKey.slice(lineKey.indexOf(SIDE_QUEST_LINE_KEY_PREFIX) + 2);

  return {
    id: `${parent.id}-${suffix}`,
    orderId: parent.orderId,
    sku,
    name,
    qty: parent.qty,
    unitPrice: 0,
    lineTotal: 0,
    createdAt: parent.createdAt,
    snapshot: {
      sku,
      name,
      priceCents: 0,
      category: 'guarniciones',
      lineKey,
      itemDisplayIndex: getOptionalNumber(parent.snapshot?.itemDisplayIndex),
      itemKind: 'garnish',
      removedIngredients: [],
      extras: [],
      burgerNote: undefined,
      garnish: null,
      includedDrink: null,
      sideQuestExtras: [],
      comboBurgers: [],
      parentLineKey,
      parentItemKind: getOptionalString(parent.snapshot?.itemKind),
      parentItemName: parent.name,
      sideQuestSource: source,
      upcharge: getOptionalNumber(entry.upcharge),
      price: getOptionalNumber(entry.price),
    },
  };
};

const appendKitchenSideQuestItems = (items: OrderV2Item[]) =>
  items.flatMap((item) => {
    const snapshot = item.snapshot ?? {};
    const syntheticItems: OrderV2Item[] = [];
    const garnish = asRecord(snapshot.garnish);
    if (garnish) {
      const sideQuestItem = createKitchenSideQuestItem(item, garnish, 'included-garnish');
      if (sideQuestItem) syntheticItems.push(sideQuestItem);
    }

    if (Array.isArray(snapshot.sideQuestExtras)) {
      snapshot.sideQuestExtras.forEach((extra, index) => {
        const extraRecord = asRecord(extra);
        if (!extraRecord) return;
        const itemKind = getOptionalString(extraRecord.itemKind) ?? 'garnish';
        if (itemKind !== 'garnish') return;
        const sideQuestItem = createKitchenSideQuestItem(item, extraRecord, 'sidequest-extra', index);
        if (sideQuestItem) syntheticItems.push(sideQuestItem);
      });
    }

    return [item, ...syntheticItems];
  });

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
  const environment = parseOrderEnvironmentFromRequest(request);
  if (!environment) return errorResponse(400, 'INVALID_ENVIRONMENT', 'Ambiente de orden inválido.');
  const from = params.get('from')?.trim() ?? '';
  const to = params.get('to')?.trim() ?? '';
  if ((from && !isDateOnly(from)) || (to && !isDateOnly(to))) return errorResponse(400, 'INVALID_DATE', 'Fechas inválidas.');

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
      .map((row: any) => {
        const items = appendKitchenSideQuestItems(itemsByOrder.get(String(row.id)) ?? []);
        return mapD1OrderToOrderV2(row, items, eventsByOrder.get(String(row.id)) ?? []);
      });

    return json(200, { ok: true, data: { orders, source: 'd1' } });
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', 'No se pudieron listar las órdenes.');
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'GET') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use GET.');
  return onRequestGet(context);
};
