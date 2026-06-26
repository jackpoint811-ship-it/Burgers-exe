import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card } from "@ui/index";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
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

/* ------------------------------------------------------------------ */
/*  Grouped order type for production line                            */
/* ------------------------------------------------------------------ */

type OrderGroup = {
  orderId: string;
  order: KitchenOrder;
  items: KitchenProductionItem[];
  allDone: boolean;
  pendingCount: number;
  doneCount: number;
  summaryLabel: string;
};

const buildOrderGroups = (items: KitchenProductionItem[]): OrderGroup[] => {
  const map = new Map<string, KitchenProductionItem[]>();
  for (const item of items) {
    const existing = map.get(item.order.id);
    if (existing) existing.push(item);
    else map.set(item.order.id, [item]);
  }
  return [...map.entries()].map(([orderId, orderItems]) => {
    const pendingCount = orderItems.filter((i) => !i.done).length;
    const doneCount = orderItems.filter((i) => i.done).length;
    const summaryLabel = orderItems
      .map((i) => i.detailLabel || i.item.name)
      .join(" · ");
    return {
      orderId,
      order: orderItems[0]!.order,
      items: orderItems,
      allDone: pendingCount === 0,
      pendingCount,
      doneCount,
      summaryLabel,
    };
  });
};

/* ------------------------------------------------------------------ */
/*  Empty state                                                       */
/* ------------------------------------------------------------------ */

const KitchenEmptyState = ({ title }: { title: string }) => (
  <Card className="border-dashed border-zinc-700/90 p-5 text-center">
    <p className="text-base font-black text-zinc-100">{title}</p>
  </Card>
);

/* ------------------------------------------------------------------ */
/*  Item detail list (unchanged from previous, filters by lane)       */
/* ------------------------------------------------------------------ */

