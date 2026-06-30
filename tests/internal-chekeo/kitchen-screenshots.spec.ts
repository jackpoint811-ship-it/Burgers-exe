/**
 * Screenshot capture script for Phase 2.3 kitchen production line.
 * Generates all 11 required screenshots for docs/assets.
 *
 * Usage:
 *   npx playwright test --config=playwright.internal-kitchen.config.ts tests/internal-chekeo/kitchen-screenshots.spec.ts
 */
import { expect, test, type Page } from "@playwright/test";

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

const validInternalPin = "BOG_INTERNAL_PIN";

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

const createScreenshotState = () => {
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
          previousStatus: "new" as OrderStatus,
          nextStatus: "cancelled" as OrderStatus,
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

const createRaffleState = () => {
  const campaign = {
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

  return {
    campaigns: [campaign],
    buildSummary: () => ({
      campaign,
      baseTickets: 9,
      extraTickets: 1,
      totalTickets: 10,
      totalParticipants: 2,
      topParticipants: [],
      participantResults: [],
      recentAdjustments: [],
    }),
    buildReferralCodes: () => [],
    buildReferrals: () => [],
  };
};

const installScreenshotMocks = async (page: Page) => {
  const state = createScreenshotState();
  const raffleState = createRaffleState();

  await page.addInitScript(() => {
    let copiedText = "";
    let openedUrl = "";
    Object.defineProperty(window, "__copiedPaymentText", {
      configurable: true,
      get: () => copiedText,
      set: (value) => { copiedText = String(value ?? ""); },
    });
    Object.defineProperty(window, "__lastOpenedUrl", {
      configurable: true,
      get: () => openedUrl,
      set: (value) => { openedUrl = String(value ?? ""); },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => { copiedText = value; },
      },
    });
    window.open = ((url?: string | URL | undefined) => {
      openedUrl = String(url ?? "");
      return null;
    }) as typeof window.open;
  });

  await page.route("**/api/internal-v2-auth/status", async (route) => {
    await route.fulfill({ json: { ok: true, data: { authenticated: state.authenticated } } });
  });

  await page.route("**/api/internal-v2-auth/login", async (route) => {
    const payload = JSON.parse(route.request().postData() || "{}") as { pin?: string };
    if (payload.pin !== validInternalPin) {
      await route.fulfill({ status: 401, json: { ok: false, error: { code: "UNAUTHORIZED", message: "PIN incorrecto." } } });
      return;
    }
    state.authenticated = true;
    await route.fulfill({ json: { ok: true, data: { authenticated: true } } });
  });

  await page.route("**/api/internal-v2-auth/logout", async (route) => {
    state.authenticated = false;
    await route.fulfill({ json: { ok: true, data: { authenticated: false } } });
  });

  await page.route(/.*\/api\/kitchen-v2-admin\/summary-k\?.*$/, async (route) => {
    await route.fulfill({ json: { ok: true, data: buildKitchenSummary() } });
  });

  await page.route(/.*\/api\/orders-v2-admin\/[^/]+\/status$/, async (route) => {
    const payload = JSON.parse(route.request().postData() || "{}") as { status?: OrderStatus; reason?: string };
    const orderId = route.request().url().split("/").slice(-2)[0];
    const updated = state.updateStatus(orderId, payload.status || "new", payload.reason);
    await route.fulfill({ json: { ok: true, data: { order: updated } } });
  });

  await page.route(/.*\/api\/orders-v2-admin\/[^/]+\/kitchen-item$/, async (route) => {
    const payload = JSON.parse(route.request().postData() || "{}") as { lineKey: string; itemKind: string; done: boolean };
    const orderId = route.request().url().split("/").slice(-2)[0];
    const updated = state.updateKitchenItem(orderId, payload.lineKey, payload.itemKind, payload.done);
    await route.fulfill({ json: { ok: true, data: { order: updated } } });
  });

  await page.route(/.*\/api\/orders-v2-admin\/[^/]+\/payment$/, async (route) => {
    const payload = JSON.parse(route.request().postData() || "{}") as { paymentStatus?: PaymentStatus; notes?: string };
    const orderId = route.request().url().split("/").slice(-2)[0];
    const updated = state.updatePayment(orderId, payload.paymentStatus || "pending", payload.notes);
    await route.fulfill({ json: { ok: true, data: { order: updated } } });
  });

  await page.route(/.*\/api\/orders-v2-admin\/summary(\?.*)?$/, async (route) => {
    await route.fulfill({ json: { ok: true, data: buildOrdersSummary(state.getOrders()) } });
  });

  await page.route(/.*\/api\/orders-v2-admin\?.*$/, async (route) => {
    await route.fulfill({ json: { ok: true, data: { orders: state.getOrders() } } });
  });

  await page.route(/.*\/api\/raffles-v2-admin\/campaigns(\?.*)?$/, async (route) => {
    await route.fulfill({ json: { ok: true, data: { campaigns: raffleState.campaigns } } });
  });

  await page.route(/.*\/api\/raffles-v2-admin\/summary(\?.*)?$/, async (route) => {
    await route.fulfill({ json: { ok: true, data: raffleState.buildSummary() } });
  });

  await page.route(/.*\/api\/raffles-v2-admin\/referral-codes(\?.*)?$/, async (route) => {
    await route.fulfill({ json: { ok: true, data: { codes: raffleState.buildReferralCodes() } } });
  });

  await page.route(/.*\/api\/raffles-v2-admin\/referrals(\?.*)?$/, async (route) => {
    await route.fulfill({ json: { ok: true, data: { referrals: raffleState.buildReferrals() } } });
  });

  await page.route(/.*\/api\/raffles-v2-admin\/ticket-adjustments$/, async (route) => {
    await route.fulfill({ json: { ok: true, data: { adjustment: null } } });
  });

  await page.route(/.*\/api\/raffles-v2-admin\/ticket-adjustments\/[^/]+$/, async (route) => {
    await route.fulfill({ json: { ok: true, data: { adjustment: null } } });
  });

  return state;
};

const SCREENSHOT_DIR = "docs/assets/chekeo-phase-2-3-kitchen-production-line";

const loginToChekeo = async (page: Page) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator('input[type="password"]').fill(validInternalPin);
  await page.getByRole("button", { name: /Entrar/i }).click();
  await expect(page.getByRole("heading", { name: "Prioridad de turno" })).toBeVisible();
};

