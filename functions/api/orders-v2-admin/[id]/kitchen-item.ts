import type {
  OrderV2,
  OrderV2Item,
  UpdateKitchenItemPayload,
} from "../../../../packages/config/src";
import {
  assertOrderMatchesEnvironment,
  errorResponse,
  fetchOrderBundle,
  generateId,
  json,
  parseJsonObject,
  parseJsonSnapshot,
  parseOrderEnvironment,
  requireAdminToken,
  type AdminEnv,
} from "../../_orders-v2-utils";

type Env = AdminEnv;

type ItemRow = {
  id: string;
  snapshot_json?: string | null;
  snapshotJson?: string | null;
};
type SnapshotRecord = Record<string, unknown>;
type SideQuestSource = "included-garnish" | "sidequest-extra";

const KITCHEN_ITEM_KINDS = new Set<UpdateKitchenItemPayload["itemKind"]>([
  "burger",
  "combo",
  "garnish",
]);
const SIDE_QUEST_LINE_KEY_PREFIX = "::sidequest-";

const parsePayload = (
  body: Record<string, unknown>,
): UpdateKitchenItemPayload | Response => {
  const lineKey = typeof body.lineKey === "string" ? body.lineKey.trim() : "";
  if (!lineKey)
    return errorResponse(400, "INVALID_LINE_KEY", "lineKey requerido.");

  const itemKind =
    typeof body.itemKind === "string"
      ? (body.itemKind.trim() as UpdateKitchenItemPayload["itemKind"])
      : ("" as UpdateKitchenItemPayload["itemKind"]);
  if (!KITCHEN_ITEM_KINDS.has(itemKind))
    return errorResponse(400, "INVALID_ITEM_KIND", "itemKind inválido.");

  if (typeof body.done !== "boolean")
    return errorResponse(400, "INVALID_DONE", "done debe ser boolean.");
  const environment = parseOrderEnvironment(body.environment);
  if (!environment)
    return errorResponse(400, "INVALID_ENVIRONMENT", "Ambiente de orden inválido.");

  return { lineKey, itemKind, done: body.done, environment };
};

const getSnapshotString = (row: ItemRow) =>
  row.snapshot_json ?? row.snapshotJson ?? "";

const getOptionalString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const getOptionalNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const asRecord = (value: unknown): SnapshotRecord | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as SnapshotRecord)
    : null;

const getParentLineKey = (item: OrderV2Item) =>
  getOptionalString(item.snapshot?.lineKey) ?? item.id;

const buildSideQuestLineKey = (
  parentLineKey: string,
  source: SideQuestSource,
  index = 0,
) => `${parentLineKey}${SIDE_QUEST_LINE_KEY_PREFIX}${source === "included-garnish" ? "included-garnish" : `extra-${index}`}`;

const isValidNestedSideQuestLineKey = (
  snapshot: SnapshotRecord,
  payload: UpdateKitchenItemPayload,
) => {
  if (payload.itemKind !== "garnish") return false;
  const parentLineKey = getOptionalString(snapshot.lineKey);
  if (!parentLineKey) return false;

  if (payload.lineKey === buildSideQuestLineKey(parentLineKey, "included-garnish")) {
    return Boolean(getOptionalString(asRecord(snapshot.garnish)?.name));
  }

  const extraPrefix = `${parentLineKey}${SIDE_QUEST_LINE_KEY_PREFIX}extra-`;
  if (!payload.lineKey.startsWith(extraPrefix)) return false;
  const index = Number(payload.lineKey.slice(extraPrefix.length));
  if (!Number.isInteger(index) || index < 0) return false;

  const extras = Array.isArray(snapshot.sideQuestExtras)
    ? snapshot.sideQuestExtras
    : [];
  const extra = asRecord(extras[index]);
  if (!extra || !getOptionalString(extra.name)) return false;
  const itemKind = getOptionalString(extra.itemKind) ?? "garnish";
  return itemKind === "garnish";
};

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
      category: "guarniciones",
      lineKey,
      itemDisplayIndex: getOptionalNumber(parent.snapshot?.itemDisplayIndex),
      itemKind: "garnish",
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
      const sideQuestItem = createKitchenSideQuestItem(item, garnish, "included-garnish");
      if (sideQuestItem) syntheticItems.push(sideQuestItem);
    }

    if (Array.isArray(snapshot.sideQuestExtras)) {
      snapshot.sideQuestExtras.forEach((extra, index) => {
        const extraRecord = asRecord(extra);
        if (!extraRecord) return;
        const itemKind = getOptionalString(extraRecord.itemKind) ?? "garnish";
        if (itemKind !== "garnish") return;
        const sideQuestItem = createKitchenSideQuestItem(item, extraRecord, "sidequest-extra", index);
        if (sideQuestItem) syntheticItems.push(sideQuestItem);
      });
    }

    return [item, ...syntheticItems];
  });

