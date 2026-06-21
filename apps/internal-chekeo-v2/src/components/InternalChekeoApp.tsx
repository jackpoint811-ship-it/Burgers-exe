import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChefHat,
  CreditCard,
  ExternalLink,
  FileText,
  Gift,
  History,
  House,
  PackageSearch,
  RefreshCw,
  Shield,
  ShoppingBag,
  WalletCards,
} from "lucide-react";
import {
  mockOrders,
  type KitchenSummaryKResponse,
  type MockOrder,
  type OrdersV2SummaryResponse,
  type OrderStatus,
  type OrderV2,
  type OrderV2Environment,
  type OrderV2Event,
  type OrderV2ItemKind,
  type OrderV2PaymentStatus,
  type OrderV2Status,
  type ChekeoRuntimeEnvironment,
  bankPaymentConfig,
  getBankPaymentPrimaryLabel,
  getBankPaymentPrimaryValue,
  getChekeoRuntimeEnvironment,
  getOrderEnvironmentForChekeoRuntime,
  getPublicOrderLabelForEnvironment,
  getPublicOrderUrlForEnvironment,
} from "@config/index";
import { Button, Card, StatusPill } from "@ui/index";
import {
  fetchInternalAuthStatus,
  getInternalAuthMode,
  shouldGateAdminInternally,
  shouldUseGlobalInternalAuthGate,
  loginInternal,
  logoutInternal,
  type InternalAuthMode,
} from "../lib/internal-auth";
import { fetchKitchenSummaryK } from "../lib/ingredients-v2-admin";
import {
  archiveCancelledOrderV2,
  exportOrdersV2Csv,
  fetchOrdersV2Admin,
  fetchOrdersV2Summary,
  updateKitchenItemV2,
  updateOrderV2Payment,
  updateOrderV2Status,
} from "../lib/orders-v2-admin";
import {
  buildWhatsappOrderMessage,
  buildWhatsappPaymentMessage,
  buildWhatsappUrl,
  normalizeWhatsappPhone,
  type WhatsappBankDetails,
  type WhatsappOrderMessageType,
} from "../lib/whatsapp";
import {
  buildOrderTicketSummaryText,
  canShareOrderTicketImage,
  downloadOrderTicketImage,
  generateOrderTicketImage,
  shareOrderTicketImage,
} from "../lib/order-ticket-image";
import { CatalogAdminPanel } from "./CatalogAdminPanel";
import { RafflesAdminPanel } from "./RafflesAdminPanel";
import { KitchenQueue } from "./kitchen/KitchenQueue";
import {
  extractKitchenLocation,
  getKitchenLineKey,
  parseOrderTimestamp,
  stripLocationFromNotes,
} from "./kitchen/kitchen-helpers";

type TabKey =
  | "home"
  | "pedidos"
  | "cocina"
  | "pagos"
  | "admin";
type AdminViewKey =
  | "launcher"
  | "banco"
  | "historial"
  | "cierre"
  | "catalogo"
  | "sorteos"
  | "reportes";
type OrdersSource = "d1" | "mock" | "fallback";
type OrdersV2Summary = NonNullable<OrdersV2SummaryResponse["data"]>;
type KitchenSummaryK = NonNullable<KitchenSummaryKResponse["data"]>;
type KitchenItemKind = Extract<OrderV2ItemKind, "burger" | "combo" | "garnish">;
type InternalOrderItem = MockOrder["items"][number] & {
  lineTotal?: number;
  lineKey?: string;
  itemDisplayIndex?: number;
  itemKind?: OrderV2ItemKind;
  removedIngredients: string[];
  extras: Array<{ sku?: string; name: string; price?: number }>;
  burgerNote?: string;
  garnish?: { sku?: string; name: string; upcharge?: number } | null;
  includedDrink?: { sku?: string; name: string } | null;
  sideQuestExtras: Array<{ sku?: string; name: string; price?: number; itemKind?: "garnish" | "drink" }>;
  comboBurgers: Array<{
    sku?: string;
    name: string;
    removedIngredients: string[];
    extras: Array<{ sku?: string; name: string; price?: number }>;
    burgerNote?: string;
  }>;
  extrasTotalCents?: number;
  sideQuestExtrasTotalCents?: number;
  includedGarnishUpchargeCents?: number;
  kitchenDone?: boolean;
};
type InternalTimelineEvent = MockOrder["timeline"][number] & {
  actor?: string;
  previousStatus?: OrderStatus;
  nextStatus?: OrderStatus;
  reason?: string;
};
type InternalOrder = Omit<
  MockOrder,
  "paymentMethod" | "paymentState" | "channel" | "items" | "timeline"
> & {
  channel: "walk-in" | "pickup" | "delivery";
  paymentMethod: string;
  paymentState: OrderV2PaymentStatus | string;
  customerPhone?: string;
  source?: string;
  updatedAt?: string;
  createdAtMs?: number;
  updatedAtMs?: number;
  items: InternalOrderItem[];
  timeline: InternalTimelineEvent[];
  archivedAt?: string;
};

type StatusAction = { status: OrderStatus; label: string; tone?: "danger" };
type OrdersStatusFilter = "all" | "received" | "ready" | "delivered" | "cancelled";
type OrdersRangeFilter = "today" | "week" | "all";
type NewOrderNotice = {
  message: string;
  orderFolios: string[];
} | null;
type OrdersRuntime = {
  environment: OrderV2Environment;
  source: OrdersSource;
  loading: boolean;
  actionOrderId: string | null;
  error: string | null;
  notice: string | null;
  highlightedOrderIds: Set<string>;
  sessionActive: boolean;
  sessionState: SessionState;
  onSessionExpired: () => void;
  reload: (includeTerminal?: boolean) => void;
  lastUpdated: string | null;
  limitWarning: string | null;
};
type SessionState = "checking" | "active" | "inactive" | "expired";
type TruthTone = "system" | "success" | "warning" | "danger" | "neutral";
type TruthItem = { label: string; value: string; tone: TruthTone };
type TruthBanner = { title: string; message: string; tone: TruthTone };
type TruthAction = { label: string; helper: string; tone: TruthTone };
type OperationalTruth = {
  headline: string;
  summary: string;
  environment: TruthItem;
  session: TruthItem;
  data: TruthItem;
  capability: TruthItem;
  activity: TruthItem;
  freshness: TruthItem;
  action: TruthAction;
  banner: TruthBanner | null;
  sourceBadge: string;
  sourceMessage: string;
  sourceHint: string;
  kitchenTitle: string;
  kitchenHint: string;
  summaryHint: string;
};
type NavIcon = typeof House;
type AdminModuleCategory = "operacion" | "configuracion" | "datos" | "promos";
type AdminModuleStatus = "base-lista" | "solo-lectura" | "basico" | "pendiente";
type AdminViewDefinition = {
  key: AdminViewKey;
  label: string;
  hint: string;
  icon: NavIcon;
  category?: AdminModuleCategory;
  status?: AdminModuleStatus;
  description?: string;
  cta?: string;
};
type AdminModuleDefinition = AdminViewDefinition & {
  key: Exclude<AdminViewKey, "launcher">;
  category: AdminModuleCategory;
  status: AdminModuleStatus;
  description: string;
  cta: string;
};

const orderEnvironmentLabel: Record<OrderV2Environment, string> = {
  production: "Producción",
  preview: "Preview",
};

const runtimeEnvironmentLabel: Record<ChekeoRuntimeEnvironment, string> = {
  production: "PRODUCCIÓN",
  preview: "PREVIEW",
  local: "LOCAL",
};

const runtimeEnvironmentCopy: Record<
  ChekeoRuntimeEnvironment,
  { primary: string; secondary: string }
> = {
  preview: {
    primary: "Preview: valida sin tocar producción.",
    secondary: "No asumas datos reales hasta ver D1 activo.",
  },
  production: {
    primary: "Producción: cualquier cambio impacta pedidos reales.",
    secondary: "Confirma sesión y datos antes de operar.",
  },
  local: {
    primary: "Local: UI para pruebas internas.",
    secondary: "No cambia pedidos reales.",
  },
};
const primaryTabs: Array<{
  key: TabKey;
  label: string;
  hint: string;
  icon: NavIcon;
}> = [
  { key: "home", label: "Home", hint: "Resumen", icon: House },
  { key: "pedidos", label: "Pedidos", hint: "Seguimiento", icon: ShoppingBag },
  { key: "cocina", label: "Cocina", hint: "Producción", icon: ChefHat },
  { key: "pagos", label: "Pagos", hint: "Confirmación", icon: WalletCards },
  { key: "admin", label: "Admin", hint: "Módulos", icon: Shield },
];
const adminModuleGroups: Array<{
  key: AdminModuleCategory;
  title: string;
  description: string;
}> = [
  {
    key: "operacion",
    title: "Operación",
    description: "Cierre actual e historial fuera del flujo diario.",
  },
  {
    key: "configuracion",
    title: "Configuración",
    description: "Datos y catálogo que alimentan módulos internos.",
  },
  {
    key: "datos",
    title: "Datos",
    description: "Exportes, reportes y enlaces de estado.",
  },
  {
    key: "promos",
    title: "Promos/Sorteos",
    description: "Campañas, referidos y ajustes manuales auditable.",
  },
];
const adminModuleStatusMeta: Record<
  AdminModuleStatus,
  { label: string; className: string }
> = {
  "base-lista": {
    label: "Base lista",
    className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
  },
  "solo-lectura": {
    label: "Solo lectura",
    className: "border-zinc-600 bg-zinc-900 text-zinc-100",
  },
  basico: {
    label: "Básico",
    className: "border-cyan-400/40 bg-cyan-500/10 text-cyan-100",
  },
  pendiente: {
    label: "Pendiente",
    className: "border-amber-400/40 bg-amber-500/10 text-amber-100",
  },
};
const adminViews: AdminViewDefinition[] = [
  { key: "launcher", label: "Hub", hint: "Módulos", icon: Shield },
  {
    key: "banco",
    label: "Datos bancarios",
    hint: "Transferencia",
    icon: WalletCards,
    category: "configuracion",
    status: "solo-lectura",
    description:
      "Fuente central de transferencia para Pagos y mensajes operativos.",
    cta: "Ver módulo",
  },
  {
    key: "historial",
    label: "Historial",
    hint: "Entregados/cancelados",
    icon: History,
    category: "operacion",
    status: "base-lista",
    description:
      "Pedidos entregados y cancelados sin saturar el centro operativo.",
    cta: "Ver módulo",
  },
  {
    key: "cierre",
    label: "Cierre",
    hint: "Corte actual",
    icon: CreditCard,
    category: "operacion",
    status: "base-lista",
    description:
      "Resumen de operación por rango y descarga del corte actual.",
    cta: "Ver módulo",
  },
  {
    key: "catalogo",
    label: "Catálogo",
    hint: "Menú y stock",
    icon: PackageSearch,
    category: "configuracion",
    status: "base-lista",
    description:
      "Productos, promos, banners e ingredientes con el panel existente.",
    cta: "Ver módulo",
  },
  {
    key: "sorteos",
    label: "Sorteos",
    hint: "Campañas",
    icon: Gift,
    category: "promos",
    status: "basico",
    description:
      "Campañas, participantes, referidos y tickets extra manuales.",
    cta: "Ver módulo",
  },
  {
    key: "reportes",
    label: "Reportes",
    hint: "Exportes",
    icon: FileText,
    category: "datos",
    status: "basico",
    description:
      "Exportes y contexto técnico sin mezclarlo con operación diaria.",
    cta: "Ver módulo",
  },
];
const adminModuleViews = adminViews.filter(
  (option): option is AdminModuleDefinition => option.key !== "launcher",
);
const LIVE_ACTIVE_ORDERS_LIMIT = 100;
const LIVE_TERMINAL_ORDERS_LIMIT = 100;
const shouldIncludeTerminalOrders = (tab: TabKey, adminView: AdminViewKey) =>
  tab === "pedidos" ||
  tab === "pagos" ||
  (tab === "admin" &&
    (adminView === "historial" ||
      adminView === "cierre" ||
      adminView === "reportes"));
const shouldKeepOrdersLoaded = (tab: TabKey, adminView: AdminViewKey) =>
  tab !== "admin" ||
  (adminView !== "banco" &&
    adminView !== "catalogo" &&
    adminView !== "sorteos" &&
    adminView !== "cierre" &&
    adminView !== "reportes");
const shouldRetainTerminalOrdersInView = (tab: TabKey, adminView: AdminViewKey) =>
  tab === "pedidos" || (tab === "admin" && adminView === "historial");

const isPreviewOrderSource = (source?: string) => source === "public-v2-preview";

const statusLabel: Record<OrderStatus, string> = {
  new: "Pedido listo para revisar",
  preparing: "En preparación",
  ready: "Listo para entregar",
  delivered: "Entregado",
  cancelled: "Cancelado",
};
const statusTone: Record<OrderStatus, string> = {
  new: "border-sky-400/40 text-sky-200",
  preparing: "border-amber-400/40 text-amber-200",
  ready: "border-emerald-400/40 text-emerald-200",
  delivered: "border-zinc-500/40 text-zinc-200",
  cancelled: "border-rose-500/40 text-rose-300",
};
const paymentStatusLabel: Record<OrderV2PaymentStatus, string> = {
  pending: "Pago pendiente",
  paid: "Pago confirmado",
  cancelled: "Cancelado",
};
const paymentStatusTone: Record<OrderV2PaymentStatus, string> = {
  pending: "border-amber-400/40 text-amber-200",
  paid: "border-emerald-400/40 text-emerald-200",
  cancelled: "border-rose-500/40 text-rose-300",
};
const isOrderV2PaymentStatus = (value: string): value is OrderV2PaymentStatus =>
  value === "pending" || value === "paid" || value === "cancelled";
const terminalStatuses = new Set<OrderStatus>(["delivered", "cancelled"]);
const channelLabel: Record<InternalOrder["channel"], string> = {
  "walk-in": "Mostrador",
  pickup: "Para recoger",
  delivery: "Entrega",
};
const paymentMethodLabel: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  unknown: "Por confirmar",
};
const sourceLabel = (source?: string) =>
  source === "d1" || source === "public-v2"
    ? "Pedidos reales"
    : source === "public-v2-preview"
      ? "Pedidos de prueba"
      : "Vista local";
const truthToneClassName: Record<TruthTone, string> = {
  system: "truth-pill truth-pill--system",
  success: "truth-pill truth-pill--success",
  warning: "truth-pill truth-pill--warning",
  danger: "truth-pill truth-pill--danger",
  neutral: "truth-pill truth-pill--neutral",
};
const truthBannerClassName: Record<TruthTone, string> = {
  system: "truth-banner truth-banner--system",
  success: "truth-banner truth-banner--success",
  warning: "truth-banner truth-banner--warning",
  danger: "truth-banner truth-banner--danger",
  neutral: "truth-banner truth-banner--neutral",
};
const truthActionClassName: Record<TruthTone, string> = {
  system: "truth-action truth-action--system",
  success: "truth-action truth-action--success",
  warning: "truth-action truth-action--warning",
  danger: "truth-action truth-action--danger",
  neutral: "truth-action truth-action--neutral",
};
const sessionStateLabel: Record<SessionState, TruthItem> = {
  checking: { label: "Sesión", value: "Verificando", tone: "system" },
  active: { label: "Sesión", value: "Activa", tone: "success" },
  inactive: { label: "Sesión", value: "No activa", tone: "neutral" },
  expired: { label: "Sesión", value: "Expirada", tone: "danger" },
};
const getOperationalTruth = ({
  runtime,
  runtimeEnvironment,
  activeCount,
}: {
  runtime: OrdersRuntime;
  runtimeEnvironment: ChekeoRuntimeEnvironment;
  activeCount: number;
}): OperationalTruth => {
  const environment: TruthItem = {
    label: "Entorno",
    value: runtimeEnvironmentLabel[runtimeEnvironment],
    tone: "system",
  };
  const session = sessionStateLabel[runtime.sessionState];
  const isLiveD1 = runtime.source === "d1" && runtime.environment === "production";
  const isPreviewD1 = runtime.source === "d1" && runtime.environment === "preview";
  const data: TruthItem = isLiveD1
    ? { label: "Datos", value: "D1 real", tone: "success" }
    : isPreviewD1
      ? { label: "Datos", value: "Preview D1", tone: "system" }
      : runtime.source === "fallback"
        ? { label: "Datos", value: "Fallback", tone: "warning" }
        : { label: "Datos", value: "Mock local", tone: "warning" };
  const capability: TruthItem =
    runtime.sessionState !== "active"
      ? { label: "Capacidad", value: "Entrar para operar", tone: "danger" }
      : runtime.error && runtime.source !== "d1"
        ? { label: "Capacidad", value: "Sin backend", tone: "danger" }
        : runtime.source === "d1"
          ? {
              label: "Capacidad",
              value: runtime.environment === "preview" ? "Operable en preview" : "Operable",
              tone: "success",
            }
          : { label: "Capacidad", value: "Solo revisión", tone: "warning" };
  const activity: TruthItem = {
    label: "Carga",
    value: `${activeCount} activos`,
    tone: activeCount > 0 ? "neutral" : "system",
  };
  const freshness: TruthItem = {
    label: "Actualización",
    value: runtime.lastUpdated ? runtime.lastUpdated : "Pendiente",
    tone: runtime.lastUpdated ? "neutral" : runtime.source === "d1" ? "warning" : "neutral",
  };

  let headline = "Chekeo listo para revisar";
  let summary = "Confirma entorno, sesión y datos antes de mover pedidos.";
  let action: TruthAction = {
    label: runtime.loading ? "Actualizando..." : "Actualizar",
    helper: "Refresca el estado actual.",
    tone: "system",
  };
  let banner: TruthBanner | null = null;
  let sourceBadge = data.value;
  let sourceMessage = "Revisa esta superficie antes de operar.";
  let sourceHint = "Reintenta si dudas del backend.";
  let kitchenTitle = "Cocina conectada";
  let kitchenHint = "Revisa el flujo actual antes de mover pedidos.";
  let summaryHint = "Solo referencia visual.";

  if (runtime.sessionState === "expired") {
    headline = "Sesión expirada";
    summary = "Vuelve a entrar antes de operar.";
    action = { label: "Entrar de nuevo", helper: "Recupera la sesión.", tone: "danger" };
    banner = {
      title: "Sesión vencida",
      message: "Chekeo salió de la sesión activa. Vuelve a entrar para recuperar D1.",
      tone: "danger",
    };
  } else if (runtime.sessionState !== "active") {
    headline = "Sin sesión operativa";
    summary = "Entra para consultar D1 y habilitar acciones.";
    action = { label: "Entrar", helper: "Activa la sesión primero.", tone: "neutral" };
  } else if (isLiveD1) {
    headline = "Operando con datos reales";
    summary = "Cada acción impacta pedidos reales.";
    action = {
      label: runtime.loading ? "Actualizando..." : "Actualizar",
      helper: "Confirma que la lista siga al día.",
      tone: "success",
    };
    sourceMessage = "Lee y escribe sobre D1 real.";
    sourceHint = "Si algo falla, revisa sesión o backend antes de seguir.";
    kitchenTitle = "Cocina conectada a D1 real";
    summaryHint = `${activeCount} pedidos activos visibles.`;
  } else if (isPreviewD1) {
    headline = "Operando en preview";
    summary = "Puedes validar flujo sin tocar producción.";
    action = {
      label: runtime.loading ? "Actualizando..." : "Actualizar",
      helper: "Refresca preview antes de validar.",
      tone: "system",
    };
    banner = {
      title: "Preview D1",
      message: "Los datos vienen del backend de prueba. No asumas producción.",
      tone: "system",
    };
    sourceMessage = "Lee y escribe sobre D1 preview.";
    sourceHint = "Úsalo para validar flujos y copy.";
    kitchenTitle = "Cocina conectada a preview";
    kitchenHint = "Valida el flujo sin tratarlo como producción.";
    summaryHint = `${activeCount} pedidos activos visibles en preview.`;
  } else if (runtime.source === "fallback") {
    headline = "Chekeo está en fallback";
    summary = "Puedes revisar pedidos, pero no confiar en escritura real.";
    action = {
      label: runtime.loading ? "Reconectando..." : "Reintentar",
      helper: "Busca volver a D1.",
      tone: "warning",
    };
    banner = {
      title: "Solo revisión",
      message: runtime.error
        ? "El backend falló y Chekeo cayó a fallback. Reintenta antes de operar."
        : "Los cambios quedan en esta vista hasta recuperar D1.",
      tone: runtime.error ? "danger" : "warning",
    };
    sourceMessage = "Solo lectura mientras el backend no responde.";
    sourceHint = "No confirmes pagos o estados como definitivos.";
    kitchenTitle = "Cocina en fallback";
    kitchenHint = "Referencia visual. Reintenta para volver a D1.";
  } else {
    headline = runtimeEnvironment === "local" ? "Chekeo corre en local" : "Chekeo está en mock";
    summary = "Úsalo para revisar UI; no hay backend real activo.";
    action = {
      label: runtime.loading ? "Reintentando..." : "Reintentar",
      helper: "Intenta recuperar D1 o sesión.",
      tone: "warning",
    };
    banner = {
      title: runtimeEnvironment === "local" ? "Mock local" : "Modo mock",
      message: "Solo valida la interfaz. Los cambios no llegan a datos reales.",
      tone: "warning",
    };
    sourceMessage = "Vista aislada del backend real.";
    sourceHint = "Úsala para revisar layout y flujo base.";
    kitchenTitle = "Cocina en vista local";
    kitchenHint = "Solo referencia visual hasta volver a D1.";
  }

  if (runtime.error && runtime.source === "d1") {
    banner = {
      title: "Backend con error",
      message: "La última solicitud falló. Reintenta antes de asumir que todo está al día.",
      tone: "warning",
    };
    action = {
      label: runtime.loading ? "Reintentando..." : "Reintentar",
      helper: "Confirma que D1 siga respondiendo.",
      tone: "warning",
    };
  }

  return {
    headline,
    summary,
    environment,
    session,
    data,
    capability,
    activity,
    freshness,
    action,
    banner,
    sourceBadge,
    sourceMessage,
    sourceHint,
    kitchenTitle,
    kitchenHint,
    summaryHint,
  };
};
const getPaymentStatusLabel = (status: string) =>
  isOrderV2PaymentStatus(status) ? paymentStatusLabel[status] : status || "Por confirmar";