const openPrimaryTab = async (page: Page, label: string) => {
  await page.locator("button.tab").filter({ hasText: new RegExp(label, "i") }).first().click();
  await page.waitForTimeout(300);
};

const openKitchenView = async (page: Page, label: string) => {
  await page.locator("button.kitchen-view-tab").filter({ hasText: new RegExp(label, "i") }).first().click();
  await page.waitForTimeout(300);
};

const kitchenConnectedCopy = (page: Page) =>
  page.getByText(/Cocina conectada a (preview|D1 real)/i);

/* ─── Preparación screenshots at 390px mobile ───────────────────── */
test.describe("Phase 2.3 kitchen screenshots — mobile 390", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("cocina-preparacion-active-order-mobile-390", async ({ page }) => {
    await installScreenshotMocks(page);
    await loginToChekeo(page);
    await openPrimaryTab(page, "Cocina");
    await expect(kitchenConnectedCopy(page)).toBeVisible();
    // Default view: Preparación with active order showing
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/cocina-preparacion-active-order-mobile-390.png`, fullPage: false });
  });

  test("cocina-preparacion-multi-item-accordion-mobile-390", async ({ page }) => {
    await installScreenshotMocks(page);
    await loginToChekeo(page);
    await openPrimaryTab(page, "Cocina");
    await expect(kitchenConnectedCopy(page)).toBeVisible();
    // Click on the active order's accordion items to expand multiple
    const accordionItems = page.locator(".kitchen-accordion-item");
    const count = await accordionItems.count();
    if (count > 1) {
      await accordionItems.nth(1).click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/cocina-preparacion-multi-item-accordion-mobile-390.png`, fullPage: false });
  });

  test("cocina-preparacion-next-order-mobile-390", async ({ page }) => {
    await installScreenshotMocks(page);
    await loginToChekeo(page);
    await openPrimaryTab(page, "Cocina");
    await expect(kitchenConnectedCopy(page)).toBeVisible();
    // Scroll down to the next order section
    const nextOrder = page.locator(".kitchen-next-order").first();
    if (await nextOrder.isVisible()) {
      await nextOrder.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/cocina-preparacion-next-order-mobile-390.png`, fullPage: false });
  });

  test("cocina-preparacion-following-orders-mobile-390", async ({ page }) => {
    await installScreenshotMocks(page);
    await loginToChekeo(page);
    await openPrimaryTab(page, "Cocina");
    await expect(kitchenConnectedCopy(page)).toBeVisible();
    // Expand the following orders section
    const followingToggle = page.locator(".kitchen-following-orders__toggle").first();
    if (await followingToggle.isVisible()) {
      await followingToggle.click();
      await page.waitForTimeout(300);
      await followingToggle.scrollIntoViewIfNeeded();
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/cocina-preparacion-following-orders-mobile-390.png`, fullPage: false });
  });

  test("cocina-preparacion-listas-mobile-390", async ({ page }) => {
    await installScreenshotMocks(page);
    await loginToChekeo(page);
    await openPrimaryTab(page, "Cocina");
    await expect(kitchenConnectedCopy(page)).toBeVisible();
    // Expand the done list
    const doneToggle = page.locator(".kitchen-done-list__toggle").first();
    if (await doneToggle.isVisible()) {
      await doneToggle.scrollIntoViewIfNeeded();
      await doneToggle.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/cocina-preparacion-listas-mobile-390.png`, fullPage: false });
  });

  /* ─── Side Quest screenshots at 390px ─────────────────────────── */
  test("cocina-sidequest-active-order-mobile-390", async ({ page }) => {
    await installScreenshotMocks(page);
    await loginToChekeo(page);
    await openPrimaryTab(page, "Cocina");
    await expect(kitchenConnectedCopy(page)).toBeVisible();
    await openKitchenView(page, "Side Quest");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/cocina-sidequest-active-order-mobile-390.png`, fullPage: false });
  });

  test("cocina-sidequest-next-order-mobile-390", async ({ page }) => {
    await installScreenshotMocks(page);
    await loginToChekeo(page);
    await openPrimaryTab(page, "Cocina");
    await expect(kitchenConnectedCopy(page)).toBeVisible();
    await openKitchenView(page, "Side Quest");
    const nextOrder = page.locator(".kitchen-next-order").first();
    if (await nextOrder.isVisible()) {
      await nextOrder.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/cocina-sidequest-next-order-mobile-390.png`, fullPage: false });
  });

  test("cocina-sidequest-listas-mobile-390", async ({ page }) => {
    await installScreenshotMocks(page);
    await loginToChekeo(page);
    await openPrimaryTab(page, "Cocina");
    await expect(kitchenConnectedCopy(page)).toBeVisible();
    await openKitchenView(page, "Side Quest");
    const doneToggle = page.locator(".kitchen-done-list__toggle").first();
    if (await doneToggle.isVisible()) {
      await doneToggle.scrollIntoViewIfNeeded();
      await doneToggle.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/cocina-sidequest-listas-mobile-390.png`, fullPage: false });
  });
});

