import type { OrderV2ItemKind } from "@config/index";
import type {
  KitchenItemKind,
  KitchenLocalBreakdownItem,
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
    notes.push(
      `Burgers del combo: ${item.comboBurgers.map((burger) => burger.name).join(", ")}`,
    );
  }
  if (item.removedIngredients.length) {
    item.removedIngredients.forEach((ing) => {
      notes.push(`Sin ${ing}`);
    });
  }
  if (item.extras.length) {
    item.extras.forEach((extra) => {
      const cleanName = extra.name
        .replace(/\bextras?\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      if (cleanName) {
        notes.push(cleanName);
      }
    });
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
      burger.removedIngredients.forEach((ing) => {
        notes.push(`sin ${ing}`);
      });
    }
    if (burger.extras.length) {
      burger.extras.forEach((extra) => {
        const cleanName = extra.name
          .replace(/\bextras?\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();
        if (cleanName) {
          notes.push(cleanName);
        }
      });
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
        const nextEntries: Omit<
          KitchenProductionItem,
          "collapsedByDefault" | "orderKitchenItemCount"
        >[] = [];
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
  orders: KitchenOrder[],
): KitchenLocalSummary => {
  const summary: KitchenLocalSummary = {
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
    burgersList: [],
    garnishesList: [],
  };

  const burgerMap = new Map<string, KitchenLocalBreakdownItem>();
  const garnishMap = new Map<string, KitchenLocalBreakdownItem>();

  const addBurger = (sku: string, name: string, qty: number) => {
    const key = sku || name;
    if (!key) return;
    const existing = burgerMap.get(key) || { sku, name, quantity: 0 };
    existing.quantity += qty;
    burgerMap.set(key, existing);
  };

  const addGarnish = (sku: string, name: string, qty: number) => {
    const key = sku || name;
    if (!key) return;
    const existing = garnishMap.get(key) || { sku, name, quantity: 0 };
    existing.quantity += qty;
    garnishMap.set(key, existing);
  };

  orders.forEach((order) => {
    summary.estimatedSales += order.total ?? 0;

    order.items.forEach((item) => {
      if (!isProductionItem(item)) return;

      const kind = getKitchenItemKind(item);
      summary.totalItems += 1;

      if (item.kitchenDone) summary.doneItems += 1;
      else summary.pendingItems += 1;

      summary.extras += item.extras.length * item.qty;

      if (kind === "burger") {
        summary.burgers += item.qty;
        addBurger(item.comboBurgers?.[0]?.sku || "", item.name, item.qty);
      } else if (kind === "combo") {
        summary.comboItems += item.qty;
        const comboBurgerCount = item.comboBurgers.length;
        const totalComboBurgers = Math.max(1, comboBurgerCount) * item.qty;
        summary.comboBurgers += totalComboBurgers;
        summary.burgers += totalComboBurgers;

        if (comboBurgerCount > 0) {
          item.comboBurgers.forEach((cb) =>
            addBurger(cb.sku || "", cb.name, item.qty),
          );
        } else {
          addBurger("", item.name, item.qty);
        }

        if (item.garnish) {
          summary.garnishes += item.qty;
          summary.sideQuests += item.qty;
          addGarnish(item.garnish.sku || "", item.garnish.name, item.qty);
        }
      } else if (kind === "garnish") {
        summary.garnishes += item.qty;
        summary.sideQuests += item.qty;
        addGarnish("", item.name, item.qty);
      }

      item.sideQuestExtras.forEach((sqExtra) => {
        if (sqExtra.itemKind === "garnish") {
           summary.garnishes += item.qty;
           summary.sideQuests += item.qty;
           addGarnish(sqExtra.sku || "", sqExtra.name, item.qty);
        }
      });
    });
  });

  summary.burgersList = Array.from(burgerMap.values()).sort(
    (a, b) => b.quantity - a.quantity,
  );
  summary.garnishesList = Array.from(garnishMap.values()).sort(
    (a, b) => b.quantity - a.quantity,
  );

  return summary;
};

export const getKitchenItemActionKind = (
  item: Pick<KitchenOrderItem, "itemKind" | "name">,
) => {
  const kind = getKitchenItemKind(item);
  return isKitchenActionKind(kind) ? kind : "burger";
};

const getShortName = (name: string): string => {
  const clean = name.trim();
  if (clean === "Aros de cebolla") return "Aros";
  if (clean.toLowerCase().startsWith("burger ")) {
    return clean.substring(7).trim();
  }
  return clean;
};

/**
 * Builds a compact queue summary for the entire kitchen order.
 * e.g. "x1 BBQ · x3 OG · x1 Combo BBQ · x2 Papas"
 */
export const buildKitchenOrderQueueSummary = (
  order: KitchenOrder,
): string => {
  const counts = new Map<string, number>();

  const addCount = (name: string, qty: number) => {
    const short = getShortName(name);
    counts.set(short, (counts.get(short) ?? 0) + qty);
  };

  for (const item of order.items) {
    const kind = getKitchenItemKind(item);

    if (kind === "burger" || kind === "combo" || kind === "garnish") {
      addCount(item.name, item.qty);

      if (kind === "combo") {
        if (item.comboBurgers && item.comboBurgers.length > 0) {
          for (const cb of item.comboBurgers) {
            addCount(cb.name, item.qty);
          }
        }
        if (item.garnish) {
          addCount(item.garnish.name, item.qty);
        }
      }

      if (item.sideQuestExtras && item.sideQuestExtras.length > 0) {
        for (const extra of item.sideQuestExtras) {
          addCount(extra.name, item.qty);
        }
      }
    }
  }

  return [...counts.entries()]
    .map(([name, qty]) => `x${qty} ${name}`)
    .join(" · ");
};