const getPaymentMethodLabel = (method: string) =>
  paymentMethodLabel[method] ?? (method || "Por confirmar");
const isTransferPaymentMethod = (method: string) =>
  ["transfer", "transferencia", "spei"].includes(
    method.trim().toLowerCase(),
  );
const getPaymentDeliveryDetail = (order: InternalOrder) => {
  const location = extractKitchenLocation(order.note);
  const noteWithoutLocation = stripLocationFromNotes(order.note);
  const detailParts = [`${channelLabel[order.channel]} · ${location}`];
  if (noteWithoutLocation) detailParts.push(noteWithoutLocation);
  return detailParts.join(" | ");
};
const buildPaymentNoteWithLocation = (
  order: InternalOrder,
  note: string,
) => {
  const location = extractKitchenLocation(order.note);
  const trimmedNote = note.trim();
  if (!trimmedNote) {
    return location === "Sin ubicación" ? "" : `Ubicación: ${location}`;
  }
  return location === "Sin ubicación"
    ? trimmedNote
    : `Ubicación: ${location} | ${trimmedNote}`;
};
const getPaymentItemsDigest = (order: InternalOrder) => {
  if (!order.items.length) return "Resumen no disponible.";
  const preview = order.items
    .slice(0, 2)
    .map((item) => `${item.qty}x ${item.name}`)
    .join(" · ");
  const remaining = order.items.length - 2;
  return remaining > 0 ? `${preview} +${remaining} mas` : preview;
};
const buildPaymentWhatsappCopy = (order: InternalOrder) =>
  buildWhatsappPaymentMessage({
    customer: order.customer,
    customerName: order.customer,
    folio: order.folio,
    paymentMethod: order.paymentMethod,
    paymentState: order.paymentState,
    total: order.total,
    items: order.items,
    note: stripLocationFromNotes(order.note),
    source: order.source,
    orderStatus: statusLabel[order.status],
    deliveryDetail: getPaymentDeliveryDetail(order),
    bankDetails: isTransferPaymentMethod(order.paymentMethod)
      ? bankPaymentConfig
      : null,
  });
const getOrderItemCount = (order: InternalOrder) =>
  order.items.reduce((total, item) => total + item.qty, 0);
const getOrdersStatusFilterValue = (
  status: OrderStatus,
): Exclude<OrdersStatusFilter, "all"> =>
  status === "ready"
    ? "ready"
    : status === "delivered"
      ? "delivered"
      : status === "cancelled"
        ? "cancelled"
        : "received";
const ordersStatusLabel: Record<Exclude<OrdersStatusFilter, "all">, string> = {
  received: "Recibido",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
};
const ordersStatusTone: Record<Exclude<OrdersStatusFilter, "all">, string> = {
  received: "border-sky-400/40 text-sky-200",
  ready: "border-emerald-400/40 text-emerald-200",
  delivered: "border-zinc-500/40 text-zinc-200",
  cancelled: "border-rose-500/40 text-rose-300",
};
const ordersStatusFilterOptions: Array<{
  value: OrdersStatusFilter;
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "received", label: "Recibido" },
  { value: "ready", label: "Listo" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
];
const ordersRangeFilterOptions: Array<{
  value: OrdersRangeFilter;
  label: string;
}> = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Semana" },
  { value: "all", label: "Todo" },
];
const getOrdersStatusLabel = (status: OrderStatus) =>
  ordersStatusLabel[getOrdersStatusFilterValue(status)];
const getOrderLocationLabel = (order: Pick<InternalOrder, "note">) =>
  extractKitchenLocation(order.note);
const getOrderPower = (order: InternalOrder) => {
  const extrasCount = order.items.reduce(
    (total, item) =>
      total +
      item.extras.length +
      item.sideQuestExtras.length +
      item.comboBurgers.reduce((comboTotal, burger) => comboTotal + burger.extras.length, 0),
    0,
  );
  return Math.max(
    10,
    Math.round(order.total / 120) + getOrderItemCount(order) * 12 + extrasCount * 6,
  );
};
const getOrderRarity = (order: InternalOrder) => {
  const power = getOrderPower(order);
  if (power >= 220) return "Legendario";
  if (power >= 160) return "Épico";
  if (power >= 110) return "Raro";
  return "Base";
};
const getOperationalSummary = (orders: InternalOrder[]) => {
  const visibleOrders = orders.filter((order) => !terminalStatuses.has(order.status));
  const participants = new Set(
    orders.map((order) => (order.customerPhone || order.customer).trim().toLowerCase()).filter(Boolean),
  );
  const actionableOrders = visibleOrders.filter(
    (order) =>
      order.status === "new" ||
      order.status === "ready" ||
      order.paymentState === "pending",
  );
  return {
    activeOrders: visibleOrders.length,
    pendingOrders: visibleOrders.filter((order) => order.status === "new").length,
    preparingOrders: visibleOrders.filter((order) => order.status === "preparing").length,
    readyOrders: visibleOrders.filter((order) => order.status === "ready").length,
    actionableOrders: actionableOrders.length,
    participants: participants.size,
    totalTickets: orders.length,
    paymentsToReview: visibleOrders.filter((order) => order.paymentState === "pending").length,
  };
};
const whatsappTemplateLabels: Array<{
  value: Exclude<WhatsappOrderMessageType, "custom">;
  label: string;
}> = [
  { value: "received", label: "Recibido" },
  { value: "preparing", label: "En preparación" },
  { value: "ready", label: "Listo" },
  { value: "delivered", label: "Entregado" },
];

const cancellationReasonPresets = [
  "Cliente canceló",
  "Sin stock",
  "Pago no confirmado",
  "Pedido duplicado",
  "Error de captura",
  "Otro",
] as const;
type CancellationReasonPreset = (typeof cancellationReasonPresets)[number];
type CancellationRequest = {
  order: InternalOrder;
  origin: "pedidos" | "detalle";
} | null;
type MoveOrderStatus = (
  id: string,
  next: OrderStatus,
  reason?: string,
) => Promise<void>;
type ToggleKitchenItemDone = (
  orderId: string,
  lineKey: string,
  itemKind: KitchenItemKind,
  done: boolean,
) => Promise<void>;