/* ─── Responsive screenshots: 320, 430, desktop ─────────────────── */
test.describe("Phase 2.3 kitchen screenshots — mobile 320", () => {
  test.use({ viewport: { width: 320, height: 740 } });

  test("cocina-mobile-320", async ({ page }) => {
    await installScreenshotMocks(page);
    await loginToChekeo(page);
    await openPrimaryTab(page, "Cocina");
    await expect(kitchenConnectedCopy(page)).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/cocina-mobile-320.png`, fullPage: false });
  });
});

test.describe("Phase 2.3 kitchen screenshots — mobile 430", () => {
  test.use({ viewport: { width: 430, height: 932 } });

  test("cocina-mobile-430", async ({ page }) => {
    await installScreenshotMocks(page);
    await loginToChekeo(page);
    await openPrimaryTab(page, "Cocina");
    await expect(kitchenConnectedCopy(page)).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/cocina-mobile-430.png`, fullPage: false });
  });
});

test.describe("Phase 2.3 kitchen screenshots — desktop 1280", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("cocina-desktop-overview", async ({ page }) => {
    await installScreenshotMocks(page);
    await loginToChekeo(page);
    await openPrimaryTab(page, "Cocina");
    await expect(kitchenConnectedCopy(page)).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/cocina-desktop-overview.png`, fullPage: false });
  });
});
