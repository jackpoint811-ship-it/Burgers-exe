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
  mockOrders,
  operatorStats,
  type MockOrder,
  type OrdersV2SummaryResponse,
  type OrderStatus,
  type OrderV2,
  type OrderV2Event,
  type OrderV2ItemKind,
  type OrderV2PaymentStatus,
  type OrderV2Status,
} from "@config/index";
import { Button, Card, StatusPill } from "@ui/index";
import {
  fetchInternalAuthStatus,
  loginInternal,
  logoutInternal,
} from "../lib/internal-auth";
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
  buildWhatsappUrl,
  normalizeWhatsappPhone,
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

type TabKey =
  | "inicio"
  | "pedidos"
  | "cocina"
  | "pagos"
  | "historial"
  | "cierre"
  | "catalogo"
  | "sorteos";
type OrdersSource = "d1" | "mock" | "fallback";
type OrdersV2Summary = NonNullable<OrdersV2SummaryResponse["data"]>;
type KitchenItemKind = Extract<OrderV2ItemKind, "burger" | "combo" | "garnish">;
type InternalOrderItem = MockOrder["items"][number] & {
  lineTotal?: number;
  lineKey?: string;
  itemDisplayIndex?: number;
  itemKind?: OrderV2ItemKind;
  removedIngredients: string[];
  extras: Array<{ sku?: string; name: string; price?: number }>;
  burgerNote?: string;
  garnish?: { sku?: string; name: string } | null;
  extrasTotalCents?: number;
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
  items: InternalOrderItem[];
  timeline: InternalTimelineEvent[];
  archivedAt?: string;
};

type StatusAction = { status: OrderStatus; label: string; tone?: "danger" };
type NewOrderNotice = {
  message: string;
  orderFolios: string[];
} | null;
type OrdersRuntime = {
  source: OrdersSource;
  loading: boolean;
  actionOrderId: string | null;
  error: string | null;
  notice: string | null;
  highlightedOrderIds: Set<string>;
  sessionActive: boolean;
  onSessionExpired: () => void;
  reload: (includeTerminal?: boolean) => void;
  lastUpdated: string | null;
};