const appendKitchenSideQuestItemsToOrder = (order: OrderV2): OrderV2 => ({
  ...order,
  items: appendKitchenSideQuestItems(order.items),
});

export const onRequestPatch: PagesFunction<Env> = async ({
  env,
  params,
  request,
}) => {
  if (!env.BOG_MENU_DB)
    return errorResponse(503, "MISSING_DB", "BOG_MENU_DB no está configurado.");
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;

  const id = String(params.id ?? "").trim();
  if (!id) return errorResponse(400, "INVALID_ORDER_ID", "Order id requerido.");

  const body = await parseJsonObject(request);
  if (!body) return errorResponse(400, "INVALID_JSON", "JSON inválido.");
  const payload = parsePayload(body);
  if (payload instanceof Response) return payload;

  try {
    const currentRow = await env.BOG_MENU_DB.prepare(
      "SELECT status, source FROM orders_v2 WHERE id = ? LIMIT 1",
    )
      .bind(id)
      .first<{ status: string; source: string }>();
    if (!currentRow)
      return errorResponse(404, "ORDER_NOT_FOUND", "Orden no encontrada.");
    const environmentError = assertOrderMatchesEnvironment(currentRow, payload.environment ?? "production");
    if (environmentError) return environmentError;

    const itemsResult = await env.BOG_MENU_DB.prepare(
      "SELECT id, snapshot_json FROM order_items_v2 WHERE order_id = ?",
    )
      .bind(id)
      .all<ItemRow>();
    const snapshots = (itemsResult.results ?? [])
      .map((row) => parseJsonSnapshot(getSnapshotString(row)))
      .filter((snapshot): snapshot is SnapshotRecord => Boolean(snapshot));
    const exactSnapshot = snapshots.find((snapshot) => snapshot.lineKey === payload.lineKey);
    const nestedSideQuestSnapshot = exactSnapshot
      ? undefined
      : snapshots.find((snapshot) => isValidNestedSideQuestLineKey(snapshot, payload));
    const matchingSnapshot = exactSnapshot ?? nestedSideQuestSnapshot;

    if (!matchingSnapshot)
      return errorResponse(
        400,
        "LINE_KEY_NOT_FOUND",
        "lineKey no existe en los items de esta orden.",
      );

    if (exactSnapshot) {
      const snapshotItemKind = exactSnapshot.itemKind;
      if (typeof snapshotItemKind === "string") {
        if (snapshotItemKind !== payload.itemKind)
          return errorResponse(
            400,
            "ITEM_KIND_MISMATCH",
            "itemKind no coincide con el snapshot del item.",
          );
      } else if (snapshotItemKind !== undefined) {
        return errorResponse(
          400,
          "INVALID_SNAPSHOT_ITEM_KIND",
          "itemKind inválido en snapshot.",
        );
      }
    }

    const now = new Date().toISOString();
    const eventId = generateId("evt");
    const eventType = payload.done
      ? "KITCHEN_ITEM_DONE"
      : "KITCHEN_ITEM_REOPENED";
    const detail = JSON.stringify({
      lineKey: payload.lineKey,
      itemKind: payload.itemKind,
      source: "internal-v2",
      environment: payload.environment ?? "production",
    });

    const result = await env.BOG_MENU_DB.prepare(
      `INSERT INTO order_events_v2 (id, order_id, type, previous_status, next_status, detail_json, actor, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'internal-v2', ?)`,
    )
      .bind(
        eventId,
        id,
        eventType,
        String(currentRow.status),
        String(currentRow.status),
        detail,
        now,
      )
      .run();

    if (!result.success)
      return errorResponse(
        500,
        "KITCHEN_ITEM_UPDATE_FAILED",
        "No se pudo actualizar el checklist de cocina.",
      );

    const order = await fetchOrderBundle(env.BOG_MENU_DB, id);
    if (!order)
      return errorResponse(
        500,
        "KITCHEN_ITEM_UPDATE_FAILED",
        "No se pudo recuperar la orden actualizada.",
      );
    const event = order.events?.find((entry) => entry.id === eventId);
    return json(200, { ok: true, data: { order: appendKitchenSideQuestItemsToOrder(order), event } });
  } catch {
    return errorResponse(
      500,
      "KITCHEN_ITEM_UPDATE_FAILED",
      "No se pudo actualizar el checklist de cocina.",
    );
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "PATCH")
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Use PATCH.");
  return onRequestPatch(context);
};
