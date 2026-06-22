import type { OrderV2ItemKind } from "@config/index";
import type {
  KitchenItemKind,
  KitchenLocalSummary,
  KitchenOrder,
  KitchenOrderItem,
  KitchenProductionItem,
  KitchenSideQuestItem,
} from "./kitchen-types";

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

export const getKitchenItemKind = (
  item: Pick<KitchenOrderItem, "itemKind" | "name">,
): OrderV2ItemKind => {
  if (item.itemKind) return item.itemKind;
  return item.name.toLowerCase().includes("fries") ? "garnish" : "burger";
};

export const isKitchenActionKind = (
  kind: OrderV2ItemKind,
): kind is KitchenItemKind =>
  kind === "burger" || kind === "combo" || kind === "garnish";

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
  if (kind === "garnish") return "Side Quest";
  if (kind === "drink") return "Bebida";
  return "Burger";
};

export const getKitchenItemNotes = (item: KitchenOrderItem) => {
  const notes: string[] = [];
  if (item.comboBurgers.length) {
    notes.push(`Burgers del combo: ${item.comboBurgers.map((burger) => burger.name).join(", ")}`);
  }
  if (item.removedIngredients.length) {
    notes.push(`Sin: ${item.removedIngredients.join(", ")}`);
  }
  if (item.extras.length) {
    notes.push(`Extras: ${item.extras.map((extra) => extra.name).join(", ")}`);
  }
  if (item.garnish) notes.push(`Guarnición: ${item.garnish.name}`);
  if (item.sideQuestExtras.length) {
    notes.push(
      `Side Quest: ${item.sideQuestExtras.map((extra) => extra.name).join(", ")}`,
    );
  }
  if (item.includedDrink) notes.push(`Bebida: ${item.includedDrink.name}`);
  if (item.burgerNote) notes.push(`Nota: ${item.burgerNote}`);
  return notes;
};

export const getComboBurgerNotes = (item: KitchenOrderItem) =>
  item.comboBurgers.flatMap((burger) => {
    const notes: string[] = [burger.name];
    if (burger.removedIngredients.length) {
      notes.push(`sin ${burger.removedIngredients.join(", ")}`);
    }
    if (burger.extras.length) {
      notes.push(`extras ${burger.extras.map((extra) => extra.name).join(", ")}`);
    }
    if (burger.burgerNote) notes.push(burger.burgerNote);
    return notes.join(" · ");
  });

const isProductionItem = (item: KitchenOrderItem) => {
  const kind = getKitchenItemKind(item);
  return kind === "burger" || kind === "combo" || kind === "garnish";
};

const hasComboBurgerWork = (item: KitchenOrderItem) => {
  const kind = getKitchenItemKind(item);
  return kind === "combo" || kind === "burger";
};

const hasSideQuestWork = (item: KitchenOrderItem) => {
  return getKitchenItemKind(item) === "garnish";
};

const getSideQuestLabel = (item: KitchenOrderItem) => {
  const labels: string[] = [];
  if (getKitchenItemKind(item) === "garnish") labels.push(item.name);
  if (item.garnish?.name) labels.push(item.garnish.name);
  if (item.sideQuestExtras.length) {
    labels.push(...item.sideQuestExtras.map((extra) => extra.name));
  }
  if (item.includedDrink?.name) labels.push(item.includedDrink.name);
  return labels.join(" + ") || item.name;
};

