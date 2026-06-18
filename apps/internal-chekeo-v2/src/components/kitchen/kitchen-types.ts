import type {
  OrderStatus,
  OrderV2Environment,
  OrderV2ItemKind,
} from "@config/index";

export type KitchenItemKind = Extract<
  OrderV2ItemKind,
  "burger" | "combo" | "garnish"
>;

export type KitchenView = "preparacion" | "listos" | "sideQuest" | "summaryK";
export type KitchenPrepState = "por-hacer" | "hecho";

export type KitchenOrderItem = {
  name: string;
  qty: number;
  lineKey?: string;
  itemDisplayIndex?: number;
  itemKind?: OrderV2ItemKind;
  removedIngredients: string[];
  extras: Array<{ sku?: string; name: string; price?: number }>;
  burgerNote?: string;
  garnish?: { sku?: string; name: string; upcharge?: number } | null;
  includedDrink?: { sku?: string; name: string } | null;
  sideQuestExtras: Array<{
    sku?: string;
    name: string;
    price?: number;
    itemKind?: "garnish" | "drink";
  }>;
  comboBurgers: Array<{
    sku?: string;
    name: string;
    removedIngredients: string[];
    extras: Array<{ sku?: string; name: string; price?: number }>;
    burgerNote?: string;
  }>;
  kitchenDone?: boolean;
};

export type KitchenOrder = {
  id: string;
  folio: string;
  customer: string;
  note?: string;
  status: OrderStatus;
  priority?: string;
  paymentState: string;
  createdAtMs?: number;
  items: KitchenOrderItem[];
};

export type KitchenProductionItem = {
  id: string;
  order: KitchenOrder;
  item: KitchenOrderItem;
  index: number;
  kind: KitchenItemKind;
  lineKey: string;
  done: boolean;
  collapsedByDefault: boolean;
  orderKitchenItemCount: number;
};

export type KitchenSideQuestItem = {
  id: string;
  order: KitchenOrder;
  label: string;
  detail: string;
  done: boolean;
};

export type KitchenLocalSummary = {
  totalItems: number;
  pendingItems: number;
  doneItems: number;
  burgers: number;
  comboItems: number;
  comboBurgers: number;
  garnishes: number;
  extras: number;
  sideQuests: number;
};

export type KitchenOrdersRuntime = {
  environment: OrderV2Environment;
  source: "d1" | "mock" | "fallback";
  loading: boolean;
  actionOrderId: string | null;
  error: string | null;
  limitWarning: string | null;
  highlightedOrderIds: Set<string>;
  sessionActive: boolean;
  reload: (includeTerminal?: boolean) => void;
  lastUpdated: string | null;
};

export type MoveKitchenOrderStatus = (
  id: string,
  next: OrderStatus,
  reason?: string,
) => Promise<void>;

export type ToggleKitchenItemDone = (
  orderId: string,
  lineKey: string,
  itemKind: KitchenItemKind,
  done: boolean,
) => Promise<void>;
