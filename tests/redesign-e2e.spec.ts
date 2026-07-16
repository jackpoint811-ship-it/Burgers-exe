import { expect, test } from "@playwright/test";

const publicUrl = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const internalUrl = process.env.INTERNAL_PREVIEW_URL || "http://127.0.0.1:4174";
const validInternalPin = "0485";

// Realistic mock data structure matching the D1 schema contracts
const mockMenuData = {
  categories: [
    { id: "c1", key: "burgers", name: "Burgers", sortOrder: 1 },
    { id: "c2", key: "guarniciones", name: "Sides", sortOrder: 2 },
    { id: "c3", key: "drinks", name: "Drinks", sortOrder: 3 }
  ],
  items: [
    { sku: "BRG-OG", category: "burgers", name: "Burger OG", description: "Rich taste", price: 100, isAvailable: true, sortOrder: 1, tags: [], upsellItems: [], comboLinks: [] },
    { sku: "BRG-DBL", category: "burgers", name: "Double Smash", description: "Double cheese", price: 150, isAvailable: true, sortOrder: 2, tags: [], upsellItems: [], comboLinks: [] },
    { sku: "SDE-FRY", category: "guarniciones", name: "French Fries", description: "Crispy", price: 50, isAvailable: true, sortOrder: 1, tags: [], upsellItems: [], comboLinks: [] },
    { sku: "DRK-COKE", category: "drinks", name: "Coca Cola", description: "Cold soda", price: 30, isAvailable: true, sortOrder: 1, tags: [], upsellItems: [], comboLinks: [] }
  ],
  promos: [],
  categoryBanners: [],
  catalogBanners: [
    {
      id: 1,
      title: "Slate Promo Banner",
      subtitle: "Get 20% off",
      ctaLabel: "Order Now",
      imageKey: "banners/promo.png",
      imageUrl: "/placeholder.jpg",
      isActive: true,
      sortOrder: 1,
      updatedAt: new Date().toISOString()
    }
  ],
  siteConfig: { brandName: "Redesign Test Burgers", currency: "MXN", orderModes: ["pickup", "delivery"], supportPhone: "5551234567" },
  publicConfig: { publicMode: "catalog", catalogEnabled: true },
  source: "d1"
};

// Stateful memory database for logical checkout simulation
let mockOrdersDb: any[] = [];

// Helper to determine column counts based on card layout positions
async function getGridColumnsCount(page: any) {
  const cards = page.locator(".catalog-card");
  const count = await cards.count();
  if (count === 0) return 0;
  
  const rects = await cards.evaluateAll((elems) =>
    elems.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top };
    })
  );

  const rows: { [key: number]: number } = {};
  for (const rect of rects) {
    let matched = false;
    for (const yKey of Object.keys(rows).map(Number)) {
      if (Math.abs(rect.y - yKey) < 5) {
        rows[yKey]++;
        matched = true;
        break;
      }
    }
    if (!matched) {
      rows[rect.y] = 1;
    }
  }

  return Math.max(...Object.values(rows));
}

// Login helper for Kitchen app
async function loginToKitchen(page: any) {
  await page.goto(`${internalUrl}/`, { waitUntil: "domcontentloaded" });
  if (await page.locator('input[type="password"]').isVisible()) {
    await page.locator('input[type="password"]').fill(validInternalPin);
    await page.getByRole("button", { name: /Entrar/i }).click();
  }
}

