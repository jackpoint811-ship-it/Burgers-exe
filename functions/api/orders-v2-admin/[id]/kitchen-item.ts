import type {
  OrderV2ItemKind,
  UpdateKitchenItemPayload,
} from "../../../../packages/config/src";
import {
  errorResponse,
  fetchOrderBundle,
  generateId,
  json,
  parseJsonObject,
  parseJsonSnapshot,
  requireAdminToken,
  type AdminEnv,
} from "../../_orders-v2-utils";

type Env = AdminEnv;

type ItemRow = {
  id: string;
  snapshot_json?: string | null;
  snapshotJson?: string | null;
};

const KITCHEN_ITEM_KINDS = new Set<UpdateKitchenItemPayload["itemKind"]>([
  "burger",
  "combo",
  "garnish",
]);

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

  return { lineKey, itemKind, done: body.done };
};

const getSnapshotString = (row: ItemRow) =>
  row.snapshot_json ?? row.snapshotJson ?? "";

export const onRequestPatch: PagesFunction<Env> = async ({
  env,
  params,
  request,
}) => {
  if (!env.BOG_MENU_DB)
    return errorResponse(503, "MISSING_DB", "BOG_MENU_DB no está configurado.");
  const authError = requireAdminToken(request, env);
  if (authError) return authError;

  const id = String(params.id ?? "").trim();
  if (!id) return errorResponse(400, "INVALID_ORDER_ID", "Order id requerido.");

  const body = await parseJsonObject(request);
  if (!body) return errorResponse(400, "INVALID_JSON", "JSON inválido.");
  const payload = parsePayload(body);
  if (payload instanceof Response) return payload;

  try {
    const currentRow = await env.BOG_MENU_DB.prepare(
      "SELECT status FROM orders_v2 WHERE id = ? LIMIT 1",
    )
      .bind(id)
      .first<{ status: string }>();
    if (!currentRow)
      return errorResponse(404, "ORDER_NOT_FOUND", "Orden no encontrada.");

    const itemsResult = await env.BOG_MENU_DB.prepare(
      "SELECT id, snapshot_json FROM order_items_v2 WHERE order_id = ?",
    )
      .bind(id)
      .all<ItemRow>();
    const matchingSnapshot = (itemsResult.results ?? [])
      .map((row) => parseJsonSnapshot(getSnapshotString(row)))
      .find((snapshot) => snapshot?.lineKey === payload.lineKey);

    if (!matchingSnapshot)
      return errorResponse(
        400,
        "LINE_KEY_NOT_FOUND",
        "lineKey no existe en los items de esta orden.",
      );

    const snapshotItemKind = matchingSnapshot.itemKind;
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

    const now = new Date().toISOString();
    const eventId = generateId("evt");
    const eventType = payload.done
      ? "KITCHEN_ITEM_DONE"
      : "KITCHEN_ITEM_REOPENED";
    const detail = JSON.stringify({
      lineKey: payload.lineKey,
      itemKind: payload.itemKind,
      source: "internal-v2",
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
    return json(200, { ok: true, data: { order, event } });
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
