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
  paymentMethod: "cash" | "card";
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

const isoMinutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const makeItem = (
  orderId: string,
  lineKey: string,
  name: string,
  itemKind: ItemKind,
  unitPrice: number,
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

  const byPaymentMethod = ["cash", "card"].map((paymentMethod) => {
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
    status,
    paymentStatus = "paid",
    minutesAgo,
    items,
    events = [],
    total = 10000,
  }: {
    id: string;
    folio: string;
    status: OrderStatus;
    paymentStatus?: PaymentStatus;
    minutesAgo: number;
    items: OrderItem[];
    events?: OrderEvent[];
    total?: number;
  }): OrderRecord => ({
    id,
    folio,
    customerName: folio,
    customerPhone: "5550000000",
    orderMode: "pickup",
    paymentMethod: paymentStatus === "pending" ? "card" : "cash",
    paymentStatus,
    notes: "Ubicación: Mostrador | Validación Playwright",
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
      total: 18900,
      items: [makeItem("order-critical-001", "crit-line-1", "Burger crítica", "burger", 18900)],
    }),
    makeOrder({
      id: "order-ready-review-401",
      folio: "RDY-401",
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
  };
};

const ticketByFolio = (page: Page, folio: string) =>
  page.locator(".kitchen-ticket").filter({ hasText: folio }).first();

const primaryTab = (page: Page, label: string) =>
  page.locator("button.tab").filter({ hasText: new RegExp(label, "i") }).first();

const adminNavButton = (page: Page, label: string) =>
  page
    .locator("button.admin-nav__button")
    .filter({ hasText: new RegExp(`^${label}$`, "i") })
    .first();

const clickLane = async (page: Page, label: string) => {
  await page
    .locator("button.kitchen-lane")
    .filter({ hasText: new RegExp(label, "i") })
    .first()
    .click();
  await page.waitForTimeout(200);
};

const installKitchenApiMocks = async (page: Page) => {
  const state = createKitchenState();

  await page.route("**/api/internal-v2-auth/status", async (route) => {
    await route.fulfill({
      json: { ok: true, data: { authenticated: state.authenticated } },
    });
  });

  await page.route("**/api/internal-v2-auth/login", async (route) => {
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

  return state;
};

const loginToChekeo = async (page: Page) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator('input[type="password"]').fill("0485");
  await page.getByRole("button", { name: /Entrar/i }).click();
  await expect(page.getByRole("heading", { name: "Base operativa para Home" })).toBeVisible();
  await expect(page.getByText("Mini Resumen K")).toBeVisible();
  await expect(page.locator("button.tab")).toHaveCount(5);
};

const openPrimaryTab = async (page: Page, label: string) => {
  await primaryTab(page, label).click();
  await page.waitForTimeout(200);
};

const openAdminSection = async (page: Page, label: string) => {
  await adminNavButton(page, label).click();
  await page.waitForTimeout(200);
};

const openKitchenFromHome = async (page: Page) => {
  await openPrimaryTab(page, "Cocina");
  await expect(page.getByText("Cocina operativa")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Cocina conectada a (preview|D1 real)/i }),
  ).toBeVisible();
};

