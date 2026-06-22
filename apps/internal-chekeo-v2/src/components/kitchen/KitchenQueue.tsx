import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@ui/index";
import {
  CheckCircle2,
  MapPin,
  RefreshCw,
} from "lucide-react";
import type {
  KitchenSummaryKResponse,
  OrderStatus,
  OrderV2Environment,
} from "@config/index";
import { fetchKitchenSummaryK } from "../../lib/ingredients-v2-admin";
import {
  buildKitchenLocalSummary,
  buildKitchenProductionItems,
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
  KitchenView,
  MoveKitchenOrderStatus,
  ToggleKitchenItemDone,
} from "./kitchen-types";

type KitchenSummaryK = NonNullable<KitchenSummaryKResponse["data"]>;

const terminalStatuses = new Set<OrderStatus>(["delivered", "cancelled"]);

const orderEnvironmentLabel: Record<OrderV2Environment, string> = {
  production: "Producción",
  preview: "Preview",
};

const kitchenViews: Array<{
  key: KitchenView;
  label: string;
}> = [
  { key: "preparacion", label: "Preparación" },
  { key: "sideQuest", label: "Side Quest" },
  { key: "summaryK", label: "Resumen K" },
];

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

const KitchenEmptyState = ({ title }: { title: string }) => (
  <Card className="border-dashed border-zinc-700/90 p-5 text-center">
    <p className="text-base font-black text-zinc-100">{title}</p>
  </Card>
);

