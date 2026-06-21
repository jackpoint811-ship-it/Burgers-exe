import { useEffect, useMemo, useState } from "react";
import { Button, Card, StatusPill } from "@ui/index";
import {
  CheckCircle2,
  Eye,
  ListChecks,
  MapPin,
  PanelTopOpen,
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
  buildKitchenLocalSummary,
  buildKitchenProductionItems,
  buildKitchenSideQuestItems,
  extractKitchenLocation,
  getComboBurgerNotes,
  getKitchenItemActionKind,
  getKitchenItemLabel,
  getKitchenItemNotes,
  stripLocationFromNotes,
} from "./kitchen-helpers";
import type {
  KitchenLocalSummary,
  KitchenOrder,
  KitchenOrdersRuntime,
  KitchenProductionItem,
  KitchenSideQuestItem,
  KitchenView,
  MoveKitchenOrderStatus,
  ToggleKitchenItemDone,
} from "./kitchen-types";

type KitchenSummaryK = NonNullable<KitchenSummaryKResponse["data"]>;

const terminalStatuses = new Set<OrderStatus>(["delivered", "cancelled"]);

const statusLabel: Record<OrderStatus, string> = {
  new: "Por hacer",
  preparing: "Preparación",
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
  pending: "Pago pendiente",
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

const kitchenViews: Array<{
  key: KitchenView;
  label: string;
  hint: string;
}> = [
  { key: "preparacion", label: "Preparación", hint: "Por item" },
  { key: "listos", label: "Listos", hint: "Compacto" },
  { key: "sideQuest", label: "Side Quest", hint: "Extras" },
  { key: "summaryK", label: "Resumen K", hint: "Total" },
];

const isOrderV2PaymentStatus = (
  value: string,
): value is OrderV2PaymentStatus =>
  value === "pending" || value === "paid" || value === "cancelled";

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

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

const KitchenMetricCard = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div className="kitchen-metric-card">
    <span>{value}</span>
    <p>{label}</p>
  </div>
);