test.describe("internal chekeo kitchen production board", () => {
  test("keeps the global auth gate before the operation shell", async ({ page }) => {
    await installKitchenApiMocks(page);
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.getByLabel("PIN de acceso")).toBeVisible();
    await expect(page.locator("button.tab")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Base operativa para Home" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Hub de módulos de Chekeo" })).toHaveCount(0);

    await page.locator('input[type="password"]').fill("0485");
    await page.getByRole("button", { name: /Entrar/i }).click();
    await expect(page.getByRole("heading", { name: "Base operativa para Home" })).toBeVisible();

    await openPrimaryTab(page, "Admin");
    await expect(page.getByRole("heading", { name: "Hub de módulos de Chekeo" })).toBeVisible();

    await page.getByRole("button", { name: /Cerrar sesion/i }).click();
    await expect(page.getByLabel("PIN de acceso")).toBeVisible();
    await expect(page.locator("button.tab")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Base operativa para Home" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Hub de módulos de Chekeo" })).toHaveCount(0);
  });

  test("keeps the restructured operation shell stable", async ({ page }) => {
    await installKitchenApiMocks(page);
    await loginToChekeo(page);

    await expect(page.getByText("Pedidos activos")).toBeVisible();
    await expect(page.getByText("Pagos pendientes")).toBeVisible();
    await expect(primaryTab(page, "Home")).toBeVisible();
    await expect(primaryTab(page, "Pedidos")).toBeVisible();
    await expect(primaryTab(page, "Cocina")).toBeVisible();
    await expect(primaryTab(page, "Pagos")).toBeVisible();
    await expect(primaryTab(page, "Admin")).toBeVisible();

    await openKitchenFromHome(page);

    for (const folio of ["CRIT-001", "RDY-401", "NEW-201", "PREP-301", "RDY-402"]) {
      await expect(ticketByFolio(page, folio)).toHaveCount(1);
    }

    await clickLane(page, "ATENCIÓN");
    const attentionFolios = await page.locator(".kitchen-ticket .text-2xl").allTextContents();
    expect(attentionFolios[0]).toBe("CRIT-001");
    await expect(ticketByFolio(page, "RDY-401")).toHaveCount(1);

    await clickLane(page, "NUEVOS");
    await expect(ticketByFolio(page, "NEW-201")).toHaveCount(1);
    await ticketByFolio(page, "NEW-201")
      .getByRole("button", { name: /Iniciar preparación/i })
      .click();

    await clickLane(page, "EN PREPARACIÓN");
    await expect(ticketByFolio(page, "NEW-201")).toHaveCount(1);
    const prepTicket = ticketByFolio(page, "PREP-301");
    await expect(prepTicket).toHaveCount(1);
    await expect(prepTicket.getByRole("button", { name: /Marcar listo/i })).toHaveCount(0);
    await prepTicket.getByRole("button", { name: /^Hecho$/i }).first().click();
    await expect(prepTicket.getByRole("button", { name: /Reabrir/i })).toHaveCount(1);
    await prepTicket.getByRole("button", { name: /Marcar listo/i }).click();

    await clickLane(page, "LISTOS");
    await expect(ticketByFolio(page, "RDY-401")).toHaveCount(1);
    await expect(ticketByFolio(page, "RDY-402")).toHaveCount(1);
    await expect(ticketByFolio(page, "PREP-301")).toHaveCount(1);

    await page.getByRole("button", { name: /Resumen K/i }).click();
    await expect(
      page.getByRole("heading", { name: "Ingredientes estimados" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Tablero/i }).click();
    await expect(
      page.getByRole("heading", { name: /Cocina conectada a (preview|D1 real)/i }),
    ).toBeVisible();

    await ticketByFolio(page, "RDY-401")
      .getByRole("button", { name: /Ver detalle/i })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "RDY-401" })).toBeVisible();
    await page.getByRole("dialog").click({ position: { x: 8, y: 8 } }).catch(() => undefined);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page
      .getByLabel("Estado operativo actual")
      .getByRole("button", { name: /^Actualizar$/i })
      .click();
    await expect(
      page.getByRole("heading", { name: /Cocina conectada a (preview|D1 real)/i }),
    ).toBeVisible();

    await openPrimaryTab(page, "Pedidos");
    await expect(page.getByText("CRIT-001").first()).toBeVisible();
    await expect(page.getByText("Preview D1").first()).toBeVisible();
    await expect(page.getByText("Operable en preview").first()).toBeVisible();
    await expect(page.getByText("Operación en vivo")).toHaveCount(0);

    await openPrimaryTab(page, "Pagos");
    await expect(page.getByRole("heading", { name: "Pagos por confirmar" })).toBeVisible();
    await expect(page.getByText("RDY-401")).toBeVisible();

    await openPrimaryTab(page, "Admin");
    await expect(page.getByRole("heading", { name: "Hub de módulos de Chekeo" })).toBeVisible();
    await expect(page.locator("button.admin-module-card").filter({ hasText: /Historial/i })).toHaveCount(1);
    await expect(page.locator("button.admin-module-card").filter({ hasText: /Cierre/i })).toHaveCount(1);
    await expect(page.locator("button.admin-module-card").filter({ hasText: /Catálogo/i })).toHaveCount(1);
    await expect(page.locator("button.admin-module-card").filter({ hasText: /Sorteos/i })).toHaveCount(1);
    await expect(page.locator("button.admin-module-card").filter({ hasText: /Reportes/i })).toHaveCount(1);
    await expect(
      page.getByText(/Auth global se mantiene temporalmente por seguridad/i),
    ).toBeVisible();

    await page.locator("button.admin-module-card").filter({ hasText: /Historial/i }).first().click();
    await expect(page.getByRole("heading", { name: /Historial (de pedidos|de esta vista)/i })).toBeVisible();
    await expect(page.getByText("DEL-501")).toBeVisible();
    await expect(page.getByText("CAN-601")).toBeVisible();

    await openAdminSection(page, "Cierre");
    await expect(page.getByRole("heading", { name: "Cierre" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Descargar reporte/i })).toBeVisible();

    await openAdminSection(page, "Reportes");
    await expect(page.getByRole("heading", { name: "Exportes operativos" })).toBeVisible();
    await expect(page.getByText("Reportes y exportes")).toBeVisible();
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
      await expect(page.getByRole("heading", { name: "Base operativa para Home" })).toBeVisible();

      await openPrimaryTab(page, "Admin");
      await expect(page.getByRole("heading", { name: "Hub de módulos de Chekeo" })).toBeVisible();

      const adminOverflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });

      expect(adminOverflow).toBeLessThanOrEqual(1);
    });
  }
});