const ItemDetailList = ({ item }: { item: KitchenProductionItem }) => {
  const rawNotes = getKitchenItemNotes(item.item);
  const notes =
    item.lane === "prep"
      ? rawNotes.filter(
          (note) =>
            !note.startsWith("Guarnición:") &&
            !note.startsWith("Side Quest:") &&
            !note.startsWith("Bebida:") &&
            !note.startsWith("Burgers del combo:"),
        )
      : [
          ...(item.item.parentItemName ? [`Parte de: ${item.item.parentItemName}`] : []),
          ...(item.detailLabel ? [`Item: ${item.detailLabel}`] : []),
        ];
  const comboNotes = item.lane === "prep" ? getComboBurgerNotes(item.item) : [];
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
  expanded,
  onExpand,
  onToggle,
}: {
  entry: KitchenProductionItem;
  busy: boolean;
  expanded: boolean;
  onExpand: () => void;
  onToggle: (entry: KitchenProductionItem, done: boolean) => void;
}) => {
  const location = extractKitchenLocation(entry.order.note);

  return (
    <article
      className={`kitchen-production-card ${entry.done ? "kitchen-production-card--done" : ""} ${expanded && !entry.done ? "kitchen-production-card--active" : ""}`}
    >
      <div className="kitchen-production-card__head">
        <div className="min-w-0">
          <p className="kitchen-production-card__customer">
            {entry.order.customer}
          </p>
          <p className="kitchen-production-card__folio">{entry.order.folio}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <span className="kitchen-location-chip">
            <MapPin size={14} aria-hidden="true" />
            {location}
          </span>
          {entry.kind === "combo" || entry.item.parentItemName ? (
            <span className="kitchen-location-chip kitchen-location-chip--combo">
              Combo
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className="kitchen-production-card__item"
        aria-expanded={expanded}
        onClick={onExpand}
      >
        <span className="kitchen-item-kind">{entry.itemLabel || getKitchenItemLabel(entry.item)}</span>
        <div className="min-w-0">
          <h3>{entry.detailLabel || entry.item.name}</h3>
          <p>
            Item {entry.index + 1} de {entry.orderKitchenItemCount}
          </p>
        </div>
        <span className={entry.done ? "kitchen-dot kitchen-dot--done" : "kitchen-dot"}>
          {entry.done ? "Hecha" : "Por hacer"}
        </span>
      </button>

      {expanded ? <ItemDetailList item={entry} /> : null}

      {!entry.item.lineKey ? (
        <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm font-bold text-amber-100">
          No se puede marcar este item todavía. Revisa el detalle del pedido.
        </p>
      ) : null}

      {!entry.done ? (
        <div className="kitchen-production-card__actions">
          <Button
            className="kitchen-item-action"
            disabled={busy || !entry.item.lineKey}
            onClick={() => onToggle(entry, true)}
          >
            <>
              <CheckCircle2 size={16} aria-hidden="true" /> Hecha
            </>
          </Button>
        </div>
      ) : null}
    </article>
  );
};

const KitchenOrderAccordion = ({
  orderItems,
  busyLineKey,
  onToggle,
}: {
  orderItems: KitchenProductionItem[];
  busyLineKey: string | null;
  onToggle: (entry: KitchenProductionItem, done: boolean) => void;
}) => {
  const firstPendingId =
    orderItems.find((entry) => !entry.done)?.id ?? orderItems[0]?.id ?? "";
  const [expandedId, setExpandedId] = useState(firstPendingId);

  useEffect(() => {
    setExpandedId(firstPendingId);
  }, [firstPendingId]);

  if (!orderItems.length) return null;

  return (
    <section className="kitchen-order-accordion">
      {orderItems.map((entry) => (
        <KitchenProductionCard
          key={entry.id}
          entry={entry}
          busy={busyLineKey === entry.lineKey}
          expanded={expandedId === entry.id && !entry.done}
          onExpand={() => setExpandedId(entry.id)}
          onToggle={onToggle}
        />
      ))}
    </section>
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
  const estimatedProfitText =
    summary?.totals.estimatedCostCents == null
      ? "—"
      : formatCurrency(localSummary.estimatedSales - summary.totals.estimatedCostCents / 100);

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
        <SummaryMetric label="Hechas" value={localSummary.doneItems} />
        <SummaryMetric label="Extras" value={localSummary.extras} />
        <SummaryMetric label="Ventas visibles" value={formatCurrency(localSummary.estimatedSales)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryMetric label="Costo producción" value={costText} />
        <SummaryMetric label="Ganancia estimada" value={estimatedProfitText} />
        <SummaryMetric label="Insumos" value={summary?.totals.ingredients ?? 0} />
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
}: {
  orders: KitchenOrder[];
  runtime: KitchenOrdersRuntime;
  onToggleKitchenItem: ToggleKitchenItemDone;
  onMove: MoveKitchenOrderStatus;
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
  const prepItems = useMemo(
    () => productionItems.filter((entry) => entry.lane === "prep"),
    [productionItems],
  );
  const prepPendingItems = useMemo(
    () => prepItems.filter((entry) => !entry.done),
    [prepItems],
  );
  const sideQuestProductionItems = useMemo(
    () => productionItems.filter((entry) => entry.lane === "sideQuest"),
    [productionItems],
  );
  const sideQuestPendingItems = useMemo(
    () => sideQuestProductionItems.filter((entry) => !entry.done),
    [sideQuestProductionItems],
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
        item.id === entry.id ? done : item.done,
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

  const groupItemsByOrder = (items: KitchenProductionItem[]) => {
    const groups = new Map<string, KitchenProductionItem[]>();
    items.forEach((entry) => {
      groups.set(entry.order.id, [...(groups.get(entry.order.id) ?? []), entry]);
    });
    return [...groups.values()];
  };

  const prepOrderGroups = useMemo(() => groupItemsByOrder(prepItems), [prepItems]);
  const sideQuestOrderGroups = useMemo(
    () => groupItemsByOrder(sideQuestProductionItems),
    [sideQuestProductionItems],
  );

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

      {view === "preparacion" ? (
        <section className="space-y-4">
          <div id="kitchen-pending" className="kitchen-section">
            <div className="kitchen-section__header">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-200">
                  Por hacer
                </p>
                <h3 className="mt-1 text-lg font-black text-zinc-50">
                  Burgers por orden
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Hamburguesas individuales y burgers dentro de combos.
                </p>
              </div>
              <span className="kitchen-note-chip">{prepPendingItems.length} pendientes</span>
            </div>
            <div className="kitchen-item-grid">
              {prepOrderGroups.length ? (
                prepOrderGroups.map((orderItems) => (
                  <KitchenOrderAccordion
                    key={orderItems[0]?.order.id}
                    orderItems={orderItems}
                    busyLineKey={busyLineKey}
                    onToggle={toggleKitchenItem}
                  />
                ))
              ) : (
                <KitchenEmptyState title="Sin burgers por hacer." />
              )}
            </div>
          </div>
        </section>
      ) : null}

      {view === "sideQuest" ? (
        <section className="space-y-4">
          <div id="kitchen-pending" className="kitchen-section">
            <div className="kitchen-section__header">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                  Side Quest
                </p>
                <h3 className="mt-1 text-lg font-black text-zinc-50">
                  Complementos por orden
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Papas, guarniciones, bebidas y extras no-burger.
                </p>
              </div>
              <span className="kitchen-note-chip">
                {sideQuestPendingItems.length} items
              </span>
            </div>
            <div className="kitchen-item-grid">
              {sideQuestOrderGroups.length ? (
                sideQuestOrderGroups.map((orderItems) => (
                  <KitchenOrderAccordion
                    key={orderItems[0]?.order.id}
                    orderItems={orderItems}
                    busyLineKey={busyLineKey}
                    onToggle={toggleKitchenItem}
                  />
                ))
              ) : (
                <KitchenEmptyState title="Sin Side Quest por hacer." />
              )}
            </div>
          </div>
        </section>
      ) : null}

      {view === "summaryK" ? (
        <KitchenSummaryKPanel
          environment={runtime.environment}
          localSummary={localSummary}
        />
      ) : null}
    </section>
  );
};
