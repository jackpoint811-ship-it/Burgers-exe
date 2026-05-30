import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
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
  type OrderV2PaymentStatus,
  type OrderV2Status,
} from "@config/index";
import { Button, Card, StatusPill } from "@ui/index";
import {
  ADMIN_TOKEN_CHANGED_EVENT,
  clearAdminToken,
  getAdminToken,
  setAdminToken as persistAdminToken,
} from "../lib/admin-token";
import {
  exportOrdersV2Csv,
  fetchOrdersV2Admin,
  fetchOrdersV2Summary,
  updateOrderV2Payment,
  updateOrderV2Status,
} from "../lib/orders-v2-admin";
import {
  buildWhatsappOrderMessage,
  buildWhatsappUrl,
  normalizeWhatsappPhone,
  type WhatsappOrderMessageType,
} from "../lib/whatsapp";
import { CatalogAdminPanel } from "./CatalogAdminPanel";

type TabKey =
  | "inicio"
  | "pedidos"
  | "cocina"
  | "pagos"
  | "historial"
  | "cierre"
  | "catalogo";
type OrdersSource = "d1" | "mock" | "fallback";
type OrdersV2Summary = NonNullable<OrdersV2SummaryResponse["data"]>;
type InternalOrderItem = MockOrder["items"][number] & { lineTotal?: number };
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
};

