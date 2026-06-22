import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@ui/index";
import {
  CheckCircle2,
  MapPin,
  PanelTopOpen,
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
  hint: string;
}> = [
  { key: "preparacion", label: "Preparación", hint: "Por item" },
  { key: "sideQuest", label: "Side Quest", hint: "Hecha" },
  { key: "summaryK", label: "Resumen K", hint: "Total" },
];

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

const KitchenEmptyState = ({ title }: { title: string }) => (
  <Card className="border-dashed border-zinc-700/90 p-5 text-center">
    <p className="text-base font-black text-zinc-100">{title}</p>
  </Card>
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
}: {
  entry: KitchenProductionItem;
  busy: boolean;
  onToggle: (entry: KitchenProductionItem, done: boolean) => void;
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
          <p className="kitchen-production-card__folio">{entry.order.folio}</p>
          <p className="kitchen-production-card__customer">
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
          {entry.done ? "Hecha" : "Por hacer"}
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
          {expanded ? "Ocultar item" : "Mostrar item"}
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
              <CheckCircle2 size={16} aria-hidden="true" /> Hecha
            </>
          )}
        </Button>
      </div>
    </article>
  );
};

const DoneItemsSection = ({
  items,
  busyLineKey,
  onToggle,
}: {
  items: KitchenProductionItem[];
  busyLineKey: string | null;
  onToggle: (entry: KitchenProductionItem, done: boolean) => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!items.length) return null;

  return (
    <section id="kitchen-done" className="kitchen-done-section">
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
            />
          ))}
        </div>
      ) : null}
    </section>
  );
};

const scrollToKitchenSection = (id: string) => {
  document.getElementById(id)?.scrollIntoView({
    block: "start",
    behavior: "smooth",
  });
};

const KitchenAnchorControls = ({
  pendingCount,
  doneCount,
}: {
  pendingCount: number;
  doneCount: number;
}) => (
  <div className="kitchen-anchor-controls" aria-label="Filtros de preparación">
    <button
      type="button"
      className="kitchen-anchor-button kitchen-anchor-button--active"
      onClick={() => scrollToKitchenSection("kitchen-pending")}
    >
      Por hacer <strong>{pendingCount}</strong>
    </button>
    <button
      type="button"
      className="kitchen-anchor-button"
      onClick={() => scrollToKitchenSection("kitchen-done")}
    >
      Hechas <strong>{doneCount}</strong>
    </button>
  </div>
);

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
        <SummaryMetric label="Hechas" value={localSummary.doneItems} />
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
  const pendingItems = useMemo(
    () => productionItems.filter((entry) => !entry.done),
    [productionItems],
  );
  const doneItems = useMemo(
    () => productionItems.filter((entry) => entry.done),
    [productionItems],
  );
  const sideQuestProductionItems = useMemo(
    () =>
      productionItems.filter(
        (entry) =>
          entry.kind === "garnish" ||
          Boolean(entry.item.garnish) ||
          entry.item.sideQuestExtras.some((extra) => extra.itemKind !== "drink"),
      ),
    [productionItems],
  );
  const sideQuestPendingItems = useMemo(
    () => sideQuestProductionItems.filter((entry) => !entry.done),
    [sideQuestProductionItems],
  );
  const sideQuestDoneItems = useMemo(
    () => sideQuestProductionItems.filter((entry) => entry.done),
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
    sideQuest: sideQuestPendingItems.length,
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

      {view === "preparacion" ? (
        <section className="space-y-4">
          <KitchenAnchorControls
            pendingCount={pendingItems.length}
            doneCount={doneItems.length}
          />
          <div id="kitchen-pending" className="kitchen-section">
            <div className="kitchen-section__header">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-200">
                  Por hacer
                </p>
                <h3 className="mt-1 text-lg font-black text-zinc-50">
                  Producción accionable
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Incluye pedidos nuevos y en preparación con items pendientes.
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
          />
        </section>
      ) : null}

      {view === "sideQuest" ? (
        <section className="space-y-4">
          <KitchenAnchorControls
            pendingCount={sideQuestPendingItems.length}
            doneCount={sideQuestDoneItems.length}
          />
          <div id="kitchen-pending" className="kitchen-section">
            <div className="kitchen-section__header">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                  Side Quest
                </p>
                <h3 className="mt-1 text-lg font-black text-zinc-50">
                  Extras accionables
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Guarniciones y extras se marcan con el mismo checklist real de Cocina.
                </p>
              </div>
              <span className="kitchen-note-chip">
                {sideQuestPendingItems.length} items
              </span>
            </div>
            <div className="kitchen-item-grid">
              {sideQuestPendingItems.length ? (
                sideQuestPendingItems.map((entry) => (
                  <KitchenProductionCard
                    key={entry.id}
                    entry={entry}
                    busy={busyLineKey === entry.lineKey}
                    onToggle={toggleKitchenItem}
                  />
                ))
              ) : (
                <KitchenEmptyState title="Sin Side Quest por hacer." />
              )}
            </div>
          </div>
          <DoneItemsSection
            items={sideQuestDoneItems}
            busyLineKey={busyLineKey}
            onToggle={toggleKitchenItem}
          />
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