const normalizeMockOrderItem = (
  item: MockOrder["items"][number],
  index: number,
): InternalOrderItem => ({
  ...item,
  lineKey: `mock-${index + 1}-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  itemDisplayIndex: index + 1,
  itemKind: item.name.toLowerCase().includes("fries") ? "garnish" : "burger",
  removedIngredients: item.note ? [item.note] : [],
  extras: [],
  garnish: null,
  includedDrink: null,
  sideQuestExtras: [],
  comboBurgers: [],
  kitchenDone: false,
});
const asInternalOrders = (orders: MockOrder[]): InternalOrder[] =>
  orders.map((order) => ({
    ...order,
    createdAtMs: parseOrderTimestamp(order.createdAt),
    items: order.items.map(normalizeMockOrderItem),
  }));
const AUTO_REFRESH_INTERVAL_MS = 25_000;
const NEW_ORDER_HIGHLIGHT_MS = 12_000;
const formatOrderRefreshTime = (reason?: "manual" | "auto" | "session") => {
  const time = new Date().toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return reason === "auto" ? `${time} · auto-refresh` : time;
};
const getOrderKey = (order: Pick<InternalOrder, "id" | "folio">) =>
  `${order.id}::${order.folio}`;
const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
const todayDateInput = () => new Date().toISOString().slice(0, 10);
const formatDuration = (seconds: number | null) => {
  if (seconds === null) return "—";
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const restSeconds = rounded % 60;
  return minutes > 0 ? `${minutes}m ${restSeconds}s` : `${restSeconds}s`;
};
const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
};
const mapKitchenStation = (
  status: OrderV2Status,
): InternalOrder["kitchenStation"] =>
  status === "new" ? "grill" : status === "preparing" ? "assembly" : "dispatch";
const getWhatsappTemplateForStatus = (
  status: OrderStatus,
): Exclude<WhatsappOrderMessageType, "custom"> => {
  if (status === "preparing") return "preparing";
  if (status === "ready") return "ready";
  if (status === "delivered" || status === "cancelled") return "delivered";
  return "received";
};

const isOrderV2ItemKind = (value: unknown): value is OrderV2ItemKind =>
  value === "burger" ||
  value === "combo" ||
  value === "garnish" ||
  value === "drink" ||
  value === "other";

const getOptionalString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const getOptionalNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const parseSnapshotExtras = (
  value: unknown,
): Array<{ sku?: string; name: string; price?: number }> => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const name = getOptionalString(record.name);
    if (!name) return [];
    const sku = getOptionalString(record.sku);
    const price = getOptionalNumber(record.price);
    return [
      {
        ...(sku ? { sku } : {}),
        name,
        ...(price !== undefined ? { price } : {}),
      },
    ];
  });
};

const parseSnapshotGarnish = (value: unknown) => {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const name = getOptionalString(record.name);
  if (!name) return null;
  const sku = getOptionalString(record.sku);
  const upcharge = getOptionalNumber(record.upcharge);
  return { ...(sku ? { sku } : {}), name, ...(upcharge !== undefined ? { upcharge } : {}) };
};

const parseSnapshotIncludedDrink = (value: unknown) => {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const name = getOptionalString(record.name);
  if (!name) return null;
  const sku = getOptionalString(record.sku);
  return { ...(sku ? { sku } : {}), name };
};

const parseSnapshotSideQuestExtras = (
  value: unknown,
): Array<{ sku?: string; name: string; price?: number; itemKind?: "garnish" | "drink" }> =>
  parseSnapshotExtras(value).map((extra, index) => {
    const rawEntry = Array.isArray(value) ? value[index] : null;
    const record = rawEntry && typeof rawEntry === "object" && !Array.isArray(rawEntry) ? rawEntry as Record<string, unknown> : {};
    const itemKind = record.itemKind === "drink" || record.itemKind === "garnish" ? record.itemKind : undefined;
    return { ...extra, ...(itemKind ? { itemKind } : {}) };
  });

const parseSnapshotComboBurgers = (value: unknown): InternalOrderItem["comboBurgers"] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const name = getOptionalString(record.name);
    if (!name) return [];
    const sku = getOptionalString(record.sku);
    return [{
      ...(sku ? { sku } : {}),
      name,
      removedIngredients: Array.isArray(record.removedIngredients) ? record.removedIngredients.filter((ingredient): ingredient is string => typeof ingredient === "string" && Boolean(ingredient.trim())) : [],
      extras: parseSnapshotExtras(record.extras),
      burgerNote: getOptionalString(record.burgerNote),
    }];
  });
};

const getKitchenDoneByLineKey = (events: OrderV2Event[]) => {
  const doneByLineKey = new Map<string, boolean>();
  events.forEach((event) => {
    if (
      event.type !== "KITCHEN_ITEM_DONE" &&
      event.type !== "KITCHEN_ITEM_REOPENED"
    ) {
      return;
    }
    const lineKey = getOptionalString(event.detail?.lineKey);
    if (!lineKey) return;
    doneByLineKey.set(lineKey, event.type === "KITCHEN_ITEM_DONE");
  });
  return doneByLineKey;
};

const mapOrderV2ItemToInternalItem = (
  item: OrderV2["items"][number],
  doneByLineKey: Map<string, boolean>,
): InternalOrderItem => {
  const snapshot =
    item.snapshot &&
    typeof item.snapshot === "object" &&
    !Array.isArray(item.snapshot)
      ? item.snapshot
      : {};
  const lineKey = getOptionalString(snapshot.lineKey);
  const itemKind = isOrderV2ItemKind(snapshot.itemKind)
    ? snapshot.itemKind
    : undefined;
  const removedIngredients = Array.isArray(snapshot.removedIngredients)
    ? snapshot.removedIngredients.filter(
        (entry): entry is string =>
          typeof entry === "string" && Boolean(entry.trim()),
      )
    : [];

  return {
    name: item.name,
    qty: item.qty,
    price: item.unitPrice,
    lineTotal: item.lineTotal,
    lineKey,
    itemDisplayIndex: getOptionalNumber(snapshot.itemDisplayIndex),
    itemKind,
    removedIngredients,
    extras: parseSnapshotExtras(snapshot.extras),
    burgerNote: getOptionalString(snapshot.burgerNote),
    garnish: parseSnapshotGarnish(snapshot.garnish),
    includedDrink: parseSnapshotIncludedDrink(snapshot.includedDrink),
    sideQuestExtras: parseSnapshotSideQuestExtras(snapshot.sideQuestExtras),
    comboBurgers: parseSnapshotComboBurgers(snapshot.comboBurgers),
    extrasTotalCents: getOptionalNumber(snapshot.extrasTotalCents),
    sideQuestExtrasTotalCents: getOptionalNumber(snapshot.sideQuestExtrasTotalCents),
    includedGarnishUpchargeCents: getOptionalNumber(snapshot.includedGarnishUpchargeCents),
    kitchenDone: lineKey ? (doneByLineKey.get(lineKey) ?? false) : false,
  };
};

const getEventReason = (event: OrderV2Event): string | undefined => {
  const reason = event.detail?.reason;
  if (typeof reason !== "string" || !reason.trim()) return undefined;
  const trimmedReason = reason.trim();
  return /^Internal V2/i.test(trimmedReason)
    ? "Actualizado desde Chekeo"
    : trimmedReason;
};

const formatEventType = (type: string) =>
  type
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getTimelineLabel = (event: OrderV2Event) => {
  if (event.type === "ORDER_CREATED") return "Pedido creado";
  if (event.type === "STATUS_CHANGED" && event.nextStatus)
    return event.nextStatus === "cancelled"
      ? "Cancelado por operador"
      : `Estado: ${statusLabel[event.nextStatus]}`;
  if (event.type === "ORDER_CANCELLED") return "Pedido cancelado";
  return formatEventType(event.type);
};

const getCancellationReason = (order: InternalOrder) =>
  [...order.timeline]
    .reverse()
    .find((event) => event.nextStatus === "cancelled" && event.reason)?.reason;

const mapOrderV2ToInternalOrder = (order: OrderV2): InternalOrder => {
  const events: OrderV2Event[] = order.events?.length
    ? order.events
    : [
        {
          id: `created-${order.id}`,
          orderId: order.id,
          type: "ORDER_CREATED",
          actor: order.source,
          createdAt: order.createdAt,
        },
      ];
  const doneByLineKey = getKitchenDoneByLineKey(events);
  return {
    id: order.id,
    folio: order.folio,
    customer: order.customerName,
    customerPhone: order.customerPhone,
    channel: order.orderMode,
    createdAt: formatDateTime(order.createdAt),
    updatedAt: formatDateTime(order.updatedAt),
    createdAtMs: parseOrderTimestamp(order.createdAt),
    updatedAtMs: parseOrderTimestamp(order.updatedAt),
    archivedAt: order.archivedAt,
    status: order.status,
    priority: "normal",
    paymentMethod: order.paymentMethod,
    paymentState: order.paymentStatus,
    note: order.notes,
    items: order.items.map((item) =>
      mapOrderV2ItemToInternalItem(item, doneByLineKey),
    ),
    total: order.total,
    kitchenStation: mapKitchenStation(order.status),
    source: order.source,
    timeline: events.map((event) => ({
      id: event.id,
      label: getTimelineLabel(event),
      time: formatDateTime(event.createdAt),
      tone:
        event.nextStatus === "ready" || event.nextStatus === "delivered"
          ? "success"
          : event.nextStatus === "cancelled"
            ? "warning"
            : "default",
      actor: event.actor,
      previousStatus: event.previousStatus,
      nextStatus: event.nextStatus,
      reason: getEventReason(event),
    })),
  };
};

const StatusBadge = ({ status }: { status: OrderStatus }) => (
  <StatusPill className={statusTone[status]}>{statusLabel[status]}</StatusPill>
);

const OrdersStatusBadge = ({ status }: { status: OrderStatus }) => {
  const key = getOrdersStatusFilterValue(status);
  return (
    <StatusPill className={ordersStatusTone[key]}>
      {ordersStatusLabel[key]}
    </StatusPill>
  );
};

const EmptyOrdersState = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <Card className="border-dashed border-zinc-700/90 p-5 text-center">
    <p className="text-base font-black text-zinc-100">{title}</p>
    {description ? (
      <p className="mx-auto mt-1 max-w-md text-sm text-zinc-400">{description}</p>
    ) : null}
    {action ? <div className="mt-3">{action}</div> : null}
  </Card>
);

const orderStatusOptions: Array<{ value: OrderV2Status | ""; label: string }> =
  [
    { value: "", label: "Todos" },
    { value: "new", label: "Nuevo" },
    { value: "preparing", label: "En preparación" },
    { value: "ready", label: "Listo" },
    { value: "delivered", label: "Entregado" },
    { value: "cancelled", label: "Cancelado" },
  ];

const OrdersExportControls = ({
  sessionActive,
  defaultIncludeTerminal,
  environment,
}: {
  sessionActive: boolean;
  defaultIncludeTerminal: boolean;
  environment: OrderV2Environment;
}) => {
  const [includeTerminal, setIncludeTerminal] = useState(
    defaultIncludeTerminal,
  );
  const [status, setStatus] = useState<OrderV2Status | "">("");
  const [limit, setLimit] = useState("500");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setIncludeTerminal(defaultIncludeTerminal);
  }, [defaultIncludeTerminal]);
  useEffect(() => {
    if (!success) return;
    const timeout = window.setTimeout(() => setSuccess(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [success]);

  const parsedLimit = Number(limit);
  const invalidLimit =
    !Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000;
  const disabled = exporting || !sessionActive || invalidLimit;

  const downloadCsv = async () => {
    setError(null);
    setSuccess(null);
    if (!sessionActive) {
      setError("Sesión expirada. Vuelve a iniciar sesión.");
      return;
    }
    if (invalidLimit) {
      setError("El límite debe ser un entero entre 1 y 1000");
      return;
    }
    setExporting(true);
    try {
      const blob = await exportOrdersV2Csv({
        includeTerminal,
        status,
        from,
        to,
        limit: parsedLimit,
        environment,
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "orders-v2-export.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setSuccess("Reporte descargado");
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "No se pudo descargar el reporte. Inténtalo de nuevo.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-2">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold text-zinc-100">Descargar reporte</p>
          <p className="text-[11px] text-zinc-400">
            Baja los pedidos filtrados para revisión o cierre.
          </p>
        </div>
        {!sessionActive ? (
          <p className="text-[11px] text-amber-200">
            Sesión expirada. Vuelve a iniciar sesión.
          </p>
        ) : null}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 sm:col-span-2 lg:col-span-1">
          <input
            type="checkbox"
            checked={includeTerminal}
            onChange={(event) => setIncludeTerminal(event.target.checked)}
          />
          Incluir entregados y cancelados
        </label>
        <label className="text-[11px] text-zinc-400">
          Estado
          <select
            className="input mt-1 text-xs"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as OrderV2Status | "")
            }
          >
            {orderStatusOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-zinc-400">
          Máximo de registros
          <input
            className="input mt-1 text-xs"
            inputMode="numeric"
            type="number"
            min="1"
            max="1000"
            step="1"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
          />
        </label>
        <label className="text-[11px] text-zinc-400">
          Desde
          <input
            className="input mt-1 text-xs"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="text-[11px] text-zinc-400">
          Hasta
          <input
            className="input mt-1 text-xs"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </div>
      {invalidLimit ? (
        <p className="mt-2 rounded bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
          El límite debe ser un entero entre 1 y 1000.
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 rounded bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-2 rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
          {success}
        </p>
      ) : null}
      <Button
        className="mt-2 w-full bg-cyan-400 px-3 py-2 text-sm font-bold text-black disabled:opacity-40 md:w-auto"
        onClick={() => void downloadCsv()}
        disabled={disabled}
      >
          {exporting ? "Preparando…" : "Descargar reporte"}
      </Button>
    </div>
  );
};

const NewOrderBanner = ({
  notice,
  onDismiss,
}: {
  notice: NewOrderNotice;
  onDismiss: () => void;
}) =>
  notice ? (
    <section
      className="mb-3 rounded-2xl border border-cyan-300/40 bg-cyan-400/15 p-3 text-cyan-50 shadow-lg shadow-cyan-950/20"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black">{notice.message}</p>
          <p className="mt-1 break-words text-[11px] text-cyan-100/80">
            Folios: {notice.orderFolios.join(", ")}
          </p>
        </div>
        <Button
          className="w-full shrink-0 border border-cyan-200/40 bg-cyan-950/50 px-3 py-1.5 text-xs text-cyan-50 sm:w-auto"
          onClick={onDismiss}
        >
          Entendido
        </Button>
      </div>
    </section>
  ) : null;

const SourcePanel = ({
  runtime,
  runtimeEnvironment,
  includeTerminal = false,
}: {
  runtime: OrdersRuntime;
  runtimeEnvironment: ChekeoRuntimeEnvironment;
  includeTerminal?: boolean;
}) => {
  const truth = getOperationalTruth({
    runtime,
    runtimeEnvironment,
    activeCount: 0,
  });
  return (
    <Card className="source-panel-card mb-2.5 p-3">
      <div className="surface-status">
        <div className="surface-status__copy">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill className={truthToneClassName[truth.data.tone]}>
              {truth.sourceBadge}
            </StatusPill>
            <StatusPill className={truthToneClassName[truth.session.tone]}>
              {truth.session.value}
            </StatusPill>
            <StatusPill className={truthToneClassName[truth.capability.tone]}>
              {truth.capability.value}
            </StatusPill>
            {includeTerminal ? (
              <StatusPill className={truthToneClassName.neutral}>
                Incluye terminales
              </StatusPill>
            ) : null}
          </div>
          <p className="text-sm font-bold text-zinc-100">{truth.sourceMessage}</p>
          <p className="text-[11px] text-zinc-400">{truth.sourceHint}</p>
        </div>
        <div className="surface-status__meta">
          <span className="text-[11px] text-zinc-500">
            {runtime.lastUpdated ? `Actualizado ${runtime.lastUpdated}` : "Sin sync confirmado"}
          </span>
          <Button
            className="border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs disabled:opacity-40"
            onClick={() => runtime.reload(includeTerminal)}
            disabled={runtime.loading || runtime.sessionState !== "active"}
          >
            {runtime.loading ? "Actualizando..." : truth.action.label}
          </Button>
        </div>
      </div>
      {runtime.limitWarning ? (
        <p className="state-message state-message--warning mt-3">
          {runtime.limitWarning}
        </p>
      ) : null}
      {runtime.error ? (
        <p className="state-message state-message--error mt-2">
          {runtime.error}
        </p>
      ) : null}
      {runtime.notice ? (
        <p className="state-message state-message--success mt-2">
          {runtime.notice}
        </p>
      ) : null}
    </Card>
  );
};

const InternalLogin = ({
  authMode,
  onLogin,
  checkingSession,
  runtimeEnvironment,
  sessionState,
  sessionMessage,
}: {
  authMode: InternalAuthMode;
  onLogin: () => void;
  checkingSession: boolean;
  runtimeEnvironment: ChekeoRuntimeEnvironment;
  sessionState: SessionState;
  sessionMessage?: string | null;
}) => {
  const copy = runtimeEnvironmentCopy[runtimeEnvironment];
  const publicOrderUrl = getPublicOrderUrlForEnvironment(runtimeEnvironment);
  const publicOrderLabel = getPublicOrderLabelForEnvironment(runtimeEnvironment);

  return (
    <main className="shell flex items-center justify-center py-8">
      <section className="login card w-full max-w-md border-cyan-400/20 bg-zinc-950/95 p-5 shadow-cyan-950/30">
        <div className="mb-6 text-center">
          <EnvironmentBadge environment={runtimeEnvironment} className="mx-auto mb-3" />
          <p className="text-2xl font-black tracking-tight text-zinc-50">
            Burgers<span className="text-cyan-300">.exe</span>
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.35em] text-cyan-200">
            Chekeo
          </p>
        </div>
        <div className="runtime-login-notice">
          <p className="text-sm font-semibold text-zinc-50">{copy.primary}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill className={truthToneClassName.system}>
              {runtimeEnvironmentLabel[runtimeEnvironment]}
            </StatusPill>
            <StatusPill className={truthToneClassName[sessionStateLabel[sessionState].tone]}>
              {sessionStateLabel[sessionState].value}
            </StatusPill>
          </div>
          <p className="mt-2 text-xs text-zinc-300">{copy.secondary}</p>
          <a
            className="runtime-environment-link mt-3 w-full"
            href={publicOrderUrl}
            target="_blank"
            rel="noreferrer"
          >
            {publicOrderLabel}
          </a>
        </div>
        {authMode === "admin-only" ? (
          <p className="state-message state-message--warning mb-4">
            {getAdminAuthModeHint(authMode)}
          </p>
        ) : null}
        <SessionPinForm
          inputId="pin"
          label="PIN de acceso"
          submitLabel="Entrar"
          submitBusyLabel="Entrando..."
          onSuccess={onLogin}
          disabled={checkingSession}
          notice={sessionMessage}
        />
      </section>
    </main>
  );
};

const SessionPinForm = ({
  inputId,
  label,
  submitLabel,
  submitBusyLabel,
  onSuccess,
  disabled = false,
  notice = null,
  autoFocus = true,
}: {
  inputId: string;
  label: string;
  submitLabel: string;
  submitBusyLabel: string;
  onSuccess: () => void;
  disabled?: boolean;
  notice?: string | null;
  autoFocus?: boolean;
}) => {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = pin.trim();
    if (!trimmed) {
      setError("Escribe tu PIN de 4 dígitos.");
      return;
    }
    if (!/^\d{4}$/.test(trimmed)) {
      setError("El PIN debe tener 4 dígitos.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await loginInternal(trimmed);
      setPin("");
      onSuccess();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "No se pudo iniciar sesión.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      <label className="block text-sm font-bold text-zinc-100" htmlFor={inputId}>
        {label}
        <input
          id={inputId}
          type="password"
          className="input mt-2 min-h-12 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
          placeholder="••••"
          value={pin}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          pattern="[0-9]{4}"
          aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={(event) => {
            setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
            setError(null);
          }}
          autoFocus={autoFocus}
          disabled={loading || disabled}
        />
      </label>
      {error ? (
        <p id={`${inputId}-error`} className="state-message state-message--error">
          {error}
        </p>
      ) : null}
      {!error && notice ? (
        <p className="state-message state-message--warning">
          {notice}
        </p>
      ) : null}
      <Button
        className="w-full bg-cyan-400 py-3 text-base font-black text-black disabled:opacity-50"
        disabled={loading || disabled}
      >
        {loading || disabled ? submitBusyLabel : submitLabel}
      </Button>
    </form>
  );
};

const EnvironmentBadge = ({
  environment,
  className = "",
}: {
  environment: ChekeoRuntimeEnvironment;
  className?: string;
}) => (
  <span className={`environment-badge environment-badge--${environment} ${className}`}>
    {runtimeEnvironmentLabel[environment]}
  </span>
);

const OperatorHeader = ({
  runtimeEnvironment,
  onLogout,
  truth,
}: {
  runtimeEnvironment: ChekeoRuntimeEnvironment;
  onLogout: () => void;
  truth: OperationalTruth;
}) => {
  const publicOrderUrl = getPublicOrderUrlForEnvironment(runtimeEnvironment);
  const publicOrderLabel = getPublicOrderLabelForEnvironment(runtimeEnvironment);

  return (
    <header className={`card shell-header shell-header--${runtimeEnvironment}`}>
      <div className="shell-header__layout">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="shell-header__eyebrow">
              Operación de hoy
            </p>
            <EnvironmentBadge environment={runtimeEnvironment} />
          </div>
          <h1 className="shell-header__title">
            Chekeo Burgers.exe
          </h1>
          <p className="shell-header__summary">
            {truth.headline}
          </p>
        </div>
        <div className="shell-header__actions">
          <a
            className="runtime-environment-link w-full"
            href={publicOrderUrl}
            target="_blank"
            rel="noreferrer"
          >
            {publicOrderLabel}
          </a>
          <Button
            className="min-h-11 border border-zinc-700 bg-zinc-900 px-3 py-2 text-[11px]"
            onClick={onLogout}
          >
            Cerrar sesion
          </Button>
          <p className="text-[11px] text-zinc-500 sm:text-right">
            {truth.summary}
          </p>
        </div>
      </div>
    </header>
  );
};

const OperationalStatusBar = ({
  truth,
  onPrimaryAction,
  disabled,
}: {
  truth: OperationalTruth;
  onPrimaryAction: () => void;
  disabled: boolean;
}) => {
  const items = [
    truth.environment,
    truth.session,
    truth.data,
    truth.capability,
    truth.activity,
    truth.freshness,
  ];

  return (
    <section className="truth-shell" aria-label="Estado operativo actual">
      <div className="truth-shell__top">
        <div className="truth-shell__intro">
          <p className="truth-shell__eyebrow">Estado operativo</p>
          <h2 className="truth-shell__title">{truth.headline}</h2>
          <p className="truth-shell__summary">{truth.summary}</p>
        </div>
        <div className="truth-shell__action">
          <Button
            className={`${truthActionClassName[truth.action.tone]} disabled:opacity-40`}
            onClick={onPrimaryAction}
            disabled={disabled}
          >
            {truth.action.label}
          </Button>
          <p className="text-[11px] text-zinc-500">{truth.action.helper}</p>
        </div>
      </div>
      <div className="truth-shell__grid">
        {items.map((item) => (
          <div key={item.label} className="truth-shell__card">
            <p className="truth-shell__label">{item.label}</p>
            <StatusPill className={truthToneClassName[item.tone]}>
              {item.value}
            </StatusPill>
          </div>
        ))}
      </div>
      {truth.banner ? (
        <div className={truthBannerClassName[truth.banner.tone]}>
          <strong>{truth.banner.title}</strong>
          <span>{truth.banner.message}</span>
        </div>
      ) : null}
    </section>
  );
};

const HomePanel = ({
  orders,
  runtime,
  runtimeEnvironment,
  onOpenTab,
  onOpenAdminView,
}: {
  orders: InternalOrder[];
  runtime: OrdersRuntime;
  runtimeEnvironment: ChekeoRuntimeEnvironment;
  onOpenTab: (tab: TabKey) => void;
  onOpenAdminView: (view: AdminViewKey) => void;
}) => {
  const summary = useMemo(() => getOperationalSummary(orders), [orders]);
  const [todaySummary, setTodaySummary] = useState<OrdersV2Summary | null>(null);
  const [kitchenSummary, setKitchenSummary] = useState<KitchenSummaryK | null>(null);
  const [todayLoading, setTodayLoading] = useState(false);
  const [todayError, setTodayError] = useState<string | null>(null);
  const actionableOrders = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            !terminalStatuses.has(order.status) &&
            (order.status === "new" ||
              order.status === "ready" ||
              order.paymentState === "pending"),
        )
        .slice(0, 4),
    [orders],
  );

  useEffect(() => {
    if (!runtime.sessionActive) {
      setTodaySummary(null);
      setKitchenSummary(null);
      setTodayError(null);
      setTodayLoading(false);
      return;
    }

    let cancelled = false;
    const today = todayDateInput();

    const loadHomeData = async () => {
      setTodayLoading(true);
      setTodayError(null);
      const [summaryResult, kitchenResult] = await Promise.allSettled([
        fetchOrdersV2Summary({
          from: today,
          to: today,
          includeTerminal: true,
          limit: 1000,
          topLimit: 5,
          environment: runtime.environment,
        }),
        fetchKitchenSummaryK(runtime.environment),
      ]);

      if (cancelled) return;

      if (summaryResult.status === "fulfilled") {
        setTodaySummary(summaryResult.value);
      } else {
        setTodaySummary(null);
      }

      if (kitchenResult.status === "fulfilled") {
        setKitchenSummary(kitchenResult.value);
      } else {
        setKitchenSummary(null);
      }

      if (
        summaryResult.status === "rejected" &&
        kitchenResult.status === "rejected"
      ) {
        setTodayError(
          "No se pudo cargar el resumen de hoy ni el mini Resumen K.",
        );
      } else if (summaryResult.status === "rejected") {
        setTodayError("No se pudo cargar la venta de hoy.");
      } else if (kitchenResult.status === "rejected") {
        setTodayError("No se pudo cargar el mini Resumen K.");
      } else {
        setTodayError(null);
      }

      setTodayLoading(false);
    };

    void loadHomeData();
    return () => {
      cancelled = true;
    };
  }, [runtime.environment, runtime.sessionActive]);

  const metricCards = [
    {
      label: "Pedidos activos",
      value: summary.activeOrders,
      hint: "Pedidos hoy que siguen abiertos",
      action: () => onOpenTab("pedidos"),
    },
    {
      label: "Pagos pendientes",
      value: summary.paymentsToReview,
      hint: "Confirmaciones por revisar",
      action: () => onOpenTab("pagos"),
    },
    {
      label: "Pedidos de hoy",
      value: todaySummary?.totals.orders ?? "—",
      hint: todayLoading ? "Actualizando..." : "Lectura del corte actual",
      action: () => onOpenAdminView("cierre"),
    },
    {
      label: "Venta de hoy",
      value:
        todaySummary?.totals.grossSales !== undefined
          ? formatCurrency(todaySummary.totals.grossSales)
          : "—",
      hint: "Sin cálculo de utilidad en este PR",
      action: () => onOpenAdminView("cierre"),
    },
  ];

  const quickActions: Array<{
    label: string;
    hint: string;
    icon: NavIcon;
    onClick: () => void;
  }> = [
    {
      label: "Pedidos",
      hint: "Entregados y cancelaciones viven aquí",
      icon: ShoppingBag,
      onClick: () => onOpenTab("pedidos"),
    },
    {
      label: "Cocina",
      hint: "Checklist y producción actual",
      icon: ChefHat,
      onClick: () => onOpenTab("cocina"),
    },
    {
      label: "Pagos",
      hint: "Pendiente y pagado",
      icon: WalletCards,
      onClick: () => onOpenTab("pagos"),
    },
    {
      label: "Historial",
      hint: "Pasa a Admin",
      icon: History,
      onClick: () => onOpenAdminView("historial"),
    },
    {
      label: "Cierre actual",
      hint: "Corte y venta del día",
      icon: CreditCard,
      onClick: () => onOpenAdminView("cierre"),
    },
  ];

  return (
    <section className="space-y-3">
      <div className="home-grid">
        <Card className="home-hero">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                Operación de hoy
              </p>
              <h2 className="mt-1 text-2xl font-black text-zinc-50 md:text-3xl">
                Base operativa para Home
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                Home concentra lectura rápida, accesos directos y el estado mínimo para arrancar sin mezclar módulos técnicos.
              </p>
            </div>
            <div className="home-hero__meta">
              <StatusPill className={truthToneClassName[runtime.source === "d1" ? "success" : "warning"]}>
                {runtime.source === "d1" ? "Datos live" : "Vista de respaldo"}
              </StatusPill>
              <StatusPill className={truthToneClassName[runtimeEnvironment === "production" ? "danger" : "system"]}>
                {runtimeEnvironmentLabel[runtimeEnvironment]}
              </StatusPill>
            </div>
          </div>
          <div className="home-metrics">
            {metricCards.map((card) => (
              <button
                key={card.label}
                type="button"
                className="home-metric-card"
                onClick={card.action}
              >
                <p className="home-metric-card__label">{card.label}</p>
                <p className="home-metric-card__value">{card.value}</p>
                <p className="home-metric-card__hint">{card.hint}</p>
              </button>
            ))}
          </div>
          {todayError ? (
            <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
              {todayError}
            </p>
          ) : null}
        </Card>

        <Card className="home-side-card">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
            Mini Resumen K
          </p>
          <h3 className="mt-1 text-lg font-black text-zinc-50">
            Lectura rápida de producción
          </h3>
          {kitchenSummary ? (
            <div className="mt-3 grid gap-2">
              <div className="row">
                <span>Burgers / combos</span>
                <strong>{kitchenSummary.totals.burgers}</strong>
              </div>
              <div className="row">
                <span>Guarniciones</span>
                <strong>{kitchenSummary.totals.garnishes}</strong>
              </div>
              <div className="row">
                <span>Ingredientes</span>
                <strong>{kitchenSummary.totals.ingredients}</strong>
              </div>
              <div className="row">
                <span>Costo estimado</span>
                <strong>
                  {kitchenSummary.totals.estimatedCostCents === null
                    ? "—"
                    : formatCurrency(
                        kitchenSummary.totals.estimatedCostCents / 100,
                      )}
                </strong>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-400">
              {todayLoading
                ? "Cargando resumen..."
                : "Sin datos disponibles para el mini Resumen K."}
            </p>
          )}
          <Button
            className="mt-3 border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            onClick={() => onOpenTab("cocina")}
          >
            Abrir Cocina
          </Button>
        </Card>
      </div>

      <div className="home-grid home-grid--secondary">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                Accesos directos
              </p>
              <h3 className="mt-1 text-lg font-black text-zinc-50">
                Moverse sin ruido
              </h3>
            </div>
            <StatusPill className="border-cyan-400/40 text-cyan-100">
              5 accesos
            </StatusPill>
          </div>
          <div className="home-quick-actions">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  className="quick-action-card"
                  onClick={action.onClick}
                >
                  <span className="quick-action-card__icon">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="quick-action-card__label">{action.label}</p>
                    <p className="quick-action-card__hint">{action.hint}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                Resumen de operación
              </p>
              <h3 className="mt-1 text-lg font-black text-zinc-50">
                Pedidos por resolver
              </h3>
            </div>
            <StatusPill className="border-amber-400/40 text-amber-100">
              {summary.actionableOrders} abiertos
            </StatusPill>
          </div>
          <div className="mt-3 space-y-2">
            {actionableOrders.length ? (
              actionableOrders.map((order) => (
                <div key={order.id} className="row items-start">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold text-zinc-50">
                      {order.folio} · {order.customer}
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      {channelLabel[order.channel]} · {getPaymentStatusLabel(order.paymentState)} · {formatCurrency(order.total)}
                    </p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-400">
                Sin pedidos abiertos por resolver. Cuando entre uno nuevo aparecerá aquí.
              </p>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
};

const getAdminAuthModeHint = (authMode: InternalAuthMode) =>
  authMode === "admin-only"
    ? "Modo admin-only preparado. Chekeo sigue pidiendo PIN global hasta que exista protección externa y una política backend compatible."
    : "Modo seguro global activo. Toda la app sigue pidiendo PIN antes de abrir.";

const AdminReportsPanel = ({
  runtime,
  authMode,
}: {
  runtime: OrdersRuntime;
  authMode: InternalAuthMode;
}) => (
  <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
    <Card className="p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
        Reportes y exportes
      </p>
      <h3 className="mt-2 text-xl font-black text-zinc-50">
        Exportes operativos
      </h3>
      <p className="mt-2 text-sm text-zinc-400">
        Descarga cortes y listas filtradas sin volver a mezclar estos controles con Pedidos, Cocina o Pagos.
      </p>
      <OrdersExportControls
        sessionActive={runtime.sessionActive}
        defaultIncludeTerminal
        environment={runtime.environment}
      />
    </Card>
    <Card className="p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
        Estado técnico
      </p>
      <h3 className="mt-2 text-lg font-black text-zinc-50">
        Contexto actual del backend
      </h3>
      <div className="mt-3 space-y-2">
        <div className="row">
          <span>Fuente de datos</span>
          <strong>{runtime.source === "d1" ? "D1" : runtime.source}</strong>
        </div>
        <div className="row">
          <span>Sesión</span>
          <strong>{sessionStateLabel[runtime.sessionState].value}</strong>
        </div>
        <div className="row">
          <span>Última actualización</span>
          <strong>{runtime.lastUpdated || "Pendiente"}</strong>
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        {getAdminAuthModeHint(authMode)}
      </p>
    </Card>
  </div>
);

const AdminGate = ({
  authMode,
  sessionActive,
  onUnlock,
  children,
}: {
  authMode: InternalAuthMode;
  sessionActive: boolean;
  onUnlock: () => void;
  children: ReactNode;
}) => {
  if (!shouldGateAdminInternally(authMode) || sessionActive) return <>{children}</>;

  return (
    <Card className="p-4 sm:p-5">
      <div className="max-w-md">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
          Admin protegido
        </p>
        <h2 className="mt-1 text-xl font-black text-zinc-50">
          Acceso Admin
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Admin siempre requiere PIN interno. Home, Pedidos, Cocina y Pagos solo pueden abrirse sin PIN global cuando la URL ya está protegida externamente.
        </p>
        <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-zinc-950/70 p-4">
          <SessionPinForm
            inputId="admin-pin"
            label="PIN Admin"
            submitLabel="Desbloquear Admin"
            submitBusyLabel="Desbloqueando..."
            onSuccess={onUnlock}
          />
        </div>
      </div>
    </Card>
  );
};

const AdminWorkspace = ({
  view,
  setView,
  orders,
  runtime,
  runtimeEnvironment,
  authMode,
  onArchiveCancelled,
}: {
  view: AdminViewKey;
  setView: (view: AdminViewKey) => void;
  orders: InternalOrder[];
  runtime: OrdersRuntime;
  runtimeEnvironment: ChekeoRuntimeEnvironment;
  authMode: InternalAuthMode;
  onArchiveCancelled: (order: InternalOrder) => Promise<void>;
}) => {
  const activeView = adminViews.find((option) => option.key === view) ?? adminViews[0];
  const publicOrderUrl = getPublicOrderUrlForEnvironment(runtimeEnvironment);
  const publicOrderLabel = getPublicOrderLabelForEnvironment(runtimeEnvironment);

  const renderModuleCard = (module: AdminModuleDefinition) => {
    const Icon = module.icon;
    const status = adminModuleStatusMeta[module.status];

    return (
      <button
        key={module.key}
        type="button"
        className="admin-module-card"
        onClick={() => setView(module.key)}
      >
        <span className="admin-module-card__top">
          <span className="admin-module-card__icon">
            <Icon size={18} aria-hidden="true" />
          </span>
          <StatusPill className={`admin-module-card__status ${status.className}`}>
            {status.label}
          </StatusPill>
        </span>
        <span className="admin-module-card__content">
          <span className="admin-module-card__label">{module.label}</span>
          <span className="admin-module-card__hint">{module.hint}</span>
          <span className="admin-module-card__desc">{module.description}</span>
        </span>
        <span className="admin-module-card__footer">
          <span>{module.cta}</span>
          <span aria-hidden="true">→</span>
        </span>
      </button>
    );
  };

  const content =
    view === "banco" ? (
      <BankConfigAdminPanel />
    ) : view === "catalogo" ? (
      <CatalogAdminPanel />
    ) : view === "sorteos" ? (
      <RafflesAdminPanel runtimeEnvironment={runtimeEnvironment} />
    ) : view === "historial" ? (
      <HistoryPanel
        orders={orders}
        runtime={runtime}
        runtimeEnvironment={runtimeEnvironment}
        onArchiveCancelled={onArchiveCancelled}
      />
    ) : view === "cierre" ? (
      <OperationalClosePanel
        environment={runtime.environment}
        sessionActive={runtime.sessionActive}
      />
    ) : view === "reportes" ? (
      <AdminReportsPanel runtime={runtime} authMode={authMode} />
    ) : (
      <div className="admin-hub">
        {adminModuleGroups.map((group) => {
          const modules = adminModuleViews.filter((module) => module.category === group.key);
          if (!modules.length) return null;

          return (
            <section
              key={group.key}
              className="admin-module-group"
              aria-labelledby={`admin-module-group-${group.key}`}
            >
              <div className="admin-module-group__header">
                <div>
                  <h3 id={`admin-module-group-${group.key}`} className="admin-module-group__title">
                    {group.title}
                  </h3>
                  <p className="admin-module-group__desc">{group.description}</p>
                </div>
                <span className="admin-module-group__count">
                  {modules.length} módulo{modules.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="admin-module-grid">
                {modules.map(renderModuleCard)}
              </div>
            </section>
          );
        })}

        <section className="admin-module-group" aria-labelledby="admin-module-group-public">
          <div className="admin-module-group__header">
            <div>
              <h3 id="admin-module-group-public" className="admin-module-group__title">
                Página pública
              </h3>
              <p className="admin-module-group__desc">
                Enlace de estado a la experiencia de clientes; este PR no la modifica.
              </p>
            </div>
            <StatusPill className="border-emerald-400/40 bg-emerald-500/10 text-emerald-100">
              Base lista
            </StatusPill>
          </div>
          <a
            className="admin-module-card admin-module-card--link"
            href={publicOrderUrl}
            target="_blank"
            rel="noreferrer"
          >
            <span className="admin-module-card__top">
              <span className="admin-module-card__icon">
                <ExternalLink size={18} aria-hidden="true" />
              </span>
              <StatusPill className="admin-module-card__status border-emerald-400/40 bg-emerald-500/10 text-emerald-100">
                Base lista
              </StatusPill>
            </span>
            <span className="admin-module-card__content">
              <span className="admin-module-card__label">Página pública</span>
              <span className="admin-module-card__hint">{publicOrderLabel}</span>
              <span className="admin-module-card__desc">
                Acceso rápido para revisar la ruta pública activa sin cambiar su implementación.
              </span>
            </span>
            <span className="admin-module-card__footer">
              <span>Abrir página</span>
              <ExternalLink size={16} aria-hidden="true" />
            </span>
          </a>
        </section>
      </div>
    );

  return (
    <section className="space-y-3">
      <Card className="admin-workspace-header p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
              Admin
            </p>
            <h2 className="mt-1 text-xl font-black text-zinc-50">
              {view === "launcher" ? "Hub de módulos de Chekeo" : activeView.label}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-400">
              {view === "launcher"
                ? "Datos bancarios, historial, cierre, catálogo, sorteos y reportes viven aquí para mantener la navegación principal enfocada en operación."
                : activeView.description}
            </p>
          </div>
          <div className="admin-workspace-header__actions">
            {view !== "launcher" ? (
              <Button
                type="button"
                className="admin-back-button border border-cyan-400/40 bg-cyan-400/10 text-cyan-100"
                onClick={() => setView("launcher")}
              >
                Volver al hub
              </Button>
            ) : null}
            <div className="admin-nav-shell" aria-label="Navegación Admin">
              <p className="admin-nav-shell__title">Navegación Admin</p>
              <div className="admin-nav">
                {adminViews.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      aria-label={option.label}
                      className={`admin-nav__button ${view === option.key ? "admin-nav__button--active" : ""}`}
                      onClick={() => setView(option.key)}
                    >
                      <span className="admin-nav__icon">
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <span className="admin-nav__copy">
                        <span className="admin-nav__label">{option.label}</span>
                        <span className="admin-nav__hint">{option.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          {getAdminAuthModeHint(authMode)}
        </p>
      </Card>
      {content}
    </section>
  );
};

const BankConfigAdminPanel = () => {
  const primaryLabel = getBankPaymentPrimaryLabel(bankPaymentConfig);
  const primaryValue = getBankPaymentPrimaryValue(bankPaymentConfig);

  return (
    <section className="space-y-3">
      <Card className="p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
              Configuración de pago
            </p>
            <h3 className="mt-1 text-xl font-black text-zinc-50">
              Datos bancarios
            </h3>
            <p className="mt-1 max-w-3xl text-sm text-zinc-400">
              Fuente central compartida para transferencias. Pagos la consume
              para el mensaje operativo y esta vista la expone solo dentro de
              Admin.
            </p>
          </div>
          <StatusPill className="border-zinc-700 bg-zinc-900 text-zinc-100">
            {bankPaymentConfig.editable ? "Editable" : "Solo lectura"}
          </StatusPill>
        </div>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-4">
          <div className="grid gap-3 min-[520px]:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/65 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                Banco
              </p>
              <p className="mt-2 break-words text-base font-black text-zinc-50">
                {bankPaymentConfig.bankName}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/65 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                Titular
              </p>
              <p className="mt-2 break-words text-base font-black text-zinc-50">
                {bankPaymentConfig.accountHolder}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/65 p-3 min-[520px]:col-span-2">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                {primaryLabel}
              </p>
              <p className="mt-2 break-all text-base font-black text-zinc-50">
                {primaryValue || "Sin dato configurado"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-3">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-100">
                Alcance
              </p>
              <p className="mt-2 text-sm text-zinc-100">
                Solo transferencia. Pedidos, ticket, Home y Cocina no deben
                mostrar estos datos.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/65 p-3 text-sm text-zinc-300">
              <p className="font-black text-zinc-100">Estado de edición</p>
              <p className="mt-2">
                La configuración actual es de solo lectura y vive en la capa
                compartida del proyecto. La edición persistente queda pendiente
                hasta definir una fuente segura en backend.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/65 p-3 text-sm text-zinc-300">
              <p className="font-black text-zinc-100">Fuente</p>
              <p className="mt-2">
                <code>{bankPaymentConfig.source}</code> compartida por{" "}
                <code>Pagos</code>, <code>Admin</code> y la integración de
                transferencia donde aplica.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};

const getPedidoActions = (status: OrderStatus): StatusAction[] =>
  terminalStatuses.has(status)
    ? []
    : [
        ...(status === "ready"
          ? [{ status: "delivered", label: "Marcar entregado" } satisfies StatusAction]
          : []),
        { status: "cancelled", label: "Cancelar pedido", tone: "danger" },
      ];
const getKitchenActions = (status: OrderStatus): StatusAction[] =>
  status === "new"
    ? [{ status: "preparing", label: "Iniciar preparación" }]
    : status === "preparing"
      ? [{ status: "ready", label: "Marcar listo" }]
      : status === "ready"
        ? [{ status: "delivered", label: "Entregar" }]
        : [];

const ActionButtons = ({
  order,
  actions,
  onMove,
  onCancel,
  actionOrderId,
}: {
  order: InternalOrder;
  actions: StatusAction[];
  onMove: MoveOrderStatus;
  onCancel: (order: InternalOrder) => void;
  actionOrderId: string | null;
}) => {
  const busy = actionOrderId === order.id;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const isCancellation = action.status === "cancelled";
        return (
          <button
            key={action.status}
            type="button"
            className={`btn-sm ${action.tone === "danger" ? "danger" : "border-cyan-500/50 bg-cyan-500/10 text-cyan-100"}`}
            onClick={() =>
              isCancellation
                ? onCancel(order)
                : void onMove(order.id, action.status)
            }
            disabled={busy}
          >
            {busy
              ? isCancellation
                ? "Cancelando…"
                : "Actualizando…"
              : action.label}
          </button>
        );
      })}
    </div>
  );
};

type WhatsappNotice = { tone: "success" | "error"; message: string } | null;

const WhatsappOrderActions = ({
  order,
  template = getWhatsappTemplateForStatus(order.status),
  showHint = false,
}: {
  order: InternalOrder;
  template?: WhatsappOrderMessageType;
  showHint?: boolean;
}) => {
  const [notice, setNotice] = useState<WhatsappNotice>(null);
  const [ticketBlob, setTicketBlob] = useState<Blob | null>(null);
  const [generatingTicket, setGeneratingTicket] = useState(false);
  const phone = normalizeWhatsappPhone(order.customerPhone ?? "");
  const message = buildWhatsappOrderMessage(order, template);
  const whatsappUrl = phone ? buildWhatsappUrl(phone, message) : "";
  const canAttemptFileShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    setTicketBlob(null);
  }, [
    order.id,
    order.folio,
    order.paymentMethod,
    order.paymentState,
    order.total,
    order.items,
  ]);

  const getTicketBlob = async () => {
    if (ticketBlob) return ticketBlob;
    setGeneratingTicket(true);
    try {
      const nextBlob = await generateOrderTicketImage({
        ...order,
        orderStatus: statusLabel[order.status],
      });
      setTicketBlob(nextBlob);
      return nextBlob;
    } finally {
      setGeneratingTicket(false);
    }
  };

  const openWhatsapp = () => {
    if (!whatsappUrl) return;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const downloadTicket = async () => {
    setNotice(null);
    try {
      const blob = await getTicketBlob();
      downloadOrderTicketImage(blob, order.folio);
      setNotice({ tone: "success", message: "Ticket PNG descargado" });
    } catch {
      setNotice({
        tone: "error",
        message: "No se pudo generar el ticket PNG en este navegador.",
      });
    }
  };

  const copySummary = async () => {
    setNotice(null);
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard no disponible en este navegador");
      await navigator.clipboard.writeText(buildOrderTicketSummaryText(order));
      setNotice({ tone: "success", message: "Resumen copiado" });
    } catch {
      setNotice({
        tone: "error",
        message:
          "No se pudo copiar el resumen. Copia manualmente desde un navegador seguro.",
      });
    }
  };

  const shareTicket = async () => {
    setNotice(null);
    try {
      const blob = await getTicketBlob();
      if (!canShareOrderTicketImage(blob, order.folio)) {
        setNotice({
          tone: "error",
          message: "Descarga la imagen y adjúntala manualmente en WhatsApp.",
        });
        return;
      }
      await shareOrderTicketImage(blob, order);
      setNotice({ tone: "success", message: "Imagen lista para compartir" });
    } catch {
      setNotice({
        tone: "error",
        message: "Descarga la imagen y adjúntala manualmente en WhatsApp.",
      });
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-2">
      {showHint ? (
        <p className="mb-2 text-[11px] text-cyan-100">
          Acción manual: abre WhatsApp con texto prellenado. WhatsApp vía
          wa.me no adjunta el PNG automáticamente.
        </p>
      ) : null}
      {!phone ? (
        <p className="mb-2 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
          Teléfono inválido para WhatsApp
        </p>
      ) : null}
      {!canAttemptFileShare ? (
        <p className="mb-2 rounded bg-zinc-800/70 px-2 py-1 text-[11px] text-zinc-300">
          Descarga la imagen y adjúntala manualmente en WhatsApp.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Button
          className="border border-amber-700 bg-amber-950/50 px-2 py-1.5 text-[11px] text-amber-100 disabled:opacity-40"
          onClick={() => void downloadTicket()}
          disabled={generatingTicket}
        >
          {generatingTicket ? "Generando…" : "Descargar ticket"}
        </Button>
        <Button
          className="border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px]"
          onClick={() => void copySummary()}
        >
          Copiar mensaje
        </Button>
        <Button
          className="border border-emerald-700 bg-emerald-950/50 px-2 py-1.5 text-[11px] text-emerald-100 disabled:opacity-40"
          onClick={openWhatsapp}
          disabled={!phone}
        >
          Abrir WhatsApp
        </Button>
        <Button
          className="border border-cyan-700 bg-cyan-950/50 px-2 py-1.5 text-[11px] text-cyan-100 disabled:opacity-40"
          onClick={() => void shareTicket()}
          disabled={generatingTicket || !canAttemptFileShare}
        >
          Compartir imagen
        </Button>
      </div>
      {notice ? (
        <p
          className={`mt-2 rounded px-2 py-1 text-[11px] ${notice.tone === "success" ? "bg-emerald-500/10 text-emerald-200" : "bg-rose-500/10 text-rose-200"}`}
        >
          {notice.message}
        </p>
      ) : null}
    </div>
  );
};

const CancellationReasonDialog = ({
  request,
  runtime,
  onClose,
  onConfirm,
}: {
  request: CancellationRequest;
  runtime: OrdersRuntime;
  onClose: () => void;
  onConfirm: (order: InternalOrder, reason: string) => Promise<void>;
}) => {
  const [preset, setPreset] =
    useState<CancellationReasonPreset>("Cliente canceló");
  const [reason, setReason] = useState("Cliente canceló");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!request) return;
    setPreset("Cliente canceló");
    setReason("Cliente canceló");
    setError(
      runtime.source === "d1" && !runtime.sessionActive
        ? "Sesión expirada. Vuelve a iniciar sesión."
        : null,
    );
  }, [request?.order.id, runtime.sessionActive, runtime.source]);

  if (!request) return null;
  const { order } = request;
  const busy = runtime.actionOrderId === order.id;
  const trimmedReason = reason.trim();
  const validationError = !trimmedReason
    ? "La razón es obligatoria."
    : trimmedReason.length < 3
      ? "La razón debe tener al menos 3 caracteres."
      : trimmedReason.length > 200
        ? "La razón debe tener máximo 200 caracteres."
        : preset === "Otro" && /^otro$/i.test(trimmedReason)
          ? "Describe una razón útil cuando eliges Otro."
          : null;
  const disabled =
    busy ||
    Boolean(validationError) ||
    (runtime.source === "d1" && !runtime.sessionActive);

  const selectPreset = (nextPreset: CancellationReasonPreset) => {
    setPreset(nextPreset);
    setError(null);
    setReason(nextPreset === "Otro" ? "" : nextPreset);
  };

  const submit = async () => {
    setError(null);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (runtime.source === "d1" && !runtime.sessionActive) {
      setError("Sesión expirada. Vuelve a iniciar sesión.");
      return;
    }
    try {
      await onConfirm(order, trimmedReason);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo cancelar la orden",
      );
    }
  };

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-title"
      onClick={busy ? undefined : onClose}
    >
      <section
        className="modal max-h-[calc(100vh-1rem)] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-200">
              Cancelación manual
            </p>
            <h2 id="cancel-title" className="text-lg font-black">
              Cancelar {order.folio}
            </h2>
            <p className="text-xs text-zinc-400">
              {order.customer} · {order.createdAt}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-xs text-zinc-300">
          <p>
            La cancelación quedará guardada con su razón para seguimiento
            administrativo.
          </p>
          {runtime.source !== "d1" ? (
            <p className="mt-1 rounded bg-amber-500/10 px-2 py-1 text-amber-100">
              Vista local: la cancelación se refleja solo en pantalla.
            </p>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {cancellationReasonPresets.map((option) => (
            <button
              key={option}
              type="button"
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${preset === option ? "border-rose-300 bg-rose-300 text-black" : "border-zinc-700 bg-zinc-900 text-zinc-200"}`}
              onClick={() => selectPreset(option)}
              disabled={busy}
            >
              {option}
            </button>
          ))}
        </div>
        <label className="mt-3 block text-xs font-semibold text-zinc-200">
          Razón obligatoria
          <textarea
            className="input min-h-24 text-sm"
            maxLength={200}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
            placeholder={
              preset === "Otro"
                ? "Describe la razón real de cancelación"
                : "Edita la razón si hace falta"
            }
            disabled={busy}
          />
        </label>
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
          <span>Mínimo 3 caracteres, máximo 200.</span>
          <span>{reason.length}/200</span>
        </div>
        {error || validationError ? (
          <p className="mt-2 rounded bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
            {error ?? validationError}
          </p>
        ) : null}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1 border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm disabled:opacity-40"
            onClick={onClose}
            disabled={busy}
          >
            Volver
          </Button>
          <Button
            className="flex-1 border border-rose-700 bg-rose-950/70 px-3 py-2 text-sm font-bold text-rose-100 disabled:opacity-40"
            onClick={() => void submit()}
            disabled={disabled}
          >
            {busy ? "Cancelando…" : "Confirmar cancelación"}
          </Button>
        </div>
      </section>
    </div>
  );
};