const ItemDetailList = ({ item }: { item: KitchenProductionItem }) => {
  const isPrep = item.lane === "prep";

  // BURGER block (Combo burgers)
  const comboNotes = isPrep ? getComboBurgerNotes(item.item) : [];

  // MOD block
  const mods = isPrep ? item.item.removedIngredients.map(ing => `Sin ${ing}`) : [];

  // UPGRADE block
  const upgrades = isPrep ? item.item.extras.map(e => e.name.replace(/\bextras?\b/gi, "").replace(/\s+/g, " ").trim()).filter(Boolean) : [];

  // NOTES block
  const generalNote = stripLocationFromNotes(item.order.note);
  const itemNote = isPrep ? item.item.burgerNote : null;

  // SideQuest / Non-prep specific notes
  const otherNotes = !isPrep ? [
    ...(item.item.parentItemName ? [`Parte de: ${item.item.parentItemName}`] : []),
    ...(item.detailLabel ? [`Item: ${item.detailLabel}`] : []),
  ] : [];

  return (
    <div className="kitchen-item-details">
      {comboNotes.length ? (
        <div className="kitchen-detail-block kitchen-detail-block--burger">
          <p className="kitchen-detail-label">Burgers del combo</p>
          <div className="mt-2 grid gap-2">
            {comboNotes.map((note) => (
              <span key={note} className="kitchen-note-chip kitchen-note-chip--combo">
                {note}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {mods.length || upgrades.length ? (
        <div className="kitchen-detail-block kitchen-detail-block--mod-upgrade grid gap-3 min-[420px]:grid-cols-2">
          {mods.length ? (
            <div className="kitchen-detail-block h-full">
              <p className="kitchen-detail-label text-rose-300">Mod (Quitar)</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {mods.map((note) => (
                  <span key={note} className="kitchen-note-chip kitchen-note-chip--mod">
                    {note}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {upgrades.length ? (
            <div className="kitchen-detail-block h-full">
              <p className="kitchen-detail-label text-lime-300">Upgrade (Agregar)</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {upgrades.map((note) => (
                  <span key={note} className="kitchen-note-chip kitchen-note-chip--upgrade">
                    {note}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {otherNotes.length ? (
        <div className="kitchen-detail-block">
          <p className="kitchen-detail-label">Detalles</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {otherNotes.map((note) => (
              <span key={note} className="kitchen-note-chip">
                {note}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {itemNote || generalNote ? (
        <div className="kitchen-detail-block kitchen-detail-block--notes">
          {itemNote ? <p className="kitchen-critical-note">Nota de item: {itemNote}</p> : null}
          {generalNote ? <p className="kitchen-critical-note">Nota general: {generalNote}</p> : null}
        </div>
      ) : null}

      {!comboNotes.length && !mods.length && !upgrades.length && !otherNotes.length && !itemNote && !generalNote ? (
        <p className="text-sm font-semibold text-zinc-500 italic p-2">
          Sin modificaciones registradas.
        </p>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Accordion item row within an order                                */
/* ------------------------------------------------------------------ */

const AccordionItemRow = ({
  entry,
  busy,
  expanded,
  glowing,
  onExpand,
  onToggle,
}: {
  entry: KitchenProductionItem;
  busy: boolean;
  expanded: boolean;
  glowing: boolean;
  onExpand: () => void;
  onToggle: (entry: KitchenProductionItem, done: boolean) => void;
}) => (
  <div
    className={`kitchen-accordion-item ${entry.done ? "kitchen-accordion-item--done" : ""} ${expanded ? "kitchen-accordion-item--open" : ""} ${glowing ? "kitchen-accordion-item--glow" : ""}`}
  >
    <button
      type="button"
      className="kitchen-accordion-item__header kitchen-production-card__item"
      aria-expanded={expanded}
      onClick={onExpand}
    >
      <span className="kitchen-item-kind">
        {entry.itemLabel || getKitchenItemLabel(entry.item)}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-base font-black text-zinc-50">
          {entry.detailLabel || entry.item.name}
        </h3>
      </div>
      <span
        className={
          entry.done ? "kitchen-dot kitchen-dot--done" : "kitchen-dot"
        }
      >
        {entry.done ? "Hecha" : "Por hacer"}
      </span>
    </button>

    {expanded ? (
      <>
        <ItemDetailList item={entry} />

        {!entry.item.lineKey ? (
          <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm font-bold text-amber-100">
            No se puede marcar este item todavía. Revisa el detalle del pedido.
          </p>
        ) : null}

        <div className="kitchen-accordion-item__actions">
          {entry.done ? (
            <Button
              className="kitchen-item-action kitchen-item-action--done"
              disabled={busy || !entry.item.lineKey}
              onClick={() => onToggle(entry, false)}
            >
              Revertir hecha
            </Button>
          ) : (
            <Button
              className="kitchen-item-action"
              disabled={busy || !entry.item.lineKey}
              onClick={() => onToggle(entry, true)}
            >
              <>
                <CheckCircle2 size={16} aria-hidden="true" /> Hecha
              </>
            </Button>
          )}
        </div>
      </>
    ) : null}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Active order container                                            */
/* ------------------------------------------------------------------ */

const ActiveOrderContainer = ({
  group,
  busyLineKey,
  onToggle,
}: {
  group: OrderGroup;
  busyLineKey: string | null;
  onToggle: (entry: KitchenProductionItem, done: boolean) => void;
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [glowingId, setGlowingId] = useState<string | null>(null);

  useEffect(() => {
    setExpandedId(
      group.items.find((entry) => !entry.done)?.id ?? group.items[0]?.id ?? ""
    );
  }, [group.orderId]);

  const handleToggle = (entry: KitchenProductionItem, done: boolean) => {
    onToggle(entry, done);
    if (done) {
      const nextPending = group.items.find(i => i.id !== entry.id && !i.done);
      if (nextPending) setExpandedId(nextPending.id);
    } else {
      setExpandedId(entry.id);
      setGlowingId(entry.id);
      setTimeout(() => setGlowingId(null), 800);
    }
  };

  const location = extractKitchenLocation(group.order.note);
  const hasCombo = group.items.some(
    (entry) => entry.kind === "combo" || entry.item.parentItemName,
  );

  return (
    <section className="kitchen-active-order kitchen-production-card" aria-label="Orden activa">
      <div className="kitchen-active-order__header flex-col md:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-400 m-0">Pedido Activo</p>
            <span className="text-[10px] font-black bg-lime-400/20 text-lime-300 px-1.5 py-0.5 rounded uppercase tracking-[0.1em]">
              {group.doneCount}/{group.items.length}
            </span>
          </div>
          <h3 className="kitchen-active-order__customer">
            {group.order.customer}
          </h3>
          <p className="kitchen-active-order__folio kitchen-production-card__folio">{group.order.folio}</p>
        </div>
        <div className="flex flex-wrap md:justify-end gap-1.5 self-start w-full md:w-auto mt-2 md:mt-0">
          <span className="kitchen-location-chip">
            <MapPin size={14} aria-hidden="true" />
            {location}
          </span>
          {hasCombo ? (
            <span className="kitchen-location-chip kitchen-location-chip--combo">
              Combo
            </span>
          ) : null}
        </div>
      </div>

      <div className="kitchen-active-order__items">
        {group.items.length === 1 ? (
          <AccordionItemRow
            entry={group.items[0]!}
            busy={busyLineKey === group.items[0]!.lineKey}
            expanded={expandedId === group.items[0]!.id}
            glowing={glowingId === group.items[0]!.id}
            onExpand={() => setExpandedId(group.items[0]!.id)}
            onToggle={handleToggle}
          />
        ) : (
          group.items.map((entry) => (
            <AccordionItemRow
              key={entry.id}
              entry={entry}
              busy={busyLineKey === entry.lineKey}
              expanded={expandedId === entry.id}
              glowing={glowingId === entry.id}
              onExpand={() => setExpandedId(entry.id)}
              onToggle={handleToggle}
            />
          ))
        )}
      </div>
    </section>
  );
};

const PendingOrdersQueue = ({
  groups,
  onSelect,
}: {
  groups: OrderGroup[];
  onSelect: (orderId: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? groups : groups.slice(0, 4);

  if (!groups.length) return null;

  return (
    <section className="kitchen-following-orders mt-4">
      {expanded ? (
        <button
          type="button"
          className="kitchen-following-orders__toggle w-full flex items-center justify-between px-4 py-3 text-left font-black text-cyan-400 hover:bg-zinc-800/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-300 transition-colors"
          onClick={() => setExpanded(false)}
          aria-expanded={true}
        >
          <span className="text-[11px] tracking-[0.2em] uppercase">
            Cola de pedidos ({groups.length})
          </span>
          <ChevronUp size={16} />
        </button>
      ) : null}

      {expanded ? (
        <div className="kitchen-following-orders__list border-t border-zinc-800/40 p-3 space-y-3">
          {groups.map((group) => (
            <div key={group.orderId} className="kitchen-production-card bg-zinc-950/60 border border-zinc-800/80 p-3 rounded-xl text-left">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-black text-zinc-100 text-lg">{group.order.customer}</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{group.order.folio}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{group.summaryLabel}</p>
                </div>
                <Button
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs px-3 py-1.5 h-auto min-h-0 whitespace-nowrap"
                  onClick={() => onSelect(group.orderId)}
                >
                  Cocinar pedido
                </Button>
              </div>
              <div className="space-y-1.5 border-t border-zinc-800/50 pt-2 mt-2">
                {group.items.map((item) => (
                  <div key={item.id} className="text-sm flex justify-between">
                    <span className="text-zinc-300 font-bold">{item.detailLabel || item.item.name}</span>
                    <span className="text-zinc-600 text-[10px] uppercase tracking-widest font-black">{getKitchenItemLabel(item.item)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div          className="kitchen-following-orders__list p-3 grid gap-2 cursor-pointer hover:bg-zinc-900/20"          onClick={() => setExpanded(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded(true);
            }
          }}
        >
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-[11px] font-black tracking-[0.2em] uppercase text-cyan-400">
              Cola de pedidos ({groups.length})
            </span>
            <ChevronDown size={16} className="text-cyan-400" />
          </div>
          {visible.map((group, idx) => {
            const isFirst = idx === 0;
            const opacityValue = isFirst ? 1 : idx === 1 ? 0.75 : idx === 2 ? 0.55 : 0.4;
            return (
              <div
                key={group.orderId}
                className={`kitchen-production-card flex justify-between items-center px-3 py-2.5 rounded-lg border transition-all ${
                  isFirst ? "border-cyan-500/30 bg-cyan-950/20" : "border-zinc-800/40 bg-zinc-950/20"
                }`}
                style={{ opacity: opacityValue }}
              >
                <div className="text-left">
                  <p className={`text-[10px] font-black uppercase tracking-[0.16em] mb-0.5 ${isFirst ? "text-cyan-300" : "text-zinc-500"}`}>
                    {isFirst ? "Siguiente" : "Después"}
                  </p>
                  <p className={`font-black ${isFirst ? "text-zinc-100 text-base" : "text-zinc-300 text-sm"}`}>{group.order.customer}</p>
                  <p className="truncate text-xs text-zinc-500">{group.summaryLabel}</p>
                </div>
                <span className="text-[10px] font-black text-zinc-600 uppercase">{group.order.folio}</span>
              </div>
            );
          })}
          {groups.length > 4 ? (
             <p className="text-center text-[10px] font-black tracking-[0.2em] uppercase text-zinc-600 mt-2">+{groups.length - 4} pedidos más</p>
          ) : null}
        </div>
      )}
    </section>
  );
};

/* ------------------------------------------------------------------ */
/*  Done list (compact, collapsed at bottom)                          */
/* ------------------------------------------------------------------ */

const DoneOrdersList = ({
  groups,
  label,
  busyLineKey,
  onToggle,
}: {
  groups: OrderGroup[];
  label: string;
  busyLineKey: string | null;
  onToggle: (entry: KitchenProductionItem, done: boolean) => void;
}) => {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (!groups.length) return null;

  const foliosLabel = groups.map((g) => g.order.folio).join(", ");

  return (
    <section className="kitchen-done-list">
      <button
        type="button"
        className="kitchen-done-list__toggle flex flex-col items-start gap-1 p-3 w-full border-t border-zinc-800/40 hover:bg-zinc-800/20 transition-colors mt-4"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <div className="flex w-full items-center justify-between">
          <span className="text-[11px] font-black tracking-[0.2em] uppercase text-zinc-300">
            {label} · {groups.length} {groups.length === 1 ? "pedido" : "pedidos"}
          </span>
          {expanded ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
        </div>
        {!expanded ? (
          <span className="text-xs text-zinc-500">Toca para revisar o revertir</span>
        ) : null}
      </button>
      {expanded ? (
        <div className="kitchen-done-list__items">
          {groups.map((group) => {
            const isGroupExpanded = expandedGroupId === group.orderId;
            return (
              <div key={group.orderId} className="kitchen-done-list__item border-b border-zinc-800/30 pb-3 last:border-0 last:pb-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-300"
                  onClick={() => {
                    setExpandedGroupId(isGroupExpanded ? null : group.orderId);
                    setExpandedItemId(null);
                  }}
                  aria-expanded={isGroupExpanded}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-zinc-100">{group.order.customer}</p>
                      <span className="kitchen-dot kitchen-dot--done">Hecha</span>
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-500">{group.order.folio}</p>
                    <p className="mt-0.5 text-sm text-zinc-400">{group.summaryLabel}</p>
                  </div>
                  {isGroupExpanded ? (
                    <ChevronUp size={16} className="text-zinc-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-zinc-500 flex-shrink-0" />
                  )}
                </button>

                {isGroupExpanded ? (
                  <div className="mt-3 space-y-2.5 pl-2 border-l border-zinc-800/80">
                    {group.items.map((entry) => (
                      <AccordionItemRow
                        key={entry.id}
                        entry={entry}
                        busy={busyLineKey === entry.lineKey}
                        expanded={expandedItemId === entry.id}
                        glowing={false}
                        onExpand={() => setExpandedItemId(expandedItemId === entry.id ? null : entry.id)}
                        onToggle={onToggle}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};

/* ------------------------------------------------------------------ */
/*  Production lane panel (shared by Preparación & Side Quest)        */
/* ------------------------------------------------------------------ */

const ProductionLanePanel = ({
  laneItems,
  laneName,
  laneDescription,
  laneAccent,
  busyLineKey,
  onToggle,
}: {
  laneItems: KitchenProductionItem[];
  laneName: string;
  laneDescription: string;
  laneAccent: string;
  busyLineKey: string | null;
  onToggle: (entry: KitchenProductionItem, done: boolean) => void;
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const orderGroups = useMemo(() => buildOrderGroups(laneItems), [laneItems]);
  const pendingGroups = useMemo(
    () => orderGroups.filter((g) => !g.allDone),
    [orderGroups],
  );
  const doneGroups = useMemo(
    () => orderGroups.filter((g) => g.allDone),
    [orderGroups],
  );

  const activeGroup = useMemo(() => {
    if (selectedOrderId) {
      const found = pendingGroups.find((g) => g.orderId === selectedOrderId);
      if (found) return found;
    }
    return pendingGroups[0] ?? null;
  }, [pendingGroups, selectedOrderId]);

  const otherPendingGroups = useMemo(() => {
    if (!activeGroup) return pendingGroups;
    return pendingGroups.filter((g) => g.orderId !== activeGroup.orderId);
  }, [pendingGroups, activeGroup]);



  if (!orderGroups.length) {
    return <KitchenEmptyState title={`Sin items en ${laneName}.`} />;
  }

  return (
    <section className="kitchen-lane space-y-4">
      {/* Section header */}
      <div className="kitchen-section__header">
        <div>
          <p
            className={`text-xs font-black uppercase tracking-[0.18em] ${laneAccent}`}
          >
            {laneName}
          </p>
          <p className="mt-1 text-sm text-zinc-400">{laneDescription}</p>
        </div>
        <span className="kitchen-note-chip">
          {pendingGroups.reduce((acc, g) => acc + g.pendingCount, 0)} pendientes
        </span>
      </div>

      {/* 1. Active order */}
      {activeGroup ? (
        <ActiveOrderContainer
          group={activeGroup}
          busyLineKey={busyLineKey}
          onToggle={onToggle}
        />
      ) : null}

      {/* 2. Unified Queue (Pending Orders) */}
      {otherPendingGroups.length ? (
        <PendingOrdersQueue
          groups={otherPendingGroups}
          onSelect={setSelectedOrderId}
        />
      ) : null}

      {/* 4. Done list */}
      <DoneOrdersList
        groups={doneGroups}
        label="Listas"
        busyLineKey={busyLineKey}
        onToggle={onToggle}
      />
    </section>
  );
};

/* ------------------------------------------------------------------ */
/*  Summary metrics (unchanged)                                       */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Resumen K panel (unchanged)                                       */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Main KitchenQueue component                                       */
/* ------------------------------------------------------------------ */

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
  const sideQuestProductionItems = useMemo(
    () => productionItems.filter((entry) => entry.lane === "sideQuest"),
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

  const toggleKitchenItem = useCallback(
    async (entry: KitchenProductionItem, done: boolean) => {
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
        if (
          !done &&
          entry.order.status === "ready"
        ) {
          await onMove(entry.order.id, "preparing", "Cocina: revertir item a pendiente");
        }
      } finally {
        setBusyLineKey(null);
      }
    },
    [onMove, onToggleKitchenItem, productionItems],
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
        <div className="kitchen-view-tabs" role="tablist">
          {kitchenViews.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={view === option.key}
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
        <ProductionLanePanel
          laneItems={prepItems}
          laneName="Preparación"
          laneDescription="Hamburguesas individuales y burgers dentro de combos."
          laneAccent="text-lime-200"
          busyLineKey={busyLineKey}
          onToggle={toggleKitchenItem}
        />
      ) : null}

      {view === "sideQuest" ? (
        <ProductionLanePanel
          laneItems={sideQuestProductionItems}
          laneName="Side Quest"
          laneDescription="Papas, guarniciones, bebidas y extras no-burger."
          laneAccent="text-amber-200"
          busyLineKey={busyLineKey}
          onToggle={toggleKitchenItem}
        />
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
