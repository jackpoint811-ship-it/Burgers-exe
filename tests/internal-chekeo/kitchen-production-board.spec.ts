import { expect, test, type Page } from "@playwright/test";
import * as fs from "fs";

type OrderStatus = "new" | "preparing" | "ready" | "delivered" | "cancelled";
type PaymentStatus = "pending" | "paid" | "cancelled";
type ItemKind = "burger" | "combo" | "garnish" | "drink" | "other";

type OrderEvent = {
  id: string;
  orderId: string;
  type: string;
  actor: string;
  createdAt: string;
  previousStatus?: OrderStatus;
  nextStatus?: OrderStatus;
  detail?: Record<string, unknown>;
};

type OrderItem = {
  id: string;
  orderId: string;
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  snapshot: Record<string, unknown>;
  createdAt: string;
};

type OrderRecord = {
  id: string;
  folio: string;
  customerName: string;
  customerPhone: string;
  orderMode: "pickup";
  paymentMethod: "cash" | "card" | "transfer";
  paymentStatus: PaymentStatus;
  notes: string;
  subtotal: number;
  total: number;
  status: OrderStatus;
  source: "internal-v2";
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  events: OrderEvent[];
};

const viewports = [
  { name: "mobile-320", width: 320, height: 740 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;
const validInternalPin = "0485";
const isAdminOnlyMode = process.env.VITE_INTERNAL_AUTH_MODE === "admin-only";

const isoMinutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const makeItem = (
  orderId: string,
  lineKey: string,
  name: string,
  itemKind: ItemKind,
  unitPrice: number,
  snapshotOverrides: Record<string, unknown> = {},
): OrderItem => ({
  id: `${orderId}-${lineKey}`,
  orderId,
  sku: lineKey,
  name,
  qty: 1,
  unitPrice,
  lineTotal: unitPrice,
  snapshot: {
    lineKey,
    itemKind,
    itemDisplayIndex: 1,
    sideQuestExtras: [],
    removedIngredients: [],
    extras: [],
    comboBurgers: [],
    ...snapshotOverrides,
  },
  createdAt: new Date().toISOString(),
});

const buildKitchenSummary = () => ({
  hasRecipes: true,
  totals: {
    burgers: 4,
    garnishes: 2,
    ingredients: 6,
    estimatedCostCents: 12450,
  },
  burgers: [{ sku: "burger-og", name: "OG", quantity: 4 }],
  garnishes: [{ sku: "fries", name: "Papas", quantity: 2 }],
  ingredients: [
    {
      ingredientId: "potato",
      name: "Papa",
      quantity: 2,
      unit: "kg",
      unitPriceCents: 1200,
      estimatedCostCents: 2400,
    },
  ],
});

const buildOrdersSummary = (orders: OrderRecord[]) => {
  const byStatus = {
    new: 0,
    preparing: 0,
    ready: 0,
    delivered: 0,
    cancelled: 0,
  } as Record<OrderStatus, number>;
  let grossSales = 0;
  let deliveredSales = 0;

  for (const order of orders) {
    byStatus[order.status] += 1;
    grossSales += order.total;
    if (order.status === "delivered") deliveredSales += order.total;
  }

  const byPaymentMethod = [...new Set(orders.map((order) => order.paymentMethod))].map((paymentMethod) => {
    const matchingOrders = orders.filter((order) => order.paymentMethod === paymentMethod);
    return {
      paymentMethod,
      orders: matchingOrders.length,
      total: matchingOrders.reduce((sum, order) => sum + order.total, 0),
    };
  });

  const topItemsMap = new Map<
    string,
    { sku: string; name: string; qty: number; total: number; orders: number }
  >();
  for (const order of orders) {
    for (const item of order.items) {
      const current = topItemsMap.get(item.sku) ?? {
        sku: item.sku,
        name: item.name,
        qty: 0,
        total: 0,
        orders: 0,
      };
      current.qty += item.qty;
      current.total += item.lineTotal;
      current.orders += 1;
      topItemsMap.set(item.sku, current);
    }
  }

  return {
    source: "d1" as const,
    range: {
      from: "2026-06-17",
      to: "2026-06-17",
      fromUtc: "2026-06-17T00:00:00.000Z",
      toUtc: "2026-06-17T23:59:59.999Z",
    },
    totals: {
      orders: orders.length,
      activeOrders: orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length,
      deliveredOrders: byStatus.delivered,
      cancelledOrders: byStatus.cancelled,
      grossSales,
      deliveredSales,
      averageTicket: orders.length ? Math.round(grossSales / orders.length) : 0,
    },
    byStatus,
    byPaymentMethod,
    byOrderMode: [
      {
        orderMode: "pickup",
        orders: orders.length,
        total: grossSales,
      },
    ],
    topItems: [...topItemsMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
    recentOrders: orders.slice(0, 5).map((order) => ({
      id: order.id,
      folio: order.folio,
      createdAt: order.createdAt,
      status: order.status,
      customerName: order.customerName,
      orderMode: order.orderMode,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      total: order.total,
    })),
    durations: {
      newToReadyAvgSeconds: 720,
      newToDeliveredAvgSeconds: 1440,
    },
    generatedAt: new Date().toISOString(),
  };
};

const createKitchenState = () => {
  let eventSeq = 0;
  let authenticated = false;

  const doneEvent = (orderId: string, lineKey: string): OrderEvent => ({
    id: `event-${++eventSeq}`,
    orderId,
    type: "KITCHEN_ITEM_DONE",
    actor: "internal-v2",
    createdAt: isoMinutesAgo(1),
    detail: { lineKey },
  });

  const makeOrder = ({
    id,
    folio,
    customerName = folio,
    status,
    paymentStatus = "paid",
    paymentMethod = paymentStatus === "pending" ? "card" : "cash",
    minutesAgo,
    items,
    events = [],
    total = 10000,
    notes = "Ubicación: Mostrador | Validación Playwright",
  }: {
    id: string;
    folio: string;
    customerName?: string;
    status: OrderStatus;
    paymentStatus?: PaymentStatus;
    paymentMethod?: "cash" | "card" | "transfer";
    minutesAgo: number;
    items: OrderItem[];
    events?: OrderEvent[];
    total?: number;
    notes?: string;
  }): OrderRecord => ({
    id,
    folio,
    customerName,
    customerPhone: "5550000000",
    orderMode: "pickup",
    paymentMethod,
    paymentStatus,
    notes,
    subtotal: total,
    total,
    status,
    source: "internal-v2",
    createdAt: isoMinutesAgo(minutesAgo),
    updatedAt: isoMinutesAgo(Math.max(1, minutesAgo - 1)),
    items,
    events,
  });

  const orders: OrderRecord[] = [
    makeOrder({
      id: "order-critical-001",
      folio: "CRIT-001",
      status: "preparing",
      minutesAgo: 25,
      total: 38900,
      items: [
        makeItem("order-critical-001", "crit-line-1", "Burger crítica", "burger", 18900, {
          removedIngredients: ["Cebolla"],
          extras: [{ sku: "extra-cheese", name: "Queso extra", price: 2500 }],
        }),
        makeItem("order-critical-001", "crit-line-2", "Combo doble", "combo", 15000, {
          comboBurgers: [
            {
              sku: "burger-og",
              name: "OG",
              removedIngredients: ["Pickles"],
              extras: [{ sku: "bacon", name: "Tocino", price: 3000 }],
              burgerNote: "Bien dorada",
            },
            {
              sku: "burger-bx",
              name: "BX",
              removedIngredients: [],
              extras: [],
            },
          ],
          garnish: { sku: "fries", name: "Papas" },
          sideQuestExtras: [{ sku: "onion-rings", name: "Aros", itemKind: "garnish" }],
          includedDrink: { sku: "soda", name: "Refresco" },
        }),
        makeItem("order-critical-001", "crit-line-3", "Papas directas", "garnish", 5000),
      ],
    }),
    makeOrder({
      id: "order-ready-review-401",
      folio: "RDY-401",
      customerName: "Andrea Pending",
      status: "ready",
      paymentStatus: "pending",
      minutesAgo: 8,
      total: 26000,
      items: [
        makeItem("order-ready-review-401", "ready-line-1", "Burger lista", "burger", 18000),
        makeItem("order-ready-review-401", "ready-line-2", "Papas pendientes", "garnish", 8000),
      ],
      events: [doneEvent("order-ready-review-401", "ready-line-1")],
    }),
    makeOrder({
      id: "order-transfer-701",
      folio: "TRF-701",
      customerName: "Valeria Transfer",
      status: "new",
      paymentStatus: "pending",
      paymentMethod: "transfer",
      minutesAgo: 4,
      total: 29900,
      notes: "Ubicación: GGA | Cliente comparte comprobante por WhatsApp",
      items: [
        makeItem("order-transfer-701", "trf-line-1", "Combo transferencia", "combo", 29900, {
          comboBurgers: [
            {
              sku: "burger-og",
              name: "OG",
              removedIngredients: [],
              extras: [],
            },
          ],
          garnish: { sku: "fries", name: "Papas" },
        }),
      ],
    }),
    makeOrder({
      id: "order-new-201",
      folio: "NEW-201",
      status: "new",
      minutesAgo: 2,
      total: 17500,
      items: [makeItem("order-new-201", "new-line-1", "Burger nueva", "burger", 17500)],
    }),
    makeOrder({
      id: "order-prep-301",
      folio: "PREP-301",
      status: "preparing",
      minutesAgo: 5,
      total: 21000,
      items: [makeItem("order-prep-301", "prep-line-1", "Burger prep", "burger", 21000)],
    }),
    makeOrder({
      id: "order-ready-402",
      folio: "RDY-402",
      status: "ready",
      minutesAgo: 1,
      total: 15000,
      items: [makeItem("order-ready-402", "ready-line-3", "Burger ready", "burger", 15000)],
      events: [doneEvent("order-ready-402", "ready-line-3")],
    }),
    makeOrder({
      id: "order-delivered-501",
      folio: "DEL-501",
      status: "delivered",
      minutesAgo: 18,
      total: 19900,
      items: [makeItem("order-delivered-501", "del-line-1", "Burger entregada", "burger", 19900)],
    }),
    makeOrder({
      id: "order-cancelled-601",
      folio: "CAN-601",
      status: "cancelled",
      paymentStatus: "cancelled",
      minutesAgo: 14,
      total: 12000,
      items: [makeItem("order-cancelled-601", "can-line-1", "Burger cancelada", "burger", 12000)],
      events: [
        {
          id: `event-${++eventSeq}`,
          orderId: "order-cancelled-601",
          type: "STATUS_CHANGED",
          actor: "internal-v2",
          previousStatus: "new",
          nextStatus: "cancelled",
          createdAt: isoMinutesAgo(12),
          detail: { reason: "Cliente canceló" },
        },
      ],
    }),
  ];

  return {
    get authenticated() {
      return authenticated;
    },
    set authenticated(value: boolean) {
      authenticated = value;
    },
    getOrders: () => orders,
    updateStatus(orderId: string, status: OrderStatus, reason?: string) {
      const order = orders.find((entry) => entry.id === orderId);
      if (!order) throw new Error(`Order not found: ${orderId}`);
      const previousStatus = order.status;
      order.status = status;
      order.updatedAt = new Date().toISOString();
      order.events.push({
        id: `event-${++eventSeq}`,
        orderId: order.id,
        type: "STATUS_CHANGED",
        actor: "internal-v2",
        previousStatus,
        nextStatus: status,
        createdAt: new Date().toISOString(),
        detail: reason ? { reason } : {},
      });
      return order;
    },
    updateKitchenItem(orderId: string, lineKey: string, itemKind: string, done: boolean) {
      const order = orders.find((entry) => entry.id === orderId);
      if (!order) throw new Error(`Order not found: ${orderId}`);
      order.updatedAt = new Date().toISOString();
      order.events.push({
        id: `event-${++eventSeq}`,
        orderId: order.id,
        type: done ? "KITCHEN_ITEM_DONE" : "KITCHEN_ITEM_REOPENED",
        actor: "internal-v2",
        createdAt: new Date().toISOString(),
        detail: { lineKey, itemKind },
      });
      return order;
    },
    updatePayment(orderId: string, paymentStatus: PaymentStatus, notes?: string) {
      const order = orders.find((entry) => entry.id === orderId);
      if (!order) throw new Error(`Order not found: ${orderId}`);
      order.paymentStatus = paymentStatus;
      if (typeof notes === "string") order.notes = notes;
      order.updatedAt = new Date().toISOString();
      order.events.push({
        id: `event-${++eventSeq}`,
        orderId: order.id,
        type: "PAYMENT_UPDATED",
        actor: "internal-v2",
        createdAt: new Date().toISOString(),
        detail: { paymentStatus, notes },
      });
      return order;
    },
  };
};

type RaffleCampaignRecord = {
  id: string;
  title: string;
  description: string;
  rulesText: string;
  bannerImageUrl: string;
  bannerImageKey: string;
  detailImageUrl: string;
  detailImageKey: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  ticketPerBurger: number;
  ticketPerReferral: number;
  createdAt: string;
  updatedAt: string;
};

type RaffleParticipantRecord = {
  participantKey: string;
  customerName: string;
  customerPhoneMasked: string;
  burgerTickets: number;
  referralTickets: number;
  manualExtraTickets: number;
  totalTickets: number;
  lastOrderFolio: string;
  lastOrderAt: string;
  referralCode?: string;
  referralCodeIsActive?: boolean;
  lastAdjustmentAt?: string;
  lastAdjustmentReason?: string;
};

type RaffleReferralCodeRecord = {
  id: string;
  campaignId: string;
  ownerName: string;
  ownerPhoneMasked: string;
  code: string;
  labelText?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type RaffleReferralRecord = {
  id: string;
  campaignId: string;
  code: string;
  referrerName: string;
  referrerPhoneMasked: string;
  referredCustomerName: string;
  referredCustomerPhoneMasked: string;
  referredOrderFolio: string;
  status: "pending" | "valid" | "invalid";
  ticketsAwarded: number;
  invalidReason?: string;
  createdAt: string;
  updatedAt: string;
};

type RaffleAdjustmentRecord = {
  id: string;
  campaignId: string;
  participantKey: string;
  participantName: string;
  participantPhoneMasked: string;
  ticketsDelta: number;
  reason: string;
  actor: string;
  status: "active" | "reverted";
  createdAt: string;
  updatedAt: string;
  revertedAt?: string;
  revertedBy?: string;
};

const createRaffleState = () => {
  const campaign: RaffleCampaignRecord = {
    id: "raffle-june-2026",
    title: "Rifa Burger Lovers",
    description: "Tickets extra por pedidos y referidos.",
    rulesText: "Cada burger suma tickets base y los ajustes manuales quedan auditados.",
    bannerImageUrl: "",
    bannerImageKey: "",
    detailImageUrl: "",
    detailImageKey: "",
    startsAt: "2026-06-01T00:00:00.000Z",
    endsAt: "2026-06-30T23:59:59.999Z",
    isActive: true,
    ticketPerBurger: 1,
    ticketPerReferral: 2,
    createdAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-06-17T18:30:00.000Z",
  };

  const participants: RaffleParticipantRecord[] = [
    {
      participantKey: "pk-luna-4821",
      customerName: "Luna Smash",
      customerPhoneMasked: "****4821",
      burgerTickets: 4,
      referralTickets: 2,
      manualExtraTickets: 0,
      totalTickets: 6,
      lastOrderFolio: "BX-4821",
      lastOrderAt: "2026-06-17T18:15:00.000Z",
      referralCode: "LUNA27",
      referralCodeIsActive: true,
    },
    {
      participantKey: "pk-mario-9910",
      customerName: "Mario Queso",
      customerPhoneMasked: "****9910",
      burgerTickets: 2,
      referralTickets: 1,
      manualExtraTickets: 1,
      totalTickets: 4,
      lastOrderFolio: "BX-9910",
      lastOrderAt: "2026-06-17T16:40:00.000Z",
      referralCode: "MARIO10",
      referralCodeIsActive: false,
      lastAdjustmentAt: "2026-06-17T17:00:00.000Z",
      lastAdjustmentReason: "Premio de bienvenida",
    },
  ];

  const referralCodes: RaffleReferralCodeRecord[] = [
    {
      id: "code-luna",
      campaignId: campaign.id,
      ownerName: "Luna Smash",
      ownerPhoneMasked: "****4821",
      code: "LUNA27",
      labelText: "LUNA 27",
      isActive: true,
      createdAt: "2026-06-01T12:10:00.000Z",
      updatedAt: "2026-06-17T18:00:00.000Z",
    },
    {
      id: "code-mario",
      campaignId: campaign.id,
      ownerName: "Mario Queso",
      ownerPhoneMasked: "****9910",
      code: "MARIO10",
      labelText: "MARIO 10",
      isActive: false,
      createdAt: "2026-06-01T12:12:00.000Z",
      updatedAt: "2026-06-17T17:10:00.000Z",
    },
  ];

  const referrals: RaffleReferralRecord[] = [
    {
      id: "ref-001",
      campaignId: campaign.id,
      code: "LUNA27",
      referrerName: "Luna Smash",
      referrerPhoneMasked: "****4821",
      referredCustomerName: "Bruno Bacon",
      referredCustomerPhoneMasked: "****1133",
      referredOrderFolio: "BX-701",
      status: "valid",
      ticketsAwarded: 2,
      createdAt: "2026-06-17T15:00:00.000Z",
      updatedAt: "2026-06-17T15:20:00.000Z",
    },
    {
      id: "ref-002",
      campaignId: campaign.id,
      code: "MARIO10",
      referrerName: "Mario Queso",
      referrerPhoneMasked: "****9910",
      referredCustomerName: "Camila Crunch",
      referredCustomerPhoneMasked: "****2299",
      referredOrderFolio: "BX-702",
      status: "pending",
      ticketsAwarded: 1,
      createdAt: "2026-06-17T16:00:00.000Z",
      updatedAt: "2026-06-17T16:10:00.000Z",
    },
  ];

  const adjustments: RaffleAdjustmentRecord[] = [];
  let adjustmentSeq = 0;

  const sortParticipants = () => [...participants].sort((a, b) => b.totalTickets - a.totalTickets || a.customerName.localeCompare(b.customerName));
  const syncParticipant = (participantKey: string) => {
    const participant = participants.find((entry) => entry.participantKey === participantKey);
    if (!participant) return null;
    const activeAdjustments = adjustments.filter((entry) => entry.participantKey === participantKey && entry.status === "active");
    const totalExtra = activeAdjustments.reduce((sum, entry) => sum + entry.ticketsDelta, 0);
    participant.manualExtraTickets = totalExtra;
    participant.totalTickets = participant.burgerTickets + participant.referralTickets + totalExtra;
    const latestAdjustment = activeAdjustments[0];
    participant.lastAdjustmentAt = latestAdjustment?.createdAt;
    participant.lastAdjustmentReason = latestAdjustment?.reason;
    return participant;
  };

  const matchesParticipant = (participant: RaffleParticipantRecord, query: string) => {
    if (!query) return true;
    const fields = [
      participant.customerName,
      participant.customerPhoneMasked,
      participant.lastOrderFolio,
      participant.participantKey,
      participant.referralCode,
      participant.lastAdjustmentReason,
    ].filter((value): value is string => Boolean(value));
    return fields.some((field) => field.toLowerCase().includes(query));
  };

  const buildSummary = (q?: string) => {
    const query = q?.trim().toLowerCase() ?? "";
    const topParticipants = sortParticipants();
    const participantResults = query ? topParticipants.filter((participant) => matchesParticipant(participant, query)) : topParticipants;
    const baseTickets = topParticipants.reduce((sum, participant) => sum + participant.burgerTickets + participant.referralTickets, 0);
    const extraTickets = topParticipants.reduce((sum, participant) => sum + participant.manualExtraTickets, 0);
    return {
      campaign,
      baseTickets,
      extraTickets,
      totalTickets: baseTickets + extraTickets,
      totalParticipants: topParticipants.length,
      topParticipants,
      participantResults,
      recentAdjustments: [...adjustments].slice(0, 5),
    };
  };

  const buildReferralCodes = (q?: string) => {
    const query = q?.trim().toLowerCase() ?? "";
    return referralCodes.filter((code) => {
      if (!query) return true;
      return [code.ownerName, code.ownerPhoneMasked, code.code, code.labelText ?? ""].some((field) => field.toLowerCase().includes(query));
    });
  };

  const buildReferrals = (options: { q?: string; status?: string }) => {
    const query = options.q?.trim().toLowerCase() ?? "";
    return referrals.filter((referral) => {
      if (options.status && options.status !== "all" && referral.status !== options.status) return false;
      if (!query) return true;
      return [
        referral.code,
        referral.referrerName,
        referral.referrerPhoneMasked,
        referral.referredCustomerName,
        referral.referredCustomerPhoneMasked,
        referral.referredOrderFolio,
        referral.status,
      ].some((field) => field.toLowerCase().includes(query));
    });
  };

  const createAdjustment = (payload: { campaignId?: string; participantKey?: string; ticketsDelta?: number; reason?: string; actor?: string }) => {
    const participant = payload.participantKey ? participants.find((entry) => entry.participantKey === payload.participantKey) : null;
    if (!participant) throw new Error(`Participant not found: ${payload.participantKey || "unknown"}`);
    const now = new Date().toISOString();
    const adjustment: RaffleAdjustmentRecord = {
      id: `adj-${++adjustmentSeq}`,
      campaignId: payload.campaignId || campaign.id,
      participantKey: participant.participantKey,
      participantName: participant.customerName,
      participantPhoneMasked: participant.customerPhoneMasked,
      ticketsDelta: Math.max(1, Number(payload.ticketsDelta) || 1),
      reason: String(payload.reason || "").trim(),
      actor: String(payload.actor || "internal-v2").trim() || "internal-v2",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    adjustments.unshift(adjustment);
    syncParticipant(participant.participantKey);
    return adjustment;
  };

  const updateAdjustment = (id: string, payload: { status?: "active" | "reverted"; actor?: string }) => {
    const adjustment = adjustments.find((entry) => entry.id === id);
    if (!adjustment) throw new Error(`Adjustment not found: ${id}`);
    const now = new Date().toISOString();
    adjustment.status = payload.status ?? adjustment.status;
    adjustment.updatedAt = now;
    adjustment.actor = String(payload.actor || adjustment.actor || "internal-v2");
    if (adjustment.status === "reverted") {
      adjustment.revertedAt = now;
      adjustment.revertedBy = adjustment.actor;
    } else {
      adjustment.revertedAt = undefined;
      adjustment.revertedBy = undefined;
    }
    syncParticipant(adjustment.participantKey);
    return adjustment;
  };

  return {
    campaigns: [campaign],
    buildSummary,
    buildReferralCodes,
    buildReferrals,
    createAdjustment,
    updateAdjustment,
  };
};

const productionCardByFolio = (page: Page, folio: string) =>
  page.locator(".kitchen-production-card").filter({ hasText: folio });

const productionCardByItem = (page: Page, itemName: string) =>
  page.locator(".kitchen-production-card").filter({ hasText: itemName });

const kitchenItemTitle = (page: Page, itemName: string) =>
  page
    .locator(".kitchen-production-card__item h3")
    .filter({ hasText: itemName });

const readyCardByFolio = (page: Page, folio: string) =>
  page.locator(".kitchen-ready-card").filter({ hasText: folio });

const doneCardByFolio = (page: Page, folio: string) =>
  page
    .locator(".kitchen-done-section .kitchen-production-card")
    .filter({ hasText: folio });

const doneCardByItem = (page: Page, itemName: string) =>
  page
    .locator(".kitchen-done-section .kitchen-production-card")
    .filter({ hasText: itemName });

const primaryTab = (page: Page, label: string) =>
  page.locator("button.tab").filter({ hasText: new RegExp(label, "i") }).first();

const adminModuleCard = (page: Page, label: string) =>
  page.locator("button.admin-module-card").filter({ hasText: new RegExp(label, "i") });

const orderCardByFolio = (page: Page, folio: string) =>
  page.locator(".orders-card").filter({ hasText: folio });

const ordersFilterButton = (page: Page, label: string) =>
  page.locator("button.orders-filter-pill").filter({ hasText: new RegExp(`^${label}$`, "i") }).first();

const paymentCardByFolio = (page: Page, folio: string) =>
  page.locator(".payments-card").filter({ hasText: folio });

const paymentFilterButton = (page: Page, label: string) =>
  page.locator("button.payments-filter-pill").filter({ hasText: new RegExp(`^${label}$`, "i") }).first();

const operationHeading = (page: Page) =>
  page.getByRole("heading", { name: "Prioridad de turno" });

const kitchenConnectedCopy = (page: Page) =>
  page.getByText(/Cocina conectada a (preview|D1 real)/i);

const openOrdersFilters = async (page: Page) => {
  const drawer = page.locator("details.orders-filter-drawer");
  if (!(await drawer.count())) return;
  const isOpen = await drawer.evaluate((node) => node.hasAttribute("open"));
  if (!isOpen) await drawer.locator("summary").click();
};

const kitchenViewTab = (page: Page, label: string) =>
  page
    .locator("button.kitchen-view-tab")
    .filter({ hasText: new RegExp(label, "i") })
    .first();

const openKitchenView = async (page: Page, label: string) => {
  await kitchenViewTab(page, label).click();
  await page.waitForTimeout(200);
};

const installKitchenApiMocks = async (page: Page) => {
  const state = createKitchenState();
  const raffleState = createRaffleState();

  await page.addInitScript(() => {
    let copiedText = "";
    let openedUrl = "";
    Object.defineProperty(window, "__copiedPaymentText", {
      configurable: true,
      get: () => copiedText,
      set: (value) => {
        copiedText = String(value ?? "");
      },
    });
    Object.defineProperty(window, "__lastOpenedUrl", {
      configurable: true,
      get: () => openedUrl,
      set: (value) => {
        openedUrl = String(value ?? "");
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          copiedText = value;
        },
      },
    });
    window.open = ((url?: string | URL | undefined) => {
      openedUrl = String(url ?? "");
      return null;
    }) as typeof window.open;
  });

  await page.route("**/api/internal-v2-auth/status", async (route) => {
    await route.fulfill({
      json: { ok: true, data: { authenticated: state.authenticated } },
    });
  });

  await page.route("**/api/internal-v2-auth/login", async (route) => {
    const payload = JSON.parse(route.request().postData() || "{}") as {
      pin?: string;
    };
    if (payload.pin !== validInternalPin) {
      await route.fulfill({
        status: 401,
        json: {
          ok: false,
          error: { code: "UNAUTHORIZED", message: "PIN incorrecto." },
        },
      });
      return;
    }
    state.authenticated = true;
    await route.fulfill({
      json: { ok: true, data: { authenticated: true } },
    });
  });

  await page.route("**/api/internal-v2-auth/logout", async (route) => {
    state.authenticated = false;
    await route.fulfill({ json: { ok: true, data: { authenticated: false } } });
  });

  await page.route(/.*\/api\/kitchen-v2-admin\/summary-k\?.*$/, async (route) => {
    await route.fulfill({
      json: { ok: true, data: buildKitchenSummary() },
    });
  });

  await page.route(/.*\/api\/orders-v2-admin\/[^/]+\/status$/, async (route) => {
    const payload = JSON.parse(route.request().postData() || "{}") as {
      status?: OrderStatus;
      reason?: string;
    };
    const orderId = route.request().url().split("/").slice(-2)[0];
    const updated = state.updateStatus(orderId, payload.status || "new", payload.reason);
    await route.fulfill({
      json: { ok: true, data: { order: updated } },
    });
  });

  await page.route(/.*\/api\/orders-v2-admin\/[^/]+\/kitchen-item$/, async (route) => {
    const payload = JSON.parse(route.request().postData() || "{}") as {
      lineKey: string;
      itemKind: string;
      done: boolean;
    };
    const orderId = route.request().url().split("/").slice(-2)[0];
    const updated = state.updateKitchenItem(
      orderId,
      payload.lineKey,
      payload.itemKind,
      payload.done,
    );
    await route.fulfill({
      json: { ok: true, data: { order: updated } },
    });
  });

  await page.route(/.*\/api\/orders-v2-admin\/[^/]+\/payment$/, async (route) => {
    const payload = JSON.parse(route.request().postData() || "{}") as {
      paymentStatus?: PaymentStatus;
      notes?: string;
    };
    const orderId = route.request().url().split("/").slice(-2)[0];
    const updated = state.updatePayment(
      orderId,
      payload.paymentStatus || "pending",
      payload.notes,
    );
    await route.fulfill({
      json: { ok: true, data: { order: updated } },
    });
  });

  await page.route(/.*\/api\/orders-v2-admin\/summary(\?.*)?$/, async (route) => {
    await route.fulfill({
      json: { ok: true, data: buildOrdersSummary(state.getOrders()) },
    });
  });

  await page.route(/.*\/api\/orders-v2-admin\?.*$/, async (route) => {
    await route.fulfill({
      json: { ok: true, data: { orders: state.getOrders() } },
    });
  });

  await page.route(/.*\/api\/raffles-v2-admin\/campaigns(\?.*)?$/, async (route) => {
    const requestUrl = new URL(route.request().url());
    const campaignId = requestUrl.searchParams.get("campaignId");
    const campaigns = raffleState.campaigns.filter((campaign) => !campaignId || campaign.id === campaignId);
    await route.fulfill({
      json: { ok: true, data: { campaigns } },
    });
  });

  await page.route(/.*\/api\/raffles-v2-admin\/summary(\?.*)?$/, async (route) => {
    const requestUrl = new URL(route.request().url());
    const q = requestUrl.searchParams.get("q") || undefined;
    await route.fulfill({
      json: { ok: true, data: raffleState.buildSummary(q) },
    });
  });

  await page.route(/.*\/api\/raffles-v2-admin\/referral-codes(\?.*)?$/, async (route) => {
    const requestUrl = new URL(route.request().url());
    const q = requestUrl.searchParams.get("q") || undefined;
    await route.fulfill({
      json: { ok: true, data: { codes: raffleState.buildReferralCodes(q) } },
    });
  });

  await page.route(/.*\/api\/raffles-v2-admin\/referrals(\?.*)?$/, async (route) => {
    const requestUrl = new URL(route.request().url());
    const q = requestUrl.searchParams.get("q") || undefined;
    const status = requestUrl.searchParams.get("status") || undefined;
    await route.fulfill({
      json: { ok: true, data: { referrals: raffleState.buildReferrals({ q, status }) } },
    });
  });

  await page.route(/.*\/api\/raffles-v2-admin\/ticket-adjustments$/, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({ json: { ok: true, data: { adjustment: null } } });
      return;
    }
    const payload = JSON.parse(route.request().postData() || "{}") as {
      campaignId?: string;
      participantKey?: string;
      ticketsDelta?: number;
      reason?: string;
      actor?: string;
    };
    const adjustment = raffleState.createAdjustment(payload);
    await route.fulfill({
      json: { ok: true, data: { adjustment } },
    });
  });

  await page.route(/.*\/api\/raffles-v2-admin\/ticket-adjustments\/[^/]+$/, async (route) => {
    const adjustmentId = route.request().url().split("/").pop() || "";
    const payload = JSON.parse(route.request().postData() || "{}") as {
      status?: "active" | "reverted";
      actor?: string;
    };
    const adjustment = raffleState.updateAdjustment(adjustmentId, payload);
    await route.fulfill({
      json: { ok: true, data: { adjustment } },
    });
  });

  return state;
};

const loginToChekeo = async (page: Page) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator('input[type="password"]').fill(validInternalPin);
  await page.getByRole("button", { name: /Entrar/i }).click();
  await expect(operationHeading(page)).toBeVisible();
  await expect(page.getByText("Mini Resumen K")).toBeVisible();
  await expect(page.locator("button.tab")).toHaveCount(5);
};

const openPrimaryTab = async (page: Page, label: string) => {
  await primaryTab(page, label).click();
  await page.waitForTimeout(200);
};

const openAdminSection = async (page: Page, label: string) => {
  const moduleCard = adminModuleCard(page, label).first();
  if (await moduleCard.isVisible().catch(() => false)) {
    await moduleCard.click();
  } else {
    await page.getByLabel("Cambiar módulo").selectOption({ label });
  }
  await page.waitForTimeout(200);
};

const openKitchenFromHome = async (page: Page) => {
  await openPrimaryTab(page, "Cocina");
  await expect(page.getByRole("heading", { name: "Cocina" })).toBeVisible();
  await expect(kitchenConnectedCopy(page)).toBeVisible();
};

test.describe("internal chekeo kitchen production board", () => {
  test.skip(isAdminOnlyMode, "This suite validates the default global secure mode.");

  test("keeps the global auth gate before the operation shell", async ({ page }) => {
    await installKitchenApiMocks(page);
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.getByLabel("PIN de acceso")).toBeVisible();
    await expect(page.locator("button.tab")).toHaveCount(0);
    await expect(operationHeading(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Módulos secundarios" })).toHaveCount(0);

    await page.locator('input[type="password"]').fill(validInternalPin);
    await page.getByRole("button", { name: /Entrar/i }).click();
    await expect(operationHeading(page)).toBeVisible();

    await openPrimaryTab(page, "Admin");
    await expect(page.getByRole("heading", { name: "Módulos secundarios" })).toBeVisible();

    await page.getByRole("button", { name: /Salir/i }).click();
    await expect(page.getByLabel("PIN de acceso")).toBeVisible();
    await expect(page.locator("button.tab")).toHaveCount(0);
    await expect(operationHeading(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Módulos secundarios" })).toHaveCount(0);
  });

  test("keeps the restructured operation shell stable", async ({ page }) => {
    await installKitchenApiMocks(page);
    await loginToChekeo(page);

    await expect(page.getByText("Pedidos activos")).toBeVisible();
    await expect(page.getByText("Pagos pendientes").first()).toBeVisible();
    await expect(primaryTab(page, "Operación")).toBeVisible();
    await expect(primaryTab(page, "Pedidos")).toBeVisible();
    await expect(primaryTab(page, "Cocina")).toBeVisible();
    await expect(primaryTab(page, "Pagos")).toBeVisible();
    await expect(primaryTab(page, "Admin")).toBeVisible();

    await openKitchenFromHome(page);

    for (const folio of ["CRIT-001", "NEW-201", "PREP-301"]) {
      await expect(page.getByText(folio).first()).toBeVisible();
    }

    await expect(kitchenViewTab(page, "Preparación")).toBeVisible();
    await expect(kitchenViewTab(page, "Listos")).toHaveCount(0);
    await expect(kitchenViewTab(page, "Side Quest")).toBeVisible();
    await expect(kitchenViewTab(page, "Resumen K")).toBeVisible();
    await expect(page.locator(".kitchen-view-tab strong")).toHaveCount(0);
    await expect(page.locator(".kitchen-view-tab p")).toHaveCount(0);
    await expect(page.getByText("Siguiente en cocina")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Entregar/i })).toHaveCount(0);
    await expect(page.locator(".shell-header__quicknav-button")).toHaveCount(5);

    const firstProductionFolios = await page
      .locator(".kitchen-production-card .kitchen-production-card__folio")
      .allTextContents();
    expect(firstProductionFolios[0]).toBe("CRIT-001");

    const criticalCard = productionCardByFolio(page, "CRIT-001");
    await expect(criticalCard).toHaveCount(1);
    await expect(criticalCard.first().getByText("Burger crítica")).toBeVisible();
    await criticalCard.locator(".kitchen-production-card__item").nth(1).click();
    await expect(criticalCard.getByText("Burgers del combo", { exact: true })).toBeVisible();
    await expect(criticalCard.getByText("OG · sin Pickles")).toBeVisible();
    await expect(productionCardByItem(page, "Papas directas")).toHaveCount(0);
    await expect(productionCardByItem(page, "Papas pendientes")).toHaveCount(0);

    // Select NEW-201 to make it active/visible
    await page.locator(".kitchen-following-orders__list").first().click();
    await page.locator(".kitchen-following-orders__list .kitchen-production-card").filter({ hasText: "NEW-201" }).getByRole("button", { name: "Cocinar" }).click();
    const newCard = productionCardByFolio(page, "NEW-201");
    await expect(newCard).toHaveCount(1);
    await newCard.getByRole("button", { name: /^Hecha$/i }).click();

    // Expand the done list and check NEW-201 is in the done list marked "Hecha"
    const doneListToggle = page.getByRole("button", { name: /^Listas/ });
    if (await doneListToggle.getAttribute("aria-expanded") !== "true") {
      await doneListToggle.click();
    }
    const newDoneCard = page.locator(".kitchen-done-list__item").filter({ hasText: "NEW-201" });
    await expect(newDoneCard.getByText("Hecha", { exact: true })).toBeVisible();

    // Select PREP-301 to make it active/visible
    await page.locator(".kitchen-following-orders__list").first().click();
    await page.locator(".kitchen-following-orders__list .kitchen-production-card").filter({ hasText: "PREP-301" }).getByRole("button", { name: "Cocinar" }).click();
    const prepCard = productionCardByFolio(page, "PREP-301");
    await expect(prepCard).toHaveCount(1);
    await prepCard.getByRole("button", { name: /^Hecha$/i }).first().click();

    // Check PREP-301 is in the done list marked "Hecha"
    if (await doneListToggle.getAttribute("aria-expanded") !== "true") {
      await doneListToggle.click();
    }
    const prepDoneCard = page.locator(".kitchen-done-list__item").filter({ hasText: "PREP-301" });
    await expect(prepDoneCard.getByText("Hecha", { exact: true })).toBeVisible();

    await openKitchenView(page, "Side Quest");
    await expect(productionCardByFolio(page, "CRIT-001")).toHaveCount(1);
    // Expand the combo item in Side Quest to show its sub-items
    await page.locator(".kitchen-production-card__item").nth(0).click();
    await expect(kitchenItemTitle(page, "Papas")).toHaveCount(2);
    await expect(kitchenItemTitle(page, "Aros")).toHaveCount(1);
    await expect(kitchenItemTitle(page, "Refresco")).toHaveCount(1);
    await expect(kitchenItemTitle(page, "Papas directas")).toHaveCount(1);
    await expect(productionCardByItem(page, "Burger crítica")).toHaveCount(0);
    await expect(page.locator(".kitchen-production-card").getByRole("button", { name: /^Hecha$/i }).first()).toBeVisible();

    await openKitchenView(page, "Resumen K");
    await expect(
      page.getByRole("heading", { name: "Ingredientes estimados" }),
    ).toBeVisible();
    await expect(page.getByText("Combos desglosados")).toBeVisible();
    await expect(page.getByText("Side Quest").nth(1)).toBeVisible();
    await expect(page.getByText("Ganancia estimada")).toBeVisible();
    await openKitchenView(page, "Preparación");
    await expect(kitchenConnectedCopy(page)).toBeVisible();

    await page.locator(".kitchen-hero").getByRole("button", { name: /^Actualizar$/i }).click();
    await expect(kitchenConnectedCopy(page)).toBeVisible();

    await openPrimaryTab(page, "Pedidos");
    await expect(page.getByText("Cola compacta", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
    await openOrdersFilters(page);
    await expect(page.getByPlaceholder("Ej. BX-102 o Andrea")).toBeVisible();
    await expect(orderCardByFolio(page, "CRIT-001")).toHaveCount(1);
    await expect(page.getByText("Preview D1").first()).toBeVisible();
    await expect(page.getByText("Operación en vivo")).toHaveCount(0);
    await ordersFilterButton(page, "Listo").click();
    await expect(orderCardByFolio(page, "RDY-401")).toHaveCount(1);
    await expect(orderCardByFolio(page, "RDY-402")).toHaveCount(1);
    await page.locator(".orders-command-detail").filter({ hasText: "RDY-402" })
      .getByRole("button", { name: /^Entregado$/i })
      .click();
    await expect(orderCardByFolio(page, "RDY-402")).toHaveCount(0);
    await ordersFilterButton(page, "Entregado").click();
    await expect(orderCardByFolio(page, "RDY-402")).toHaveCount(1);
    await ordersFilterButton(page, "Todos").click();
    await page.getByPlaceholder("Ej. BX-102 o Andrea").fill("RDY-401");
    await expect(orderCardByFolio(page, "RDY-401")).toHaveCount(1);
    await expect(orderCardByFolio(page, "RDY-402")).toHaveCount(0);
    await orderCardByFolio(page, "RDY-401")
      .getByRole("button", { name: /Ver ticket/i })
      .click();
    await expect(page.locator("#order-title")).toHaveText("RDY-401");
    await expect(page.getByText("Rareza")).toHaveCount(0);
    await expect(page.getByText("Power")).toHaveCount(0);
    await expect(page.getByRole("dialog").getByText("Ubicación: Mostrador", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/Estado pago|Método de pago|Pago confirmado|Pago pendiente/i)).toHaveCount(0);
    await expect(page.getByText(/CLABE|BBVA|Banorte|Santander/i)).toHaveCount(0);
    await page.getByRole("dialog").getByText("Ticket y WhatsApp").click();
    await expect(page.getByRole("dialog").getByRole("button", { name: /Copiar WhatsApp/i })).toHaveCount(1);
    await page.getByRole("dialog").getByRole("button", { name: /Copiar WhatsApp/i }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__copiedPaymentText))
      .toContain("Tu pedido en Burgers.exe quedó registrado");
    await expect.poll(() => page.evaluate(() => (window as any).__copiedPaymentText))
      .not.toContain("Datos bancarios:");
    await expect(page.getByRole("dialog").getByRole("button", { name: /Compartir imagen/i })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByPlaceholder("Ej. BX-102 o Andrea").fill("");

    await openPrimaryTab(page, "Pagos");
    await expect(page.getByText("Bandeja de cobros", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pagos" })).toBeVisible();
    await expect(paymentCardByFolio(page, "RDY-401")).toHaveCount(1);
    await expect(paymentCardByFolio(page, "TRF-701")).toHaveCount(1);
    await expect(paymentCardByFolio(page, "TRF-701").getByText("Ubicacion: GGA")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Entregado$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Cancelar pedido/i })).toHaveCount(0);

    await paymentFilterButton(page, "Pendiente").click();
    await expect(paymentCardByFolio(page, "RDY-402")).toHaveCount(0);
    await expect(paymentCardByFolio(page, "RDY-401")).toHaveCount(1);
    await expect(paymentCardByFolio(page, "TRF-701")).toHaveCount(1);

    await paymentCardByFolio(page, "RDY-401")
      .getByRole("button", { name: /Marcar pagado/i })
      .click();
    await expect(paymentCardByFolio(page, "RDY-401")).toHaveCount(0);

    await paymentFilterButton(page, "Pagado").click();
    await expect(paymentCardByFolio(page, "RDY-401")).toHaveCount(1);
    await expect(paymentCardByFolio(page, "RDY-401").getByText("Pago confirmado", { exact: true }).first()).toBeVisible();
    await paymentCardByFolio(page, "RDY-401")
      .getByRole("button", { name: /^Más$/i })
      .click();
    await page.locator(".modal--wide")
      .getByRole("button", { name: /Regresar a pendiente/i })
      .click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#payment-detail-title")).toHaveCount(0);
    await paymentFilterButton(page, "Pendiente").click();
    await expect(paymentCardByFolio(page, "RDY-401")).toHaveCount(1);

    await paymentCardByFolio(page, "TRF-701")
      .getByRole("button", { name: /^Más$/i })
      .click();
    const paymentModal = page.locator(".modal--wide");
    await expect(page.locator("#payment-detail-title")).toHaveText("TRF-701");
    await expect(page.getByText("Datos bancarios", { exact: true })).toBeVisible();
    await expect(page.getByText("BBVA", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("012180015645465369", { exact: true }).first()).toBeVisible();
    await paymentModal.getByRole("button", { name: /Copiar WhatsApp/i }).scrollIntoViewIfNeeded();
    await paymentModal.getByRole("button", { name: /Copiar WhatsApp/i }).click({ force: true });
    await expect.poll(() => page.evaluate(() => (window as any).__copiedPaymentText))
      .toContain("Datos bancarios:");
    await expect.poll(() => page.evaluate(() => (window as any).__copiedPaymentText))
      .toContain("BBVA");
    await paymentModal.getByRole("button", { name: /Abrir WhatsApp/i }).click({ force: true });
    await expect.poll(() => page.evaluate(() => (window as any).__lastOpenedUrl))
      .toContain("wa.me");
    await page.keyboard.press("Escape");
    await expect(page.locator("#payment-detail-title")).toHaveCount(0);

    await paymentCardByFolio(page, "RDY-401")
      .getByRole("button", { name: /^Más$/i })
      .click();
    await expect(page.locator("#payment-detail-title")).toHaveText("RDY-401");
    await expect(page.getByText("Datos bancarios", { exact: true })).toHaveCount(0);
    await paymentModal.getByRole("button", { name: /Copiar WhatsApp/i }).scrollIntoViewIfNeeded();
    await paymentModal.getByRole("button", { name: /Copiar WhatsApp/i }).click({ force: true });
    await expect.poll(() => page.evaluate(() => (window as any).__copiedPaymentText))
      .not.toContain("Datos bancarios:");
    await page.keyboard.press("Escape");
    await expect(page.locator("#payment-detail-title")).toHaveCount(0);

    await openPrimaryTab(page, "Admin");
    await expect(page.getByRole("heading", { name: "Módulos secundarios" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Operación" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Configuración" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Datos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Promos/Sorteos" })).toBeVisible();
    await expect(adminModuleCard(page, "Datos bancarios")).toHaveCount(1);
    await expect(adminModuleCard(page, "Historial")).toHaveCount(1);
    await expect(adminModuleCard(page, "Cierre")).toHaveCount(1);
    await expect(adminModuleCard(page, "Catálogo")).toHaveCount(1);
    await expect(adminModuleCard(page, "Sorteos")).toHaveCount(1);
    await expect(adminModuleCard(page, "Reportes")).toHaveCount(1);
    await expect(page.getByText("Base lista", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Solo lectura", { exact: true })).toBeVisible();
    await expect(page.getByText("Básico", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Ver módulo", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Página pública/i })).toBeVisible();
    await expect(page.getByText("Abrir página", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/Modo seguro global activo\. Toda la app sigue pidiendo PIN antes de abrir\./i),
    ).toBeVisible();

    await openAdminSection(page, "Datos bancarios");
    await expect(page.getByRole("heading", { name: "Datos bancarios" }).first()).toBeVisible();
    await expect(page.getByText("BBVA", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Yolitzin Ameyali Zarate Otero", { exact: true })).toBeVisible();
    await expect(page.getByText("012180015645465369", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Solo transferencia/i)).toBeVisible();
    await page.getByRole("button", { name: /Volver al hub/i }).click();
    await expect(page.getByRole("heading", { name: "Módulos secundarios" })).toBeVisible();

    await openAdminSection(page, "Historial");
    await expect(page.getByRole("heading", { name: /Historial (de pedidos|de esta vista)/i })).toBeVisible();
    await expect(page.getByText("DEL-501")).toBeVisible();
    await expect(page.getByText("CAN-601")).toBeVisible();

    await openAdminSection(page, "Cierre");
    await expect(page.getByRole("heading", { name: "Cierre" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Descargar reporte/i })).toBeVisible();

    await openAdminSection(page, "Catálogo");
    await expect(page.getByRole("heading", { name: "Catálogo" }).first()).toBeVisible();

    await openAdminSection(page, "Sorteos");
    await expect(page.getByRole("heading", { name: "Campañas" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rifa Burger Lovers" })).toBeVisible();
    await expect(page.getByText("Premio visible")).toBeVisible();

    await openAdminSection(page, "Reportes");
    await expect(page.getByRole("heading", { name: "Exportes operativos" })).toBeVisible();
    await expect(page.getByText("Reportes y exportes")).toBeVisible();
  });

  test("supports manual raffle ticket adjustments", async ({ page }) => {
    await installKitchenApiMocks(page);
    await loginToChekeo(page);

    await openPrimaryTab(page, "Admin");
    await openAdminSection(page, "Sorteos");
    await expect(page.getByRole("heading", { name: "Rifa Burger Lovers" })).toBeVisible();
    await page.getByRole("button", { name: /Participantes/i }).click();

    const raffleSearch = page.getByPlaceholder("Nombre, folio, teléfono o código");
    await expect(raffleSearch).toBeVisible();
    await raffleSearch.fill("Luna");
    await expect(page.getByText("Resultados de búsqueda", { exact: true })).toBeVisible();
    const lunaParticipant = page.locator("article").filter({ hasText: "Luna Smash" }).first();
    await page.getByRole("button", { name: "+ tickets" }).first().click();
    const quickTicketSheet = page.getByRole("dialog", { name: /Luna Smash/i });
    await expect(quickTicketSheet).toBeVisible();
    await expect(quickTicketSheet.getByRole("heading", { name: "Luna Smash" })).toBeVisible();

    await expect(lunaParticipant).toContainText("Base: 6");
    await expect(lunaParticipant).toContainText("Extra manual: 0");
    await expect(lunaParticipant).toContainText("Total: 6");

    await quickTicketSheet.getByRole("spinbutton", { name: "Tickets extra" }).fill("4");
    await quickTicketSheet.getByLabel("Motivo").fill("ok");
    await quickTicketSheet.getByRole("button", { name: "Guardar tickets" }).click();
    await expect(quickTicketSheet.getByText("El motivo es obligatorio.")).toBeVisible();
    await expect(lunaParticipant).toContainText("Extra manual: 0");
    await expect(lunaParticipant).toContainText("Total: 6");

    await quickTicketSheet.getByLabel("Motivo").fill("Ajuste premio");
    await quickTicketSheet.getByRole("button", { name: "Guardar tickets" }).click();
    await expect(page.getByText("Ajuste guardado.")).toBeVisible();
    await expect(quickTicketSheet).toHaveCount(0);
    await expect(lunaParticipant).toContainText("Extra manual: 4");
    await expect(lunaParticipant).toContainText("Total: 10");

    await page.once("dialog", (dialog) => {
      void dialog.accept();
    });
    await page.getByRole("button", { name: "Revertir" }).first().click();
    await expect(page.getByText("Ajuste revertido.")).toBeVisible();
    await expect(lunaParticipant).toContainText("Extra manual: 0");
    await expect(lunaParticipant).toContainText("Total: 6");
    await expect(page.getByRole("button", { name: "Revertir" })).toHaveCount(0);
  });

  test("supports Phase 2.3 kitchen production line refinements", async ({ page }) => {
    await installKitchenApiMocks(page);
    await loginToChekeo(page);
    await openKitchenFromHome(page);

    // 1. Check MOD and UPGRADE formatting
    const criticalCard = productionCardByFolio(page, "CRIT-001");
    await expect(criticalCard).toHaveCount(1);

    await expect(criticalCard.getByText("Sin Cebolla")).toBeVisible();
    await expect(criticalCard.getByText("Queso", { exact: true })).toBeVisible();
    await expect(criticalCard.getByText("Queso extra")).toHaveCount(0);

    // 2. Check accordion behavior in active order container
    await criticalCard.getByRole("button", { name: /^Hecha$/i }).first().click();

    // Expand the combo double details inside the active card
    await criticalCard.locator(".kitchen-production-card__item").filter({ hasText: "Combo doble" }).click();
    await expect(criticalCard.getByText("OG · sin Pickles · Tocino · Bien dorada")).toBeVisible();

    // 3. Mark the combo double as hecha
    await criticalCard.getByRole("button", { name: /^Hecha$/i }).first().click();

    // 4. Check list of done items and revert functionality
    const doneListToggle = page.getByRole("button", { name: /^Listas/ });
    await expect(doneListToggle).toBeVisible();
    if (await doneListToggle.getAttribute("aria-expanded") !== "true") {
      await doneListToggle.click();
    }

    const critDoneCard = page.locator(".kitchen-done-list__item").filter({ hasText: "CRIT-001" });
    await expect(critDoneCard).toBeVisible();
    await critDoneCard.click();

    const critBurgerItem = critDoneCard.locator(".kitchen-accordion-item").filter({ hasText: "Burger crítica" });
    await expect(critBurgerItem).toBeVisible();
    await critBurgerItem.click();

    await expect(critBurgerItem.getByText("Sin Cebolla")).toBeVisible();
    await expect(critBurgerItem.getByText("Queso", { exact: true })).toBeVisible();

    const revertBtn = critBurgerItem.getByRole("button", { name: /Revertir hecha/i });
    await expect(revertBtn).toBeVisible();
    await revertBtn.click();

    // The order CRIT-001 should go back to active order container!
    await expect(productionCardByFolio(page, "CRIT-001")).toBeVisible();
    await expect(productionCardByFolio(page, "CRIT-001").getByText("Por hacer").first()).toBeVisible();
  });

  test("reverts one done burger inside multi-burger order without re-closing it", async ({ page }) => {
    await installKitchenApiMocks(page);
    await loginToChekeo(page);
    await openKitchenFromHome(page);

    const criticalCard = productionCardByFolio(page, "CRIT-001");
    await expect(criticalCard).toBeVisible();

    // Mark the first burger as done
    const firstBurgerBtn = criticalCard.getByRole("button", { name: /^Hecha$/i }).first();
    await firstBurgerBtn.click();

    // Open the done burger (which is the first one in the group)
    const doneBurgerItemContainer = criticalCard.locator(".kitchen-accordion-item").nth(0);
    await doneBurgerItemContainer.click();

    // Click Revertir
    const revertBtn = doneBurgerItemContainer.getByRole("button", { name: /Revertir hecha/i });
    await expect(revertBtn).toBeVisible();
    await revertBtn.click();

    // It should stay expanded, and become pending
    await expect(doneBurgerItemContainer).toHaveClass(/kitchen-accordion-item--open/);
    await expect(doneBurgerItemContainer.getByRole("button", { name: /^Hecha$/i })).toBeVisible();
  });

  test("keeps summary K working after kitchen production interactions", async ({ page }) => {
    await installKitchenApiMocks(page);
    await loginToChekeo(page);
    await openKitchenFromHome(page);

    // Go to Summary K
    await openKitchenView(page, "Resumen K");
    await expect(page.getByText("Total burgers")).toBeVisible();
    await expect(page.getByText("Costo producción")).toBeVisible();

    // Back to prep
    await openKitchenView(page, "Preparación");

    const criticalCard = productionCardByFolio(page, "CRIT-001");
    await criticalCard.getByRole("button", { name: /^Hecha$/i }).first().click();

    // Back to Summary K
    await openKitchenView(page, "Resumen K");
    await expect(page.getByText("Total burgers")).toBeVisible();
  });

  test("summary K shows local burger breakdown when backend arrays are missing", async ({ page }) => {
    await installKitchenApiMocks(page);

    await page.route("**/api/kitchen-v2-admin/summary-k*", async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          ok: true,
          data: {
            hasRecipes: false,
            totals: { burgers: 0, garnishes: 0, ingredients: 0 },
            burgers: [],
            garnishes: [],
            ingredients: [],
          },
        },
      });
    });

    await loginToChekeo(page);
    await openKitchenFromHome(page);

    await openKitchenView(page, "Resumen K");

    await expect(page.getByText("Sin burgers del día.")).not.toBeVisible();
    await expect(page.getByText("OG").first()).toBeVisible();
    await expect(page.getByText("Burger crítica")).toBeVisible();
    await expect(page.getByText("Burger lista")).toBeVisible();

    const ogRow = page.locator(".kitchen-summary-row").filter({ hasText: "OG" });
    await expect(ogRow.locator("strong")).not.toHaveText("0");
  });

  test("summary K shows local garnish breakdown when backend arrays are missing", async ({ page }) => {
    await installKitchenApiMocks(page);

    await page.route("**/api/kitchen-v2-admin/summary-k*", async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          ok: true,
          data: {
            hasRecipes: false,
            totals: { burgers: 0, garnishes: 0, ingredients: 0 },
            burgers: [],
            garnishes: [],
            ingredients: [],
          },
        },
      });
    });

    await loginToChekeo(page);
    await openKitchenFromHome(page);

    await openKitchenView(page, "Resumen K");

    await expect(page.getByText("Sin guarniciones del día.")).not.toBeVisible();
    await expect(page.getByText("Papas").first()).toBeVisible();
    await expect(page.getByText("Aros").first()).toBeVisible();
  });

  test("preview realistic fixtures use short PVW folios", async () => {
    const sqlContent = fs.readFileSync("migrations/0008_preview_realistic_orders_seed.sql", "utf-8");

    expect(sqlContent).toContain("PVW-");
    expect(sqlContent).not.toContain("QA-COCINA");
    expect(sqlContent).not.toContain("CRIT-001");
    expect(sqlContent).toContain("public-v2-preview");
    expect(sqlContent).toContain("[FIXTURE:PREVIEW_REALISTIC_ORDERS]");
    expect(sqlContent).toContain("Ubicación: Torre Valcob");
    expect(sqlContent).toContain("Ubicación: Torre GGA");

    const hasRealisticNames = sqlContent.includes("Andrea") || sqlContent.includes("Carlos") || sqlContent.includes("López") || sqlContent.includes("Mariana");
    expect(hasRealisticNames).toBe(true);
  });

  for (const viewport of viewports) {
    test(`avoids horizontal overflow on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await installKitchenApiMocks(page);
      await loginToChekeo(page);

      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });

      expect(overflow).toBeLessThanOrEqual(1);
      await expect(operationHeading(page)).toBeVisible();

      await openPrimaryTab(page, "Cocina");
      await expect(kitchenConnectedCopy(page)).toBeVisible();

      const kitchenOverflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });

      expect(kitchenOverflow).toBeLessThanOrEqual(1);

      await openPrimaryTab(page, "Pedidos");
      await expect(page.getByText("Cola compacta", { exact: true })).toBeVisible();

      const ordersOverflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });

      expect(ordersOverflow).toBeLessThanOrEqual(1);

      await openPrimaryTab(page, "Pagos");
      await expect(page.getByText("Bandeja de cobros", { exact: true })).toBeVisible();

      const paymentsOverflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });

      expect(paymentsOverflow).toBeLessThanOrEqual(1);

      await openPrimaryTab(page, "Admin");
      await expect(page.getByRole("heading", { name: "Módulos secundarios" })).toBeVisible();

      const adminOverflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });

      expect(adminOverflow).toBeLessThanOrEqual(1);

      await openAdminSection(page, "Datos bancarios");
      await expect(page.getByRole("heading", { name: "Datos bancarios" }).first()).toBeVisible();

      const adminModuleOverflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });

      expect(adminModuleOverflow).toBeLessThanOrEqual(1);

      await openAdminSection(page, "Sorteos");
      await expect(page.getByRole("heading", { name: "Rifa Burger Lovers" })).toBeVisible();

      const raffleOverflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });

      expect(raffleOverflow).toBeLessThanOrEqual(1);
    });
  }
});

test.describe("internal chekeo admin-only security mode", () => {
  test.skip(!isAdminOnlyMode, "Admin-only assertions run only when the explicit mode is enabled.");

  test("keeps admin-only prepared behind the global gate until backend auth exists", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installKitchenApiMocks(page);
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.getByLabel("PIN de acceso")).toBeVisible();
    await expect(page.locator("button.tab")).toHaveCount(0);
    await expect(operationHeading(page)).toHaveCount(0);
    await expect(
      page.getByText(/Modo admin-only preparado\. Chekeo sigue pidiendo PIN global/i),
    ).toBeVisible();

    const loginOverflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    expect(loginOverflow).toBeLessThanOrEqual(1);

    await page.getByLabel("PIN de acceso").fill(validInternalPin);
    await page.getByRole("button", { name: /Entrar/i }).click();
    await expect(operationHeading(page)).toBeVisible();
    await expect(page.locator("button.tab")).toHaveCount(5);

    await openPrimaryTab(page, "Admin");
    await expect(page.getByRole("heading", { name: "Módulos secundarios" })).toBeVisible();
    await expect(
      page.getByText(/Modo admin-only preparado\. Chekeo sigue pidiendo PIN global/i),
    ).toBeVisible();

    const shellOverflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    expect(shellOverflow).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: /Salir/i }).click();
    await expect(page.getByLabel("PIN de acceso")).toBeVisible();
    await expect(page.locator("button.tab")).toHaveCount(0);
  });
});