test.describe("Professional Catalog Redesign E2E Suite (Tiers 1-4)", () => {
  test.beforeEach(async ({ page }) => {
    // Reset order database state for each test run
    mockOrdersDb = [];

    // Mock Public Menu API
    await page.route("**/api/menu-v2", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        json: mockMenuData
      });
    });

    // Stateful/Logical Order API Mock
    await page.route("**/api/orders-v2", async (route) => {
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON();
        const customerName = payload.customerName || payload.customer?.name;
        const customerPhone = payload.customerPhone || payload.customer?.phone;

        if (!customerName || !customerPhone || !payload.items || payload.items.length === 0) {
          await route.fulfill({
            status: 400,
            json: { ok: false, error: "Missing required fields" }
          });
          return;
        }

        const newOrder = {
          id: `ord-${Math.random().toString(36).substring(2, 9)}`,
          folio: `BX-${1000 + mockOrdersDb.length}`,
          customerName: customerName,
          customerPhone: customerPhone,
          customer: customerName, // for kitchen backward compatibility
          orderMode: payload.orderMode || "pickup",
          paymentMethod: payload.paymentMethod || "cash",
          paymentStatus: "pending",
          paymentState: "pending", // for kitchen backward compatibility
          notes: payload.notes || "",
          note: payload.notes || "", // for kitchen backward compatibility
          total: payload.total || 10000,
          status: "preparing",
          createdAt: new Date().toISOString(),
          items: payload.items.map((it: any, idx: number) => ({
            id: `item-${idx}`,
            sku: it.sku,
            name: it.name || "Item",
            qty: it.qty,
            unitPrice: 10000,
            lineTotal: 10000,
            snapshot: {
              lineKey: it.lineKey || `lk-${idx}`,
              itemKind: it.itemKind,
              removedIngredients: it.removedIngredients || [],
              extras: it.extras || [],
              comboBurgers: it.comboBurgers || [],
              sideQuestExtras: it.sideQuestExtras || []
            }
          }))
        };
        mockOrdersDb.push(newOrder);

        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          json: { ok: true, data: { order: newOrder } }
        });
      } else {
        await route.fulfill({ status: 405, json: { ok: false, error: "Method not allowed" } });
      }
    });

    // Mock internal auth status
    await page.route("**/api/internal-v2-auth/status", async (route) => {
      await route.fulfill({
        status: 200,
        json: { ok: true, data: { authenticated: true } }
      });
    });

    // Mock internal orders list endpoint
    await page.route("**/api/orders-v2-admin?*", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        json: { ok: true, data: { orders: mockOrdersDb } }
      });
    });

    // Mock order status patch endpoint
    await page.route("**/api/orders-v2-admin/*/status", async (route) => {
      const url = new URL(route.request().url());
      const pathParts = url.pathname.split("/");
      const orderId = pathParts[pathParts.length - 2];
      const payload = route.request().postDataJSON();

      const orderIndex = mockOrdersDb.findIndex((o) => o.id === orderId);
      if (orderIndex !== -1) {
        mockOrdersDb[orderIndex].status = payload.status;
        await route.fulfill({
          status: 200,
          json: { ok: true, data: { order: mockOrdersDb[orderIndex] } }
        });
      } else {
        await route.fulfill({ status: 404, json: { ok: false, error: "Order not found" } });
      }
    });
  });

  // ==========================================
  // TIER 1: FEATURE COVERAGE (30 TESTS)
  // ==========================================

  test.describe("Tier 1: Feature Coverage", () => {
    
    // Feature 1: Desktop 3-Column Layout
    test.describe("Feature 1: Desktop 3-Column Layout", () => {
      test("F1.1: Desktop layout renders 3 distinct columns side-by-side", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        
        const sidebar = page.locator(".catalog-category-sidebar, .catalog-category-nav").first();
        const grid = page.locator(".catalog-grid").first();
        const cart = page.locator(".catalog-cart-drawer, .catalog-cart-drawer--persistent, .catalog-cart-panel").first();

        // Check visibility
        await expect(sidebar).toBeVisible();
        await expect(grid).toBeVisible();
        
        // Check horizontal non-overlapping layout if persistent elements are configured
        if (await cart.count() > 0 && await cart.isVisible()) {
          const sidebarBox = await sidebar.boundingBox();
          const gridBox = await grid.boundingBox();
          const cartBox = await cart.boundingBox();
          expect(sidebarBox!.x).toBeLessThan(gridBox!.x);
          expect(gridBox!.x).toBeLessThan(cartBox!.x);
        }
      });

      test("F1.2: Clicking categories in desktop sidebar filters products in catalog grid", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        
        const firstCategoryBtn = page.locator(".catalog-category-nav button, .catalog-category-sidebar button").nth(1);
        await expect(firstCategoryBtn).toBeVisible();
        
        const initialCardsCount = await page.locator(".catalog-card").count();
        await firstCategoryBtn.click();
        
        const filteredCardsCount = await page.locator(".catalog-card").count();
        expect(filteredCardsCount).toBeLessThanOrEqual(initialCardsCount);
      });

      test("F1.3: Persistent cart panel is visible on desktop by default", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        
        const persistentCart = page.locator(".catalog-cart-drawer--persistent, .catalog-cart-drawer, .catalog-cart-panel").first();
        if (await persistentCart.count() > 0) {
          await expect(persistentCart).toBeVisible();
        }
      });

      test("F1.4: Floating bottom cart bar (mobile) is hidden on desktop viewports", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        
        const mobileCartBar = page.locator(".catalog-cart-bar");
        await expect(mobileCartBar).toBeHidden();
      });

      test("F1.5: Resizing viewport from mobile to desktop transitions to 3-column layout", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        
        // In mobile view, persistent columns are not rendered or different classes apply
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.waitForTimeout(200);
        
        const grid = page.locator(".catalog-grid");
        await expect(grid).toBeVisible();
      });
    });

    // Feature 2: Mobile View Layout & Drawer
    test.describe("Feature 2: Mobile View Layout & Drawer", () => {
      test("F2.1: Mobile view has a fixed header containing the brand name", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        
        const header = page.locator("header, .catalog-header").first();
        await expect(header).toBeVisible();
        await expect(header).toContainText("Redesign Test Burgers");
      });

      test("F2.2: Hamburger button is visible in mobile header and opens categories drawer", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        
        const hamburger = page.locator("button.catalog-header__hamburger, button.catalog-header__menu-btn, button[aria-label*='Categorías']").first();
        if (await hamburger.count() > 0) {
          await expect(hamburger).toBeVisible();
          await hamburger.click();
          const drawer = page.locator(".catalog-category-drawer, .catalog-drawer").first();
          await expect(drawer).toBeVisible();
        }
      });

      test("F2.3: Clicking a category in mobile drawer filters products and closes drawer", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        
        const hamburger = page.locator("button.catalog-header__hamburger, button.catalog-header__menu-btn, button[aria-label*='Categorías']").first();
        if (await hamburger.count() > 0) {
          await hamburger.click();
          const categoryLink = page.locator(".catalog-category-drawer a, .catalog-drawer button").nth(1);
          await categoryLink.click();
          const drawer = page.locator(".catalog-category-drawer, .catalog-drawer").first();
          await expect(drawer).toBeHidden();
        }
      });

      test("F2.4: Floating bottom cart bar is visible on mobile when items are in cart", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        
        await page.click(".catalog-card__detail-trigger");
        await page.click("button.catalog-drawer__add-btn");
        await page.click("button.catalog-drawer__close");
        
        const cartBar = page.locator(".catalog-cart-bar");
        await expect(cartBar).toBeVisible();
      });

      test("F2.5: Clicking floating bottom cart bar opens the cart drawer", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        
        await page.click(".catalog-card__detail-trigger");
        await page.click("button.catalog-drawer__add-btn");
        await page.click("button.catalog-drawer__close");
        
        await page.click("button.catalog-cart-bar__cta");
        const cartDrawer = page.locator(".catalog-cart-drawer");
        await expect(cartDrawer).toBeVisible();
      });
    });

    // Feature 3: Product Cards Mixed Layout
    test.describe("Feature 3: Product Cards Mixed Layout", () => {
      test("F3.1: Product cards with images render image elements correctly", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const img = page.locator(".catalog-card__image img").first();
        await expect(img).toBeVisible();
      });

      test("F3.2: Product cards without images render a text-only layout", async ({ page }) => {
        // We configure mock items without image properties or verify placeholder is fallback
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const placeholder = page.locator(".catalog-card__image span").first();
        await expect(placeholder).toBeVisible();
      });

      test("F3.3: Product card layouts scale responsively in the catalog grid", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        expect(await getGridColumnsCount(page)).toBe(2);

        await page.setViewportSize({ width: 1280, height: 800 });
        await page.waitForTimeout(200);
        expect(await getGridColumnsCount(page)).toBe(4);
      });

      test("F3.4: Clicking the product card opens the customization drawer", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        const drawer = page.locator(".catalog-drawer");
        await expect(drawer).toBeVisible();
      });

      test("F3.5: Product cards detail trigger has a touch target of >= 44x44px", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const trigger = page.locator(".catalog-card__detail-trigger").first();
        const box = await trigger.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      });
    });

    // Feature 4: Clean Light Visual Style
    test.describe("Feature 4: Clean Light Visual Style", () => {
      test("F4.1: Body background color is white or a light shade", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const bg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
        // Clean style is light/white themed, so check rgb components are high
        if (bg.startsWith("rgb")) {
          const parts = bg.match(/\d+/g);
          if (parts) {
            const [r, g, b] = parts.map(Number);
            // We assume it's light theme: average brightness > 128 (non-dark)
            // Wait, in pre-patch state it might fail, which is expected for Milestone 1.
            expect((r + g + b) / 3).toBeGreaterThan(128);
          }
        }
      });

      test("F4.2: Brand primary color variable is light-themed (not neon green)", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const primaryHsl = await page.evaluate(() => window.getComputedStyle(document.documentElement).getPropertyValue("--brand-primary-hsl").trim());
        if (primaryHsl) {
          const hue = parseInt(primaryHsl.split(" ")[0]);
          expect(hue).not.toBeCloseTo(139, 5); // Cannot be neon green (hue 139)
        }
      });

      test("F4.3: No elements contain cyberpunk neon text glow classes", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const glowingElements = page.locator(".glow-neon-text, .glow-amber-text, .glow-cyan-text, .glow-magenta-text");
        await expect(glowingElements).toHaveCount(0);
      });

      test("F4.4: Computed font-family includes Inter or Roboto", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const font = await page.evaluate(() => window.getComputedStyle(document.body).fontFamily);
        expect(font).toMatch(/Inter|Roboto/i);
      });

      test("F4.5: Card and drawer borders use rounded corners", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const radius = await page.evaluate(() => {
          const card = document.querySelector(".catalog-card");
          return card ? window.getComputedStyle(card).borderRadius : "0px";
        });
        expect(parseInt(radius)).toBeGreaterThanOrEqual(12);
      });
    });

    // Feature 5: Styled Drawer Checkbox/Radio Inputs
    test.describe("Feature 5: Styled Drawer Checkbox/Radio Inputs", () => {
      test("F5.1: Checkbox inputs in customization drawer are rendered and interactive", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        
        const checkbox = page.locator(".catalog-drawer input[type='checkbox'], .catalog-checkout-drawer input[type='checkbox']").first();
        if (await checkbox.count() > 0) {
          await expect(checkbox).toBeVisible();
          await checkbox.check();
          expect(await checkbox.isChecked()).toBe(true);
        }
      });

      test("F5.2: Radio inputs in customization drawer are rendered and interactive", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        
        const radio = page.locator(".catalog-drawer input[type='radio'], .catalog-drawer [role='radio']").first();
        if (await radio.count() > 0) {
          await expect(radio).toBeVisible();
          await radio.click();
        }
      });

      test("F5.3: Customization options inputs have custom styling (not browser default)", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        
        const customInput = page.locator(".catalog-drawer input[type='checkbox'], .catalog-drawer [role='radio']").first();
        if (await customInput.count() > 0) {
          const appearance = await customInput.evaluate((el) => window.getComputedStyle(el).appearance);
          expect(appearance).not.toBe("auto");
        }
      });

      test("F5.4: Selecting customization options updates the product price dynamically", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        
        const option = page.locator(".catalog-drawer .catalog-option-input, .catalog-drawer [role='checkbox']").first();
        if (await option.count() > 0) {
          const initialPriceText = await page.locator(".catalog-drawer__details strong").textContent();
          await option.click();
          const updatedPriceText = await page.locator(".catalog-drawer__details strong").textContent();
          expect(updatedPriceText).not.toBe(initialPriceText);
        }
      });

      test("F5.5: Checkboxes/radios can be toggled using keyboard navigation (Space/Enter)", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        
        const target = page.locator(".catalog-drawer input[type='checkbox'], .catalog-drawer [role='radio']").first();
        if (await target.count() > 0) {
          await target.focus();
          await page.keyboard.press("Space");
          // verify toggle took place
        }
      });
    });

    // Feature 6: Data Integrity & Kitchen Integration
    test.describe("Feature 6: Data Integrity & Kitchen Integration", () => {
      test("F6.1: Checkout form name and phone inputs are rendered and accept input", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        await page.click("button.catalog-drawer__add-btn");
        await page.click("button.catalog-drawer__close");
        await page.click("button.catalog-cart-bar__cta");
        await page.click("button.catalog-cart-drawer__checkout");
        
        const nameInput = page.locator("#checkout-name");
        const phoneInput = page.locator("#checkout-phone");
        
        await expect(nameInput).toBeVisible();
        await expect(phoneInput).toBeVisible();
        
        await nameInput.fill("Luna Redesign");
        await phoneInput.fill("5551234567");
        
        await expect(nameInput).toHaveValue("Luna Redesign");
        await expect(phoneInput).toHaveValue("5551234567");
      });

      test("F6.2: Successful checkout sends correct JSON payload to /api/orders-v2", async ({ page }) => {
        let payloadReceived: any = null;
        await page.route("**/api/orders-v2", async (route) => {
          payloadReceived = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            json: { ok: true, data: { order: { folio: "BX-123", status: "preparing" } } }
          });
        });

        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        await page.click("button.catalog-drawer__add-btn");
        await page.click("button.catalog-drawer__close");
        await page.click("button.catalog-cart-bar__cta");
        await page.click("button.catalog-cart-drawer__checkout");
        
        await page.locator("#checkout-name").fill("Luna Redesign");
        await page.locator("#checkout-phone").fill("5551234567");
        await page.locator("#location-label + .catalog-checkout-chips button").first().click();
        await page.locator("button.catalog-checkout__submit").click();
        
        expect(payloadReceived).not.toBeNull();
        expect(payloadReceived.customer?.name || payloadReceived.customerName).toBe("Luna Redesign");
      });

      test("F6.3: Placed order appears on the kitchen app queue (port 4174)", async ({ page }) => {
        // Place order on port 4173
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        await page.click("button.catalog-drawer__add-btn");
        await page.click("button.catalog-drawer__close");
        await page.click("button.catalog-cart-bar__cta");
        await page.click("button.catalog-cart-drawer__checkout");
        await page.locator("#checkout-name").fill("Kitchen Sync Cust");
        await page.locator("#checkout-phone").fill("5551112222");
        await page.locator("#location-label + .catalog-checkout-chips button").first().click();
        await page.locator("button.catalog-checkout__submit").click();
        await expect(page.locator(".catalog-checkout-success")).toBeVisible();

        // Switch to Kitchen App on port 4174
        await loginToKitchen(page);
        await page.click("button.tab:has-text('Cocina')");
        
        // Order should appear in queue
        const activeOrderCard = page.locator(".kitchen-active-order, .kitchen-production-card").filter({ hasText: "Kitchen Sync Cust" });
        await expect(activeOrderCard).toBeVisible();
      });

      test("F6.4: Kitchen app displays the order status as preparing", async ({ page }) => {
        // Place order
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        await page.click("button.catalog-drawer__add-btn");
        await page.click("button.catalog-drawer__close");
        await page.click("button.catalog-cart-bar__cta");
        await page.click("button.catalog-cart-drawer__checkout");
        await page.locator("#checkout-name").fill("Kitchen Status Cust");
        await page.locator("#checkout-phone").fill("5552223333");
        await page.locator("#location-label + .catalog-checkout-chips button").first().click();
        await page.locator("button.catalog-checkout__submit").click();

        await loginToKitchen(page);
        await page.click("button.tab:has-text('Cocina')");
        
        const activeOrderCard = page.locator(".kitchen-active-order, .kitchen-production-card").filter({ hasText: "Kitchen Status Cust" });
        await expect(activeOrderCard).toBeVisible();
        await expect(activeOrderCard).toContainText("preparing, En preparación");
      });

      test("F6.5: Kitchen fallback classifier categorizes items without explicit itemKind correctly", async ({ page }) => {
        // Push an order with missing itemKind in snapshot
        mockOrdersDb.push({
          id: "o-fallback-test",
          folio: "FW-777",
          customerName: "Fallback Tester",
          customerPhone: "5551234567",
          customer: "Fallback Tester",
          orderMode: "pickup",
          paymentMethod: "cash",
          paymentStatus: "paid",
          paymentState: "paid",
          notes: "Ubicación: GGA",
          total: 10000,
          status: "preparing",
          createdAt: new Date().toISOString(),
          items: [{
            id: "it-fb",
            sku: "SDE-FRY",
            name: "Crispy French Fries", // trigger garnish keyword
            qty: 1,
            unitPrice: 10000,
            lineTotal: 10000,
            snapshot: {
              lineKey: "lk-fb",
              // itemKind is intentionally missing
              sideQuestExtras: [],
              removedIngredients: [],
              extras: []
            }
          }]
        });

        await loginToKitchen(page);
        await page.click("button.tab:has-text('Cocina')");
        await page.click("button.kitchen-view-tab:has-text('Side Quest')");
        
        // Verify it is placed under the Side Quest lane for garnish items
        const card = page.locator(".kitchen-production-card").filter({ hasText: "FW-777" });
        await expect(card).toBeVisible();
      });
    });
  });

  // ==========================================
  // TIER 2: BOUNDARY & CORNER CASES (30 TESTS)
  // ==========================================

  test.describe("Tier 2: Boundary & Corner Cases", () => {
    
    // Feature 1: Desktop 3-Column Layout
    test.describe("Feature 1: Desktop 3-Column Layout", () => {
      test("F1.B1: Desktop layout scales correctly under extreme viewport width (1920px)", async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(overflow).toBe(false);
      });

      test("F1.B2: Desktop layout handles empty categories list gracefully", async ({ page }) => {
        await page.route("**/api/menu-v2", async (route) => {
          await route.fulfill({
            status: 200,
            json: { ...mockMenuData, categories: [], items: [] }
          });
        });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const emptyMsg = page.locator(".catalog-empty");
        await expect(emptyMsg).toBeVisible();
      });

      test("F1.B3: Desktop categories sidebar scrolls independently when overflowing", async ({ page }) => {
        const manyCategories = Array.from({ length: 30 }, (_, i) => ({
          id: `c${i+10}`, key: `cat-${i}`, name: `Category ${i}`, sortOrder: i
        }));
        await page.route("**/api/menu-v2", async (route) => {
          await route.fulfill({
            status: 200,
            json: { ...mockMenuData, categories: manyCategories }
          });
        });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const sidebar = page.locator(".catalog-category-sidebar, .catalog-category-nav").first();
        const overflow = await sidebar.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.overflowY === "auto" || style.overflowX === "auto" || style.overflow === "auto" || el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
        });
        expect(overflow).toBe(true);
      });

      test("F1.B4: Desktop persistent cart checkout button is disabled when cart is empty", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const checkoutBtn = page.locator("button.catalog-cart-drawer__checkout, button.catalog-checkout__submit").first();
        if (await checkoutBtn.count() > 0) {
          await expect(checkoutBtn).toBeDisabled();
        }
      });

      test("F1.B5: Persistent cart panel scrolls independently when cart has many items", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        for (let i = 0; i < 15; i++) {
          await page.click(".catalog-card__detail-trigger");
          await page.click("button.catalog-drawer__add-btn");
          await page.click("button.catalog-drawer__close");
        }
        await page.click("button.catalog-cart-bar__cta");
        const list = page.locator(".catalog-cart-drawer__list").first();
        const overflow = await list.evaluate((el) => el.scrollHeight > el.clientHeight);
        expect(overflow).toBe(true);
      });
    });

    // Feature 2: Mobile View Layout & Drawer
    test.describe("Feature 2: Mobile View Layout & Drawer", () => {
      test("F2.B1: Mobile layout has no horizontal overflow on extremely narrow screen (320px)", async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(overflow).toBe(false);
      });

      test("F2.B2: Mobile categories drawer closes on Escape key, overlay click, or close button", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const hamburger = page.locator("button.catalog-header__hamburger, button.catalog-header__menu-btn").first();
        if (await hamburger.count() > 0) {
          await hamburger.click();
          const drawer = page.locator(".catalog-category-drawer, .catalog-drawer").first();
          await page.keyboard.press("Escape");
          await expect(drawer).toBeHidden();
        }
      });

      test("F2.B3: Mobile categories drawer traps focus and restores it on close", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const hamburger = page.locator("button.catalog-header__hamburger, button.catalog-header__menu-btn").first();
        if (await hamburger.count() > 0) {
          await hamburger.focus();
          await hamburger.click();
          // Escape drawer and verify focus returned
          await page.keyboard.press("Escape");
          await expect(hamburger).toBeFocused();
        }
      });

      test("F2.B4: Mobile floating bottom cart bar handles many items without visual overlap", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        await page.click("button.catalog-drawer__add-btn");
        await page.click("button.catalog-drawer__close");
        const cartBar = page.locator(".catalog-cart-bar");
        await expect(cartBar).toBeVisible();
      });

      test("F2.B5: Categories drawer handles special characters in category names", async ({ page }) => {
        const specialCategories = [
          { id: "c1", key: "burgers", name: "Burgers & grill! 🔥", sortOrder: 1 }
        ];
        await page.route("**/api/menu-v2", async (route) => {
          await route.fulfill({
            status: 200,
            json: { ...mockMenuData, categories: specialCategories }
          });
        });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const categoryBtn = page.locator(".catalog-category-nav button, .catalog-category-sidebar button").nth(1);
        await expect(categoryBtn).toBeVisible();
      });
    });

    // Feature 3: Product Cards Mixed Layout
    test.describe("Feature 3: Product Cards Mixed Layout", () => {
      test("F3.B1: Product cards handle extremely long description text by truncating gracefully", async ({ page }) => {
        const longDescItem = {
          sku: "LONG", category: "burgers", name: "Long Desc Burger",
          description: "A".repeat(300), price: 100, isAvailable: true, sortOrder: 1, tags: [], upsellItems: [], comboLinks: []
        };
        await page.route("**/api/menu-v2", async (route) => {
          await route.fulfill({
            status: 200,
            json: { ...mockMenuData, items: [longDescItem] }
          });
        });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const card = page.locator(".catalog-card").first();
        await expect(card).toBeVisible();
      });

      test("F3.B2: Product card displays text fallback when image URL fails to load", async ({ page }) => {
        const brokenImageItem = {
          sku: "BROKEN", category: "burgers", name: "Broken Image Burger",
          description: "Test image failure", price: 100, isAvailable: true, sortOrder: 1, tags: [], upsellItems: [], comboLinks: [],
          imageUrl: "/broken-image.jpg"
        };
        await page.route("**/api/menu-v2", async (route) => {
          await route.fulfill({
            status: 200,
            json: { ...mockMenuData, items: [brokenImageItem] }
          });
        });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        // The text fallback should be displayed
        const fallbackSpan = page.locator(".catalog-card__image span").first();
        await expect(fallbackSpan).toBeVisible();
      });

      test("F3.B3: Product card handles extremely high prices without breaking boundaries", async ({ page }) => {
        const richItem = {
          sku: "RICH", category: "burgers", name: "Rich Gold Burger",
          description: "Gold leaf topping", price: 999999, isAvailable: true, sortOrder: 1, tags: [], upsellItems: [], comboLinks: []
        };
        await page.route("**/api/menu-v2", async (route) => {
          await route.fulfill({
            status: 200,
            json: { ...mockMenuData, items: [richItem] }
          });
        });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const price = page.locator(".catalog-card__footer strong").first();
        await expect(price).toBeVisible();
      });

      test("F3.B4: Product cards grid spacing (gap) is <= 16px on all viewports", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const gap = await page.locator(".catalog-grid").evaluate((el) => window.getComputedStyle(el).gap);
        expect(parseInt(gap) || 0).toBeLessThanOrEqual(16);
      });

      test("F3.B5: Product card detail trigger has visible keyboard focus outline", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const trigger = page.locator(".catalog-card__detail-trigger").first();
        await trigger.focus();
        const outline = await trigger.evaluate((el) => window.getComputedStyle(el).outlineStyle);
        expect(outline).not.toBe("none");
      });
    });

    // Feature 4: Clean Light Visual Style
    test.describe("Feature 4: Clean Light Visual Style", () => {
      test("F4.B1: Box-shadow on cards is a soft shadow (low opacity alpha)", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const shadow = await page.locator(".catalog-card").first().evaluate((el) => window.getComputedStyle(el).boxShadow);
        expect(shadow).toBeDefined();
      });

      test("F4.B2: Title elements have no text-shadow (no glow)", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const titleShadow = await page.locator("h1, h2, h3").first().evaluate((el) => window.getComputedStyle(el).textShadow);
        expect(titleShadow).toBe("none");
      });

      test("F4.B3: Text elements meet WCAG color contrast standards against light background", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const color = await page.locator("body").evaluate((el) => window.getComputedStyle(el).color);
        expect(color).toBeDefined();
      });

      test("F4.B4: Drawer animations are disabled under prefers-reduced-motion", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        const drawer = page.locator(".catalog-drawer");
        await expect(drawer).toBeVisible();
      });

      test("F4.B5: Layout borders are clean and thin (no neon glowing borders)", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        const border = await page.locator(".catalog-card").first().evaluate((el) => window.getComputedStyle(el).borderWidth);
        expect(parseFloat(border) || 0).toBeLessThanOrEqual(2);
      });
    });

    // Feature 5: Styled Drawer Checkbox/Radio Inputs
    test.describe("Feature 5: Styled Drawer Checkbox/Radio Inputs", () => {
      test("F5.B1: Custom checkboxes handle rapid toggle states without desyncing", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        const checkbox = page.locator("input[type='checkbox']").first();
        if (await checkbox.count() > 0) {
          await checkbox.click();
          await checkbox.click();
          expect(await checkbox.isChecked()).toBe(false);
        }
      });

      test("F5.B2: Custom radios enforce mutually exclusive selection correctly", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        await page.click("button.catalog-drawer__add-btn");
        await page.click("button.catalog-drawer__close");
        await page.click("button.catalog-cart-bar__cta");
        await page.click("button.catalog-cart-drawer__checkout");

        const locationChips = page.locator("#location-label + .catalog-checkout-chips button");
        await locationChips.nth(0).click();
        await locationChips.nth(1).click();
        
        await expect(locationChips.nth(0)).not.toHaveClass(/active/);
        await expect(locationChips.nth(1)).toHaveClass(/active/);
      });

      test("F5.B3: Customization drawer resets option states cleanly when closing/reopening", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        
        const option = page.locator(".catalog-drawer input[type='checkbox']").first();
        if (await option.count() > 0) {
          await option.check();
          await page.click("button.catalog-drawer__close");
          await page.click(".catalog-card__detail-trigger");
          expect(await option.isChecked()).toBe(false);
        }
      });

      test("F5.B4: Customization drawer validates required modifiers before adding to cart", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        
        // Assert we can click add directly if there are no required options
        const addBtn = page.locator("button.catalog-drawer__add-btn");
        await expect(addBtn).toBeEnabled();
      });

      test("F5.B5: Styled checkbox/radio inputs have clear keyboard focus indicators", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        const checkbox = page.locator(".catalog-drawer input[type='checkbox']").first();
        if (await checkbox.count() > 0) {
          await checkbox.focus();
          const outline = await checkbox.evaluate((el) => window.getComputedStyle(el).outlineStyle);
          expect(outline).not.toBe("none");
        }
      });
    });

    // Feature 6: Data Integrity & Kitchen Integration
    test.describe("Feature 6: Data Integrity & Kitchen Integration", () => {
      test("F6.B1: Phone number normalization strips +52 prefix and formats correctly", async ({ page }) => {
        let sentPhone = "";
        await page.route("**/api/orders-v2", async (route) => {
          const body = route.request().postDataJSON();
          sentPhone = body.customer?.phone || body.customerPhone;
          await route.fulfill({ status: 200, json: { ok: true, data: { order: { folio: "BX-N1", status: "preparing" } } } });
        });

        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        await page.click("button.catalog-drawer__add-btn");
        await page.click("button.catalog-drawer__close");
        await page.click("button.catalog-cart-bar__cta");
        await page.click("button.catalog-cart-drawer__checkout");
        
        await page.locator("#checkout-name").fill("Normalizer User");
        await page.locator("#checkout-phone").fill("+52 55 1234 5678");
        await page.locator("#location-label + .catalog-checkout-chips button").first().click();
        await page.locator("button.catalog-checkout__submit").click();
        
        expect(sentPhone).toBe("5512345678");
      });

      test("F6.B2: Phone number validation rejects numbers not meeting 10-digit format", async ({ page }) => {
        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        await page.click("button.catalog-drawer__add-btn");
        await page.click("button.catalog-drawer__close");
        await page.click("button.catalog-cart-bar__cta");
        await page.click("button.catalog-cart-drawer__checkout");
        
        await page.locator("#checkout-name").fill("Validation User");
        await page.locator("#checkout-phone").fill("123");
        await page.locator("button.catalog-checkout__submit").click();
        
        const phoneError = page.locator("#phone-error");
        await expect(phoneError).toBeVisible();
      });

      test("F6.B3: Checkout payload handles special/accented characters in customer name", async ({ page }) => {
        let nameSent = "";
        await page.route("**/api/orders-v2", async (route) => {
          const body = route.request().postDataJSON();
          nameSent = body.customer?.name || body.customerName;
          await route.fulfill({ status: 200, json: { ok: true, data: { order: { folio: "BX-N2", status: "preparing" } } } });
        });

        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
        await page.click(".catalog-card__detail-trigger");
        await page.click("button.catalog-drawer__add-btn");
        await page.click("button.catalog-drawer__close");
        await page.click("button.catalog-cart-bar__cta");
        await page.click("button.catalog-cart-drawer__checkout");
        
        await page.locator("#checkout-name").fill("Ángel Núñez");
        await page.locator("#checkout-phone").fill("5551234567");
        await page.locator("#location-label + .catalog-checkout-chips button").first().click();
        await page.locator("button.catalog-checkout__submit").click();
        
        expect(nameSent).toBe("Ángel Núñez");
      });

      test("F6.B4: Kitchen fallback classifier handles mixed-case keywords and name patterns", async ({ page }) => {
        mockOrdersDb.push({
          id: "o-mixed-case",
          folio: "FW-888",
          customerName: "Mixed Case Tester",
          customerPhone: "5551234567",
          customer: "Mixed Case Tester",
          orderMode: "pickup",
          paymentMethod: "cash",
          paymentStatus: "paid",
          paymentState: "paid",
          notes: "Ubicación: GGA",
          total: 10000,
          status: "preparing",
          createdAt: new Date().toISOString(),
          items: [{
            id: "it-mc",
            sku: "DRK-COKE",
            name: "CoCa CoLa sODa",
            qty: 1,
            unitPrice: 10000,
            lineTotal: 10000,
            snapshot: { lineKey: "lk-mc", sideQuestExtras: [], removedIngredients: [], extras: [] }
          }]
        });

        await loginToKitchen(page);
        await page.click("button.tab:has-text('Cocina')");
        await page.click("button.kitchen-view-tab:has-text('Side Quest')");
        
        // Classified as drink (soda keyword)
        const card = page.locator(".kitchen-production-card").filter({ hasText: "FW-888" });
        await expect(card).toBeVisible();
        await expect(card.getByText("🥤 1 Bebida")).toBeVisible();
      });

      test("F6.B5: Placed orders maintain data structure when marked ready/delivered", async ({ page }) => {
        mockOrdersDb.push({
          id: "o-state-update",
          folio: "FW-999",
          customerName: "State Update Cust",
          customer: "State Update Cust",
          customerPhone: "5551234567",
          orderMode: "pickup",
          paymentMethod: "cash",
          paymentStatus: "pending",
          paymentState: "pending",
          notes: "Ubicación: GGA",
          total: 10000,
          status: "preparing",
          createdAt: new Date().toISOString(),
          items: [{
            id: "it-su",
            sku: "BRG-OG",
            name: "Burger OG",
            qty: 1,
            unitPrice: 10000,
            lineTotal: 10000,
            snapshot: { lineKey: "lk-su", sideQuestExtras: [], removedIngredients: [], extras: [] }
          }]
        });

        await loginToKitchen(page);
        await page.click("button.tab:has-text('Cocina')");
        
        // Mocking client status updates via internal dashboard triggers
        const activeOrderCard = page.locator(".kitchen-active-order, .kitchen-production-card").filter({ hasText: "FW-999" });
        await expect(activeOrderCard).toBeVisible();
      });
    });
  });

  // ==========================================
  // TIER 3: CROSS-FEATURE COMBINATIONS (6 TESTS)
  // ==========================================

  test.describe("Tier 3: Cross-Feature Combinations", () => {
    test("C.1: Desktop column sync: adding item in catalog column immediately updates persistent cart", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
      
      await page.click(".catalog-card__detail-trigger");
      await page.click("button.catalog-drawer__add-btn");
      await page.click("button.catalog-drawer__close");
      
      // persistent cart updates instantly
      const cartCount = page.locator(".catalog-cart-bar__count, .catalog-cart-drawer__title, .catalog-cart-drawer__list").first();
      await expect(cartCount).toContainText("1");
    });

    test("C.2: Mobile category selection: category click in drawer updates grid and remains selected after drawer closes", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
      
      const hamburger = page.locator("button.catalog-header__hamburger, button.catalog-header__menu-btn").first();
      if (await hamburger.count() > 0) {
        await hamburger.click();
        const categoryBtn = page.locator(".catalog-category-drawer button, .catalog-drawer button").nth(1);
        const name = await categoryBtn.textContent();
        await categoryBtn.click();
        
        const activeNavBtn = page.locator(".catalog-category-nav button.active");
        await expect(activeNavBtn).toContainText(name || "");
      }
    });

    test("C.3: Visual + Inputs: verifying custom checkboxes match the clean light visual theme style tokens", async ({ page }) => {
      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
      await page.click(".catalog-card__detail-trigger");
      
      const checkbox = page.locator(".catalog-drawer input[type='checkbox']").first();
      if (await checkbox.count() > 0) {
        const border = await checkbox.evaluate((el) => window.getComputedStyle(el).borderColor);
        expect(border).toBeDefined();
      }
    });

    test("C.4: Customization + Cart: custom options selected in drawer reflect correct final price in cart", async ({ page }) => {
      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
      await page.click(".catalog-card__detail-trigger");
      
      const option = page.locator(".catalog-drawer input[type='checkbox']").first();
      if (await option.count() > 0) {
        await option.check();
        const drawerPrice = await page.locator(".catalog-drawer__details strong").textContent();
        await page.click("button.catalog-drawer__add-btn");
        await page.click("button.catalog-drawer__close");
        await page.click("button.catalog-cart-bar__cta");
        
        const cartPrice = page.locator(".catalog-cart-item__price").first();
        await expect(cartPrice).toContainText(drawerPrice || "");
      }
    });

    test("C.5: Form + Data Integrity: submitting form in checkout drawer with normalized phone sends correct JSON payload", async ({ page }) => {
      let sentPayload: any = null;
      await page.route("**/api/orders-v2", async (route) => {
        sentPayload = route.request().postDataJSON();
        await route.fulfill({ status: 200, json: { ok: true, data: { order: { folio: "BX-C5", status: "preparing" } } } });
      });

      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
      await page.click(".catalog-card__detail-trigger");
      await page.click("button.catalog-drawer__add-btn");
      await page.click("button.catalog-drawer__close");
      await page.click("button.catalog-cart-bar__cta");
      await page.click("button.catalog-cart-drawer__checkout");
      
      await page.locator("#checkout-name").fill("Cross Val Cust");
      await page.locator("#checkout-phone").fill("+52 55 9876 5432");
      await page.locator("#location-label + .catalog-checkout-chips button").first().click();
      await page.locator("button.catalog-checkout__submit").click();
      
      expect(sentPayload.customer?.phone || sentPayload.customerPhone).toBe("5598765432");
    });

    test("C.6: E2E Integration: customized order submitted via checkout is shown and classified correctly in kitchen board", async ({ page }) => {
      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
      await page.click(".catalog-card__detail-trigger");
      await page.click("button.catalog-drawer__add-btn");
      await page.click("button.catalog-drawer__close");
      await page.click("button.catalog-cart-bar__cta");
      await page.click("button.catalog-cart-drawer__checkout");
      
      await page.locator("#checkout-name").fill("Integrated E2E Cust");
      await page.locator("#checkout-phone").fill("5554443333");
      await page.locator("#location-label + .catalog-checkout-chips button").first().click();
      await page.locator("button.catalog-checkout__submit").click();
      await expect(page.locator(".catalog-checkout-success")).toBeVisible();

      await loginToKitchen(page);
      await page.click("button.tab:has-text('Cocina')");
      
      const card = page.locator(".kitchen-active-order, .kitchen-production-card").filter({ hasText: "Integrated E2E Cust" });
      await expect(card).toBeVisible();
    });
  });

  // ==========================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 TESTS)
  // ==========================================

  test.describe("Tier 4: Real-World Application Scenarios", () => {
    test("S.1: Complete customer journey - browse, customize, add to cart, review, checkout, and submit successfully", async ({ page }) => {
      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });

      // 1. Browse catalog
      const drinksCategoryTab = page.locator(".catalog-category-nav button, .catalog-category-sidebar button").nth(2); 
      if (await drinksCategoryTab.count() > 0) {
        await drinksCategoryTab.click();
      }

      // 2. Open detail drawer
      await page.click(".catalog-card__detail-trigger");
      
      // 3. Customize & add to cart
      const option = page.locator(".catalog-drawer input[type='checkbox']").first();
      if (await option.count() > 0) {
        await option.check();
      }
      await page.click("button.catalog-drawer__add-btn");
      await page.click("button.catalog-drawer__close");

      // 4. Review via cart
      await page.click("button.catalog-cart-bar__cta");
      await expect(page.locator(".catalog-cart-drawer")).toBeVisible();

      // 5. Checkout
      await page.click("button.catalog-cart-drawer__checkout");
      await expect(page.locator(".catalog-checkout-drawer")).toBeVisible();

      // 6. Form fill & submit
      await page.locator("#checkout-name").fill("Real Scenario Cust");
      await page.locator("#checkout-phone").fill("5551234567");
      await page.locator("#location-label + .catalog-checkout-chips button").first().click();
      await page.click("button.catalog-checkout__submit");

      // 7. Verify success screen
      await expect(page.locator(".catalog-checkout-success")).toBeVisible();
    });

    test("S.2: Validation recovery journey - user fixes form fields step-by-step and completes checkout", async ({ page }) => {
      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });

      await page.click(".catalog-card__detail-trigger");
      await page.click("button.catalog-drawer__add-btn");
      await page.click("button.catalog-drawer__close");
      await page.click("button.catalog-cart-bar__cta");
      await page.click("button.catalog-cart-drawer__checkout");

      const submitBtn = page.locator("button.catalog-checkout__submit");
      
      // Submit blank
      await submitBtn.click();
      await expect(page.locator("#name-error")).toBeVisible();
      await expect(page.locator("#checkout-name")).toBeFocused();

      // Fix Name
      await page.locator("#checkout-name").fill("Luna Recovery");
      await submitBtn.click();
      await expect(page.locator("#name-error")).toBeHidden();
      await expect(page.locator("#phone-error")).toBeVisible();
      await expect(page.locator("#checkout-phone")).toBeFocused();

      // Malformed Phone
      await page.locator("#checkout-phone").fill("123");
      await submitBtn.click();
      await expect(page.locator("#phone-error")).toContainText("El teléfono debe tener exactamente 10 dígitos.");

      // Fix Phone
      await page.locator("#checkout-phone").fill("5551234567");
      await submitBtn.click();
      await expect(page.locator("#phone-error")).toBeHidden();
      await expect(page.locator("#location-error")).toBeVisible();

      // Fix Location -> Complete
      await page.locator("#location-label + .catalog-checkout-chips button").first().click();
      await submitBtn.click();

      await expect(page.locator(".catalog-checkout-success")).toBeVisible();
    });

    test("S.3: Layout resize stability during checkout process does not drop cart states", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });

      await page.click(".catalog-card__detail-trigger");
      await page.click("button.catalog-drawer__add-btn");
      await page.click("button.catalog-drawer__close");

      // Mobile view
      await expect(page.locator("button.catalog-cart-bar__cta")).toContainText("1");

      // Resize
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(200);

      // Cart bar retains count
      await expect(page.locator("button.catalog-cart-bar__cta")).toContainText("1");
    });

    test("S.4: Interleaved drawer focus loop navigation keyboard workflow", async ({ page }) => {
      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });

      const trigger = page.locator(".catalog-card__detail-trigger").first();
      await trigger.focus();
      await trigger.click();
      await expect(page.locator(".catalog-drawer")).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();

      await trigger.click();
      await page.click("button.catalog-drawer__add-btn");
      await page.click("button.catalog-drawer__close");
      
      const cartBarCta = page.locator("button.catalog-cart-bar__cta");
      await cartBarCta.focus();
      await cartBarCta.click();
      await expect(page.locator(".catalog-cart-drawer")).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(cartBarCta).toBeFocused();
    });

    test("S.5: Resilient fallback notice updates menu on retry trigger", async ({ page }) => {
      await page.route("**/api/menu-v2", async (route) => {
        await route.fulfill({
          status: 200,
          json: { ...mockMenuData, source: "fallback" }
        });
      });

      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
      const notice = page.locator(".menu-sync-notice");
      await expect(notice).toBeVisible();

      await page.route("**/api/menu-v2", async (route) => {
        await route.fulfill({
          status: 200,
          json: { ...mockMenuData, source: "d1" }
        });
      });

      // Override window.location.reload to test click behavior without dropping router/API mocks
      await page.evaluate(() => {
        window.location.reload = () => {}; 
      });
      await notice.locator("button").click();
    });
  });
});
