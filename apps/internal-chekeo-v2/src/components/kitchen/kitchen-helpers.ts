import type { OrderV2ItemKind } from "@config/index";
import type {
  KitchenFocus,
  KitchenItemKind,
  KitchenLaneKey,
  KitchenOrder,
  KitchenOrderItem,
  KitchenOrderMeta,
  KitchenUrgency,
} from "./kitchen-types";

export const KITCHEN_LATE_MINUTES = 12;
export const KITCHEN_CRITICAL_MINUTES = 20;

export const parseOrderTimestamp = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  const clock = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!clock) return undefined;
  const today = new Date();
  today.setHours(Number(clock[1]), Number(clock[2]), 0, 0);
  return today.getTime();
};

export const formatKitchenElapsed = (minutes: number | null) => {
  if (minutes === null) return "Tiempo sin confirmar";
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

export const getKitchenItemKind = (
  item: Pick<KitchenOrderItem, "itemKind" | "name">,
): OrderV2ItemKind => {
  if (item.itemKind) return item.itemKind;
  return item.name.toLowerCase().includes("fries") ? "garnish" : "burger";
};

const isBurgerOrCombo = (item: KitchenOrderItem) => {
  const kind = getKitchenItemKind(item);
  return kind === "burger" || kind === "combo";
};

const isStandaloneGarnish = (item: KitchenOrderItem) =>
  getKitchenItemKind(item) === "garnish";

export const getKitchenLineKey = (
  order: Pick<KitchenOrder, "id">,
  item: Pick<KitchenOrderItem, "lineKey" | "name">,
  index: number,
) => item.lineKey ?? `${order.id}-${index}-${item.name}`;

export const extractKitchenLocation = (notes?: string) => {
  const match = notes?.match(/Ubicación:\s*([^\n|]+)/i);
  return match?.[1]?.trim() || "Sin ubicación";
};

export const stripLocationFromNotes = (notes?: string) => {
  if (!notes) return "";
  return notes
    .replace(/Ubicación:\s*[^\n|]+\|?/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

export const getKitchenItemLabel = (item: KitchenOrderItem) => {
  const kind = getKitchenItemKind(item);
  if (kind === "combo") return "Combo";
  if (kind === "garnish") return "Guarnición";
  if (kind === "drink") return "Bebida";
  return "Burger";
};

export const getKitchenItemNotes = (item: KitchenOrderItem) => {
  const notes: string[] = [];
  if (item.removedIngredients.length) {
    notes.push(`Sin: ${item.removedIngredients.join(", ")}`);
  }
  if (item.extras.length) {
    notes.push(`Extras: ${item.extras.map((extra) => extra.name).join(", ")}`);
  }
  if (item.garnish) notes.push(`Guarnición: ${item.garnish.name}`);
  if (item.includedDrink) notes.push(`Bebida: ${item.includedDrink.name}`);
  if (item.sideQuestExtras.length) {
    notes.push(
      `Extras de guarnición: ${item.sideQuestExtras.map((extra) => extra.name).join(", ")}`,
    );
  }
  if (item.comboBurgers.length) {
    notes.push(`Combo: ${item.comboBurgers.map((burger) => burger.name).join(", ")}`);
  }
  if (item.burgerNote) notes.push(`Nota: ${item.burgerNote}`);
  return notes;
};

export const buildKitchenOrderMeta = (
  order: KitchenOrder,
  nowMs: number,
): KitchenOrderMeta => {
  const kitchenItems = order.items.filter((item) => {
    const kind = getKitchenItemKind(item);
    return kind === "burger" || kind === "combo" || kind === "garnish";
  });
  const burgerItems = kitchenItems.filter(isBurgerOrCombo);
  const garnishItems = kitchenItems.filter(isStandaloneGarnish);
  const pendingItems = kitchenItems.filter((item) => !item.kitchenDone);
  const doneItems = kitchenItems.filter((item) => item.kitchenDone);
  const elapsedMinutes =
    typeof order.createdAtMs === "number"
      ? Math.max(0, Math.floor((nowMs - order.createdAtMs) / 60000))
      : null;
  const urgency: KitchenUrgency =
    elapsedMinutes !== null && elapsedMinutes >= KITCHEN_CRITICAL_MINUTES
      ? "critical"
      : elapsedMinutes !== null && elapsedMinutes >= KITCHEN_LATE_MINUTES
        ? "late"
        : "normal";
  const progressPercent = kitchenItems.length
    ? Math.round((doneItems.length / kitchenItems.length) * 100)
    : 100;
  const readyNeedsReview = order.status === "ready" && pendingItems.length > 0;
  const needsAttention =
    order.priority === "urgent" ||
    order.paymentState === "pending" ||
    readyNeedsReview ||
    urgency === "critical";
  const nextAction =
    order.paymentState === "pending"
      ? "Revisar pago"
      : readyNeedsReview
        ? "Completar checklist"
        : order.status === "new"
          ? "Iniciar preparación"
          : order.status === "preparing" && pendingItems.length === 0
            ? "Marcar listo"
            : order.status === "preparing"
              ? "Terminar pendientes"
              : order.status === "ready"
                ? "Salida"
                : "Revisar pedido";

  return {
    order,
    kitchenItems,
    burgerItems,
    garnishItems,
    pendingItems,
    doneItems,
    elapsedMinutes,
    urgency,
    needsAttention,
    readyNeedsReview,
    progressLabel: `${doneItems.length}/${kitchenItems.length || 0}`,
    progressPercent,
    nextAction,
  };
};

export const getKitchenSortRank = (meta: KitchenOrderMeta) => {
  if (meta.order.priority === "urgent") return 0;
  if (meta.urgency === "critical") return 1;
  if (meta.needsAttention) return 2;
  if (meta.urgency === "late") return 3;
  if (meta.order.status === "new") return 4;
  if (meta.order.status === "preparing") return 5;
  if (meta.order.status === "ready") return 6;
  return 7;
};

export const sortKitchenOrders = (a: KitchenOrderMeta, b: KitchenOrderMeta) => {
  const rankDiff = getKitchenSortRank(a) - getKitchenSortRank(b);
  if (rankDiff !== 0) return rankDiff;
  const aTime = a.order.createdAtMs ?? Number.MAX_SAFE_INTEGER;
  const bTime = b.order.createdAtMs ?? Number.MAX_SAFE_INTEGER;
  return aTime - bTime;
};

export const matchesKitchenFocus = (
  meta: KitchenOrderMeta,
  focus: KitchenFocus,
) => {
  if (focus === "all") return true;
  if (focus === "attention") return meta.needsAttention;
  return meta.order.status === focus;
};

export const getKitchenLane = (meta: KitchenOrderMeta): KitchenLaneKey => {
  if (meta.needsAttention) return "attention";
  if (meta.order.status === "new") return "new";
  if (meta.order.status === "preparing") return "preparing";
  return "ready";
};

export const getKitchenItemActionKind = (
  item: Pick<KitchenOrderItem, "itemKind" | "name">,
) => getKitchenItemKind(item) as KitchenItemKind;