const ItemDetailList = ({ item }: { item: KitchenProductionItem }) => {
  const notes = getKitchenItemNotes(item.item);
  const comboNotes = getComboBurgerNotes(item.item);
  const generalNote = stripLocationFromNotes(item.order.note);

  return (
    <div className="kitchen-item-details">
      {comboNotes.length ? (
        <div>
          <p className="kitchen-detail-label">Burgers del combo</p>
          <div className="mt-2 grid gap-1.5">
            {comboNotes.map((note) => (
              <span key={note} className="kitchen-note-chip">
                {note}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {notes.length ? (
        <div>
          <p className="kitchen-detail-label">Ingredientes y modificadores</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {notes.map((note) => (
              <span key={note} className="kitchen-note-chip">
                {note}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {generalNote ? (
        <p className="kitchen-critical-note">Nota: {generalNote}</p>
      ) : null}
      {!notes.length && !comboNotes.length && !generalNote ? (
        <p className="text-sm font-semibold text-zinc-400">
          Sin modificaciones registradas.
        </p>
      ) : null}
    </div>
  );
};

const KitchenProductionCard = ({
  entry,
  busy,
  onToggle,
  onOpen,
}: {
  entry: KitchenProductionItem;
  busy: boolean;
  onToggle: (entry: KitchenProductionItem, done: boolean) => void;
  onOpen: (order: KitchenOrder) => void;
}) => {
  const [expanded, setExpanded] = useState(!entry.collapsedByDefault);
  const location = extractKitchenLocation(entry.order.note);

  useEffect(() => {
    setExpanded(!entry.collapsedByDefault);
  }, [entry.collapsedByDefault, entry.id]);

  return (
    <article
      className={`kitchen-production-card ${entry.done ? "kitchen-production-card--done" : ""}`}
    >
      <div className="kitchen-production-card__head">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="kitchen-production-card__folio">{entry.order.folio}</p>
            <KitchenStatusBadge status={entry.order.status} />
            <KitchenPaymentStatusBadge status={entry.order.paymentState} />
          </div>
          <p className="mt-1 break-words text-base font-extrabold text-zinc-100">
            {entry.order.customer}
          </p>
        </div>
        <span className="kitchen-location-chip">
          <MapPin size={14} aria-hidden="true" />
          {location}
        </span>
      </div>

      <div className="kitchen-production-card__item">
        <span className="kitchen-item-kind">{getKitchenItemLabel(entry.item)}</span>
        <div className="min-w-0">
          <h3>{entry.item.name}</h3>
          <p>
            Item {entry.index + 1} de {entry.orderKitchenItemCount}
          </p>
        </div>
        <span className={entry.done ? "kitchen-dot kitchen-dot--done" : "kitchen-dot"}>
          {entry.done ? "Hecho" : "Por hacer"}
        </span>
      </div>

      {expanded ? <ItemDetailList item={entry} /> : null}

      {entry.collapsedByDefault ? (
        <button
          type="button"
          className="kitchen-disclosure"
          onClick={() => setExpanded((current) => !current)}
        >
          <PanelTopOpen size={16} aria-hidden="true" />
          {expanded ? "Contraer item" : "Abrir item"}
        </button>
      ) : null}

      {!entry.item.lineKey ? (
        <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm font-bold text-amber-100">
          No se puede marcar este item todavía. Revisa el detalle del pedido.
        </p>
      ) : null}

      <div className="kitchen-production-card__actions">
        <Button
          className={`kitchen-item-action ${entry.done ? "kitchen-item-action--done" : ""}`}
          disabled={busy || !entry.item.lineKey}
          onClick={() => onToggle(entry, !entry.done)}
        >
          {entry.done ? (
            <>
              <RefreshCw size={15} aria-hidden="true" /> Reabrir
            </>
          ) : (
            <>
              <CheckCircle2 size={16} aria-hidden="true" /> Hecho
            </>
          )}
        </Button>
        <Button className="kitchen-secondary-action" onClick={() => onOpen(entry.order)}>
          <Eye size={16} aria-hidden="true" /> Ver pedido
        </Button>
      </div>
    </article>
  );
};

const ReadyOrderCard = ({
  order,
  items,
  onOpen,
}: {
  order: KitchenOrder;
  items: KitchenProductionItem[];
  onOpen: (order: KitchenOrder) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const doneCount = items.filter((item) => item.done).length;
  const pendingCount = items.length - doneCount;
  return (
    <Card className="kitchen-ready-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xl font-black text-zinc-50">{order.folio}</p>
            <KitchenStatusBadge status={order.status} />
            <KitchenPaymentStatusBadge status={order.paymentState} />
          </div>
          <p className="mt-1 break-words text-sm font-bold text-zinc-200">
            {order.customer}
          </p>
        </div>
        <span className="kitchen-location-chip">
          <MapPin size={14} aria-hidden="true" />
          {extractKitchenLocation(order.note)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="kitchen-note-chip">{items.length} items</span>
        <span className="kitchen-note-chip">{doneCount} hechos</span>
        {pendingCount ? (
          <span className="kitchen-note-chip">{pendingCount} por hacer</span>
        ) : null}
      </div>
      {pendingCount ? (
        <p className="mt-3 text-sm font-semibold text-amber-100">
          Este pedido sigue teniendo items por hacer en Preparación.
        </p>
      ) : null}
      {expanded ? (
        <div className="mt-3 grid gap-2">
          {items.map((entry) => (
            <div key={entry.id} className="kitchen-ready-line">
              <span>{entry.done ? "Hecho" : "Por hacer"}</span>
              <div className="min-w-0">
                <strong>{entry.item.name}</strong>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                  {getKitchenItemLabel(entry.item)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button
          className="kitchen-secondary-action"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Contraer" : "Ver items"}
        </Button>
        <Button className="kitchen-secondary-action" onClick={() => onOpen(order)}>
          <Eye size={16} aria-hidden="true" /> Ver pedido
        </Button>
      </div>
    </Card>
  );
};

const DoneItemsSection = ({
  items,
  busyLineKey,
  onToggle,
  onOpen,
}: {
  items: KitchenProductionItem[];
  busyLineKey: string | null;
  onToggle: (entry: KitchenProductionItem, done: boolean) => void;
  onOpen: (order: KitchenOrder) => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!items.length) return null;

  return (
    <section className="kitchen-done-section">
      <div className="kitchen-done-section__header">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
            Hechos
          </p>
          <h3 className="mt-1 text-lg font-black text-zinc-50">
            Items disponibles para corregir
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Reabrir sigue disponible sin salir de Cocina.
          </p>
        </div>
        <Button
          className="kitchen-secondary-action"
          onClick={() => setExpanded((current) => !current)}
        >
          <PanelTopOpen size={16} aria-hidden="true" />
          {expanded ? "Ocultar hechos" : `Abrir hechos (${items.length})`}
        </Button>
      </div>

      {expanded ? (
        <div className="kitchen-item-grid">
          {items.map((entry) => (
            <KitchenProductionCard
              key={entry.id}
              entry={entry}
              busy={busyLineKey === entry.lineKey}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
};

const SideQuestPanel = ({ items }: { items: KitchenSideQuestItem[] }) => (
  <section className="kitchen-sidequest-grid">
    {items.length ? (
      items.map((item) => (
        <Card key={item.id} className="kitchen-sidequest-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                {item.order.folio}
              </p>
              <h3 className="mt-1 break-words text-lg font-black text-zinc-50">
                {item.label}
              </h3>
              <p className="mt-1 text-sm text-zinc-400">{item.detail}</p>
            </div>
            <span className={item.done ? "kitchen-dot kitchen-dot--done" : "kitchen-dot"}>
              {item.done ? "Hecho" : "Por hacer"}
            </span>
          </div>
        </Card>
      ))
    ) : (
      <KitchenEmptyState title="Sin Side Quest en producción actual." />
    )}
  </section>
);

const NextInKitchen = ({
  pendingItems,
  doneItems,
  onOpenItem,
}: {
  pendingItems: KitchenProductionItem[];
  doneItems: KitchenProductionItem[];
  onOpenItem: (item: KitchenProductionItem) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const firstPending = pendingItems[0];
  const items = expanded ? [...pendingItems, ...doneItems].slice(0, 12) : [];

  return (
    <Card className="kitchen-next-card">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-200">
            Siguiente en cocina
          </p>
          {firstPending ? (
            <>
              <h3 className="mt-1 break-words text-xl font-black text-zinc-50">
                {firstPending.order.folio} · {firstPending.item.name}
              </h3>
              <p className="mt-1 text-sm text-zinc-400">
                {firstPending.order.customer} · {extractKitchenLocation(firstPending.order.note)}
              </p>
            </>
          ) : (
            <h3 className="mt-1 text-xl font-black text-zinc-50">
              Sin items por hacer
            </h3>
          )}
        </div>
        <Button
          className="kitchen-secondary-action"
          onClick={() => setExpanded((current) => !current)}
        >
          <ListChecks size={16} aria-hidden="true" />
          {expanded ? "Ocultar lista" : "Abrir lista"}
        </Button>
      </div>
      {expanded ? (
        <div className="kitchen-next-list">
          {items.length ? (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="kitchen-next-list__item"
                onClick={() => onOpenItem(item)}
              >
                <span>{item.done ? "Hecho" : "Por hacer"}</span>
                <strong>{item.order.folio}</strong>
                <p>{item.item.name}</p>
              </button>
            ))
          ) : (
            <p className="text-sm text-zinc-400">No hay items para mostrar.</p>
          )}
        </div>
      ) : null}
    </Card>
  );
};

const SummaryMetric = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <Card className="border-cyan-500/20 bg-zinc-950 p-4">
    <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
      {label}
    </p>
    <p className="mt-2 text-3xl font-black text-cyan-100">{value}</p>
  </Card>
);

const KitchenSummaryKPanel = ({
  environment,
  localSummary,
}: {
  environment: OrderV2Environment;
  localSummary: KitchenLocalSummary;
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

  const costText =
    summary?.totals.estimatedCostCents == null
      ? "—"
      : formatCurrency(summary.totals.estimatedCostCents / 100);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric label="Total burgers" value={summary?.totals.burgers ?? localSummary.burgers} />
        <SummaryMetric label="Total guarniciones" value={summary?.totals.garnishes ?? localSummary.garnishes} />
        <SummaryMetric label="Combos desglosados" value={localSummary.comboBurgers} />
        <SummaryMetric label="Side Quest" value={localSummary.sideQuests} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric label="Por hacer" value={localSummary.pendingItems} />
        <SummaryMetric label="Hecho" value={localSummary.doneItems} />
        <SummaryMetric label="Extras" value={localSummary.extras} />
        <SummaryMetric label="Costo estimado" value={costText} />
      </div>

      {loading ? (
        <Card className="border-cyan-500/20 bg-zinc-950 p-4">
          <p className="text-sm font-semibold text-cyan-100">Cargando Resumen K...</p>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-rose-400/30 bg-rose-950/30 p-4">
          <p className="text-sm font-bold text-rose-100">{error}</p>
          <Button className="mt-3 border border-rose-300/30 bg-zinc-950" onClick={load}>
            Reintentar
          </Button>
        </Card>
      ) : null}

      {summary && !summary.hasRecipes ? (
        <Card className="border-amber-400/30 bg-amber-950/20 p-4">
          <p className="text-sm font-bold text-amber-100">
            Configura recetas aproximadas en Chekeo para desbloquear el cálculo de ingredientes.
          </p>
        </Card>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-emerald-500/20 bg-zinc-950 p-4">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-200">
                {orderEnvironmentLabel[environment]} · burgers
              </h3>
              <div className="mt-3 space-y-2">
                {summary.burgers.length ? (
                  summary.burgers.map((item) => (
                    <div key={item.sku} className="kitchen-summary-row">
                      <span>{item.name}</span>
                      <strong>{item.quantity}</strong>
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
                    <div key={item.sku} className="kitchen-summary-row">
                      <span>{item.name}</span>
                      <strong>{item.quantity}</strong>
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
                  <div key={ingredient.ingredientId} className="kitchen-ingredient-row">
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
        </>
      ) : null}
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
  const [view, setView] = useState<KitchenView>("preparacion");
  const [busyLineKey, setBusyLineKey] = useState<string | null>(null);

  const activeOrders = useMemo(
    () => orders.filter((order) => !terminalStatuses.has(order.status)),
    [orders],
  );
  const productionItems = useMemo(
    () => buildKitchenProductionItems(activeOrders),
    [activeOrders],
  );
  const pendingItems = useMemo(
    () => productionItems.filter((entry) => !entry.done),
    [productionItems],
  );
  const doneItems = useMemo(
    () => productionItems.filter((entry) => entry.done),
    [productionItems],
  );
  const readyOrders = useMemo(() => {
    const byOrder = new Map<string, { order: KitchenOrder; items: KitchenProductionItem[] }>();
    productionItems.forEach((entry) => {
      const current = byOrder.get(entry.order.id) ?? { order: entry.order, items: [] };
      current.items.push(entry);
      byOrder.set(entry.order.id, current);
    });
    return [...byOrder.values()].filter(
      ({ order, items }) => order.status === "ready" || items.every((item) => item.done),
    );
  }, [productionItems]);
  const sideQuestItems = useMemo(
    () => buildKitchenSideQuestItems(productionItems),
    [productionItems],
  );
  const localSummary = useMemo(
    () => buildKitchenLocalSummary(productionItems),
    [productionItems],
  );
  const fallback = runtime.source !== "d1";
  const kitchenTitle = fallback
    ? "Cocina en fallback"
    : runtime.environment === "preview"
      ? "Cocina conectada a preview"
      : "Cocina conectada a D1 real";
  const kitchenHint = fallback
    ? "Solo referencia visual. Reintenta antes de confirmar cambios como definitivos."
    : "Producción actual por item, ordenada por llegada.";

  const toggleKitchenItem = async (entry: KitchenProductionItem, done: boolean) => {
    if (!entry.item.lineKey) return;
    setBusyLineKey(entry.lineKey);
    try {
      if (done && entry.order.status === "new") {
        await onMove(entry.order.id, "preparing", "Cocina: preparación actual");
      }
      await onToggleKitchenItem(
        entry.order.id,
        entry.lineKey,
        getKitchenItemActionKind(entry.item),
        done,
      );
      const orderItems = productionItems.filter(
        (item) => item.order.id === entry.order.id,
      );
      const allDoneAfter = orderItems.every((item) =>
        item.lineKey === entry.lineKey ? done : item.done,
      );
      if (
        done &&
        allDoneAfter &&
        (entry.order.status === "new" || entry.order.status === "preparing")
      ) {
        await onMove(entry.order.id, "ready", "Cocina: preparación completa");
      }
    } finally {
      setBusyLineKey(null);
    }
  };

  const viewCounts: Record<KitchenView, number | string> = {
    preparacion: pendingItems.length,
    listos: readyOrders.length,
    sideQuest: sideQuestItems.length,
    summaryK: localSummary.totalItems,
  };

  return (
    <section className="kitchen-production">
      <div className="kitchen-hero">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="home-section-label">Preparación</p>
            <h2 className="mt-1 text-2xl font-black text-zinc-50 md:text-3xl">
              Cocina
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-400">
              {kitchenTitle}. {kitchenHint}
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
          </div>
        </div>
        <div className="kitchen-command-strip">
          <KitchenMetricCard label="Por hacer" value={pendingItems.length} />
          <KitchenMetricCard label="Hecho" value={localSummary.doneItems} />
          <KitchenMetricCard label="Listos" value={readyOrders.length} />
          <KitchenMetricCard label="Side Quest" value={sideQuestItems.length} />
        </div>
        <div className="kitchen-view-tabs">
          {kitchenViews.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={view === option.key}
              className={`kitchen-view-tab ${view === option.key ? "kitchen-view-tab--active" : ""}`}
              onClick={() => setView(option.key)}
            >
              <span>{option.label}</span>
              <strong>{viewCounts[option.key]}</strong>
              <p>{option.hint}</p>
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

      {view !== "summaryK" ? (
        <NextInKitchen
          pendingItems={pendingItems}
          doneItems={doneItems}
          onOpenItem={(item) => onOpenOrder(item.order)}
        />
      ) : null}

      {view === "preparacion" ? (
        <section className="space-y-4">
          <div className="kitchen-section">
            <div className="kitchen-section__header">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-200">
                  Por hacer
                </p>
                <h3 className="mt-1 text-lg font-black text-zinc-50">
                  Producción accionable
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Incluye pedidos en Preparación y pedidos Listos con items pendientes.
                </p>
              </div>
              <span className="kitchen-note-chip">{pendingItems.length} items</span>
            </div>
            <div className="kitchen-item-grid">
              {pendingItems.length ? (
                pendingItems.map((entry) => (
                  <KitchenProductionCard
                    key={entry.id}
                    entry={entry}
                    busy={busyLineKey === entry.lineKey}
                    onToggle={toggleKitchenItem}
                    onOpen={onOpenOrder}
                  />
                ))
              ) : (
                <KitchenEmptyState title="Sin items por hacer." />
              )}
            </div>
          </div>
          <DoneItemsSection
            items={doneItems}
            busyLineKey={busyLineKey}
            onToggle={toggleKitchenItem}
            onOpen={onOpenOrder}
          />
        </section>
      ) : null}

      {view === "listos" ? (
        <section className="kitchen-ready-grid">
          {readyOrders.length ? (
            readyOrders.map(({ order, items }) => (
              <ReadyOrderCard
                key={order.id}
                order={order}
                items={items}
                onOpen={onOpenOrder}
              />
            ))
          ) : (
            <KitchenEmptyState title="Sin pedidos listos." />
          )}
        </section>
      ) : null}

      {view === "sideQuest" ? <SideQuestPanel items={sideQuestItems} /> : null}

      {view === "summaryK" ? (
        <KitchenSummaryKPanel
          environment={runtime.environment}
          localSummary={localSummary}
        />
      ) : null}
    </section>
  );
};
