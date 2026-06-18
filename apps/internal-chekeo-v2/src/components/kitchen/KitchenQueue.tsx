import { useEffect, useMemo, useState } from "react";
import { Card, Button, StatusPill } from "@ui/index";
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Clock3,
  Eye,
  MapPin,
  PackageCheck,
  Play,
  RefreshCw,
} from "lucide-react";
import type {
  KitchenSummaryKResponse,
  OrderStatus,
  OrderV2Environment,
  OrderV2PaymentStatus,
} from "@config/index";
import { fetchKitchenSummaryK } from "../../lib/ingredients-v2-admin";
import {
  buildKitchenOrderMeta,
  extractKitchenLocation,
  formatKitchenElapsed,
  getKitchenItemActionKind,
  getKitchenItemLabel,
  getKitchenItemNotes,
  getKitchenLane,
  getKitchenLineKey,
  matchesKitchenFocus,
  sortKitchenOrders,
  stripLocationFromNotes,
} from "./kitchen-helpers";
import type {
  KitchenFocus,
  KitchenOrder,
  KitchenOrderItem,
  KitchenOrderMeta,
  KitchenOrdersRuntime,
  MoveKitchenOrderStatus,
  ToggleKitchenItemDone,
} from "./kitchen-types";

type KitchenSummaryK = NonNullable<KitchenSummaryKResponse["data"]>;

const terminalStatuses = new Set<OrderStatus>(["delivered", "cancelled"]);

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
  pending: "Falta confirmar pago",
  paid: "Pago confirmado",
  cancelled: "Cancelado",
};

const paymentStatusTone: Record<OrderV2PaymentStatus, string> = {
  pending: "border-amber-400/40 text-amber-200",
  paid: "border-emerald-400/40 text-emerald-200",
  cancelled: "border-rose-500/40 text-rose-300",
};

const orderEnvironmentLabel: Record<OrderV2Environment, string> = {
  production: "Producción",
  preview: "Preview",
};

const focusCards: Array<{
  key: KitchenFocus;
  label: string;
  hint: string;
}> = [
  { key: "all", label: "Todos", hint: "Vista completa" },
  { key: "new", label: "Nuevos", hint: "Entraron y falta arrancarlos" },
  { key: "preparing", label: "En preparación", hint: "Trabajo activo" },
  { key: "attention", label: "Atención", hint: "Urgentes, pago o checklist" },
  { key: "ready", label: "Listos", hint: "Listos para salida" },
];

const boardLanes = [
  { key: "attention", title: "Atención", hint: "Pago, checklist o tiempo crítico" },
  { key: "new", title: "Nuevos", hint: "Entraron y falta iniciar" },
  { key: "preparing", title: "En preparación", hint: "Trabajo activo" },
  { key: "ready", title: "Listos", hint: "Salida y revisión final" },
] as const;

const isOrderV2PaymentStatus = (
  value: string,
): value is OrderV2PaymentStatus =>
  value === "pending" || value === "paid" || value === "cancelled";

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

const getOrderItemCount = (order: Pick<KitchenOrder, "items">) =>
  order.items.reduce((total, item) => total + item.qty, 0);

const KitchenStatusBadge = ({ status }: { status: OrderStatus }) => (
  <StatusPill className={statusTone[status]}>{statusLabel[status]}</StatusPill>
);

const KitchenPaymentStatusBadge = ({ status }: { status: string }) => {
  const label = isOrderV2PaymentStatus(status)
    ? paymentStatusLabel[status]
    : status || "Por confirmar";
  const tone = isOrderV2PaymentStatus(status)
    ? paymentStatusTone[status]
    : "border-zinc-500/40 text-zinc-200";
  return <StatusPill className={tone}>{label}</StatusPill>;
};

const KitchenEmptyState = ({ title }: { title: string }) => (
  <Card className="border-dashed border-zinc-700/90 p-5 text-center">
    <p className="text-base font-black text-zinc-100">{title}</p>
  </Card>
);

const KitchenProgressBar = ({ meta }: { meta: KitchenOrderMeta }) => (
  <div className="kitchen-progress" aria-label={`Checklist ${meta.progressLabel}`}>
    <span style={{ width: `${meta.progressPercent}%` }} />
  </div>
);