type StatusAction = { status: OrderStatus; label: string; tone?: "danger" };
type OrdersRuntime = {
  source: OrdersSource;
  loading: boolean;
  actionOrderId: string | null;
  error: string | null;
  notice: string | null;
  adminToken: string;
  setTokenInput: (value: string) => void;
  tokenInput: string;
  activateToken: () => void;
  clearToken: () => void;
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

const asInternalOrders = (orders: MockOrder[]): InternalOrder[] => orders;
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

const getEventReason = (event: OrderV2Event): string | undefined => {
  const reason = event.detail?.reason;
  return typeof reason === "string" && reason.trim() ? reason : undefined;
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
  return {
    id: order.id,
    folio: order.folio,
    customer: order.customerName,
    customerPhone: order.customerPhone,
    channel: order.orderMode,
    createdAt: formatDateTime(order.createdAt),
    updatedAt: formatDateTime(order.updatedAt),
    status: order.status,
    priority: "normal",
    paymentMethod: order.paymentMethod,
    paymentState: order.paymentStatus,
    note: order.notes,
    items: order.items.map((item) => ({
      name: item.name,
      qty: item.qty,
      price: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
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
  adminToken,
  defaultIncludeTerminal,
}: {
  adminToken: string;
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
  const disabled = exporting || !adminToken || invalidLimit;

  const downloadCsv = async () => {
    setError(null);
    setSuccess(null);
    if (!adminToken) {
      setError("Activa modo admin para exportar CSV");
      return;
    }
    if (invalidLimit) {
      setError("El límite debe ser un entero entre 1 y 1000");
      return;
    }
    setExporting(true);
    try {
      const blob = await exportOrdersV2Csv(getAdminToken(), {
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
            Export CSV operativo
          </p>
          <p className="text-[11px] text-zinc-400">
            Descarga órdenes V2 desde D1 para reporting manual.
          </p>
        </div>
        {!adminToken ? (
          <p className="text-[11px] text-amber-200">
            Activa modo admin para exportar CSV
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
          {runtime.source === "d1" ? "Pedidos live D1" : "Fallback mock"}
        </p>
        <p className="text-[11px] text-zinc-400">
          {runtime.source === "d1"
            ? "Backend V2 · D1 orders"
            : runtime.source === "fallback"
              ? "Mostrando fallback mock por error de Backend V2."
              : "Activa modo admin para operar órdenes live"}
        </p>
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
          disabled={runtime.loading || !runtime.adminToken}
        >
          {runtime.loading ? "Cargando…" : "Recargar órdenes"}
        </Button>
      </div>
    </div>
    {!runtime.adminToken ? (
      <div className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-2">
        <p className="text-xs text-cyan-100">
          Activa modo admin para cargar órdenes live.
        </p>
        <div className="mt-2 flex flex-col gap-2 md:flex-row">
          <input
            className="input md:mt-0"
            type="password"
            placeholder="Token admin preview"
            value={runtime.tokenInput}
            onChange={(e) => runtime.setTokenInput(e.target.value)}
          />
          <Button
            className="bg-cyan-400 text-black"
            onClick={runtime.activateToken}
          >
            Activar modo admin
          </Button>
        </div>
      </div>
    ) : (
      <div className="mt-3 flex items-center gap-2">
        <span className="chip">Token admin activo</span>
        <Button
          className="border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px]"
          onClick={runtime.clearToken}
        >
          Cerrar modo admin
        </Button>
      </div>
    )}
    <OrdersExportControls
      adminToken={runtime.adminToken}
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

const PinLoginMock = ({ onLogin }: { onLogin: () => void }) => (
  <main className="shell">
    <section className="login card">
      <h1>Internal Chekeo V2</h1>
      <p className="muted">Vista V2 · Backend V2 con fallback local</p>
      <label htmlFor="pin">PIN</label>
      <input id="pin" type="password" className="input" placeholder="••••" />
      <Button className="mt-3 bg-cyan-400 text-black" onClick={onLogin}>
        Entrar a consola
      </Button>
    </section>
  </main>
);
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
        Burgers.exe Operator Console
      </h1>
      <p className="text-[11px] text-zinc-400">
        Activos {active} · {source === "d1" ? "Backend V2" : "Fallback mock"} ·{" "}
        {new Date().toLocaleTimeString()}
      </p>
    </div>
    <Button
      className="border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px]"
      onClick={onLogout}
    >
      Logout mock
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
            ? "Órdenes live desde D1"
            : "Fallback mock para QA visual"}
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
  const phone = normalizeWhatsappPhone(order.customerPhone ?? "");
  const message = buildWhatsappOrderMessage(order, template);
  const whatsappUrl = phone ? buildWhatsappUrl(phone, message) : "";

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const openWhatsapp = () => {
    if (!whatsappUrl) return;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const copyMessage = async () => {
    setNotice(null);
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard no disponible en este navegador");
      await navigator.clipboard.writeText(message);
      setNotice({ tone: "success", message: "Mensaje copiado" });
    } catch {
      setNotice({
        tone: "error",
        message:
          "No se pudo copiar el mensaje. Copia manualmente desde un navegador seguro.",
      });
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-2">
      {showHint ? (
        <p className="mb-2 text-[11px] text-cyan-100">
          Acción manual: abre WhatsApp con mensaje prellenado.
        </p>
      ) : null}
      {!phone ? (
        <p className="mb-2 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
          Teléfono inválido para WhatsApp
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="border border-emerald-700 bg-emerald-950/50 px-2 py-1.5 text-[11px] text-emerald-100 disabled:opacity-40"
          onClick={openWhatsapp}
          disabled={!phone}
        >
          WhatsApp
        </Button>
        <Button
          className="border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px]"
          onClick={() => void copyMessage()}
        >
          Copiar mensaje
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
      runtime.source === "d1" && !runtime.adminToken
        ? "Activa modo admin para cancelar órdenes live"
        : null,
    );
  }, [request?.order.id, runtime.adminToken, runtime.source]);

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
    (runtime.source === "d1" && !runtime.adminToken);

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
    if (runtime.source === "d1" && !runtime.adminToken) {
      setError("Activa modo admin para cancelar órdenes live");
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
            Esta acción registra un evento STATUS_CHANGED con la razón de
            cancelación para auditoría.
          </p>
          {runtime.source !== "d1" ? (
            <p className="mt-1 rounded bg-amber-500/10 px-2 py-1 text-amber-100">
              Fallback local: la cancelación se simula solo en UI.
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
        description="Cuando Public V2 reciba un pedido nuevo, aparecerá aquí."
      />
    ) : null}
    <div className="grid gap-2">
      {orders.map((o) => (
        <Card key={o.id} className="p-3">
          <CompactRow order={o} onOpen={() => setSelected(o)} />
          <div className="mt-2 grid gap-1 text-xs text-zinc-300 md:grid-cols-2">
            <span>Modo entrega: {o.channel}</span>
            <span>Método de pago: {o.paymentMethod}</span>
            <span>Payment status: {o.paymentState}</span>
            <span>Total: {formatCurrency(o.total)}</span>
            <span>Source: {o.source ?? "mock"}</span>
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
      ))}
    </div>
  </section>
);

const KitchenQueue = ({
  orders,
  move,
  runtime,
}: {
  orders: InternalOrder[];
  move: MoveOrderStatus;
  runtime: OrdersRuntime;
}) => {
  const activeOrders = orders.filter((o) => !terminalStatuses.has(o.status));
  return (
    <section>
      <SourcePanel runtime={runtime} />
      {runtime.source === "d1" && activeOrders.length === 0 ? (
        <EmptyOrdersState
          title="Cocina limpia."
          description="No hay órdenes activas por preparar."
        />
      ) : null}
      <div className="grid gap-3 md:grid-cols-3">
        {(["new", "preparing", "ready"] as OrderStatus[]).map((s) => {
          const list = activeOrders.filter((o) => o.status === s);
          return (
            <Card key={s} className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-bold">{statusLabel[s]}</h3>
                <span className="chip">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold">
                          {o.folio} · {o.createdAt}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {o.customer} · {o.kitchenStation}
                        </p>
                      </div>
                      <StatusBadge status={o.status} />
                    </div>
                    {o.note ? (
                      <p className="mt-1 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                        {o.note}
                      </p>
                    ) : null}
                    <OrderItems order={o} />
                    <div className="mt-2">
                      <ActionButtons
                        order={o}
                        actions={getKitchenActions(o.status)}
                        onMove={move}
                        onCancel={() => undefined}
                        actionOrderId={runtime.actionOrderId}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
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

const OperationalClosePanel = ({ adminToken }: { adminToken: string }) => {
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
    const token = getAdminToken();
    if (!token) {
      setSummary(null);
      setError("Activa modo admin para cargar cierre");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const data = await fetchOrdersV2Summary(token, {
        from,
        to,
        includeTerminal,
        limit: 1000,
        topLimit: 10,
      });
      setSummary(data);
      setNotice("Cierre actualizado desde D1");
    } catch (closeError) {
      setSummary(null);
      setError(
        closeError instanceof Error
          ? closeError.message
          : "No se pudo cargar cierre desde Backend V2",
      );
    } finally {
      setLoading(false);
    }
  }, [from, includeTerminal, to]);

  useEffect(() => {
    if (adminToken) void loadSummary();
    else {
      setSummary(null);
      setError("Activa modo admin para cargar cierre");
    }
  }, [adminToken, loadSummary]);

  const downloadRangeCsv = async () => {
    const token = getAdminToken();
    if (!token) {
      setError("Activa modo admin para exportar CSV");
      return;
    }
    setExporting(true);
    setError(null);
    setNotice(null);
    try {
      const blob = await exportOrdersV2Csv(token, {
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
              Cierre operativo preview
            </p>
            <h2 className="text-xl font-black">Cierre</h2>
            <p className="text-sm text-zinc-400">
              D1 source of truth · Pagos declarados, no pagos reales · sin
              conversión de timezone en esta fase.
            </p>
          </div>
          <Button
            className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm disabled:opacity-40"
            onClick={() => void downloadRangeCsv()}
            disabled={exporting || !adminToken}
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
            disabled={loading || !adminToken}
          >
            {loading ? "Calculando…" : "Actualizar cierre"}
          </Button>
        </div>
        {!adminToken ? (
          <p className="mt-2 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
            Activa modo admin para cargar cierre
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
          Cargando cierre operativo desde D1…
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
                  label="new → ready"
                  value={formatDuration(summary.durations.newToReadyAvgSeconds)}
                />
                <CloseMetricCard
                  label="new → delivered"
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
              <h3 className="mb-2 font-bold">Pickup vs delivery</h3>
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
            <h3 className="mb-2 font-bold">Top items</h3>
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
                  Sin items no cancelados en el rango.
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
        `Pago operativo manual: ${paymentStatus}`,
      );
      setInlineNotice((current) => ({
        ...current,
        [order.id]: {
          tone: "success",
          message: `${order.folio}: payment status declarado por operador.`,
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
              Pago operativo manual
            </p>
            <h3 className="text-lg font-black">Pagos y notas V2</h3>
            <p className="text-sm text-zinc-400">
              No se realiza ningún cobro en línea. Payment status declarado por
              operador.
            </p>
          </div>
          <Button
            className="border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs disabled:opacity-40"
            onClick={() => runtime.reload(true)}
            disabled={runtime.loading || !runtime.adminToken}
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
        {!runtime.adminToken ? (
          <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
            Activa el token admin para operar pagos reales D1.
          </p>
        ) : null}
      </Card>
      {runtime.source === "d1" && paymentOrders.length === 0 ? (
        <EmptyOrdersState
          title="Sin órdenes para este filtro."
          description="Usa Recargar órdenes o cambia el filtro de payment status."
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
                    {order.source ?? "mock"}
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
                <span>paymentMethod: {order.paymentMethod}</span>
                <span>paymentStatus: {order.paymentState}</span>
                <span>order status: {statusLabel[order.status]}</span>
              </div>
              <OrderItems order={order} />
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
                  disabled={busy || !runtime.adminToken}
                >
                  {busy ? "Actualizando…" : "Marcar pagado"}
                </Button>
                <Button
                  className="border border-amber-700 bg-amber-950/50 px-3 py-1.5 text-xs text-amber-100 disabled:opacity-40"
                  onClick={() => void runPaymentAction(order, "pending")}
                  disabled={busy || !runtime.adminToken}
                >
                  {busy ? "Actualizando…" : "Marcar pendiente"}
                </Button>
                <Button
                  className="border border-rose-700 bg-rose-950/50 px-3 py-1.5 text-xs text-rose-100 disabled:opacity-40"
                  onClick={() => void runPaymentAction(order, "cancelled")}
                  disabled={busy || !runtime.adminToken}
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
                  disabled={busy || !runtime.adminToken}
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
}: {
  orders: InternalOrder[];
  runtime: OrdersRuntime;
}) => {
  const terminalOrders = orders.filter((o) => terminalStatuses.has(o.status));
  return (
    <section>
      <SourcePanel runtime={runtime} includeTerminal />
      <Card className="p-3">
        <h3 className="mb-2">
          Historial {runtime.source === "d1" ? "Backend V2" : "local"}
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
                <StatusBadge status={o.status} />
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
          <p>Source: {selected.source ?? "fallback mock"}</p>
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
  const [adminToken, setAdminTokenState] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersNotice, setOrdersNotice] = useState<string | null>(null);
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const loadLiveOrders = useCallback(
    async (includeTerminal = tab === "historial" || tab === "pagos") => {
      const token = getAdminToken();
      setAdminTokenState(token);
      if (!token) {
        setOrders(asInternalOrders(mockOrders));
        setOrdersSource("mock");
        setOrdersError("Activa modo admin para cargar órdenes live");
        return;
      }
      setLoadingOrders(true);
      setOrdersError(null);
      try {
        const liveOrders = await fetchOrdersV2Admin(token, {
          includeTerminal,
          limit: includeTerminal ? 50 : 25,
        });
        setOrders(liveOrders.map(mapOrderV2ToInternalOrder));
        setOrdersSource("d1");
        setLastUpdated(
          new Date().toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
        setOrdersNotice("Órdenes live actualizadas desde Backend V2");
      } catch (error) {
        setOrders(asInternalOrders(mockOrders));
        setOrdersSource("fallback");
        setOrdersError(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar órdenes live; mostrando fallback mock",
        );
      } finally {
        setLoadingOrders(false);
      }
    },
    [tab],
  );

  useEffect(() => {
    const syncToken = () => setAdminTokenState(getAdminToken());
    syncToken();
    window.addEventListener(ADMIN_TOKEN_CHANGED_EVENT, syncToken);
    return () =>
      window.removeEventListener(ADMIN_TOKEN_CHANGED_EVENT, syncToken);
  }, []);

  useEffect(() => {
    if (logged && tab !== "catalogo" && tab !== "cierre")
      void loadLiveOrders(tab === "historial" || tab === "pagos");
  }, [logged, tab, adminToken, loadLiveOrders]);

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
          ? "Cancelación actualizada en fallback mock"
          : "Estado actualizado en fallback mock",
      );
      return;
    }
    const token = getAdminToken();
    if (!token) {
      const message =
        s === "cancelled"
          ? "Activa modo admin para cancelar órdenes live"
          : "Activa modo admin para operar órdenes live";
      setOrdersError(message);
      throw new Error(message);
    }
    setActionOrderId(id);
    setOrdersError(null);
    try {
      const updated = await updateOrderV2Status(
        token,
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
      throw error instanceof Error ? error : new Error(message);
    } finally {
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
      setOrdersNotice("Pago operativo actualizado en fallback mock");
      return;
    }
    const token = getAdminToken();
    if (!token) {
      const message = "Activa modo admin para operar pagos live";
      setOrdersError(message);
      throw new Error(message);
    }
    setActionOrderId(id);
    setOrdersError(null);
    try {
      const updated = await updateOrderV2Payment(token, id, {
        paymentStatus,
        notes,
        reason,
      });
      const mapped = mapOrderV2ToInternalOrder(updated);
      setOrders((p) => p.map((o) => (o.id === id ? mapped : o)));
      setSelected((current) => (current?.id === id ? mapped : current));
      setOrdersNotice(`${mapped.folio}: payment status ${mapped.paymentState}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el pago operativo";
      setOrdersError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setActionOrderId(null);
    }
  };

  const requestCancellation = (
    order: InternalOrder,
    origin: "pedidos" | "detalle",
  ) => {
    setOrdersError(null);
    setCancellationRequest({ order, origin });
  };

  const confirmCancellation = async (order: InternalOrder, reason: string) => {
    await move(order.id, "cancelled", reason);
  };

  const runtime: OrdersRuntime = {
    source: ordersSource,
    loading: loadingOrders,
    actionOrderId,
    error: ordersError,
    notice: ordersNotice,
    adminToken,
    tokenInput,
    setTokenInput,
    activateToken: () => {
      if (!tokenInput.trim()) return;
      persistAdminToken(tokenInput);
      setAdminTokenState(tokenInput.trim());
      setTokenInput("");
      void loadLiveOrders(tab === "historial" || tab === "pagos");
    },
    clearToken: () => {
      clearAdminToken();
      setAdminTokenState("");
      setOrdersSource("mock");
      setOrders(asInternalOrders(mockOrders));
      setOrdersError("Activa modo admin para cargar órdenes live");
    },
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
        cocina: <KitchenQueue orders={orders} move={move} runtime={runtime} />,
        pagos: (
          <PaymentNotesPanel
            orders={orders}
            runtime={runtime}
            onUpdatePayment={updatePayment}
          />
        ),
        historial: <HistoryPanel orders={orders} runtime={runtime} />,
        cierre: <OperationalClosePanel adminToken={adminToken} />,
        catalogo: <CatalogAdminPanel />,
      })[tab],
    [orders, ordersSource, tab, runtime],
  );
  if (!logged) return <PinLoginMock onLogin={() => setLogged(true)} />;
  return (
    <main className="shell">
      <OperatorHeader
        active={active.length}
        source={ordersSource}
        onLogout={() => setLogged(false)}
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
        onClose={() => setCancellationRequest(null)}
        onConfirm={confirmCancellation}
      />
    </main>
  );
}