const statusLabel: Record<OrderStatus, string> = {
  new: "Nuevo",
  preparing: "En preparación",
  ready: "Listo",
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
  pending: "Pendiente",
  paid: "Pagado",
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
  kitchenDone: false,
});
const asInternalOrders = (orders: MockOrder[]): InternalOrder[] =>
  orders.map((order) => ({
    ...order,
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
  return { ...(sku ? { sku } : {}), name };
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
    extrasTotalCents: getOptionalNumber(snapshot.extrasTotalCents),
    kitchenDone: lineKey ? (doneByLineKey.get(lineKey) ?? false) : false,
  };
};

const extractKitchenLocation = (notes?: string) => {
  const match = notes?.match(/Ubicación:\s*([^\n|]+)/i);
  return match?.[1]?.trim() || "Sin ubicación";
};

const stripLocationFromNotes = (notes?: string) => {
  if (!notes) return "";
  return notes
    .replace(/Ubicación:\s*[^\n|]+\|?/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const getKitchenItemKind = (item: InternalOrderItem): OrderV2ItemKind => {
  if (item.itemKind) return item.itemKind;
  return item.name.toLowerCase().includes("fries") ? "garnish" : "burger";
};

const isBurgerOrCombo = (item: InternalOrderItem) => {
  const kind = getKitchenItemKind(item);
  return kind === "burger" || kind === "combo";
};

const isStandaloneGarnish = (item: InternalOrderItem) =>
  getKitchenItemKind(item) === "garnish";

const getKitchenLineKey = (
  order: InternalOrder,
  item: InternalOrderItem,
  index: number,
) => item.lineKey ?? `${order.id}-${index}-${item.name}`;

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

const EmptyOrdersState = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => (
  <Card className="p-4 text-center">
    <p className="font-bold text-zinc-100">{title}</p>
    {description ? (
      <p className="mt-1 text-sm text-zinc-400">{description}</p>
    ) : null}
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
}: {
  sessionActive: boolean;
  defaultIncludeTerminal: boolean;
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
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "orders-v2-export.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setSuccess("CSV descargado");
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "No se pudo exportar CSV",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-2">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold text-zinc-100">
            Exportar reporte
          </p>
          <p className="text-[11px] text-zinc-400">
            Descarga pedidos filtrados para revisión administrativa.
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
          Incluir entregados/cancelados
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
          Límite
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
        {exporting ? "Exportando…" : "Exportar CSV"}
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
  includeTerminal = false,
}: {
  runtime: OrdersRuntime;
  includeTerminal?: boolean;
}) => (
  <Card className="mb-2.5 p-3">
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
          Sesión activa
        </p>
        <p className="text-[11px] text-zinc-400">Órdenes</p>
      </div>
      <div className="flex flex-col gap-2 md:flex-row">
        {runtime.lastUpdated ? (
          <span className="self-center text-[11px] text-zinc-500">
            Última actualización: {runtime.lastUpdated}
          </span>
        ) : null}
        <Button
          className="border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs disabled:opacity-40"
          onClick={() => runtime.reload(includeTerminal)}
          disabled={runtime.loading || !runtime.sessionActive}
        >
          {runtime.loading ? "Cargando…" : "Recargar órdenes"}
        </Button>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="chip">Sesión activa</span>
      <span className="chip">Órdenes</span>
    </div>
    <OrdersExportControls
      sessionActive={runtime.sessionActive}
      defaultIncludeTerminal={includeTerminal}
    />
    {runtime.error ? (
      <p className="mt-2 rounded bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
        {runtime.error}
      </p>
    ) : null}
    {runtime.notice ? (
      <p className="mt-2 rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
        {runtime.notice}
      </p>
    ) : null}
  </Card>
);

const InternalLogin = ({
  onLogin,
  checkingSession,
}: {
  onLogin: () => void;
  checkingSession: boolean;
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
      onLogin();
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
    <main className="shell flex items-center justify-center py-8">
      <section className="login card w-full max-w-md border-cyan-400/20 bg-zinc-950/95 p-5 shadow-cyan-950/30">
        <div className="mb-6 text-center">
          <p className="text-2xl font-black tracking-tight text-zinc-50">
            Burgers<span className="text-cyan-300">.exe</span>
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.35em] text-cyan-200">
            Chekeo
          </p>
        </div>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm font-bold text-zinc-100" htmlFor="pin">
            PIN de acceso
            <input
              id="pin"
              type="password"
              className="input mt-2 min-h-12 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
              placeholder="••••"
              value={pin}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              pattern="[0-9]{4}"
              aria-describedby={error ? "pin-error" : undefined}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
                setError(null);
              }}
              autoFocus
              disabled={loading || checkingSession}
            />
          </label>
          {error ? (
            <p
              id="pin-error"
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"
            >
              {error}
            </p>
          ) : null}
          <Button
            className="w-full bg-cyan-400 py-3 text-base font-black text-black disabled:opacity-50"
            disabled={loading || checkingSession}
          >
            {loading || checkingSession ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </section>
    </main>
  );
};
const OperatorHeader = ({
  active,
  onLogout,
  source,
}: {
  active: number;
  onLogout: () => void;
  source: OrdersSource;
}) => (
  <header className="card header-compact">
    <div>
      <h1 className="text-sm font-bold md:text-base">
        Chekeo Burgers.exe
      </h1>
      <p className="text-[11px] text-zinc-400">
        Activos {active} · {source === "d1" ? "Live" : "Vista local"} ·{" "}
        {new Date().toLocaleTimeString()}
      </p>
    </div>
    <Button
      className="border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px]"
      onClick={onLogout}
    >
      Cerrar sesión
    </Button>
  </header>
);
const DashboardHome = ({
  orders,
  source,
}: {
  orders: InternalOrder[];
  source: OrdersSource;
}) => {
  const active = orders.filter((o) => !terminalStatuses.has(o.status)).length;
  const pending = orders.filter((o) => o.status === "new").length;
  return (
    <section className="grid gap-2.5 md:grid-cols-3">
      <Card className="p-2.5">
        <p className="muted">Órdenes activas</p>
        <p className="text-xl font-black">
          {source === "d1" ? active : operatorStats.activeOrders}
        </p>
      </Card>
      <Card className="p-2.5">
        <p className="muted">Pendientes</p>
        <p className="text-xl font-black">
          {source === "d1" ? pending : operatorStats.pendingOrders}
        </p>
      </Card>
      <Card className="p-2.5">
        <p className="muted">Carga cocina</p>
        <p className="text-xl font-black">{operatorStats.kitchenLoad}%</p>
      </Card>
      <Card className="md:col-span-2 p-2.5">
        <h3 className="mb-2 font-bold">Urgentes ahora</h3>
        {orders
          .filter((o) => o.priority === "urgent" || o.status === "new")
          .slice(0, 4)
          .map((o) => (
            <div key={o.id} className="row">
              {o.folio} · {o.customer} · {o.createdAt}
            </div>
          ))}
      </Card>
      <Card className="p-2.5">
        <h3 className="font-bold">Estado del turno</h3>
        <p className="muted">
          {source === "d1"
            ? "Órdenes"
            : "Vista operativa local"}
        </p>
      </Card>
    </section>
  );
};