export const buildKitchenProductionItems = (
  orders: KitchenOrder[],
): KitchenProductionItem[] =>
  [...orders]
    .sort((a, b) => {
      const aTime = a.createdAtMs ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.createdAtMs ?? Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      return a.folio.localeCompare(b.folio);
    })
    .flatMap((order) => {
      const kitchenItems = order.items.filter(isProductionItem);
      const entries = kitchenItems.flatMap((item, index) => {
        const kind = getKitchenItemKind(item) as KitchenItemKind;
        const lineKey = getKitchenLineKey(order, item, index);
        const base = {
          order,
          item,
          index,
          kind,
          lineKey,
          done: Boolean(item.kitchenDone),
        };
        const nextEntries: Omit<KitchenProductionItem, "collapsedByDefault" | "orderKitchenItemCount">[] = [];
        if (hasComboBurgerWork(item)) {
          nextEntries.push({
            ...base,
            id: `${order.id}-${lineKey}-prep`,
            lane: "prep",
            itemLabel: kind === "combo" ? "Burger del combo" : "Burger",
            detailLabel: item.name,
          });
        }
        if (hasSideQuestWork(item)) {
          nextEntries.push({
            ...base,
            id: `${order.id}-${lineKey}-sidequest`,
            lane: "sideQuest",
            itemLabel: "Side Quest",
            detailLabel:
              item.parentItemName && item.parentItemName !== item.name
                ? `${getSideQuestLabel(item)} · ${item.parentItemName}`
                : getSideQuestLabel(item),
          });
        }
        return nextEntries;
      });
      return entries.map((entry, index) => {
        const firstPendingIndex = entries.findIndex((item) => !item.done);
        const activeIndex = firstPendingIndex >= 0 ? firstPendingIndex : 0;
        return {
          ...entry,
          index,
          collapsedByDefault: index !== activeIndex,
          orderKitchenItemCount: entries.length,
        };
      });
    });

export const buildKitchenSideQuestItems = (
  productionItems: KitchenProductionItem[],
): KitchenSideQuestItem[] =>
  productionItems.flatMap((entry) => {
    const items: KitchenSideQuestItem[] = [];
    if (entry.item.garnish) {
      items.push({
        id: `${entry.id}-garnish`,
        order: entry.order,
        label: entry.item.garnish.name,
        detail: `${entry.item.name} · guarnición incluida`,
        done: entry.done,
      });
    }
    entry.item.sideQuestExtras.forEach((extra, index) => {
      items.push({
        id: `${entry.id}-extra-${index}`,
        order: entry.order,
        label: extra.name,
        detail: `${entry.item.name} · extra`,
        done: entry.done,
      });
    });
    if (entry.kind === "garnish") {
      items.push({
        id: `${entry.id}-standalone`,
        order: entry.order,
        label: entry.item.name,
        detail: "Side Quest directo",
        done: entry.done,
      });
    }
    return items;
  });

export const buildKitchenLocalSummary = (
  productionItems: KitchenProductionItem[],
): KitchenLocalSummary => {
  const countedOrders = new Set<string>();
  return productionItems.reduce<KitchenLocalSummary>(
    (summary, entry) => {
      const comboBurgerCount = entry.item.comboBurgers.length;
      if (!countedOrders.has(entry.order.id)) {
        countedOrders.add(entry.order.id);
        summary.estimatedSales += entry.order.total ?? 0;
      }
      summary.totalItems += 1;
      if (entry.done) summary.doneItems += 1;
      else summary.pendingItems += 1;
      if (entry.kind === "burger") summary.burgers += entry.item.qty;
      if (entry.kind === "combo") {
        summary.comboItems += entry.item.qty;
        summary.comboBurgers += Math.max(1, comboBurgerCount) * entry.item.qty;
        summary.burgers += Math.max(1, comboBurgerCount) * entry.item.qty;
      }
      if (entry.lane === "sideQuest") summary.garnishes += entry.item.qty;
      summary.extras += entry.item.extras.length * entry.item.qty;
      if (entry.lane === "sideQuest") summary.sideQuests += entry.item.qty;
      return summary;
    },
    {
      totalItems: 0,
      pendingItems: 0,
      doneItems: 0,
      burgers: 0,
      comboItems: 0,
      comboBurgers: 0,
      garnishes: 0,
      extras: 0,
      sideQuests: 0,
      estimatedSales: 0,
    },
  );
};

export const getKitchenItemActionKind = (
  item: Pick<KitchenOrderItem, "itemKind" | "name">,
) => {
  const kind = getKitchenItemKind(item);
  return isKitchenActionKind(kind) ? kind : "burger";
};