const KitchenTicketItem = ({
  order,
  item,
  index,
  busy,
  onToggleKitchenItem,
}: {
  order: KitchenOrder;
  item: KitchenOrderItem;
  index: number;
  busy: boolean;
  onToggleKitchenItem: ToggleKitchenItemDone;
}) => {
  const done = Boolean(item.kitchenDone);
  const notes = getKitchenItemNotes(item);
  return (
    <div className={`kitchen-ticket-item ${done ? "kitchen-ticket-item--done" : ""}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="kitchen-item-kind">{getKitchenItemLabel(item)}</span>
          <p className="break-words text-sm font-black text-zinc-50">
            {item.name} #{item.itemDisplayIndex ?? index + 1}
          </p>
          <span className={done ? "kitchen-dot kitchen-dot--done" : "kitchen-dot"}>
            {done ? "Hecho" : "Pendiente"}
          </span>
        </div>
        {notes.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {notes.slice(0, 4).map((note) => (
              <span key={note} className="kitchen-note-chip">
                {note}
              </span>
            ))}
          </div>
        ) : null}
        {!item.lineKey ? (
          <p className="mt-2 text-xs font-bold text-amber-200">
            No se puede marcar este item todavía. Revisa el detalle del pedido.
          </p>
        ) : null}
      </div>
      <Button
        className={`kitchen-item-action ${done ? "kitchen-item-action--done" : ""}`}
        disabled={busy || !item.lineKey}
        onClick={() => {
          if (!item.lineKey) return;
          void onToggleKitchenItem(
            order.id,
            item.lineKey,
            getKitchenItemActionKind(item),
            !done,
          );
        }}
      >
        {done ? (
          <>
            <RefreshCw size={15} aria-hidden="true" /> Reabrir
          </>
        ) : (
          <>
            <CheckCircle2 size={16} aria-hidden="true" /> Hecho
          </>
        )}
      </Button>
    </div>
  );
};

const KitchenPrimaryAction = ({
  meta,
  onMove,
  actionOrderId,
}: {
  meta: KitchenOrderMeta;
  onMove: MoveKitchenOrderStatus;
  actionOrderId: string | null;
}) => {
  const busy = actionOrderId === meta.order.id;
  if (meta.order.status === "new") {
    return (
      <Button
        className="kitchen-primary-action"
        disabled={busy}
        onClick={() => void onMove(meta.order.id, "preparing")}
      >
        <Play size={16} aria-hidden="true" />
        {busy ? "Iniciando..." : "Iniciar preparación"}
      </Button>
    );
  }
  if (meta.order.status === "preparing" && meta.pendingItems.length === 0) {
    return (
      <Button
        className="kitchen-primary-action"
        disabled={busy}
        onClick={() => void onMove(meta.order.id, "ready")}
      >
        <PackageCheck size={16} aria-hidden="true" />
        {busy ? "Marcando..." : "Marcar listo"}
      </Button>
    );
  }
  return (
    <Button className="kitchen-primary-action kitchen-primary-action--muted" disabled>
      <ChefHat size={16} aria-hidden="true" />
      {meta.nextAction}
    </Button>
  );
};

const KitchenTicket = ({
  meta,
  busyLineKey,
  highlighted,
  onToggleKitchenItem,
  onMove,
  onOpen,
  actionOrderId,
}: {
  meta: KitchenOrderMeta;
  busyLineKey: string | null;
  highlighted: boolean;
  onToggleKitchenItem: ToggleKitchenItemDone;
  onMove: MoveKitchenOrderStatus;
  onOpen: (order: KitchenOrder) => void;
  actionOrderId: string | null;
}) => {
  const { order } = meta;
  const generalNote = stripLocationFromNotes(order.note);
  const urgencyLabel =
    meta.urgency === "critical"
      ? "Crítico"
      : meta.urgency === "late"
        ? "Tardando"
        : "A tiempo";
  return (
    <article
      className={`kitchen-ticket kitchen-ticket--${meta.urgency} ${highlighted ? "kitchen-ticket--highlighted" : ""}`}
    >
      <div className="kitchen-ticket__topline">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-2xl font-black text-zinc-50">{order.folio}</p>
            <KitchenStatusBadge status={order.status} />
            <KitchenPaymentStatusBadge status={order.paymentState} />
          </div>
          <p className="mt-1 break-words text-base font-extrabold text-zinc-100">
            {order.customer}
          </p>
        </div>
        <div className="kitchen-ticket__elapsed">
          <Clock3 size={16} aria-hidden="true" />
          <span>{formatKitchenElapsed(meta.elapsedMinutes)}</span>
        </div>
      </div>

      <div className="kitchen-ticket__meta">
        <span>
          <MapPin size={14} aria-hidden="true" />
          {extractKitchenLocation(order.note)}
        </span>
        <span>Items {getOrderItemCount(order)}</span>
        <span>Burgers {meta.burgerItems.length}</span>
        <span>Guarniciones {meta.garnishItems.length}</span>
        <span>{urgencyLabel}</span>
      </div>

      <div className="kitchen-ticket__progress-row">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">
            Checklist
          </p>
          <p className="mt-1 text-sm font-black text-zinc-100">
            {meta.progressLabel} hecho · {meta.pendingItems.length} pendiente
          </p>
        </div>
        <KitchenProgressBar meta={meta} />
      </div>

      {meta.needsAttention ? (
        <div className="kitchen-alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            {order.paymentState === "pending"
              ? "Pago pendiente antes de salida."
              : meta.readyNeedsReview
                ? "Pedido listo con checklist pendiente."
                : "Revisar operación actual."}
          </span>
        </div>
      ) : null}

      {generalNote ? (
        <p className="kitchen-critical-note">Nota: {generalNote}</p>
      ) : null}

      <div className="kitchen-ticket__items">
        {meta.kitchenItems.length ? (
          meta.kitchenItems.map((item, index) => {
            const lineKey = getKitchenLineKey(order, item, index);
            return (
              <KitchenTicketItem
                key={lineKey}
                order={order}
                item={item}
                index={index}
                busy={busyLineKey === lineKey}
                onToggleKitchenItem={onToggleKitchenItem}
              />
            );
          })
        ) : (
          <p className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm font-bold text-amber-100">
            Sin items de cocina. Revisa el detalle antes de cerrar el pedido.
          </p>
        )}
      </div>

      <div className="kitchen-ticket__actions">
        <KitchenPrimaryAction
          meta={meta}
          onMove={onMove}
          actionOrderId={actionOrderId}
        />
        <Button className="kitchen-secondary-action" onClick={() => onOpen(order)}>
          <Eye size={16} aria-hidden="true" /> Ver detalle
        </Button>
      </div>
    </article>
  );
};

const KitchenSummaryKPanel = ({
  environment,
}: {
  environment: OrderV2Environment;
}) => {
  const [summary, setSummary] = useState<KitchenSummaryK | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchKitchenSummaryK(environment));
    } catch {
      setError("No se pudo cargar Resumen K. Cocina sigue funcionando normalmente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [environment]);

  if (loading) {
    return (
      <Card className="border-cyan-500/20 bg-zinc-950 p-4">
        <p className="text-sm font-semibold text-cyan-100">Cargando Resumen K...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-rose-400/30 bg-rose-950/30 p-4">
        <p className="text-sm font-bold text-rose-100">{error}</p>
        <Button className="mt-3 border border-rose-300/30 bg-zinc-950" onClick={load}>
          Reintentar
        </Button>
      </Card>
    );
  }

  if (!summary) return null;

  const costText =
    summary.totals.estimatedCostCents == null
      ? "—"
      : formatCurrency(summary.totals.estimatedCostCents / 100);

  return (
    <section className="space-y-4">
      {!summary.hasRecipes ? (
        <Card className="border-amber-400/30 bg-amber-950/20 p-4">
          <p className="text-sm font-bold text-amber-100">
            Configura recetas aproximadas en Chekeo para desbloquear el cálculo de ingredientes.
          </p>
        </Card>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Burgers totales", summary.totals.burgers],
          ["Guarniciones totales", summary.totals.garnishes],
          ["Ingredientes estimados", summary.totals.ingredients],
          ["Costo estimado", costText],
        ].map(([label, value]) => (
          <Card key={label} className="border-cyan-500/20 bg-zinc-950 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
              {label}
            </p>
            <p className="mt-2 text-3xl font-black text-cyan-100">{value}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-emerald-500/20 bg-zinc-950 p-4">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-200">
            {orderEnvironmentLabel[environment]} · burgers
          </h3>
          <div className="mt-3 space-y-2">
            {summary.burgers.length ? (
              summary.burgers.map((item) => (
                <div
                  key={item.sku}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"
                >
                  <span className="font-bold text-zinc-100">{item.name}</span>
                  <span className="text-xl font-black text-emerald-200">
                    {item.quantity}
                  </span>
                </div>
              ))
            ) : (
              <KitchenEmptyState title="Sin burgers del día." />
            )}
          </div>
        </Card>
        <Card className="border-amber-500/20 bg-zinc-950 p-4">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-amber-200">
            {orderEnvironmentLabel[environment]} · guarniciones
          </h3>
          <div className="mt-3 space-y-2">
            {summary.garnishes.length ? (
              summary.garnishes.map((item) => (
                <div
                  key={item.sku}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"
                >
                  <span className="font-bold text-zinc-100">{item.name}</span>
                  <span className="text-xl font-black text-amber-200">
                    {item.quantity}
                  </span>
                </div>
              ))
            ) : (
              <KitchenEmptyState title="Sin guarniciones del día." />
            )}
          </div>
        </Card>
      </div>
      <Card className="border-cyan-500/20 bg-zinc-950 p-4">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-200">
          Ingredientes estimados
        </h3>
        <div className="mt-3 space-y-2">
          {summary.ingredients.length ? (
            summary.ingredients.map((ingredient) => (
              <div
                key={ingredient.ingredientId}
                className="grid gap-1 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
              >
                <div>
                  <p className="font-bold text-zinc-100">{ingredient.name}</p>
                  <p className="text-xs text-zinc-400">
                    Precio unitario:{" "}
                    {ingredient.unitPriceCents == null
                      ? "—"
                      : formatCurrency(ingredient.unitPriceCents / 100)}
                  </p>
                </div>
                <p className="font-black text-cyan-100">
                  {ingredient.quantity.toFixed(2)} {ingredient.unit}
                </p>
                <p className="font-black text-emerald-200">
                  {ingredient.estimatedCostCents == null
                    ? "—"
                    : formatCurrency(ingredient.estimatedCostCents / 100)}
                </p>
              </div>
            ))
          ) : (
            <KitchenEmptyState title="Sin ingredientes estimados." />
          )}
        </div>
      </Card>
    </section>
  );
};

export const KitchenQueue = ({
  orders,
  runtime,
  onToggleKitchenItem,
  onMove,
  onOpenOrder,
}: {
  orders: KitchenOrder[];
  runtime: KitchenOrdersRuntime;
  onToggleKitchenItem: ToggleKitchenItemDone;
  onMove: MoveKitchenOrderStatus;
  onOpenOrder: (order: KitchenOrder) => void;
}) => {
  const [view, setView] = useState<"board" | "summaryK">("board");
  const [focus, setFocus] = useState<KitchenFocus>("all");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busyLineKey, setBusyLineKey] = useState<string | null>(null);

  const activeOrders = useMemo(
    () => orders.filter((order) => !terminalStatuses.has(order.status)),
    [orders],
  );
  const orderMetas = useMemo(
    () =>
      activeOrders
        .map((order) => buildKitchenOrderMeta(order, nowMs))
        .sort(sortKitchenOrders),
    [activeOrders, nowMs],
  );
  const scopedOrders = useMemo(
    () => orderMetas.filter((meta) => matchesKitchenFocus(meta, focus)),
    [focus, orderMetas],
  );
  const laneOrders = useMemo(
    () =>
      boardLanes.map((lane) => ({
        ...lane,
        orders: orderMetas.filter((meta) => getKitchenLane(meta) === lane.key),
      })),
    [orderMetas],
  );
  const focusCardValues = useMemo(
    () =>
      focusCards.map((card) => ({
        ...card,
        value:
          card.key === "all"
            ? orderMetas.length
            : card.key === "attention"
              ? orderMetas.filter((meta) => meta.needsAttention).length
              : orderMetas.filter((meta) => meta.order.status === card.key).length,
      })),
    [orderMetas],
  );
  const lateOrders = useMemo(
    () => orderMetas.filter((meta) => meta.urgency === "late").length,
    [orderMetas],
  );
  const criticalOrders = useMemo(
    () => orderMetas.filter((meta) => meta.urgency === "critical").length,
    [orderMetas],
  );
  const pendingKitchenItems = useMemo(
    () => orderMetas.reduce((total, meta) => total + meta.pendingItems.length, 0),
    [orderMetas],
  );
  const fallback = runtime.source !== "d1";
  const kitchenTitle = fallback
    ? "Cocina en fallback"
    : runtime.environment === "preview"
      ? "Cocina conectada a preview"
      : "Cocina conectada a D1 real";
  const kitchenHint = fallback
    ? "Solo referencia visual. Reintenta antes de confirmar cambios como definitivos."
    : runtime.environment === "preview"
      ? "Valida flujo y estados sin asumir producción."
      : "Ordenado por estado y pago para decidir el siguiente pedido.";

  useEffect(() => {
    if (view !== "board" || activeOrders.length === 0) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [activeOrders.length, view]);

  const toggleKitchenItem = async (
    orderId: string,
    lineKey: string,
    itemKind: Parameters<ToggleKitchenItemDone>[2],
    done: boolean,
  ) => {
    setBusyLineKey(lineKey);
    try {
      await onToggleKitchenItem(orderId, lineKey, itemKind, done);
    } finally {
      setBusyLineKey(null);
    }
  };

  return (
    <section className="kitchen-production">
      <div className="kitchen-hero">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-200">
              Cocina operativa
            </p>
            <h2 className="mt-1 text-2xl font-black text-zinc-50 md:text-3xl">
              {kitchenTitle}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-400">
              {kitchenHint}
            </p>
          </div>
          <div className="kitchen-hero__actions">
            {runtime.lastUpdated ? (
              <span className="text-[11px] text-zinc-500">
                Actualizado: {runtime.lastUpdated}
              </span>
            ) : null}
            <Button
              className="kitchen-secondary-action"
              onClick={() => runtime.reload(false)}
              disabled={runtime.loading || !runtime.sessionActive}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {runtime.loading ? "Actualizando..." : "Actualizar"}
            </Button>
            <Button
              className={`kitchen-secondary-action ${view === "summaryK" ? "kitchen-secondary-action--active" : ""}`}
              aria-pressed={view === "summaryK"}
              onClick={() =>
                setView((current) => (current === "board" ? "summaryK" : "board"))
              }
            >
              {view === "board" ? "Resumen K" : "Tablero"}
            </Button>
          </div>
        </div>
        <div className="kitchen-command-strip">
          <div>
            <span>{orderMetas.length}</span>
            <p>Pedidos activos</p>
          </div>
          <div>
            <span>{pendingKitchenItems}</span>
            <p>Items pendientes</p>
          </div>
          <div>
            <span>{lateOrders}</span>
            <p>Tardando</p>
          </div>
          <div className={criticalOrders ? "kitchen-command-strip__hot" : ""}>
            <span>{criticalOrders}</span>
            <p>Críticos</p>
          </div>
        </div>
        <div className="kitchen-lanes">
          {focusCardValues.map((card) => (
            <button
              key={card.key}
              type="button"
              aria-pressed={focus === card.key}
              className={`kitchen-lane ${focus === card.key ? "kitchen-lane--active" : ""}`}
              onClick={() => setFocus(card.key)}
            >
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-black text-zinc-50">
                {card.value}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">{card.hint}</p>
            </button>
          ))}
        </div>
      </div>

      {runtime.limitWarning ? (
        <p
          aria-live="polite"
          className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100"
        >
          {runtime.limitWarning}
        </p>
      ) : null}
      {fallback ? (
        <p
          aria-live="polite"
          className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100"
        >
          Fallback visual: estados de cocina no se guardan en D1.
        </p>
      ) : null}
      {runtime.error ? (
        <p
          aria-live="polite"
          className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100"
        >
          {runtime.error}
        </p>
      ) : null}

      {view === "summaryK" ? (
        <KitchenSummaryKPanel environment={runtime.environment} />
      ) : focus === "all" ? (
        <div className="kitchen-board" data-lanes={boardLanes.length}>
          {laneOrders.map((lane) => (
            <section key={lane.key} className="kitchen-board-lane">
              <div className="kitchen-board-lane__header">
                <div>
                  <h3>{lane.title}</h3>
                  <p>{lane.hint}</p>
                </div>
                <span>{lane.orders.length}</span>
              </div>
              <div className="kitchen-board-lane__body">
                {lane.orders.length ? (
                  lane.orders.map((meta) => (
                    <KitchenTicket
                      key={meta.order.id}
                      meta={meta}
                      busyLineKey={busyLineKey}
                      highlighted={runtime.highlightedOrderIds.has(meta.order.id)}
                      onToggleKitchenItem={toggleKitchenItem}
                      onMove={onMove}
                      onOpen={onOpenOrder}
                      actionOrderId={runtime.actionOrderId}
                    />
                  ))
                ) : (
                  <KitchenEmptyState title={`Sin pedidos en ${lane.title.toLowerCase()}.`} />
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="kitchen-focused-list">
          {scopedOrders.length ? (
            scopedOrders.map((meta) => (
              <KitchenTicket
                key={meta.order.id}
                meta={meta}
                busyLineKey={busyLineKey}
                highlighted={runtime.highlightedOrderIds.has(meta.order.id)}
                onToggleKitchenItem={toggleKitchenItem}
                onMove={onMove}
                onOpen={onOpenOrder}
                actionOrderId={runtime.actionOrderId}
              />
            ))
          ) : (
            <KitchenEmptyState title="Sin pedidos en este filtro." />
          )}
        </div>
      )}
    </section>
  );
};