const getPedidoActions = (status: OrderStatus): StatusAction[] =>
  terminalStatuses.has(status)
    ? []
    : [
        {
          status:
            status === "new"
              ? "preparing"
              : status === "preparing"
                ? "ready"
                : "delivered",
          label:
            status === "new"
              ? "Iniciar preparación"
              : status === "preparing"
                ? "Marcar listo"
                : "Entregar",
        },
        { status: "cancelled", label: "Cancelar", tone: "danger" },
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
    <div className="flex flex-wrap gap-1">
      {actions.map((action) => {
        const isCancellation = action.status === "cancelled";
        return (
          <button
            key={action.status}
            className={`btn-sm ${action.tone === "danger" ? "danger" : ""}`}
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
          {generatingTicket ? "Generando…" : "Descargar ticket PNG"}
        </Button>
        <Button
          className="border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px]"
          onClick={() => void copySummary()}
        >
          Copiar resumen
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
const CompactRow = ({
  order,
  onOpen,
}: {
  order: InternalOrder;
  onOpen: () => void;
}) => (
  <Card className="p-2.5">
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-sm font-bold">
          {order.folio} · {order.customer}
        </p>
        <p className="text-[11px] text-zinc-400">
          {order.createdAt} · {order.channel} · {order.paymentMethod}/
          {order.paymentState}
        </p>
        {order.customerPhone ? (
          <p className="text-[11px] text-zinc-500">
            Tel: {order.customerPhone}
          </p>
        ) : null}
      </div>
      <StatusBadge status={order.status} />
    </div>
    {order.note ? (
      <p className="mt-1.5 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
        Nota crítica: {order.note}
      </p>
    ) : null}
    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
      <Button
        className="border border-zinc-700 bg-zinc-900 py-1 text-[11px]"
        onClick={onOpen}
      >
        Abrir ticket
      </Button>
    </div>
    <WhatsappOrderActions order={order} />
  </Card>
);

const OrdersBoard = ({
  orders,
  setSelected,
  runtime,
  move,
  requestCancellation,
}: {
  orders: InternalOrder[];
  setSelected: (o: InternalOrder) => void;
  runtime: OrdersRuntime;
  move: MoveOrderStatus;
  requestCancellation: (
    order: InternalOrder,
    origin: "pedidos" | "detalle",
  ) => void;
}) => (
  <section>
    <SourcePanel runtime={runtime} />
    {runtime.source === "d1" && orders.length === 0 ? (
      <EmptyOrdersState
        title="No hay pedidos activos."
        description="Cuando entre un pedido nuevo, aparecerá aquí."
      />
    ) : null}
    <div className="grid gap-2">
      {orders.map((o) => {
        const highlighted = runtime.highlightedOrderIds.has(o.id);
        return (
          <Card
            key={o.id}
            className={`p-3 transition-colors ${highlighted ? "border-cyan-300/70 bg-cyan-400/10 shadow-lg shadow-cyan-950/30" : ""}`}
          >
            <CompactRow order={o} onOpen={() => setSelected(o)} />
            <div className="mt-2 grid gap-1 text-xs text-zinc-300 md:grid-cols-2">
              <span>Modo entrega: {o.channel}</span>
              <span>Método de pago: {o.paymentMethod}</span>
              <span>Estado de pago: {o.paymentState}</span>
              <span>Total: {formatCurrency(o.total)}</span>
              <span>Origen: {o.source === "d1" ? "Operativo" : "Local"}</span>
              <span>Creado: {o.createdAt}</span>
            </div>
            <OrderItems order={o} />
            <div className="mt-2">
              <ActionButtons
                order={o}
                actions={getPedidoActions(o.status)}
                onMove={move}
                onCancel={(order) => requestCancellation(order, "pedidos")}
                actionOrderId={runtime.actionOrderId}
              />
            </div>
          </Card>
        );
      })}
    </div>
  </section>
);

const KitchenItemModifiers = ({ item }: { item: InternalOrderItem }) => (
  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
    <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-200">
        MOD
      </p>
      {item.removedIngredients.length ? (
        <ul className="mt-2 space-y-1 text-base font-bold text-zinc-100">
          {item.removedIngredients.map((ingredient) => (
            <li key={ingredient}>- {ingredient}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs font-semibold text-zinc-500">Sin MOD</p>
      )}
    </div>
    <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-200">
        UPGRADE
      </p>
      {item.extras.length ? (
        <ul className="mt-2 space-y-1 text-base font-bold text-zinc-100">
          {item.extras.map((extra) => (
            <li key={`${extra.sku ?? extra.name}-${extra.name}`}>
              - {extra.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs font-semibold text-zinc-500">Sin UPGRADE</p>
      )}
    </div>
  </div>
);

const KitchenBurgerCard = ({
  order,
  item,
  itemIndex,
  open,
  busy,
  onToggleOpen,
  onDoneChange,
}: {
  order: InternalOrder;
  item: InternalOrderItem;
  itemIndex: number;
  open: boolean;
  busy: boolean;
  onToggleOpen: () => void;
  onDoneChange: (done: boolean) => void;
}) => {
  const done = Boolean(item.kitchenDone);
  const kind = getKitchenItemKind(item) as KitchenItemKind;
  const titleNumber = item.itemDisplayIndex ?? itemIndex + 1;
  return (
    <article
      className={`rounded-2xl border p-3 transition ${
        done
          ? "border-emerald-400/40 bg-emerald-500/10"
          : "border-zinc-700 bg-zinc-950/80"
      }`}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={onToggleOpen}
      >
        <div>
          <p className="text-xl font-black text-zinc-50">
            {item.name} #{titleNumber}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
            {kind === "combo" ? "Combo" : "Burger"} ·{" "}
            {done ? "Hecha" : "Pendiente"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${done ? "bg-emerald-300 text-emerald-950" : "bg-amber-300 text-amber-950"}`}
        >
          {done ? "LISTA" : open ? "ABIERTO" : "TOCAR"}
        </span>
      </button>
      {open ? (
        <div className="mt-3">
          {kind === "combo" && item.garnish ? (
            <p className="mb-3 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300">
              Guarnición incluida: {item.garnish.name}
            </p>
          ) : null}
          <KitchenItemModifiers item={item} />
          {item.burgerNote ? (
            <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-rose-200">
                Nota
              </p>
              <p className="mt-1 text-base font-bold text-rose-50">
                - {item.burgerNote}
              </p>
            </div>
          ) : null}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {done ? (
              <Button
                className="w-full border border-zinc-700 bg-zinc-900 py-3 text-base font-black text-zinc-100 disabled:opacity-50"
                disabled={busy}
                onClick={() => onDoneChange(false)}
              >
                Reabrir
              </Button>
            ) : (
              <Button
                className="w-full bg-emerald-400 py-4 text-lg font-black text-emerald-950 disabled:opacity-50"
                disabled={busy || !item.lineKey}
                onClick={() => onDoneChange(true)}
              >
                Burger hecha
              </Button>
            )}
          </div>
          {!item.lineKey ? (
            <p className="mt-2 text-xs text-amber-200">
              Sin lineKey en snapshot; no se puede persistir en D1.
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};

const KitchenOrderShell = ({
  order,
  children,
  highlighted = false,
}: {
  order: InternalOrder;
  children: ReactNode;
  highlighted?: boolean;
}) => {
  const generalNote = stripLocationFromNotes(order.note);
  return (
    <Card
      className={`overflow-hidden border-zinc-700 bg-zinc-950/70 p-0 transition-colors ${highlighted ? "border-cyan-300/70 bg-cyan-400/10 shadow-lg shadow-cyan-950/30" : ""}`}
    >
      <div className="border-b border-zinc-800 bg-zinc-900/80 p-4">
        <p className="text-3xl font-black text-zinc-50">{order.folio}</p>
        <p className="mt-1 text-xl font-extrabold text-zinc-100">
          {order.customer}
        </p>
        <p className="mt-2 inline-flex rounded-full bg-cyan-300 px-3 py-1 text-sm font-black text-cyan-950">
          {extractKitchenLocation(order.note)}
        </p>
        {generalNote ? (
          <p className="mt-3 rounded-xl bg-amber-400/10 px-3 py-2 text-sm font-bold text-amber-100">
            Nota general: {generalNote}
          </p>
        ) : null}
      </div>
      <div className="space-y-3 p-3">{children}</div>
    </Card>
  );
};

const KitchenBurgerOrder = ({
  order,
  items,
  busyLineKey,
  highlighted = false,
  onToggleKitchenItem,
}: {
  order: InternalOrder;
  items: InternalOrderItem[];
  busyLineKey: string | null;
  highlighted?: boolean;
  onToggleKitchenItem: ToggleKitchenItemDone;
}) => {
  const pendingIndex = items.findIndex((item) => !item.kitchenDone);
  const defaultOpenKey =
    pendingIndex >= 0
      ? getKitchenLineKey(order, items[pendingIndex], pendingIndex)
      : "";
  const [openLineKey, setOpenLineKey] = useState(defaultOpenKey);

  useEffect(() => {
    setOpenLineKey(defaultOpenKey);
  }, [defaultOpenKey]);

  const allDone = items.every((item) => item.kitchenDone);
  return (
    <KitchenOrderShell order={order} highlighted={highlighted}>
      {allDone ? (
        <p className="rounded-xl bg-emerald-400/10 px-3 py-2 text-center text-sm font-black text-emerald-200">
          Burgers listas
        </p>
      ) : null}
      {items.map((item, index) => {
        const lineKey = getKitchenLineKey(order, item, index);
        const kind = getKitchenItemKind(item) as KitchenItemKind;
        return (
          <KitchenBurgerCard
            key={lineKey}
            order={order}
            item={item}
            itemIndex={index}
            open={openLineKey === lineKey}
            busy={busyLineKey === lineKey}
            onToggleOpen={() =>
              setOpenLineKey((current) => (current === lineKey ? "" : lineKey))
            }
            onDoneChange={(done) => {
              if (!item.lineKey) return;
              void onToggleKitchenItem(order.id, item.lineKey, kind, done);
            }}
          />
        );
      })}
    </KitchenOrderShell>
  );
};

const SideQuestItemCard = ({
  order,
  item,
  itemIndex,
  busy,
  onToggleKitchenItem,
}: {
  order: InternalOrder;
  item: InternalOrderItem;
  itemIndex: number;
  busy: boolean;
  onToggleKitchenItem: ToggleKitchenItemDone;
}) => {
  const done = Boolean(item.kitchenDone);
  return (
    <div
      className={`rounded-2xl border p-3 ${done ? "border-emerald-400/40 bg-emerald-500/10" : "border-zinc-700 bg-zinc-950/80"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xl font-black text-zinc-50">
            {item.name} #{item.itemDisplayIndex ?? itemIndex + 1}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
            Side Quest · {done ? "Hecha" : "Pendiente"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${done ? "bg-emerald-300 text-emerald-950" : "bg-amber-300 text-amber-950"}`}
        >
          {done ? "LISTA" : "PENDIENTE"}
        </span>
      </div>
      <Button
        className={`mt-4 w-full py-3 text-base font-black disabled:opacity-50 ${done ? "border border-zinc-700 bg-zinc-900 text-zinc-100" : "bg-emerald-400 text-emerald-950"}`}
        disabled={busy || !item.lineKey}
        onClick={() => {
          if (!item.lineKey) return;
          void onToggleKitchenItem(order.id, item.lineKey, "garnish", !done);
        }}
      >
        {done ? "Reabrir" : "Guarnición hecha"}
      </Button>
    </div>
  );
};

const KitchenQueue = ({
  orders,
  runtime,
  onToggleKitchenItem,
}: {
  orders: InternalOrder[];
  runtime: OrdersRuntime;
  onToggleKitchenItem: ToggleKitchenItemDone;
}) => {
  const [mode, setMode] = useState<"burgers" | "sidequest">("burgers");
  const [busyLineKey, setBusyLineKey] = useState<string | null>(null);
  const activeOrders = orders.filter((o) => !terminalStatuses.has(o.status));
  const fallback = runtime.source !== "d1";

  const withBurgerItems = activeOrders
    .map((order) => ({ order, items: order.items.filter(isBurgerOrCombo) }))
    .filter(({ items }) => items.length > 0);
  const pendingBurgerOrders = withBurgerItems.filter(
    ({ order, items }) =>
      order.status !== "ready" && items.some((item) => !item.kitchenDone),
  );
  const doneBurgerOrders = withBurgerItems.filter(({ items }) =>
    items.every((item) => item.kitchenDone),
  );

  const withGarnishItems = activeOrders
    .map((order) => ({ order, items: order.items.filter(isStandaloneGarnish) }))
    .filter(({ items }) => items.length > 0);
  const pendingGarnishOrders = withGarnishItems
    .map(({ order, items }) => ({
      order,
      items: items.filter((item) => !item.kitchenDone),
    }))
    .filter(({ order, items }) => order.status !== "ready" && items.length > 0);
  const doneGarnishOrders = withGarnishItems
    .map(({ order, items }) => ({
      order,
      items: items.filter((item) => item.kitchenDone),
    }))
    .filter(({ items }) => items.length > 0);

  const toggleKitchenItem: ToggleKitchenItemDone = async (
    orderId,
    lineKey,
    itemKind,
    done,
  ) => {
    setBusyLineKey(lineKey);
    try {
      await onToggleKitchenItem(orderId, lineKey, itemKind, done);
    } finally {
      setBusyLineKey(null);
    }
  };

  return (
    <section className="space-y-3">
      {fallback ? (
        <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100">
          Fallback visual: estados de cocina no se guardan en D1.
        </p>
      ) : null}
      {runtime.error ? (
        <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100">
          {runtime.error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-2">
        <Button
          className={`py-3 text-base font-black ${mode === "burgers" ? "bg-cyan-300 text-cyan-950" : "bg-zinc-900 text-zinc-300"}`}
          onClick={() => setMode("burgers")}
        >
          Burgers
        </Button>
        <Button
          className={`py-3 text-base font-black ${mode === "sidequest" ? "bg-cyan-300 text-cyan-950" : "bg-zinc-900 text-zinc-300"}`}
          onClick={() => setMode("sidequest")}
        >
          Side Quest
        </Button>
      </div>

      {mode === "burgers" ? (
        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-sm font-black uppercase tracking-[0.2em] text-amber-200">
              Pendientes · {pendingBurgerOrders.length}
            </h3>
            <div className="space-y-3">
              {pendingBurgerOrders.length ? (
                pendingBurgerOrders.map(({ order, items }) => (
                  <KitchenBurgerOrder
                    key={order.id}
                    order={order}
                    items={items}
                    busyLineKey={busyLineKey}
                    highlighted={runtime.highlightedOrderIds.has(order.id)}
                    onToggleKitchenItem={toggleKitchenItem}
                  />
                ))
              ) : (
                <EmptyOrdersState title="Sin burgers pendientes." />
              )}
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-black uppercase tracking-[0.2em] text-emerald-200">
              Hechas · {doneBurgerOrders.length}
            </h3>
            <div className="space-y-3">
              {doneBurgerOrders.map(({ order, items }) => (
                <KitchenBurgerOrder
                  key={`done-${order.id}`}
                  order={order}
                  items={items}
                  busyLineKey={busyLineKey}
                  highlighted={runtime.highlightedOrderIds.has(order.id)}
                  onToggleKitchenItem={toggleKitchenItem}
                />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-sm font-black uppercase tracking-[0.2em] text-amber-200">
              Pendientes ·{" "}
              {pendingGarnishOrders.reduce(
                (acc, entry) => acc + entry.items.length,
                0,
              )}
            </h3>
            <div className="space-y-3">
              {pendingGarnishOrders.length ? (
                pendingGarnishOrders.map(({ order, items }) => (
                  <KitchenOrderShell
                    key={order.id}
                    order={order}
                    highlighted={runtime.highlightedOrderIds.has(order.id)}
                  >
                    {items.map((item, index) => (
                      <SideQuestItemCard
                        key={getKitchenLineKey(order, item, index)}
                        order={order}
                        item={item}
                        itemIndex={index}
                        busy={
                          busyLineKey === getKitchenLineKey(order, item, index)
                        }
                        onToggleKitchenItem={toggleKitchenItem}
                      />
                    ))}
                  </KitchenOrderShell>
                ))
              ) : (
                <EmptyOrdersState title="Sin Side Quest pendiente." />
              )}
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-black uppercase tracking-[0.2em] text-emerald-200">
              Hechas ·{" "}
              {doneGarnishOrders.reduce(
                (acc, entry) => acc + entry.items.length,
                0,
              )}
            </h3>
            <div className="space-y-3">
              {doneGarnishOrders.map(({ order, items }) => (
                <KitchenOrderShell
                  key={`done-garnish-${order.id}`}
                  order={order}
                  highlighted={runtime.highlightedOrderIds.has(order.id)}
                >
                  {items.map((item, index) => (
                    <SideQuestItemCard
                      key={getKitchenLineKey(order, item, index)}
                      order={order}
                      item={item}
                      itemIndex={index}
                      busy={
                        busyLineKey === getKitchenLineKey(order, item, index)
                      }
                      onToggleKitchenItem={toggleKitchenItem}
                    />
                  ))}
                </KitchenOrderShell>
              ))}
            </div>
          </section>
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

const OperationalClosePanel = ({ sessionActive }: { sessionActive: boolean }) => {
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
  }, [from, includeTerminal, sessionActive, to]);

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
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `orders-v2-cierre-${from || "all"}-${to || "all"}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setNotice("CSV del rango descargado");
    } catch (csvError) {
      setError(
        csvError instanceof Error
          ? csvError.message
          : "No se pudo exportar CSV del rango",
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
            {exporting ? "Exportando…" : "Exportar CSV del rango"}
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
            Rango UTC: {summary.range.fromUtc || "inicio"} →{" "}
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
              <h3 className="mb-2 font-bold">Por status</h3>
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
                  label="Nuevo → listo"
                  value={formatDuration(summary.durations.newToReadyAvgSeconds)}
                />
                <CloseMetricCard
                  label="Nuevo → entregado"
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

type PaymentFilter = "all" | OrderV2PaymentStatus;
type PaymentPanelNotice = { tone: "success" | "error"; message: string };

const paymentFilters: Array<{ value: PaymentFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "paid", label: "Pagados" },
  { value: "cancelled", label: "Cancelados" },
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

const PaymentNotesPanel = ({
  orders,
  runtime,
  onUpdatePayment,
}: {
  orders: InternalOrder[];
  runtime: OrdersRuntime;
  onUpdatePayment: (
    orderId: string,
    paymentStatus: OrderV2PaymentStatus,
    notes?: string,
    reason?: string,
  ) => Promise<void>;
}) => {
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [inlineNotice, setInlineNotice] = useState<
    Record<string, PaymentPanelNotice>
  >({});

  useEffect(() => {
    setDraftNotes((current) => {
      const next: Record<string, string> = {};
      orders.forEach((order) => {
        next[order.id] = current[order.id] ?? order.note ?? "";
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

  const filteredOrders = orders.filter(
    (order) => filter === "all" || order.paymentState === filter,
  );
  const paymentOrders =
    runtime.source === "d1"
      ? filteredOrders
      : filteredOrders.filter(
          (order) => order.paymentState === "pending" || order.note,
        );

  const runPaymentAction = async (
    order: InternalOrder,
    paymentStatus: OrderV2PaymentStatus,
    notes?: string,
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
        `Control de pagos: ${paymentStatus}`,
      );
      setInlineNotice((current) => ({
        ...current,
        [order.id]: {
          tone: "success",
          message: `${order.folio}: estado de pago actualizado.`,
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
              : "No se pudo actualizar el pago operativo",
        },
      }));
    }
  };

  return (
    <section className="space-y-2.5">
      <SourcePanel runtime={runtime} includeTerminal />
      <Card className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
              Control de pagos
            </p>
            <h3 className="text-lg font-black">Pagos y notas</h3>
            <p className="text-sm text-zinc-400">
              No se realiza ningún cobro en línea. Estado de pago declarado por
              operador.
            </p>
          </div>
          <Button
            className="border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs disabled:opacity-40"
            onClick={() => runtime.reload(true)}
            disabled={runtime.loading || !runtime.sessionActive}
          >
            {runtime.loading ? "Cargando…" : "Recargar órdenes"}
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 min-[360px]:grid-cols-4">
          {paymentFilters.map((option) => (
            <button
              key={option.value}
              className={`rounded-full border px-3 py-2 text-xs font-semibold ${filter === option.value ? "border-cyan-300 bg-cyan-300 text-black" : "border-zinc-700 bg-zinc-900 text-zinc-200"}`}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {!runtime.sessionActive ? (
          <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
            Inicia sesión para declarar pagos.
          </p>
        ) : null}
      </Card>
      {runtime.source === "d1" && paymentOrders.length === 0 ? (
        <EmptyOrdersState
          title="Sin órdenes para este filtro."
          description="Usa Recargar órdenes o cambia el filtro de estado de pago."
        />
      ) : null}
      <div className="grid gap-2">
        {paymentOrders.map((order) => {
          const busy = runtime.actionOrderId === order.id;
          const draft = draftNotes[order.id] ?? order.note ?? "";
          const notice = inlineNotice[order.id];
          return (
            <Card key={order.id} className="p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-sm font-bold">
                    {order.folio} · {order.customer}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {order.createdAt} · {order.channel} ·{" "}
                    {order.source === "d1" ? "Operativo" : "Local"}
                  </p>
                  {order.customerPhone ? (
                    <p className="text-[11px] text-zinc-500">
                      Tel: {order.customerPhone}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1 sm:justify-end">
                  <PaymentStatusBadge status={order.paymentState} />
                  <StatusBadge status={order.status} />
                </div>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-zinc-300 sm:grid-cols-2">
                <span>
                  Total: <strong>{formatCurrency(order.total)}</strong>
                </span>
                <span>Método de pago: {order.paymentMethod}</span>
                <span>Estado de pago: {order.paymentState}</span>
                <span>Estado del pedido: {statusLabel[order.status]}</span>
              </div>
              <OrderItems order={order} />
              <WhatsappOrderActions order={order} template="received" showHint />
              <label className="mt-2 block text-[11px] text-zinc-400">
                Notas operativas
                <textarea
                  className="input mt-1 min-h-20 text-xs"
                  maxLength={500}
                  value={draft}
                  onChange={(event) =>
                    setDraftNotes((current) => ({
                      ...current,
                      [order.id]: event.target.value,
                    }))
                  }
                  placeholder="Sin nota operativa"
                />
              </label>
              <p className="mt-1 text-[11px] text-amber-200">
                Editar notas puede reemplazar la nota operativa actual.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Button
                  className="border border-emerald-700 bg-emerald-950/50 px-3 py-1.5 text-xs text-emerald-100 disabled:opacity-40"
                  onClick={() => void runPaymentAction(order, "paid")}
                  disabled={busy || !runtime.sessionActive}
                >
                  {busy ? "Actualizando…" : "Marcar pagado"}
                </Button>
                <Button
                  className="border border-amber-700 bg-amber-950/50 px-3 py-1.5 text-xs text-amber-100 disabled:opacity-40"
                  onClick={() => void runPaymentAction(order, "pending")}
                  disabled={busy || !runtime.sessionActive}
                >
                  {busy ? "Actualizando…" : "Marcar pendiente"}
                </Button>
                <Button
                  className="border border-rose-700 bg-rose-950/50 px-3 py-1.5 text-xs text-rose-100 disabled:opacity-40"
                  onClick={() => void runPaymentAction(order, "cancelled")}
                  disabled={busy || !runtime.sessionActive}
                >
                  {busy ? "Actualizando…" : "Marcar pago cancelado"}
                </Button>
                <Button
                  className="border border-cyan-700 bg-cyan-950/50 px-3 py-1.5 text-xs text-cyan-100 disabled:opacity-40"
                  onClick={() =>
                    void runPaymentAction(
                      order,
                      isOrderV2PaymentStatus(order.paymentState)
                        ? order.paymentState
                        : "pending",
                      draft,
                    )
                  }
                  disabled={busy || !runtime.sessionActive}
                >
                  {busy ? "Guardando…" : "Guardar nota"}
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
    </section>
  );
};
const HistoryPanel = ({
  orders,
  runtime,
  onArchiveCancelled,
}: {
  orders: InternalOrder[];
  runtime: OrdersRuntime;
  onArchiveCancelled: (order: InternalOrder) => Promise<void>;
}) => {
  const terminalOrders = orders.filter((o) => terminalStatuses.has(o.status));
  return (
    <section>
      <SourcePanel runtime={runtime} includeTerminal />
      <Card className="p-3">
        <h3 className="mb-2">
          Historial {runtime.source === "d1" ? "Live" : "local"}
        </h3>
        {runtime.source === "d1" && terminalOrders.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Aún no hay historial de órdenes terminales.
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
                      {runtime.actionOrderId === o.id ? "Ocultando…" : "Ocultar"}
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
        className="modal max-h-[calc(100vh-1rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="order-title" className="text-lg font-black">
              {selected.folio}
            </h2>
            <p className="text-xs text-zinc-400">
              {selected.customer} · {selected.createdAt} · {selected.channel}
            </p>
            {selected.customerPhone ? (
              <p className="text-xs text-zinc-500">
                Tel:{" "}
                <a
                  className="text-cyan-200 underline-offset-2 hover:underline"
                  href={`tel:${selected.customerPhone}`}
                >
                  {selected.customerPhone}
                </a>
              </p>
            ) : null}
          </div>
          <StatusBadge status={selected.status} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <p>
            Pago: {selected.paymentMethod}/{selected.paymentState}
          </p>
          <p>Total: {formatCurrency(selected.total)}</p>
          <p>Origen: {selected.source === "d1" ? "Operativo" : "Local"}</p>
          <p>Estación: {selected.kitchenStation}</p>
        </div>
        <OrderItems order={selected} />
        {selected.note ? (
          <p className="mt-2 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
            Notas: {selected.note}
          </p>
        ) : null}
        <p className="mt-2 text-right text-sm font-bold">
          Total: {formatCurrency(selected.total)}
        </p>
        <div className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-2">
          <label className="text-[11px] font-semibold text-cyan-100">
            Template WhatsApp manual
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
        </div>
        <div className="mt-3 space-y-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-xs text-zinc-300">
          {selected.timeline.map((t) => (
            <div key={t.id}>
              <p>
                {t.time} · {t.label}
                {t.actor ? ` · ${t.actor}` : ""}
              </p>
              {t.previousStatus || t.nextStatus ? (
                <p className="text-zinc-500">
                  {t.previousStatus ? statusLabel[t.previousStatus] : "—"} →{" "}
                  {t.nextStatus ? statusLabel[t.nextStatus] : "—"}
                </p>
              ) : null}
              {t.reason ? (
                <p className="text-amber-200">Razón: {t.reason}</p>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {canAdvance
            ? detailActions.map((action) => (
                <Button
                  key={action.status}
                  onClick={() => void runAction(action.status)}
                  className="flex-1 border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs disabled:opacity-40"
                  disabled={busy}
                >
                  {busy ? "Actualizando…" : action.label}
                </Button>
              ))
            : null}
          {canCancel ? (
            <Button
              onClick={() => onRequestCancellation(selected, "detalle")}
              className="flex-1 border border-rose-700 bg-rose-950/50 px-3 py-1.5 text-xs text-rose-200 disabled:opacity-40"
              disabled={busy}
            >
              {busy ? "Cancelando…" : "Cancelar"}
            </Button>
          ) : null}
        </div>
        <Button
          className="mt-2 w-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs"
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
  <Tabs.Root value={tab} onValueChange={(v) => setTab(v as TabKey)}>
    <Tabs.List className="tabs">
      {[
        ["inicio", "Inicio"],
        ["pedidos", "Pedidos"],
        ["cocina", "Cocina"],
        ["pagos", "Pagos"],
        ["historial", "Historial"],
        ["cierre", "Cierre"],
        ["catalogo", "Catálogo"],
        ["sorteos", "Sorteos"],
      ].map(([k, l]) => (
        <Tabs.Trigger key={k} value={k} className="tab">
          {l}
        </Tabs.Trigger>
      ))}
    </Tabs.List>
    {content}
  </Tabs.Root>
);

export function InternalChekeoApp() {
  const [logged, setLogged] = useState(false);
  const [tab, setTab] = useState<TabKey>("inicio");
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
    setOrders(asInternalOrders(mockOrders));
    setOrdersSource("mock");
    setOrdersError("Sesión expirada. Vuelve a iniciar sesión.");
    setSelected(null);
    cancellationRequestRef.current = null;
    setCancellationRequest(null);
    setNewOrderNotice(null);
    setHighlightedOrderIds(new Set());
    orderKeysRef.current = null;
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
            ? "Entró 1 orden nueva"
            : `Entraron ${newOrders.length} órdenes nuevas`,
        orderFolios: newOrders.map((order) => order.folio),
      });
      setOrdersNotice(
        `${newOrders.length === 1 ? "Nueva orden" : "Nuevas órdenes"}: ${newOrders
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
      includeTerminal = tab === "historial" || tab === "pagos",
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
        const liveOrders = await fetchOrdersV2Admin({
          includeTerminal,
          limit: includeTerminal ? 50 : 25,
        });
        if (isAutoRefresh && isRefreshBlocked()) return;

        const mappedOrders = liveOrders.map(mapOrderV2ToInternalOrder);
        setOrders(mappedOrders);
        setSelected((current) => {
          if (!current) return current;
          return (
            mappedOrders.find((order) => order.id === current.id) ?? current
          );
        });
        setOrdersSource("d1");
        setLastUpdated(formatOrderRefreshTime(reason));
        registerLoadedOrders(mappedOrders);
        if (reason !== "auto") {
          setOrdersNotice("Órdenes actualizadas");
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudieron cargar órdenes";
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
        setOrdersError(message);
      } finally {
        loadingOrdersRef.current = false;
        setLoadingOrders(false);
      }
    },
    [expireSession, isRefreshBlocked, registerLoadedOrders, tab],
  );

  useEffect(() => {
    let cancelled = false;
    const checkSession = async () => {
      setCheckingSession(true);
      try {
        const authenticated = await fetchInternalAuthStatus();
        if (cancelled) return;
        setLogged(authenticated);
        if (authenticated)
          void loadLiveOrders(tab === "historial" || tab === "pagos");
      } catch {
        if (!cancelled) setLogged(false);
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
    if (logged && tab !== "catalogo" && tab !== "cierre")
      void loadLiveOrders(tab === "historial" || tab === "pagos");
  }, [logged, tab, loadLiveOrders]);

  useEffect(() => {
    if (!logged || tab === "catalogo" || tab === "cierre") return;

    const refresh = () => {
      void loadLiveOrders(tab === "historial" || tab === "pagos", "auto");
    };
    const interval = window.setInterval(refresh, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [logged, loadLiveOrders, tab]);

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
        return tab === "historial"
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
          ? "Cancelación actualizada localmente"
          : "Estado actualizado localmente",
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
        reason ?? `Internal V2 ${tab}`,
      );
      const mapped = mapOrderV2ToInternalOrder(updated);
      setOrders((p) => {
        const next = p.map((o) => (o.id === id ? mapped : o));
        return tab === "historial"
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
          : "No se pudo actualizar el estado live";
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
      setOrdersNotice("Pago operativo actualizado localmente");
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
      });
      const mapped = mapOrderV2ToInternalOrder(updated);
      setOrders((p) => p.map((o) => (o.id === id ? mapped : o)));
      setSelected((current) => (current?.id === id ? mapped : current));
      setOrdersNotice(`${mapped.folio}: estado de pago ${mapped.paymentState}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el pago operativo";
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
      setOrdersError("Solo puedes ocultar órdenes live desde Chekeo.");
      return;
    }
    if (order.status !== "cancelled") {
      setOrdersError("Solo se pueden ocultar órdenes canceladas.");
      return;
    }
    const confirmed = window.confirm(
      "Esta orden cancelada dejará de aparecer en historial operativo y métricas. No borra el registro interno.",
    );
    if (!confirmed) return;

    actionOrderIdRef.current = order.id;
    setActionOrderId(order.id);
    setOrdersError(null);
    try {
      const updated = await archiveCancelledOrderV2(order.id);
      setOrders((current) => current.filter((entry) => entry.id !== updated.id));
      setSelected((current) => (current?.id === updated.id ? null : current));
      setOrdersNotice(`${updated.folio}: orden cancelada oculta del historial operativo`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo ocultar la orden cancelada";
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
      setOrdersNotice("Checklist operativo actualizado localmente");
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
      });
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
    source: ordersSource,
    loading: loadingOrders,
    actionOrderId,
    error: ordersError,
    notice: ordersNotice,
    highlightedOrderIds,
    sessionActive: logged,
    onSessionExpired: expireSession,
    reload: (includeTerminal?: boolean) => {
      void loadLiveOrders(Boolean(includeTerminal));
    },
    lastUpdated,
  };

  const active = orders.filter((o) => !terminalStatuses.has(o.status));
  const content = useMemo(
    () =>
      ({
        inicio: <DashboardHome orders={orders} source={ordersSource} />,
        pedidos: (
          <OrdersBoard
            orders={orders.filter((o) => !terminalStatuses.has(o.status))}
            setSelected={setSelected}
            runtime={runtime}
            move={move}
            requestCancellation={requestCancellation}
          />
        ),
        cocina: (
          <KitchenQueue
            orders={orders}
            runtime={runtime}
            onToggleKitchenItem={toggleKitchenItemDone}
          />
        ),
        pagos: (
          <PaymentNotesPanel
            orders={orders}
            runtime={runtime}
            onUpdatePayment={updatePayment}
          />
        ),
        historial: (
          <HistoryPanel
            orders={orders}
            runtime={runtime}
            onArchiveCancelled={archiveCancelledOrder}
          />
        ),
        cierre: <OperationalClosePanel sessionActive={logged} />,
        catalogo: <CatalogAdminPanel />,
        sorteos: <RafflesAdminPanel />,
      })[tab],
    [orders, ordersSource, tab, runtime, toggleKitchenItemDone],
  );
  if (!logged)
    return (
      <InternalLogin
        checkingSession={checkingSession}
        onLogin={() => {
          loggedRef.current = true;
          setLogged(true);
          void loadLiveOrders(tab === "historial" || tab === "pagos");
        }}
      />
    );
  return (
    <main className="shell">
      <OperatorHeader
        active={active.length}
        source={ordersSource}
        onLogout={() => {
          void logoutInternal();
          loggedRef.current = false;
          setLogged(false);
          setOrdersSource("mock");
          setOrders(asInternalOrders(mockOrders));
          setSelected(null);
          cancellationRequestRef.current = null;
          setCancellationRequest(null);
          setNewOrderNotice(null);
          setHighlightedOrderIds(new Set());
          orderKeysRef.current = null;
        }}
      />
      <NewOrderBanner
        notice={newOrderNotice}
        onDismiss={() => setNewOrderNotice(null)}
      />
      <OperatorTabs
        tab={tab}
        setTab={setTab}
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