const OrderItems = ({ order }: { order: InternalOrder }) => (
  <div className="mt-2 space-y-1 rounded-lg border border-dashed border-zinc-700 p-2">
    {order.items.map((i, idx) => {
      const lineTotal = i.lineTotal ?? i.qty * i.price;
      return (
        <div key={`${order.id}-${idx}`} className="row">
          <span>
            {i.qty}x {i.name}
          </span>
          <span>
            {formatCurrency(i.price)} c/u · {formatCurrency(lineTotal)}
          </span>
        </div>
      );
    })}
  </div>
);

const OrderFact = ({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
}) => (
  <span className={`orders-fact ${emphasis ? "orders-fact--emphasis" : ""}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </span>
);

const CompactRow = ({
  order,
  onOpen,
  onMove,
  onCancel,
  busy,
}: {
  order: InternalOrder;
  onOpen: () => void;
  onMove: MoveOrderStatus;
  onCancel: (order: InternalOrder) => void;
  busy: boolean;
}) => {
  const previewOrder = isPreviewOrderSource(order.source);
  const itemCount = getOrderItemCount(order);
  const location = getOrderLocationLabel(order);
  const canDeliver = order.status === "ready";
  const canCancel = !terminalStatuses.has(order.status);
  return (
    <div className={`orders-card orders-card--${order.status}`}>
      <span className={`orders-status-rail orders-status-rail--${order.status}`} aria-hidden="true" />
      <div className="orders-card__body">
        <div className="orders-card__head">
          <div className="orders-card__identity">
            <p className="orders-card__folio">
              <span className="truncate">{order.folio}</span>
              {previewOrder ? (
                <span className="orders-preview-chip">
                  Prueba
                </span>
              ) : null}
            </p>
            <p className="orders-card__customer">
              {order.customer}
            </p>
            <p className="orders-card__timestamp">
              {order.createdAt} · {channelLabel[order.channel]}
            </p>
          </div>
          <div className="orders-card__badges">
            <OrdersStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentState} />
          </div>
        </div>

        <div className="orders-card__facts">
          <OrderFact label="Total" value={formatCurrency(order.total)} emphasis />
          <OrderFact label="Entrega" value={location} />
          <OrderFact
            label="Pago"
            value={`${getPaymentMethodLabel(order.paymentMethod)} · ${getPaymentStatusLabel(order.paymentState)}`}
          />
        </div>

        <div className="orders-card__actions">
          <Button
            className="orders-primary-action"
            onClick={onOpen}
          >
            Ver ticket
          </Button>
          <details className="orders-card__more">
            <summary>Mas acciones</summary>
            <div className="orders-card__secondary-actions">
              <span className="orders-card__items-pill">Items: {itemCount}</span>
              {order.note ? (
                <p className="orders-note">Nota: {order.note}</p>
              ) : null}
              {canDeliver ? (
                <Button
                  className="orders-secondary-action"
                  onClick={() => void onMove(order.id, "delivered")}
                  disabled={busy}
                >
                  {busy ? "Actualizando…" : "Entregado"}
                </Button>
              ) : null}
              {canCancel ? (
                <Button
                  className="orders-danger-action"
                  onClick={() => onCancel(order)}
                  disabled={busy}
                >
                  {busy ? "Cancelando…" : "Cancelar pedido"}
                </Button>
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

const OrderCommandPanel = ({
  order,
  onOpen,
  onMove,
  onCancel,
  busy,
}: {
  order: InternalOrder;
  onOpen: () => void;
  onMove: MoveOrderStatus;
  onCancel: (order: InternalOrder) => void;
  busy: boolean;
}) => {
  const itemCount = getOrderItemCount(order);
  const location = getOrderLocationLabel(order);
  const canDeliver = order.status === "ready";
  const canCancel = !terminalStatuses.has(order.status);
  const visibleItems = order.items.slice(0, 3);
  return (
    <aside className="orders-command-detail" aria-label={`Detalle rapido ${order.folio}`}>
      <div className="orders-command-detail__hero">
        <div className="min-w-0">
          <p className="orders-command-detail__eyebrow">Ticket abierto</p>
          <h3>{order.folio}</h3>
          <p>{order.customer} · {location}</p>
        </div>
        <strong>{formatCurrency(order.total)}</strong>
      </div>
      <div className="orders-command-detail__facts">
        <OrderFact label="Estado" value={statusLabel[order.status]} />
        <OrderFact
          label="Pago"
          value={`${getPaymentMethodLabel(order.paymentMethod)} · ${getPaymentStatusLabel(order.paymentState)}`}
        />
        <OrderFact label="Items" value={itemCount} />
      </div>
      <div className="orders-command-detail__panel">
        <div className="orders-command-detail__panel-head">
          <p>Resumen</p>
          <Button className="orders-ghost-action" onClick={onOpen}>
            Ver ticket
          </Button>
        </div>
        <div className="orders-command-detail__items">
          {visibleItems.map((item, index) => (
            <div key={`${order.id}-panel-${index}`} className="orders-command-detail__item">
              <span>{item.qty}x {item.name}</span>
              <strong>{formatCurrency(item.lineTotal ?? item.qty * item.price)}</strong>
            </div>
          ))}
        </div>
        {order.note ? (
          <details className="orders-card__more orders-card__more--panel">
            <summary>Nota operativa</summary>
            <p className="orders-note">{order.note}</p>
          </details>
        ) : null}
      </div>
      <div className="orders-command-detail__actions">
        {canDeliver ? (
          <Button
            className="orders-primary-action"
            onClick={() => void onMove(order.id, "delivered")}
            disabled={busy}
          >
            {busy ? "Actualizando…" : "Entregado"}
          </Button>
        ) : (
          <Button className="orders-primary-action" onClick={onOpen}>
            Ver ticket
          </Button>
        )}
        {canCancel ? (
          <Button
            className="orders-danger-action"
            onClick={() => onCancel(order)}
            disabled={busy}
          >
            {busy ? "Cancelando…" : "Cancelar pedido"}
          </Button>
        ) : null}
      </div>
    </aside>
  );
};

const OrdersBoard = ({
  orders,
  setSelected,
  runtime,
  runtimeEnvironment,
  move,
  requestCancellation,
}: {
  orders: InternalOrder[];
  setSelected: (o: InternalOrder) => void;
  runtime: OrdersRuntime;
  runtimeEnvironment: ChekeoRuntimeEnvironment;
  move: MoveOrderStatus;
  requestCancellation: (
    order: InternalOrder,
    origin: "pedidos" | "detalle",
  ) => void;
}) => {
  const [statusFilter, setStatusFilter] = useState<OrdersStatusFilter>("all");
  const [rangeFilter, setRangeFilter] = useState<OrdersRangeFilter>("today");
  const [search, setSearch] = useState("");

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
    const normalizedSearch = search.trim().toLowerCase();

    return [...orders]
      .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))
      .filter((order) => {
        const orderStatus = getOrdersStatusFilterValue(order.status);
        if (statusFilter !== "all" && orderStatus !== statusFilter) return false;

        if (rangeFilter !== "all" && order.createdAtMs) {
          const threshold =
            rangeFilter === "today" ? startOfToday : startOfWeek;
          if (order.createdAtMs < threshold) return false;
        }

        if (!normalizedSearch) return true;
        const haystack = [
          order.folio,
          order.customer,
          order.customerPhone,
          getOrderLocationLabel(order),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      });
  }, [orders, rangeFilter, search, statusFilter]);
  const commandOrder =
    filteredOrders.find((order) => order.status === "ready") ??
    filteredOrders.find((order) => order.paymentState === "pending") ??
    filteredOrders[0];

  return (
    <section className="orders-command">
      <SourcePanel
        runtime={runtime}
        runtimeEnvironment={runtimeEnvironment}
        includeTerminal
      />

      <Card className="orders-board-shell">
        <div className="orders-board-shell__header">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
              Command center
            </p>
            <h2 className="mt-1 text-2xl font-black text-zinc-50">
              Pedidos activos
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-400">
              Queue operativa: detecta prioridad, abre ticket y resuelve el siguiente movimiento.
            </p>
          </div>
          <div className="orders-board-shell__summary">
            <span className="orders-summary-chip">
              {filteredOrders.length} visibles
            </span>
            <span className="orders-summary-chip">
              {orders.filter((order) => order.status === "ready").length} listos
            </span>
            <span className="orders-summary-chip">
              {orders.filter((order) => order.paymentState === "pending").length} pago pendiente
            </span>
          </div>
        </div>

        <div className="orders-filters">
          <label className="orders-search">
            <span>Buscar por folio o cliente</span>
            <input
              className="input mt-1 text-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ej. BX-102 o Andrea"
            />
          </label>
          <div className="orders-filter-group">
            <span>Estado</span>
            <div className="orders-filter-pills">
              {ordersStatusFilterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`orders-filter-pill ${statusFilter === option.value ? "orders-filter-pill--active" : ""}`}
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="orders-filter-group">
            <span>Rango</span>
            <div className="orders-filter-pills">
              {ordersRangeFilterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`orders-filter-pill ${rangeFilter === option.value ? "orders-filter-pill--active" : ""}`}
                  onClick={() => setRangeFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {runtime.source === "d1" && orders.length === 0 ? (
        <EmptyOrdersState
          title="Todavía no hay pedidos para revisar."
          description="Cuando entre un pedido nuevo, aparecerá aquí."
        />
      ) : null}

      {!filteredOrders.length ? (
        <EmptyOrdersState
          title="No hay pedidos para ese filtro."
          description="Ajusta estado, rango o búsqueda para volver a mostrar pedidos."
        />
      ) : (
        <div className="orders-command__workspace">
          <div className="orders-command__queue">
            {filteredOrders.map((order) => {
              const highlighted = runtime.highlightedOrderIds.has(order.id);
              return (
                <Card
                  key={order.id}
                  className={`orders-card-shell ${highlighted ? "orders-card-shell--highlighted" : ""}`}
                >
                  <CompactRow
                    order={order}
                    onOpen={() => setSelected(order)}
                    onMove={move}
                    onCancel={(nextOrder) => requestCancellation(nextOrder, "pedidos")}
                    busy={runtime.actionOrderId === order.id}
                  />
                </Card>
              );
            })}
          </div>
          {commandOrder ? (
            <OrderCommandPanel
              order={commandOrder}
              onOpen={() => setSelected(commandOrder)}
              onMove={move}
              onCancel={(nextOrder) => requestCancellation(nextOrder, "pedidos")}
              busy={runtime.actionOrderId === commandOrder.id}
            />
          ) : null}
        </div>
      )}
    </section>
  );
};

const CloseMetricCard = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) => (
  <Card className="p-2.5">
    <p className="muted">{label}</p>
    <p className="text-xl font-black">{value}</p>
    {hint ? <p className="mt-1 text-[11px] text-zinc-500">{hint}</p> : null}
  </Card>
);

const EmptyCloseState = () => (
  <Card className="p-3 text-sm text-zinc-400">
    No hay datos de cierre para el rango seleccionado.
  </Card>
);

const OperationalClosePanel = ({
  environment,
  sessionActive,
}: {
  environment: OrderV2Environment;
  sessionActive: boolean;
}) => {
  const [from, setFrom] = useState(todayDateInput());
  const [to, setTo] = useState(todayDateInput());
  const [includeTerminal, setIncludeTerminal] = useState(true);
  const [summary, setSummary] = useState<OrdersV2Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasData = Boolean(summary && summary.totals.orders > 0);

  const loadSummary = useCallback(async () => {
    if (!sessionActive) {
      setSummary(null);
      setError("Sesión expirada. Vuelve a iniciar sesión.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const data = await fetchOrdersV2Summary({
        from,
        to,
        includeTerminal,
        limit: 1000,
        topLimit: 10,
        environment,
      });
      setSummary(data);
      setNotice("Cierre actualizado");
    } catch (closeError) {
      setSummary(null);
      setError(
        closeError instanceof Error
          ? closeError.message
          : "No se pudo cargar el cierre",
      );
    } finally {
      setLoading(false);
    }
  }, [environment, from, includeTerminal, sessionActive, to]);

  useEffect(() => {
    if (sessionActive) void loadSummary();
    else {
      setSummary(null);
      setError("Sesión expirada. Vuelve a iniciar sesión.");
    }
  }, [sessionActive, loadSummary]);

  const downloadRangeCsv = async () => {
    if (!sessionActive) {
      setError("Sesión expirada. Vuelve a iniciar sesión.");
      return;
    }
    setExporting(true);
    setError(null);
    setNotice(null);
    try {
      const blob = await exportOrdersV2Csv({
        from,
        to,
        includeTerminal,
        limit: 1000,
        environment,
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `orders-v2-cierre-${from || "all"}-${to || "all"}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setNotice("Reporte del rango descargado");
    } catch (csvError) {
      setError(
        csvError instanceof Error
          ? csvError.message
            : "No se pudo descargar el reporte del rango",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="space-y-3">
      <Card className="p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
              Cierre operativo
            </p>
            <h2 className="text-xl font-black">Cierre</h2>
            <p className="text-sm text-zinc-400">
              Pagos declarados · Corte por rango operativo.
            </p>
          </div>
          <Button
            className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm disabled:opacity-40"
            onClick={() => void downloadRangeCsv()}
            disabled={exporting || !sessionActive}
          >
            {exporting ? "Preparando…" : "Descargar reporte"}
          </Button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[11px] text-zinc-400">
            Desde
            <input
              className="input text-xs"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="text-[11px] text-zinc-400">
            Hasta
            <input
              className="input text-xs"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200">
            <input
              type="checkbox"
              checked={includeTerminal}
              onChange={(event) => setIncludeTerminal(event.target.checked)}
            />
            Incluir terminales
          </label>
          <Button
            className="bg-cyan-400 px-3 py-2 text-sm font-bold text-black disabled:opacity-40"
            onClick={() => void loadSummary()}
            disabled={loading || !sessionActive}
          >
            {loading ? "Calculando…" : "Actualizar cierre"}
          </Button>
        </div>
        {!sessionActive ? (
          <p className="mt-2 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
            Sesión expirada. Vuelve a iniciar sesión.
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 rounded bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-2 rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
            {notice}
          </p>
        ) : null}
        {summary ? (
          <p className="mt-2 text-[11px] text-zinc-500">
            Rango calculado: {summary.range.fromUtc || "inicio"} a{" "}
            {summary.range.toUtc || "ahora"} · generado{" "}
            {formatDateTime(summary.generatedAt)}
          </p>
        ) : null}
      </Card>

      {loading ? (
        <Card className="p-3 text-sm text-zinc-300">
          Cargando cierre operativo…
        </Card>
      ) : null}
      {!loading && summary && !hasData ? <EmptyCloseState /> : null}

      {summary ? (
        <>
          <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <CloseMetricCard
              label="Venta bruta"
              value={formatCurrency(summary.totals.grossSales)}
              hint="Órdenes no canceladas"
            />
            <CloseMetricCard
              label="Venta entregada"
              value={formatCurrency(summary.totals.deliveredSales)}
              hint="Solo delivered"
            />
            <CloseMetricCard
              label="Órdenes totales"
              value={summary.totals.orders}
            />
            <CloseMetricCard
              label="Entregadas"
              value={summary.totals.deliveredOrders}
            />
            <CloseMetricCard
              label="Canceladas"
              value={summary.totals.cancelledOrders}
            />
            <CloseMetricCard
              label="Ticket promedio"
              value={formatCurrency(summary.totals.averageTicket)}
              hint="Venta bruta / no canceladas"
            />
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <Card className="p-3">
              <h3 className="mb-2 font-bold">Por estado</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(summary.byStatus).map(([status, count]) => (
                  <div key={status} className="row">
                    <span>{statusLabel[status as OrderStatus] ?? status}</span>
                    <span className="chip">{count}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-3">
              <h3 className="mb-2 font-bold">Tiempos promedio</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <CloseMetricCard
                  label="Nuevo a listo"
                  value={formatDuration(summary.durations.newToReadyAvgSeconds)}
                />
                <CloseMetricCard
                  label="Nuevo a entregado"
                  value={formatDuration(
                    summary.durations.newToDeliveredAvgSeconds,
                  )}
                />
              </div>
            </Card>
            <Card className="p-3">
              <h3 className="mb-2 font-bold">Por método de pago declarado</h3>
              <div className="space-y-2">
                {summary.byPaymentMethod.length ? (
                  summary.byPaymentMethod.map((entry) => (
                    <div key={entry.paymentMethod} className="row">
                      <span>{entry.paymentMethod}</span>
                      <span className="text-right text-xs">
                        {entry.orders} · {formatCurrency(entry.total)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-400">
                    Sin métodos en el rango.
                  </p>
                )}
              </div>
            </Card>
            <Card className="p-3">
              <h3 className="mb-2 font-bold">Para recoger vs entrega</h3>
              <div className="space-y-2">
                {summary.byOrderMode.length ? (
                  summary.byOrderMode.map((entry) => (
                    <div key={entry.orderMode} className="row">
                      <span>{entry.orderMode}</span>
                      <span className="text-right text-xs">
                        {entry.orders} · {formatCurrency(entry.total)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-400">
                    Sin modos en el rango.
                  </p>
                )}
              </div>
            </Card>
          </section>

          <Card className="p-3">
            <h3 className="mb-2 font-bold">Productos destacados</h3>
            <div className="space-y-2">
              {summary.topItems.length ? (
                summary.topItems.map((item) => (
                  <div
                    key={item.sku}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-right">
                        {item.qty} uds · {formatCurrency(item.total)}
                      </span>
                    </div>
                    <p className="mt-1 text-zinc-500">
                      {item.sku} · {item.orders} órdenes
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-400">
                  Sin productos no cancelados en el rango.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-3">
            <h3 className="mb-2 font-bold">Órdenes recientes</h3>
            <div className="space-y-2">
              {summary.recentOrders.length ? (
                summary.recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {order.folio} · {order.customerName}
                        </p>
                        <p className="text-zinc-500">
                          {formatDateTime(order.createdAt)} · {order.orderMode}{" "}
                          · {order.paymentMethod}/{order.paymentStatus}
                        </p>
                      </div>
                      <StatusBadge status={order.status as OrderStatus} />
                    </div>
                    <p className="mt-1 text-right font-bold">
                      {formatCurrency(order.total)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-400">
                  Sin órdenes recientes en el rango.
                </p>
              )}
            </div>
          </Card>
        </>
      ) : null}
    </section>
  );
};

type PaymentFilter = "all" | "pending" | "paid";
type PaymentPanelNotice = { tone: "success" | "error"; message: string };

const paymentFilters: Array<{ value: PaymentFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendiente" },
  { value: "paid", label: "Pagado" },
];
const paymentRangeFilters: Array<{
  value: OrdersRangeFilter;
  label: string;
}> = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Semana" },
  { value: "all", label: "Todo" },
];

const PaymentStatusBadge = ({ status }: { status: string }) => {
  const label = isOrderV2PaymentStatus(status)
    ? paymentStatusLabel[status]
    : status;
  const tone = isOrderV2PaymentStatus(status)
    ? paymentStatusTone[status]
    : "border-zinc-500/40 text-zinc-200";
  return <StatusPill className={tone}>{label}</StatusPill>;
};

const PaymentDetailModal = ({
  order,
  runtime,
  draftNote,
  notice,
  onClose,
  onDraftChange,
  onSaveNote,
  onCopyMessage,
  onOpenWhatsapp,
  onMarkPaid,
  onMarkPending,
}: {
  order: InternalOrder | null;
  runtime: OrdersRuntime;
  draftNote: string;
  notice?: PaymentPanelNotice;
  onClose: () => void;
  onDraftChange: (value: string) => void;
  onSaveNote: () => Promise<void>;
  onCopyMessage: () => Promise<void>;
  onOpenWhatsapp: () => void;
  onMarkPaid: () => Promise<void>;
  onMarkPending: () => Promise<void>;
}) => {
  useEffect(() => {
    if (!order) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, order]);

  if (!order) return null;

  const busy = runtime.actionOrderId === order.id;
  const paymentCopy = buildPaymentWhatsappCopy(order);
  const phone = normalizeWhatsappPhone(order.customerPhone ?? "");
  const isTransferPayment = isTransferPaymentMethod(order.paymentMethod);
  const noteWithoutLocation = stripLocationFromNotes(order.note);

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-detail-title"
      onClick={onClose}
    >
      <section
        className="modal modal--wide max-h-[calc(100vh-1rem)] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="payments-detail__header">
          <div className="min-w-0">
            <p className="payments-detail__eyebrow">Pago operativo</p>
            <h2 id="payment-detail-title" className="payments-detail__title">
              {order.folio}
            </h2>
            <p className="break-words text-sm font-semibold text-zinc-100">
              {order.customer}
            </p>
            <p className="text-xs text-zinc-400">
              {order.createdAt} · {channelLabel[order.channel]} ·{" "}
              {sourceLabel(order.source)}
            </p>
            {order.customerPhone ? (
              <p className="text-xs text-zinc-500">Tel: {order.customerPhone}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1 sm:justify-end">
            <PaymentStatusBadge status={order.paymentState} />
            <StatusBadge status={order.status} />
          </div>
        </div>

        <div className="payments-detail__grid">
          <div className="payments-detail__stat">
            <span>Total</span>
            <strong>{formatCurrency(order.total)}</strong>
          </div>
          <div className="payments-detail__stat">
            <span>Metodo de pago</span>
            <strong>{getPaymentMethodLabel(order.paymentMethod)}</strong>
          </div>
          <div className="payments-detail__stat">
            <span>Estado de pago</span>
            <strong>{getPaymentStatusLabel(order.paymentState)}</strong>
          </div>
          <div className="payments-detail__stat">
            <span>Detalle de entrega</span>
            <strong>{getPaymentDeliveryDetail(order)}</strong>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/55 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
              Resumen del pedido
            </p>
            <p className="mt-2 text-sm text-zinc-300">{getPaymentItemsDigest(order)}</p>
            <OrderItems order={order} />
          </div>

          {isTransferPayment ? (
            <div className="payments-bank-panel">
              <p className="payments-bank-panel__label">Datos bancarios</p>
              <div className="payments-bank-panel__grid">
                <div className="payments-bank-panel__item">
                  <span>Banco</span>
                  <strong>{bankPaymentConfig.bankName}</strong>
                </div>
                <div className="payments-bank-panel__item">
                  <span>Titular</span>
                  <strong>{bankPaymentConfig.accountHolder}</strong>
                </div>
                <div className="payments-bank-panel__item">
                  <span>{getBankPaymentPrimaryLabel(bankPaymentConfig)}</span>
                  <strong>{getBankPaymentPrimaryValue(bankPaymentConfig)}</strong>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/55 p-3">
            <label className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
              Nota para seguimiento
              <textarea
                className="input mt-2 min-h-24 text-xs"
                maxLength={500}
                value={draftNote}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder="Ej. comprobante pendiente, cliente confirma por WhatsApp"
              />
            </label>
            {noteWithoutLocation ? (
              <p className="mt-2 text-[11px] text-zinc-400">
                Nota actual: {noteWithoutLocation}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3">
            <label className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100">
              Mensaje listo para WhatsApp
              <textarea
                className="input mt-2 min-h-48 text-xs leading-5"
                readOnly
                value={paymentCopy}
              />
            </label>
            {!phone ? (
              <p className="mt-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                Telefono invalido para abrir WhatsApp desde esta vista.
              </p>
            ) : null}
          </div>
        </div>

        <div className="payments-detail__actions">
          {order.paymentState === "paid" ? (
            <Button
              className="payments-secondary-action disabled:opacity-40"
              onClick={() => void onMarkPending()}
              disabled={busy || !runtime.sessionActive}
            >
              {busy ? "Actualizando…" : "Regresar a pendiente"}
            </Button>
          ) : (
            <Button
              className="payments-success-action disabled:opacity-40"
              onClick={() => void onMarkPaid()}
              disabled={busy || !runtime.sessionActive}
            >
              {busy ? "Actualizando…" : "Marcar pagado"}
            </Button>
          )}
          <Button
            className="payments-secondary-action"
            onClick={() => void onCopyMessage()}
          >
            Copiar mensaje de pago
          </Button>
          <Button
            className="payments-secondary-action disabled:opacity-40"
            onClick={onOpenWhatsapp}
            disabled={!phone}
          >
            Abrir WhatsApp
          </Button>
          <Button
            className="payments-secondary-action disabled:opacity-40"
            onClick={() => void onSaveNote()}
            disabled={busy || !runtime.sessionActive}
          >
            {busy ? "Guardando…" : "Guardar nota"}
          </Button>
        </div>

        {notice ? (
          <p
            className={`mt-3 rounded-xl px-3 py-2 text-xs ${notice.tone === "error" ? "bg-rose-500/10 text-rose-200" : "bg-emerald-500/10 text-emerald-200"}`}
          >
            {notice.message}
          </p>
        ) : null}
      </section>
    </div>
  );
};

const PaymentNotesPanel = ({
  orders,
  runtime,
  runtimeEnvironment,
  onUpdatePayment,
}: {
  orders: InternalOrder[];
  runtime: OrdersRuntime;
  runtimeEnvironment: ChekeoRuntimeEnvironment;
  onUpdatePayment: (
    orderId: string,
    paymentStatus: OrderV2PaymentStatus,
    notes?: string,
    reason?: string,
  ) => Promise<void>;
}) => {
  const [filter, setFilter] = useState<PaymentFilter>("pending");
  const [rangeFilter, setRangeFilter] = useState<OrdersRangeFilter>("today");
  const [search, setSearch] = useState("");
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [inlineNotice, setInlineNotice] = useState<
    Record<string, PaymentPanelNotice>
  >({});
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    setDraftNotes((current) => {
      const next: Record<string, string> = {};
      orders.forEach((order) => {
        next[order.id] =
          current[order.id] ?? stripLocationFromNotes(order.note);
      });
      return next;
    });
  }, [orders]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setInlineNotice((current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([, notice]) => notice.tone !== "success",
          ),
        ),
      );
    }, 2500);
    return () => window.clearTimeout(timeout);
  }, [inlineNotice]);

  useEffect(() => {
    if (!selectedOrderId) return;
    if (!orders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(null);
    }
  }, [orders, selectedOrderId]);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
    const normalizedSearch = search.trim().toLowerCase();

    return [...orders]
      .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))
      .filter((order) => {
        if (rangeFilter !== "all" && order.createdAtMs) {
          const threshold =
            rangeFilter === "today" ? startOfToday : startOfWeek;
          if (order.createdAtMs < threshold) return false;
        }

        if (!normalizedSearch) return true;

        return (
          order.folio.toLowerCase().includes(normalizedSearch) ||
          order.customer.toLowerCase().includes(normalizedSearch)
        );
      });
  }, [orders, rangeFilter, search]);

  const paymentOrders = useMemo(
    () =>
      filteredOrders.filter(
        (order) => filter === "all" || order.paymentState === filter,
      ),
    [filter, filteredOrders],
  );
  const paymentMetrics = useMemo(
    () => ({
      visible: paymentOrders.length,
      pending: filteredOrders.filter((order) => order.paymentState === "pending")
        .length,
      paid: filteredOrders.filter((order) => order.paymentState === "paid")
        .length,
      transfer: filteredOrders.filter((order) =>
        isTransferPaymentMethod(order.paymentMethod),
      ).length,
      total: filteredOrders.reduce((sum, order) => sum + order.total, 0),
    }),
    [filteredOrders, paymentOrders.length],
  );
  const selectedOrder = selectedOrderId
    ? orders.find((order) => order.id === selectedOrderId) ?? null
    : null;

  const runPaymentAction = async (
    order: InternalOrder,
    paymentStatus: OrderV2PaymentStatus,
    notes?: string,
    reason?: string,
  ) => {
    setInlineNotice((current) => ({
      ...current,
      [order.id]: { tone: "success", message: "Actualizando pago operativo…" },
    }));
    try {
      await onUpdatePayment(
        order.id,
        paymentStatus,
        notes,
        reason ?? `Control de pagos: ${paymentStatus}`,
      );
      setInlineNotice((current) => ({
        ...current,
        [order.id]: {
          tone: "success",
          message:
            paymentStatus === "paid"
              ? `${order.folio}: pago confirmado.`
              : `${order.folio}: pago pendiente de confirmar.`,
        },
      }));
    } catch (paymentError) {
      setInlineNotice((current) => ({
        ...current,
        [order.id]: {
          tone: "error",
          message:
            paymentError instanceof Error
              ? paymentError.message
              : "No se pudo actualizar el pago. Revisa la sesión e inténtalo de nuevo.",
        },
      }));
      }
  };

  const copyPaymentMessage = async (order: InternalOrder) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard no disponible en este navegador");
      }
      await navigator.clipboard.writeText(buildPaymentWhatsappCopy(order));
      setInlineNotice((current) => ({
        ...current,
        [order.id]: {
          tone: "success",
          message: `${order.folio}: mensaje de pago copiado.`,
        },
      }));
    } catch (copyError) {
      setInlineNotice((current) => ({
        ...current,
        [order.id]: {
          tone: "error",
          message:
            copyError instanceof Error
              ? copyError.message
              : "No se pudo copiar el mensaje de pago.",
        },
      }));
    }
  };

  const openPaymentWhatsapp = (order: InternalOrder) => {
    const phone = normalizeWhatsappPhone(order.customerPhone ?? "");
    if (!phone) {
      setInlineNotice((current) => ({
        ...current,
        [order.id]: {
          tone: "error",
          message: `${order.folio}: telefono invalido para WhatsApp.`,
        },
      }));
      return;
    }
    const whatsappUrl = buildWhatsappUrl(phone, buildPaymentWhatsappCopy(order));
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const savePaymentNote = async (order: InternalOrder) => {
    const nextStatus = isOrderV2PaymentStatus(order.paymentState)
      ? order.paymentState
      : "pending";
    await runPaymentAction(
      order,
      nextStatus,
      buildPaymentNoteWithLocation(order, draftNotes[order.id] ?? ""),
      "Control de pagos: nota operativa",
    );
  };

  return (
    <section className="payments-shell">
      <SourcePanel
        runtime={runtime}
        runtimeEnvironment={runtimeEnvironment}
        includeTerminal
      />
      <Card className="payments-hero">
        <div className="payments-hero__header">
          <div>
            <p className="payments-hero__eyebrow">Pagos por confirmar</p>
            <h3 className="payments-hero__title">Centro operativo de cobros</h3>
            <p className="payments-hero__summary">
              Revisa pendientes, confirma pagos y abre el mensaje correcto de
              WhatsApp sin mezclar entregas, cancelaciones ni ticket visual.
            </p>
          </div>
          <Button
            className="border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs disabled:opacity-40"
            onClick={() => runtime.reload(true)}
            disabled={runtime.loading || !runtime.sessionActive}
          >
            {runtime.loading ? "Actualizando…" : "Actualizar lista"}
          </Button>
        </div>

        <div className="payments-summary-grid">
          <div className="payments-summary-card">
            <span>Visibles</span>
            <strong>{paymentMetrics.visible}</strong>
          </div>
          <div className="payments-summary-card">
            <span>Pendientes</span>
            <strong>{paymentMetrics.pending}</strong>
          </div>
          <div className="payments-summary-card">
            <span>Pagados</span>
            <strong>{paymentMetrics.paid}</strong>
          </div>
          <div className="payments-summary-card">
            <span>Transferencia</span>
            <strong>{paymentMetrics.transfer}</strong>
          </div>
          <div className="payments-summary-card">
            <span>Total visible</span>
            <strong>{formatCurrency(paymentMetrics.total)}</strong>
          </div>
        </div>

        <div className="payments-toolbar">
          <label className="payments-search">
            <span>Buscar por folio o cliente</span>
            <input
              className="input mt-2 text-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ej. RDY-401 o Andrea"
            />
          </label>
          <div className="payments-toolbar__group">
            <div>
              <p className="payments-toolbar__label">Estado de pago</p>
              <div className="payments-pill-row">
                {paymentFilters.map((option) => (
                  <button
                    key={option.value}
                    className={`payments-filter-pill ${filter === option.value ? "payments-filter-pill--active" : ""}`}
                    onClick={() => setFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="payments-toolbar__label">Rango</p>
              <div className="payments-pill-row">
                {paymentRangeFilters.map((option) => (
                  <button
                    key={option.value}
                    className={`payments-filter-pill ${rangeFilter === option.value ? "payments-filter-pill--active" : ""}`}
                    onClick={() => setRangeFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {!runtime.sessionActive ? (
          <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
            Inicia sesión para operar pagos y guardar seguimiento.
          </p>
        ) : null}
      </Card>
      {paymentOrders.length === 0 ? (
        <EmptyOrdersState
          title={
            filter === "all" && !search.trim()
              ? "Todavia no hay pagos para revisar."
              : "No hay coincidencias con este filtro."
          }
          description={
            filter === "all" && !search.trim()
              ? "Cuando entre un pedido aparecera aqui."
              : "Ajusta rango, estado o busqueda para recuperar registros."
          }
          action={
            filter !== "all" || search.trim() || rangeFilter !== "today" ? (
              <Button
                className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs"
                onClick={() => {
                  setFilter("all");
                  setSearch("");
                  setRangeFilter("today");
                }}
              >
                Limpiar vista
              </Button>
            ) : undefined
          }
        />
      ) : null}
      <div className="grid gap-2">
        {paymentOrders.map((order) => {
          const busy = runtime.actionOrderId === order.id;
          const noteWithoutLocation = stripLocationFromNotes(order.note);
          const notice = inlineNotice[order.id];
          const location = getOrderLocationLabel(order);
          return (
            <Card
              key={order.id}
              className={`payments-card ${order.paymentState === "pending" ? "payments-card--pending" : ""}`}
            >
              <div className="payments-card__head">
                <div className="min-w-0">
                  <p className="payments-card__folio">{order.folio}</p>
                  <p className="break-words text-sm font-semibold text-zinc-100">
                    {order.customer}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {order.createdAt} · {channelLabel[order.channel]} ·{" "}
                    {sourceLabel(order.source)}
                  </p>
                </div>
                <div className="payments-card__amount">
                  <span>Total final</span>
                  <strong>{formatCurrency(order.total)}</strong>
                </div>
              </div>

              <div className="payments-card__status">
                <div className="flex flex-wrap gap-1">
                  <PaymentStatusBadge status={order.paymentState} />
                  <StatusBadge status={order.status} />
                  <span className="orders-location-chip">Ubicacion: {location}</span>
                </div>
                {order.customerPhone ? (
                  <p className="text-[11px] text-zinc-500">{order.customerPhone}</p>
                ) : null}
              </div>

              <div className="payments-card__meta">
                <span>Método de pago: {getPaymentMethodLabel(order.paymentMethod)}</span>
                <span>Estado de pago: {getPaymentStatusLabel(order.paymentState)}</span>
                <span>Estado del pedido: {statusLabel[order.status]}</span>
                <span>Detalle: {getPaymentDeliveryDetail(order)}</span>
              </div>
              <p className="payments-card__summary">
                Resumen: {getPaymentItemsDigest(order)}
              </p>
              {noteWithoutLocation ? (
                <p className="orders-note">Seguimiento: {noteWithoutLocation}</p>
              ) : null}
              <div className="payments-card__actions">
                <Button
                  className="payments-primary-action"
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  Ver pago
                </Button>
                <Button
                  className={`${order.paymentState === "paid" ? "payments-secondary-action" : "payments-success-action"} disabled:opacity-40`}
                  onClick={() =>
                    void runPaymentAction(
                      order,
                      order.paymentState === "paid" ? "pending" : "paid",
                    )
                  }
                  disabled={busy || !runtime.sessionActive}
                >
                  {busy
                    ? "Actualizando…"
                    : order.paymentState === "paid"
                      ? "Regresar a pendiente"
                      : "Marcar pagado"}
                </Button>
                <Button
                  className="payments-secondary-action"
                  onClick={() => void copyPaymentMessage(order)}
                >
                  Copiar mensaje de pago
                </Button>
                <Button
                  className="payments-secondary-action"
                  onClick={() => openPaymentWhatsapp(order)}
                >
                  Abrir WhatsApp
                </Button>
              </div>
              {notice ? (
                <p
                  className={`mt-2 rounded px-2 py-1 text-xs ${notice.tone === "error" ? "bg-rose-500/10 text-rose-200" : "bg-emerald-500/10 text-emerald-200"}`}
                >
                  {notice.message}
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>
      <PaymentDetailModal
        order={selectedOrder}
        runtime={runtime}
        draftNote={
          selectedOrder
            ? draftNotes[selectedOrder.id] ??
              stripLocationFromNotes(selectedOrder.note)
            : ""
        }
        notice={selectedOrder ? inlineNotice[selectedOrder.id] : undefined}
        onClose={() => setSelectedOrderId(null)}
        onDraftChange={(value) => {
          if (!selectedOrder) return;
          setDraftNotes((current) => ({
            ...current,
            [selectedOrder.id]: value,
          }));
        }}
        onSaveNote={() =>
          selectedOrder ? savePaymentNote(selectedOrder) : Promise.resolve()
        }
        onCopyMessage={() =>
          selectedOrder ? copyPaymentMessage(selectedOrder) : Promise.resolve()
        }
        onOpenWhatsapp={() => {
          if (!selectedOrder) return;
          openPaymentWhatsapp(selectedOrder);
        }}
        onMarkPaid={() =>
          selectedOrder
            ? runPaymentAction(selectedOrder, "paid")
            : Promise.resolve()
        }
        onMarkPending={() =>
          selectedOrder
            ? runPaymentAction(selectedOrder, "pending")
            : Promise.resolve()
        }
      />
    </section>
  );
};
const HistoryPanel = ({
  orders,
  runtime,
  runtimeEnvironment,
  onArchiveCancelled,
}: {
  orders: InternalOrder[];
  runtime: OrdersRuntime;
  runtimeEnvironment: ChekeoRuntimeEnvironment;
  onArchiveCancelled: (order: InternalOrder) => Promise<void>;
}) => {
  const terminalOrders = orders.filter((o) => terminalStatuses.has(o.status));
  return (
    <section>
      <SourcePanel
        runtime={runtime}
        runtimeEnvironment={runtimeEnvironment}
        includeTerminal
      />
      <Card className="p-3">
        <h3 className="mb-2">
          Historial {runtime.source === "d1" ? "de pedidos" : "de esta vista"}
        </h3>
        {runtime.source === "d1" && terminalOrders.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Aún no hay pedidos entregados o cancelados.
          </p>
        ) : null}
        <div className="space-y-2">
          {terminalOrders.map((o) => {
            const cancellationReason =
              o.status === "cancelled" ? getCancellationReason(o) : undefined;
            return (
              <div key={o.id} className="row items-start">
                <div className="min-w-0">
                  <p className="break-words">
                    {o.folio} · {o.customer} · {o.createdAt}
                  </p>
                  {o.status === "cancelled" ? (
                    <p className="mt-1 text-xs text-rose-200">
                      Cancelado por operador
                    </p>
                  ) : null}
                  {cancellationReason ? (
                    <p className="mt-1 text-xs text-amber-200">
                      Razón: {cancellationReason}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={o.status} />
                  {o.status === "cancelled" && runtime.source === "d1" ? (
                    <Button
                      type="button"
                      className="min-h-11 border border-rose-500/40 px-3 py-2 text-xs text-rose-100 disabled:opacity-50"
                      disabled={runtime.actionOrderId === o.id}
                      onClick={() => void onArchiveCancelled(o)}
                    >
                      {runtime.actionOrderId === o.id ? "Ocultando…" : "Ocultar del historial"}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
};
const getNextStatus = (status: OrderStatus): OrderStatus =>
  status === "new"
    ? "preparing"
    : status === "preparing"
      ? "ready"
      : status === "ready"
        ? "delivered"
        : status;

const TicketPreviewItems = ({ order }: { order: InternalOrder }) => (
  <div className="orders-ticket-items">
    {order.items.map((item, index) => {
      const lineTotal = item.lineTotal ?? item.qty * item.price;
      const notes = [
        item.comboBurgers.length
          ? `Combo: ${item.comboBurgers.map((burger) => burger.name).join(", ")}`
          : "",
        item.removedIngredients.length
          ? `Sin: ${item.removedIngredients.join(", ")}`
          : "",
        item.extras.length
          ? `Extras: ${item.extras.map((extra) => extra.name).join(", ")}`
          : "",
        item.garnish?.name ? `Guarnición: ${item.garnish.name}` : "",
        item.sideQuestExtras.length
          ? `Side Quest: ${item.sideQuestExtras.map((extra) => extra.name).join(", ")}`
          : "",
        item.burgerNote ? `Nota: ${item.burgerNote}` : "",
      ].filter(Boolean);

      return (
        <div key={`${order.id}-${index}`} className="orders-ticket-item">
          <div className="min-w-0">
            <p className="break-words text-sm font-black text-zinc-50">
              {item.qty}x {item.name}
            </p>
            {notes.length ? (
              <p className="mt-1 break-words text-xs text-zinc-400">
                {notes.join(" · ")}
              </p>
            ) : null}
          </div>
          <strong className="text-sm text-cyan-100">
            {formatCurrency(lineTotal)}
          </strong>
        </div>
      );
    })}
  </div>
);

const OrderTicketPreview = ({ order }: { order: InternalOrder }) => {
  const itemCount = getOrderItemCount(order);
  const location = getOrderLocationLabel(order);
  const power = getOrderPower(order);
  const rarity = getOrderRarity(order);
  return (
    <section className="orders-ticket-preview">
      <div className="orders-ticket-preview__hero">
        <div className="orders-ticket-preview__identity">
          <p className="orders-ticket-preview__eyebrow">
            Ticket
          </p>
          <h3 className="orders-ticket-preview__folio">
            {order.folio}
          </h3>
          <p className="orders-ticket-preview__customer">
            {order.customer}
          </p>
          <p className="orders-ticket-preview__timestamp">
            {order.createdAt} · {channelLabel[order.channel]}
          </p>
        </div>
        <div className="orders-ticket-preview__badges">
          <OrdersStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentState} />
          <span className="orders-location-chip">Ubicación: {location}</span>
        </div>
      </div>

      <div className="orders-ticket-preview__stats">
        <div className="orders-ticket-stat">
          <span>Total</span>
          <strong>{formatCurrency(order.total)}</strong>
        </div>
        <div className="orders-ticket-stat">
          <span>Items</span>
          <strong>{itemCount}</strong>
        </div>
        <div className="orders-ticket-stat">
          <span>Rareza</span>
          <strong>{rarity}</strong>
        </div>
        <div className="orders-ticket-stat">
          <span>Power</span>
          <strong>{power}</strong>
        </div>
      </div>

      <div className="orders-ticket-preview__meta">
        <span className="info-pill">Pago: {getPaymentMethodLabel(order.paymentMethod)}</span>
        <span className="info-pill">Estado pago: {getPaymentStatusLabel(order.paymentState)}</span>
        <span className="info-pill">Origen: {sourceLabel(order.source)}</span>
        {order.customerPhone ? (
          <span className="info-pill">Tel: {order.customerPhone}</span>
        ) : null}
      </div>

      <div className="orders-ticket-preview__body">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
            Resumen del pedido
          </p>
          <TicketPreviewItems order={order} />
        </div>
        {order.note ? (
          <p className="orders-note">Nota para revisar: {order.note}</p>
        ) : null}
      </div>
    </section>
  );
};

const OrderDetailModal = ({
  selected,
  onClose,
  onMove,
  onRequestCancellation,
  actionOrderId,
}: {
  selected: InternalOrder | null;
  onClose: () => void;
  onMove: MoveOrderStatus;
  onRequestCancellation: (
    order: InternalOrder,
    origin: "pedidos" | "detalle",
  ) => void;
  actionOrderId: string | null;
}) => {
  const [whatsappTemplate, setWhatsappTemplate] =
    useState<Exclude<WhatsappOrderMessageType, "custom">>("received");

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  useEffect(() => {
    if (selected)
      setWhatsappTemplate(getWhatsappTemplateForStatus(selected.status));
  }, [selected?.id, selected?.status]);

  if (!selected) return null;
  const nextStatus = getNextStatus(selected.status);
  const canAdvance = nextStatus !== selected.status;
  const canCancel =
    selected.status !== "delivered" && selected.status !== "cancelled";
  const detailActions = getPedidoActions(selected.status).filter(
    (action) => action.status !== "cancelled",
  );
  const busy = actionOrderId === selected.id;
  const runAction = async (next: OrderStatus) => {
    if (busy) return;
    await onMove(selected.id, next);
  };

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-title"
      onClick={onClose}
    >
      <section
        className="modal modal--order-detail"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="order-detail__header">
          <div className="order-detail__identity">
            <p className="order-detail__eyebrow">
              Ticket abierto
            </p>
            <h2 id="order-title" className="order-detail__title">
              {selected.folio}
            </h2>
            <p className="order-detail__customer">
              {selected.customer}
            </p>
            <p className="order-detail__timestamp">
              {selected.createdAt} · {channelLabel[selected.channel]} · {sourceLabel(selected.source)}
            </p>
            {selected.customerPhone ? (
              <p className="order-detail__phone">
                Tel:{" "}
                <a
                  className="order-detail__phone-link"
                  href={`tel:${selected.customerPhone}`}
                >
                  {selected.customerPhone}
                </a>
              </p>
            ) : null}
          </div>
          <div className="order-detail__badges">
            <OrdersStatusBadge status={selected.status} />
            <PaymentStatusBadge status={selected.paymentState} />
          </div>
        </div>
        <div className="order-detail__actions order-detail__actions--priority">
          {canAdvance
            ? detailActions.map((action) => (
                <Button
                  key={action.status}
                  onClick={() => void runAction(action.status)}
                  className="orders-primary-action order-detail__action disabled:opacity-40"
                  disabled={busy}
                >
                  {busy ? "Actualizando…" : "Entregado"}
                </Button>
              ))
            : null}
          {canCancel ? (
            <Button
              onClick={() => onRequestCancellation(selected, "detalle")}
              className="orders-danger-action order-detail__action disabled:opacity-40"
              disabled={busy}
            >
              {busy ? "Cancelando…" : "Cancelar pedido"}
            </Button>
          ) : null}
        </div>
        <OrderTicketPreview order={selected} />
        <details className="order-detail__panel order-detail__panel--message">
          <summary className="order-detail__summary-trigger">Mensaje y ticket para WhatsApp</summary>
          <label className="text-[11px] font-semibold text-cyan-100">
            Copiar mensaje
            <select
              className="input mt-1 text-xs"
              value={whatsappTemplate}
              onChange={(event) =>
                setWhatsappTemplate(
                  event.target.value as Exclude<
                    WhatsappOrderMessageType,
                    "custom"
                  >,
                )
              }
            >
              {whatsappTemplateLabels.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <WhatsappOrderActions
            order={selected}
            template={whatsappTemplate}
            showHint
          />
        </details>
        <details className="order-detail__panel order-detail__timeline">
          <summary className="order-detail__summary-trigger">Actividad del pedido</summary>
          {selected.timeline.map((t) => (
            <div key={t.id} className="order-detail__timeline-item">
              <p className="order-detail__timeline-main">
                {t.time} · {t.label}
                {t.actor ? ` · ${t.actor}` : ""}
              </p>
              {t.previousStatus || t.nextStatus ? (
                <p className="order-detail__timeline-meta">
                  Antes: {t.previousStatus ? statusLabel[t.previousStatus] : "Sin dato"} ·{" "}
                  Ahora: {t.nextStatus ? statusLabel[t.nextStatus] : "Sin dato"}
                </p>
              ) : null}
              {t.reason ? (
                <p className="order-detail__timeline-reason">Razón: {t.reason}</p>
              ) : null}
            </div>
          ))}
        </details>
        <Button
          className="order-detail__close"
          onClick={onClose}
        >
          Cerrar
        </Button>
      </section>
    </div>
  );
};

const OperatorTabs = ({
  tab,
  setTab,
  content,
}: {
  tab: TabKey;
  setTab: (v: TabKey) => void;
  content: ReactNode;
}) => (
  <Tabs.Root
    value={tab}
    onValueChange={(v) => setTab(v as TabKey)}
  >
    <div className="tabs-shell">
      <div className="tabs-shell__meta">
        <p>Operación de hoy</p>
        <p>Admin técnico al final</p>
      </div>
      <Tabs.List className="tabs">
        {primaryTabs.map(({ key, label, hint, icon: Icon }) => (
          <Tabs.Trigger
            key={key}
            value={key}
            className={`tab ${key === "admin" ? "tab--admin" : ""}`}
          >
            <span className="tab__icon">
              <Icon size={16} aria-hidden="true" />
            </span>
            <span className="tab__copy">
              <span className="tab__label">{label}</span>
              <span className="tab__hint">{hint}</span>
            </span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </div>
    {content}
  </Tabs.Root>
);

export function InternalChekeoApp() {
  const [logged, setLogged] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [tab, setTab] = useState<TabKey>("home");
  const [adminView, setAdminView] = useState<AdminViewKey>("launcher");
  const [orders, setOrders] = useState<InternalOrder[]>(
    asInternalOrders(mockOrders),
  );
  const [selected, setSelected] = useState<InternalOrder | null>(null);
  const [cancellationRequest, setCancellationRequest] =
    useState<CancellationRequest>(null);
  const [ordersSource, setOrdersSource] = useState<OrdersSource>("mock");
  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersNotice, setOrdersNotice] = useState<string | null>(null);
  const [newOrderNotice, setNewOrderNotice] = useState<NewOrderNotice>(null);
  const [highlightedOrderIds, setHighlightedOrderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const authMode = useMemo(getInternalAuthMode, []);
  const useGlobalAuthGate = shouldUseGlobalInternalAuthGate(authMode);
  const runtimeEnvironment = useMemo(getChekeoRuntimeEnvironment, []);
  const orderEnvironment = useMemo(
    () => getOrderEnvironmentForChekeoRuntime(runtimeEnvironment),
    [runtimeEnvironment],
  );
  const reduce = useReducedMotion();
  const orderKeysRef = useRef<Set<string> | null>(null);
  const loggedRef = useRef(logged);
  const actionOrderIdRef = useRef(actionOrderId);
  const cancellationRequestRef = useRef(cancellationRequest);
  const loadingOrdersRef = useRef(loadingOrders);
  const checkingSessionRef = useRef(checkingSession);

  useEffect(() => {
    loggedRef.current = logged;
  }, [logged]);

  useEffect(() => {
    actionOrderIdRef.current = actionOrderId;
  }, [actionOrderId]);

  useEffect(() => {
    cancellationRequestRef.current = cancellationRequest;
  }, [cancellationRequest]);

  useEffect(() => {
    loadingOrdersRef.current = loadingOrders;
  }, [loadingOrders]);

  useEffect(() => {
    checkingSessionRef.current = checkingSession;
  }, [checkingSession]);

  const expireSession = useCallback(() => {
    setLogged(false);
    setSessionState("expired");
    setOrders(asInternalOrders(mockOrders));
    setOrdersSource("mock");
    setOrdersError("Sesión expirada. Vuelve a iniciar sesión.");
    setOrdersNotice(null);
    setSelected(null);
    cancellationRequestRef.current = null;
    setCancellationRequest(null);
    setNewOrderNotice(null);
    setHighlightedOrderIds(new Set());
    orderKeysRef.current = null;
    setLastUpdated(null);
    setLimitWarning(null);
  }, []);

  const isRefreshBlocked = useCallback(
    () =>
      Boolean(
        actionOrderIdRef.current ||
          cancellationRequestRef.current ||
          checkingSessionRef.current ||
          !loggedRef.current,
      ),
    [],
  );

  const registerLoadedOrders = useCallback(
    (mappedOrders: InternalOrder[]) => {
      const nextKeys = new Set(mappedOrders.map(getOrderKey));
      const previousKeys = orderKeysRef.current;
      orderKeysRef.current = nextKeys;

      if (!previousKeys) return;

      const newOrders = mappedOrders.filter(
        (order) => !previousKeys.has(getOrderKey(order)),
      );
      if (!newOrders.length) return;

      const newIds = new Set(newOrders.map((order) => order.id));
      setHighlightedOrderIds((current) => new Set([...current, ...newIds]));
      setNewOrderNotice({
        message:
          newOrders.length === 1
            ? "Entró 1 pedido nuevo"
            : `Entraron ${newOrders.length} pedidos nuevos`,
        orderFolios: newOrders.map((order) => order.folio),
      });
      setOrdersNotice(
        `${newOrders.length === 1 ? "Pedido nuevo" : "Pedidos nuevos"}: ${newOrders
          .map((order) => order.folio)
          .join(", ")}`,
      );
      window.setTimeout(() => {
        setHighlightedOrderIds((current) => {
          const next = new Set(current);
          newIds.forEach((id) => next.delete(id));
          return next;
        });
      }, NEW_ORDER_HIGHLIGHT_MS);
    },
    [],
  );

  const loadLiveOrders = useCallback(
    async (
      includeTerminal = shouldIncludeTerminalOrders(tab, adminView),
      reason: "manual" | "auto" | "session" = "manual",
    ) => {
      const isAutoRefresh = reason === "auto";
      if (isAutoRefresh) {
        const hidden =
          typeof document !== "undefined" &&
          document.visibilityState !== "visible";
        if (hidden || loadingOrdersRef.current || isRefreshBlocked()) return;
      }

      loadingOrdersRef.current = true;
      setLoadingOrders(true);
      setOrdersError(null);
      try {
        const requestedLimit = includeTerminal
          ? LIVE_TERMINAL_ORDERS_LIMIT
          : LIVE_ACTIVE_ORDERS_LIMIT;
        const liveOrders = await fetchOrdersV2Admin({
          includeTerminal,
          limit: requestedLimit,
          environment: orderEnvironment,
        });
        if (isAutoRefresh && isRefreshBlocked()) return;

        const mappedOrders = liveOrders.map(mapOrderV2ToInternalOrder);
        setOrders(mappedOrders);
        setSessionState("active");
        setSelected((current) => {
          if (!current) return current;
          return (
            mappedOrders.find((order) => order.id === current.id) ?? current
          );
        });
        setOrdersSource("d1");
        setLastUpdated(formatOrderRefreshTime(reason));
        setLimitWarning(
          mappedOrders.length >= requestedLimit
            ? includeTerminal
              ? `Mostrando los primeros ${requestedLimit} registros con estados terminales. Si necesitas el corte completo, exporta desde Admin o ajusta filtros en Cierre.`
              : `Mostrando los primeros ${requestedLimit} pedidos activos. En hora pico puede haber más pedidos fuera de esta carga.`
            : null,
        );
        registerLoadedOrders(mappedOrders);
        if (reason !== "auto") {
          setOrdersNotice("Pedidos actualizados");
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudieron cargar pedidos. Actualiza la lista e inténtalo de nuevo.";
        if (/UNAUTHORIZED|401/i.test(message)) {
          expireSession();
          return;
        }
        if (isAutoRefresh) {
          setOrdersError(message);
          return;
        }
        setOrders(asInternalOrders(mockOrders));
        setOrdersSource("fallback");
        setLimitWarning(null);
        setOrdersError(message);
      } finally {
        loadingOrdersRef.current = false;
        setLoadingOrders(false);
      }
    },
    [
      adminView,
      expireSession,
      isRefreshBlocked,
      orderEnvironment,
      registerLoadedOrders,
      tab,
    ],
  );

  const activateInternalSession = useCallback(() => {
    loggedRef.current = true;
    setLogged(true);
    setSessionState("active");
    setOrdersError(null);
    void loadLiveOrders(shouldIncludeTerminalOrders(tab, adminView), "session");
  }, [adminView, loadLiveOrders, tab]);

  useEffect(() => {
    let cancelled = false;
    const checkSession = async () => {
      setCheckingSession(true);
      try {
        const authenticated = await fetchInternalAuthStatus();
        if (cancelled) return;
        setLogged(authenticated);
        setSessionState(authenticated ? "active" : "inactive");
        if (authenticated)
          void loadLiveOrders(shouldIncludeTerminalOrders(tab, adminView));
      } catch {
        if (!cancelled) {
          setLogged(false);
          setSessionState("inactive");
        }
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    };
    void checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (logged && shouldKeepOrdersLoaded(tab, adminView))
      void loadLiveOrders(shouldIncludeTerminalOrders(tab, adminView));
  }, [adminView, logged, tab, loadLiveOrders]);

  useEffect(() => {
    if (!logged || !shouldKeepOrdersLoaded(tab, adminView)) return;

    const refresh = () => {
      void loadLiveOrders(shouldIncludeTerminalOrders(tab, adminView), "auto");
    };
    const interval = window.setInterval(refresh, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [adminView, logged, loadLiveOrders, tab]);

  useEffect(() => {
    if (!newOrderNotice) return;
    const timeout = window.setTimeout(
      () => setNewOrderNotice(null),
      NEW_ORDER_HIGHLIGHT_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [newOrderNotice]);

  const move: MoveOrderStatus = async (id, s, reason) => {
    if (ordersSource !== "d1") {
      setOrders((p) => {
        const next = p.map((o) => {
          if (o.id !== id) return o;
          const timelineEvent: InternalTimelineEvent = {
            id: `local-${Date.now()}`,
            label:
              s === "cancelled"
                ? "Cancelado por operador"
                : `Estado: ${statusLabel[s]}`,
            time: new Date().toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            tone: s === "cancelled" ? "warning" : undefined,
            previousStatus: o.status,
            nextStatus: s,
            reason,
          };
          return { ...o, status: s, timeline: [...o.timeline, timelineEvent] };
        });
        return shouldRetainTerminalOrdersInView(tab, adminView)
          ? next
          : next.filter((o) => !terminalStatuses.has(o.status));
      });
      setSelected((current) => {
        if (current?.id !== id) return current;
        const timelineEvent: InternalTimelineEvent = {
          id: `local-selected-${Date.now()}`,
          label:
            s === "cancelled"
              ? "Cancelado por operador"
              : `Estado: ${statusLabel[s]}`,
          time: new Date().toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          tone: s === "cancelled" ? "warning" : undefined,
          previousStatus: current.status,
          nextStatus: s,
          reason,
        };
        return {
          ...current,
          status: s,
          timeline: [...current.timeline, timelineEvent],
        };
      });
      setOrdersNotice(
        s === "cancelled"
          ? "Cancelación actualizada en esta vista"
          : "Estado actualizado en esta vista",
      );
      return;
    }
    actionOrderIdRef.current = id;
    setActionOrderId(id);
    setOrdersError(null);
    try {
      const updated = await updateOrderV2Status(
        id,
        s,
        orderEnvironment,
        reason ?? `Internal V2 ${tab}`,
      );
      const mapped = mapOrderV2ToInternalOrder(updated);
      setOrders((p) => {
        const next = p.map((o) => (o.id === id ? mapped : o));
        return shouldRetainTerminalOrdersInView(tab, adminView)
          ? next
          : next.filter((o) => !terminalStatuses.has(o.status));
      });
      setSelected((current) => (current?.id === id ? mapped : current));
      setOrdersNotice(
        `${mapped.folio} actualizado a ${statusLabel[mapped.status]}`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el pedido. Revisa la sesión e inténtalo de nuevo.";
      setOrdersError(message);
      if (/UNAUTHORIZED|401/i.test(message)) expireSession();
      throw error instanceof Error ? error : new Error(message);
    } finally {
      actionOrderIdRef.current = null;
      setActionOrderId(null);
    }
  };

  const updatePayment = async (
    id: string,
    paymentStatus: OrderV2PaymentStatus,
    notes?: string,
    reason?: string,
  ) => {
    if (ordersSource !== "d1") {
      setOrders((p) =>
        p.map((o) =>
          o.id === id
            ? {
                ...o,
                paymentState: paymentStatus,
                note: typeof notes === "string" ? notes : o.note,
              }
            : o,
        ),
      );
      setOrdersNotice("Pago actualizado en esta vista");
      return;
    }
    actionOrderIdRef.current = id;
    setActionOrderId(id);
    setOrdersError(null);
    try {
      const updated = await updateOrderV2Payment(id, {
        paymentStatus,
        notes,
        reason,
      }, orderEnvironment);
      const mapped = mapOrderV2ToInternalOrder(updated);
      setOrders((p) => p.map((o) => (o.id === id ? mapped : o)));
      setSelected((current) => (current?.id === id ? mapped : current));
      setOrdersNotice(`${mapped.folio}: estado de pago ${mapped.paymentState}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el pago. Revisa la sesión e inténtalo de nuevo.";
      setOrdersError(message);
      if (/UNAUTHORIZED|401/i.test(message)) expireSession();
      throw error instanceof Error ? error : new Error(message);
    } finally {
      actionOrderIdRef.current = null;
      setActionOrderId(null);
    }
  };

  const requestCancellation = (
    order: InternalOrder,
    origin: "pedidos" | "detalle",
  ) => {
    const nextRequest = { order, origin };
    setOrdersError(null);
    cancellationRequestRef.current = nextRequest;
    setCancellationRequest(nextRequest);
  };

  const confirmCancellation = async (order: InternalOrder, reason: string) => {
    await move(order.id, "cancelled", reason);
  };

  const archiveCancelledOrder = async (order: InternalOrder) => {
    if (ordersSource !== "d1") {
      setOrdersError("Solo puedes ocultar pedidos reales desde Chekeo.");
      return;
    }
    if (order.status !== "cancelled") {
      setOrdersError("Solo se pueden ocultar pedidos cancelados.");
      return;
    }
    const confirmed = window.confirm(
      "Este pedido cancelado dejará de aparecer en historial y métricas. No borra el registro.",
    );
    if (!confirmed) return;

    actionOrderIdRef.current = order.id;
    setActionOrderId(order.id);
    setOrdersError(null);
    try {
      const updated = await archiveCancelledOrderV2(order.id, orderEnvironment);
      setOrders((current) => current.filter((entry) => entry.id !== updated.id));
      setSelected((current) => (current?.id === updated.id ? null : current));
      setOrdersNotice(`${updated.folio}: pedido cancelado oculto del historial`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo ocultar el pedido cancelado.";
      setOrdersError(message);
      if (/UNAUTHORIZED|401/i.test(message)) expireSession();
      throw error instanceof Error ? error : new Error(message);
    } finally {
      actionOrderIdRef.current = null;
      setActionOrderId(null);
    }
  };

  const toggleKitchenItemDone: ToggleKitchenItemDone = async (
    orderId,
    lineKey,
    itemKind,
    done,
  ) => {
    if (ordersSource !== "d1") {
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                items: order.items.map((item, index) =>
                  getKitchenLineKey(order, item, index) === lineKey
                    ? { ...item, kitchenDone: done }
                    : item,
                ),
              }
            : order,
        ),
      );
      setOrdersNotice("Checklist actualizado en esta vista");
      return;
    }

    actionOrderIdRef.current = orderId;
    setActionOrderId(orderId);
    setOrdersError(null);
    try {
      const updated = await updateKitchenItemV2(orderId, {
        lineKey,
        itemKind,
        done,
      }, orderEnvironment);
      const mapped = mapOrderV2ToInternalOrder(updated);
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? mapped : order)),
      );
      setSelected((current) => (current?.id === orderId ? mapped : current));
      setOrdersNotice(
        `${mapped.folio}: ${done ? "item de cocina hecho" : "item de cocina reabierto"}`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el checklist de cocina";
      setOrdersError(message);
      if (/UNAUTHORIZED|401/i.test(message)) expireSession();
      throw error instanceof Error ? error : new Error(message);
    } finally {
      actionOrderIdRef.current = null;
      setActionOrderId(null);
    }
  };

  const runtime: OrdersRuntime = {
    environment: orderEnvironment,
    source: ordersSource,
    loading: loadingOrders,
    actionOrderId,
    error: ordersError,
    notice: ordersNotice,
    highlightedOrderIds,
    sessionActive: logged,
    sessionState,
    onSessionExpired: expireSession,
    reload: (includeTerminal?: boolean) => {
      void loadLiveOrders(Boolean(includeTerminal));
    },
    lastUpdated,
    limitWarning,
  };
  const active = orders.filter((o) => !terminalStatuses.has(o.status));
  const shellTruth = getOperationalTruth({
    runtime,
    runtimeEnvironment,
    activeCount: active.length,
  });
  const openPrimaryTab = useCallback((nextTab: TabKey) => {
    setTab(nextTab);
    if (nextTab !== "admin") setAdminView("launcher");
  }, []);
  const openAdminView = useCallback((nextView: AdminViewKey) => {
    setTab("admin");
    setAdminView(nextView);
  }, []);
  const content = ({
    home: (
      <HomePanel
        orders={orders}
        runtime={runtime}
        runtimeEnvironment={runtimeEnvironment}
        onOpenTab={openPrimaryTab}
        onOpenAdminView={openAdminView}
      />
    ),
    pedidos: (
      <OrdersBoard
        orders={orders}
        setSelected={setSelected}
        runtime={runtime}
        runtimeEnvironment={runtimeEnvironment}
        move={move}
        requestCancellation={requestCancellation}
      />
    ),
    cocina: (
      <KitchenQueue
        orders={orders}
        runtime={runtime}
        onToggleKitchenItem={toggleKitchenItemDone}
        onMove={move}
        onOpenOrder={(order) => setSelected(order as InternalOrder)}
      />
    ),
    pagos: (
      <PaymentNotesPanel
        orders={orders}
        runtime={runtime}
        runtimeEnvironment={runtimeEnvironment}
        onUpdatePayment={updatePayment}
      />
    ),
    admin: (
      <AdminGate
        authMode={authMode}
        sessionActive={runtime.sessionActive}
        onUnlock={activateInternalSession}
      >
        <AdminWorkspace
          view={adminView}
          setView={setAdminView}
          orders={orders}
          runtime={runtime}
          runtimeEnvironment={runtimeEnvironment}
          authMode={authMode}
          onArchiveCancelled={archiveCancelledOrder}
        />
      </AdminGate>
    ),
  })[tab];
  if (useGlobalAuthGate && !logged)
    return (
      <InternalLogin
        authMode={authMode}
        checkingSession={checkingSession}
        runtimeEnvironment={runtimeEnvironment}
        sessionState={sessionState}
        sessionMessage={ordersError}
        onLogin={activateInternalSession}
      />
    );
  return (
    <main className="shell">
      <OperatorHeader
        runtimeEnvironment={runtimeEnvironment}
        truth={shellTruth}
        onLogout={() => {
          void logoutInternal();
          loggedRef.current = false;
          setLogged(false);
          setSessionState("inactive");
          setOrdersSource("mock");
          setOrders(asInternalOrders(mockOrders));
          setOrdersNotice(null);
          setOrdersError(null);
          setSelected(null);
          cancellationRequestRef.current = null;
          setCancellationRequest(null);
          setNewOrderNotice(null);
          setHighlightedOrderIds(new Set());
          orderKeysRef.current = null;
          setLastUpdated(null);
          setLimitWarning(null);
        }}
      />
      <OperationalStatusBar
        truth={shellTruth}
        onPrimaryAction={() => {
          if (runtime.sessionState !== "active") return;
          void runtime.reload(shouldIncludeTerminalOrders(tab, adminView));
        }}
        disabled={runtime.loading || runtime.sessionState !== "active"}
      />
      <NewOrderBanner
        notice={newOrderNotice}
        onDismiss={() => setNewOrderNotice(null)}
      />
      <OperatorTabs
        tab={tab}
        setTab={openPrimaryTab}
        content={
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? {} : { opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="mt-2"
            >
              {content}
            </motion.div>
          </AnimatePresence>
        }
      />
      <OrderDetailModal
        selected={selected}
        onClose={() => setSelected(null)}
        onMove={move}
        onRequestCancellation={requestCancellation}
        actionOrderId={actionOrderId}
      />
      <CancellationReasonDialog
        request={cancellationRequest}
        runtime={runtime}
        onClose={() => {
          cancellationRequestRef.current = null;
          setCancellationRequest(null);
        }}
        onConfirm={confirmCancellation}
      />
    </main>
  );
}
