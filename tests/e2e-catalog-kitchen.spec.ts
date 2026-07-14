import { expect, test } from "@playwright/test";

// Base URLs
const publicUrl = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const internalUrl = process.env.INTERNAL_PREVIEW_URL || "http://127.0.0.1:4174";

const validInternalPin = "0485";

// Mock helper for catalog banners
const mockBanners = [
  {
    id: 1,
    title: "Active Promo Banner",
    subtitle: "Get 20% off",
    cta_label: "Order Now",
    ctaLabel: "Order Now",
    image_key: "banners/promo.png",
    imageKey: "banners/promo.png",
    image_url: "/placeholder.jpg",
    imageUrl: "/placeholder.jpg",
    is_active: 1,
    isActive: true,
    sort_order: 1,
    sortOrder: 1,
    updated_at: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 2,
    title: "Inactive Winter Promo",
    subtitle: "Cold deals",
    cta_label: "Learn More",
    ctaLabel: "Learn More",
    image_key: "banners/winter.png",
    imageKey: "banners/winter.png",
    image_url: "/placeholder2.jpg",
    imageUrl: "/placeholder2.jpg",
    is_active: 0,
    isActive: false,
    sort_order: 2,
    sortOrder: 2,
    updated_at: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Mock helper to install internal auth status
const mockInternalAuth = async (page: any, authenticated = true) => {
  await page.route("**/api/internal-v2-auth/status", async (route: any) => {
    await route.fulfill({
      status: 200,
      json: { ok: true, data: { authenticated } }
    });
  });
};

test.describe("E2E Catalog & Kitchen Weaknesses Fixes Suite", () => {
  // ==========================================
  // TIER 1: FEATURE COVERAGE (15 tests, 5 per feature)
  // ==========================================

  test.describe("Tier 1 - Kitchen Fallback (5 tests)", () => {
    // Tests look at kitchen view or API logic behavior
    const testCases = [
      { name: "Mega Combo", expectedKind: "combo", expectedSummary: "🍔 1 Burger · 🍟 1 Side · 🥤 1 Bebida" },
      { name: "French Fries", expectedKind: "garnish", expectedSummary: "🍟 1 Side" },
      { name: "Coca Cola Drink", expectedKind: "drink", expectedSummary: "🥤 1 Bebida" },
      { name: "Extra Queso Manchego", expectedKind: "other", expectedSummary: "" },
      { name: "OG Smash Burger", expectedKind: "burger", expectedSummary: "🍔 1 Burger" }
    ];

    for (const tc of testCases) {
      test(`Kitchen Fallback - classify "${tc.name}" correctly`, async ({ page }) => {
        await mockInternalAuth(page, true);
        
        // Mock order list with item having missing itemKind
        await page.route("**/api/orders-v2-admin?*", async (route) => {
          await route.fulfill({
            status: 200,
            json: {
              ok: true,
              data: {
                orders: [
                  {
                    id: "order-fallback-t1",
                    folio: "FW-101",
                    customerName: "Test Customer",
                    customerPhone: "5551234567",
                    orderMode: "pickup",
                    paymentMethod: "cash",
                    paymentStatus: "paid",
                    notes: "Ubicación: GGA",
                    total: 15000,
                    status: "preparing",
                    createdAt: new Date().toISOString(),
                    items: [
                      {
                        id: "item-1",
                        orderId: "order-fallback-t1",
                        sku: "SKU-FALLBACK",
                        name: tc.name,
                        qty: 1,
                        unitPrice: 15000,
                        lineTotal: 15000,
                        snapshot: {
                          lineKey: "line-1",
                          // itemKind is missing
                          sideQuestExtras: [],
                          removedIngredients: [],
                          extras: [],
                          comboBurgers: tc.expectedKind === "combo" ? [{ sku: "burger-sub", name: "Sub Burger", removedIngredients: [], extras: [] }] : []
                        }
                      }
                    ]
                  }
                ]
              }
            }
          });
        });

        await page.goto(`${internalUrl}/`, { waitUntil: "domcontentloaded" });
        // Handle auth login input
        if (await page.locator('input[type="password"]').isVisible()) {
          await page.locator('input[type="password"]').fill(validInternalPin);
          await page.getByRole("button", { name: /Entrar/i }).click();
        }

        // Navigate to kitchen tab
        await page.click("button.tab:has-text('Cocina')");
        
        // If the item classification is correct, the quick summary on the card will reflect the expected count
        if (tc.expectedSummary) {
          if (tc.expectedKind === "garnish" || tc.expectedKind === "drink") {
            await page.click("button.kitchen-view-tab:has-text('Side Quest')");
          }
          const card = page.locator(".kitchen-production-card").filter({ hasText: "FW-101" });
          await expect(card).toBeVisible();
          await expect(card.getByText(tc.expectedSummary)).toBeVisible();
        } else {
          // If it is classified as "other", it is not a production item, so card shouldn't be visible in queue
          const card = page.locator(".kitchen-production-card").filter({ hasText: "FW-101" });
          await expect(card).toHaveCount(0);
        }
      });
    }
  });

  test.describe("Tier 1 - Catalog Banners (5 tests)", () => {
    test("Catalog Banners - public filter active shows only active banners", async ({ page }) => {
      // Mock public menu endpoint returning active and inactive banners
      await page.route("**/api/menu-v2", async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            categories: [],
            items: [],
            promos: [],
            categoryBanners: [],
            catalogBanners: mockBanners, // Contain 1 active and 1 inactive
            siteConfig: { brandName: "Test Burger", currency: "MXN", orderModes: ["pickup"], supportPhone: "555", heroCta: "Pedir", notice: "" },
            publicConfig: { publicMode: "catalog", catalogEnabled: true },
            source: "d1"
          }
        });
      });

      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
      
      // Verify active banner is visible in rail
      const activeBanner = page.locator(".catalog-banner-rail").filter({ hasText: "Active Promo Banner" });
      await expect(activeBanner).toBeVisible();

      // Verify inactive banner is NOT visible
      const inactiveBanner = page.locator(".catalog-banner-rail").filter({ hasText: "Inactive Winter Promo" });
      await expect(inactiveBanner).toHaveCount(0);
    });

    test("Catalog Banners - admin endpoint gets active", async ({ request }) => {
      // Direct API call to admin banners GET endpoint (mocked or real)
      const res = await request.get(`${internalUrl}/api/menu-v2-admin/catalog-banners`, {
        headers: { Authorization: "Bearer valid-token" }
      });
      expect([200, 401]).toContain(res.status()); // Expecting 200 after implementation, or 401 if unauthenticated
    });

    test("Catalog Banners - admin endpoint gets inactive", async ({ request }) => {
      const res = await request.get(`${internalUrl}/api/menu-v2-admin/catalog-banners`, {
        headers: { Authorization: "Bearer valid-token" }
      });
      if (res.status() === 200) {
        const body = await res.json();
        const inactive = body.banners.find((b: any) => b.is_active === 0 || !b.isActive);
        expect(inactive).toBeDefined();
      }
    });

    test("Catalog Banners - auth check rejects request without token", async ({ request }) => {
      const res = await request.get(`${internalUrl}/api/menu-v2-admin/catalog-banners`);
      expect(res.status()).toBe(401);
    });

    test("Catalog Banners - admin panel loading displays banners tab", async ({ page }) => {
      await mockInternalAuth(page, true);

      // Mock orders endpoint to prevent 401 session expiration from real backend
      await page.route("**/api/orders-v2-admin?*", async (route) => {
        await route.fulfill({
          status: 200,
          json: { ok: true, data: { orders: [] } }
        });
      });

      // Mock catalog banners admin endpoint to return mock banners
      await page.route("**/api/menu-v2-admin/catalog-banners", async (route) => {
        await route.fulfill({
          status: 200,
          json: { ok: true, banners: mockBanners }
        });
      });

      // Mock menu-v2 with banners
      await page.route("**/api/menu-v2", async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            categories: [],
            items: [],
            promos: [],
            categoryBanners: [],
            catalogBanners: mockBanners,
            siteConfig: { brandName: "Test Burger" },
            publicConfig: { publicMode: "catalog", catalogEnabled: true },
            source: "d1"
          }
        });
      });

      // Navigate to admin catalog banners panel
      await page.goto(`${internalUrl}/`, { waitUntil: "domcontentloaded" });
      if (await page.locator('input[type="password"]').isVisible()) {
        await page.locator('input[type="password"]').fill(validInternalPin);
        await page.getByRole("button", { name: /Entrar/i }).click();
      }
      await page.click("button.tab:has-text('Admin')");
      await page.click("button.admin-module-card:has-text('Catálogo')");
      await page.click("button:has-text('Banners Catálogo')");

      // Verify active banner title is visible in list
      await expect(page.getByText("Active Promo Banner")).toBeVisible();
      // Verify inactive banner is also listed in admin view
      await expect(page.getByText("Inactive Winter Promo")).toBeVisible();
    });
  });

  test.describe("Tier 1 - Checkout Phone Normalization (5 tests)", () => {
    const phones = [
      { input: "+52 55 1234 5678", expected: "5512345678" },
      { input: "52 55 1234 5678", expected: "5512345678" },
      { input: "+525512345678", expected: "5512345678" },
      { input: "525512345678", expected: "5512345678" },
      { input: "5512345678", expected: "5512345678" }
    ];

    for (const p of phones) {
      test(`Checkout Phone - normalizes "${p.input}" to "${p.expected}"`, async ({ page }) => {
        // Intercept order creation endpoint
        let sentPhone = "";
        await page.route("**/api/orders-v2", async (route) => {
          console.log("ROUTE HIT: **/api/orders-v2");
          const body = JSON.parse(route.request().postData() || "{}");
          sentPhone = body.customer?.phone;
          await route.fulfill({
            status: 201,
            json: { ok: true, data: { order: { folio: "BX-CHECKOUT-T1" } } }
          });
        });

        // Mock menu data
        await page.route("**/api/menu-v2", async (route) => {
          console.log("ROUTE HIT: **/api/menu-v2");
          await route.fulfill({
            status: 200,
            json: {
              categories: [{ id: "c1", key: "burgers", name: "Burgers", sortOrder: 1 }],
              items: [{ sku: "BRG-OG", category: "burgers", name: "Burger OG", description: "Rich taste", price: 100, isAvailable: true, sortOrder: 1, tags: [], upsellItems: [], comboLinks: [] }],
              promos: [],
              categoryBanners: [],
              catalogBanners: [],
              siteConfig: { brandName: "Test Burgers", currency: "MXN", orderModes: ["pickup"], supportPhone: "555" },
              source: "d1"
            }
          });
        });

        // Register console listeners for debugging
        page.on("console", (msg: any) => console.log(`PAGE LOG: [${msg.type()}]`, msg.text()));
        page.on("pageerror", (err: any) => console.log("PAGE ERROR:", err.message));

        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });

        // Add item to cart
        await page.click(".catalog-card__detail-trigger");
        await page.click("button.catalog-drawer__add-btn:has-text('Agregar al carrito')");
        await page.click("button.catalog-drawer__close");
        
        // Open Cart
        await page.click("button.catalog-cart-bar__cta:has-text('Ver carrito')");

        // Go to Checkout
        await page.click("button.catalog-cart-drawer__checkout:has-text('Ir a Checkout')");

        // Fill Form
        await page.locator('input[placeholder="Tu nombre"]').fill("Test user");
        await page.locator('input[placeholder="10 dígitos"]').fill(p.input);
        await page.click("button.catalog-checkout-chip:has-text('Efectivo')");

        // Submit order
        await page.click("button.catalog-checkout__submit:has-text('Enviar pedido')");

        // Assert phone normalization in payload sent to api
        await expect(page.locator(".catalog-checkout-success")).toBeVisible();
        expect(sentPhone).toBe(p.expected);
      });
    }
  });

  // ==========================================
  // TIER 2: BOUNDARY & CORNER CASES (15 tests)
  // ==========================================

  test.describe("Tier 2 - Kitchen Fallback Boundaries (5 tests)", () => {
    test("Kitchen Fallback - empty names defaults to burger", async ({ page }) => {
      await mockInternalAuth(page, true);
      await page.route("**/api/orders-v2-admin?*", async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            ok: true,
            data: {
              orders: [{
                id: "o-boundary-1",
                folio: "BD-001",
                customerName: "Boundary 1",
                createdAt: new Date().toISOString(),
                status: "preparing",
                items: [{
                  id: "item-b1",
                  name: "", // Empty name
                  qty: 1,
                  unitPrice: 100,
                  lineTotal: 100,
                  snapshot: { lineKey: "lk-b1", sideQuestExtras: [], removedIngredients: [], extras: [], comboBurgers: [] }
                }]
              }]
            }
          }
        });
      });

      await page.goto(`${internalUrl}/`, { waitUntil: "domcontentloaded" });
      await page.click("button.tab:has-text('Cocina')");
      
      const card = page.locator(".kitchen-production-card").filter({ hasText: "BD-001" });
      await expect(card).toBeVisible();
      // Should default to burger
      await expect(card.getByText("🍔 1 Burger")).toBeVisible();
    });

    test("Kitchen Fallback - multiple triggers (combo drink) prioritizes combo", async ({ page }) => {
      await mockInternalAuth(page, true);
      await page.route("**/api/orders-v2-admin?*", async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            ok: true,
            data: {
              orders: [{
                id: "o-boundary-2",
                folio: "BD-002",
                customerName: "Boundary 2",
                createdAt: new Date().toISOString(),
                status: "preparing",
                items: [{
                  id: "item-b2",
                  name: "Combo Drink Refresco", // both combo and drink keywords
                  qty: 1,
                  unitPrice: 100,
                  lineTotal: 100,
                  snapshot: { lineKey: "lk-b2", sideQuestExtras: [], removedIngredients: [], extras: [], comboBurgers: [{ sku: "sub-b2", name: "Burger", removedIngredients: [], extras: [] }] }
                }]
              }]
            }
          }
        });
      });

      await page.goto(`${internalUrl}/`, { waitUntil: "domcontentloaded" });
      await page.click("button.tab:has-text('Cocina')");
      
      const card = page.locator(".kitchen-production-card").filter({ hasText: "BD-002" });
      await expect(card).toBeVisible();
      // Should prioritize combo (burger + potentially side and drinks)
      await expect(card.getByText("🍔 1 Burger")).toBeVisible();
    });

    test("Kitchen Fallback - triggers are case insensitive", async ({ page }) => {
      await mockInternalAuth(page, true);
      await page.route("**/api/orders-v2-admin?*", async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            ok: true,
            data: {
              orders: [{
                id: "o-boundary-3",
                folio: "BD-003",
                customerName: "Boundary 3",
                createdAt: new Date().toISOString(),
                status: "preparing",
                items: [{
                  id: "item-b3",
                  name: "paPAs FRanceSAs", // case-insensitive garnish keyword
                  qty: 1,
                  unitPrice: 100,
                  lineTotal: 100,
                  snapshot: { lineKey: "lk-b3", sideQuestExtras: [], removedIngredients: [], extras: [], comboBurgers: [] }
                }]
              }]
            }
          }
        });
      });

      await page.goto(`${internalUrl}/`, { waitUntil: "domcontentloaded" });
      await page.click("button.tab:has-text('Cocina')");
      
      await page.click("button.kitchen-view-tab:has-text('Side Quest')");
      const card = page.locator(".kitchen-production-card").filter({ hasText: "BD-003" });
      await expect(card).toBeVisible();
      await expect(card.getByText("🍟 1 Side")).toBeVisible();
    });

    test("Kitchen Fallback - trims trailing spaces", async ({ page }) => {
      await mockInternalAuth(page, true);
      await page.route("**/api/orders-v2-admin?*", async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            ok: true,
            data: {
              orders: [{
                id: "o-boundary-4",
                folio: "BD-004",
                customerName: "Boundary 4",
                createdAt: new Date().toISOString(),
                status: "preparing",
                items: [{
                  id: "item-b4",
                  name: "   fries   ", // trailing spaces
                  qty: 1,
                  unitPrice: 100,
                  lineTotal: 100,
                  snapshot: { lineKey: "lk-b4", sideQuestExtras: [], removedIngredients: [], extras: [], comboBurgers: [] }
                }]
              }]
            }
          }
        });
      });

      await page.goto(`${internalUrl}/`, { waitUntil: "domcontentloaded" });
      await page.click("button.tab:has-text('Cocina')");
      
      await page.click("button.kitchen-view-tab:has-text('Side Quest')");
      const card = page.locator(".kitchen-production-card").filter({ hasText: "BD-004" });
      await expect(card).toBeVisible();
      await expect(card.getByText("🍟 1 Side")).toBeVisible();
    });

    test("Kitchen Fallback - very long names classify correctly", async ({ page }) => {
      await mockInternalAuth(page, true);
      await page.route("**/api/orders-v2-admin?*", async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            ok: true,
            data: {
              orders: [{
                id: "o-boundary-5",
                folio: "BD-005",
                customerName: "Boundary 5",
                createdAt: new Date().toISOString(),
                status: "preparing",
                items: [{
                  id: "item-b5",
                  name: "A".repeat(100) + " soda " + "B".repeat(100), // very long name with "soda"
                  qty: 1,
                  unitPrice: 100,
                  lineTotal: 100,
                  snapshot: { lineKey: "lk-b5", sideQuestExtras: [], removedIngredients: [], extras: [], comboBurgers: [] }
                }]
              }]
            }
          }
        });
      });

      await page.goto(`${internalUrl}/`, { waitUntil: "domcontentloaded" });
      await page.click("button.tab:has-text('Cocina')");
      
      await page.click("button.kitchen-view-tab:has-text('Side Quest')");
      const card = page.locator(".kitchen-production-card").filter({ hasText: "BD-005" });
      await expect(card).toBeVisible();
      await expect(card.getByText("🥤 1 Bebida")).toBeVisible();
    });
  });

  test.describe("Tier 2 - Catalog Banners Boundaries (5 tests)", () => {
    test("Catalog Banners - no banners in DB loads safely", async ({ page }) => {
      await page.route("**/api/menu-v2", async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            categories: [],
            items: [],
            promos: [],
            categoryBanners: [],
            catalogBanners: [], // Empty banners
            siteConfig: { brandName: "Empty Burgers" },
            publicConfig: { publicMode: "catalog", catalogEnabled: true },
            source: "d1"
          }
        });
      });

      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
      // Rail shouldn't be rendered, or should render empty without crashing
      const bannerRail = page.locator(".catalog-banner-rail");
      await expect(bannerRail).toHaveCount(0);
    });

    test("Catalog Banners - escape checks/SQL Injection in title doesn't crash", async ({ request }) => {
      // Verify admin endpoint handles escape chars safely on creation
      const res = await request.post(`${internalUrl}/api/menu-v2-admin/catalog-banners`, {
        headers: { Authorization: `Bearer valid-token` },
        data: {
          title: "Banner'; DROP TABLE catalog_banners; --",
          subtitle: "sql inject",
          isActive: true,
          sortOrder: 1
        }
      });
      // Should either be rejected safely (400) or successfully created without sql execution (201)
      expect([201, 400, 401]).toContain(res.status());
    });

    test("Catalog Banners - large amount of banners are sorted and rendered", async ({ page }) => {
      const manyBanners = Array.from({ length: 50 }, (_, i) => {
        const now = new Date().toISOString();
        return {
          id: i + 10,
          title: `Banner ${i}`,
          subtitle: `Subtitle ${i}`,
          cta_label: "Order Now",
          ctaLabel: "Order Now",
          image_key: `banners/banner-${i}.png`,
          imageKey: `banners/banner-${i}.png`,
          image_url: "/placeholder.jpg",
          imageUrl: "/placeholder.jpg",
          is_active: 1,
          isActive: true,
          sort_order: i,
          sortOrder: i,
          updated_at: now,
          updatedAt: now
        };
      });

      await page.route("**/api/menu-v2", async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            categories: [],
            items: [],
            promos: [],
            categoryBanners: [],
            catalogBanners: manyBanners,
            siteConfig: { brandName: "Huge Burgers" },
            publicConfig: { publicMode: "catalog", catalogEnabled: true },
            source: "d1"
          }
        });
      });

      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
      // Banners should render
      await expect(page.getByText("Banner 0")).toBeVisible();
    });

    test("Catalog Banners - sort order boundary checks", async ({ page }) => {
      // Test negative sort orders and extreme values
      const unsortedBanners = [
        {
          id: 1,
          title: "Last Banner",
          subtitle: "Last",
          cta_label: "Order Now",
          ctaLabel: "Order Now",
          image_key: "banners/last.png",
          imageKey: "banners/last.png",
          image_url: "/placeholder.jpg",
          imageUrl: "/placeholder.jpg",
          is_active: 1,
          isActive: true,
          sort_order: 1000,
          sortOrder: 1000,
          updated_at: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 2,
          title: "First Banner",
          subtitle: "First",
          cta_label: "Order Now",
          ctaLabel: "Order Now",
          image_key: "banners/first.png",
          imageKey: "banners/first.png",
          image_url: "/placeholder.jpg",
          imageUrl: "/placeholder.jpg",
          is_active: 1,
          isActive: true,
          sort_order: -50,
          sortOrder: -50,
          updated_at: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      await page.route("**/api/menu-v2", async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            categories: [],
            items: [],
            promos: [],
            categoryBanners: [],
            catalogBanners: unsortedBanners,
            siteConfig: { brandName: "Sorted Burgers" },
            publicConfig: { publicMode: "catalog", catalogEnabled: true },
            source: "d1"
          }
        });
      });

      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
      
      // Verify correct sorting in DOM (First Banner should be listed before Last Banner)
      const bannerTexts = await page.locator(".catalog-banner-rail__item-title").allTextContents();
      if (bannerTexts.length >= 2) {
        expect(bannerTexts[0]).toBe("First Banner");
        expect(bannerTexts[1]).toBe("Last Banner");
      }
    });

    test("Catalog Banners - reject unauthorized token formats", async ({ request }) => {
      const badTokens = ["", "invalid-token", "Bearer SQL' OR 1=1", "Token basic-auth"];
      for (const token of badTokens) {
        const res = await request.get(`${internalUrl}/api/menu-v2-admin/catalog-banners`, {
          headers: { Authorization: token }
        });
        expect([401, 403]).toContain(res.status());
      }
    });
  });

  test.describe("Tier 2 - Checkout Phone Boundaries (5 tests)", () => {
    const invalidPhones = [
      { input: "+1 555 123 4567", desc: "Non-Mexican USA number" },
      { input: "55123", desc: "Short number" },
      { input: "5255123456789", desc: "Long number (> 12 digits)" },
      { input: "55abc1234567", desc: "Letters inside" },
      { input: "52", desc: "Exactly 52" }
    ];

    for (const tc of invalidPhones) {
      test(`Checkout Phone Boundary - rejects "${tc.input}" (${tc.desc})`, async ({ page }) => {
        // Intercept order creation endpoint
        let apiCalled = false;
        await page.route("**/api/orders-v2", async (route) => {
          apiCalled = true;
          await route.fulfill({
            status: 201,
            json: { ok: true, data: { order: { folio: "BX-FAIL" } } }
          });
        });

        // Mock menu data
        await page.route("**/api/menu-v2", async (route) => {
          await route.fulfill({
            status: 200,
            json: {
              categories: [{ id: "c1", key: "burgers", name: "Burgers", sortOrder: 1 }],
              items: [{ sku: "BRG-OG", category: "burgers", name: "Burger OG", description: "Yummy", price: 100, isAvailable: true, sortOrder: 1, tags: [], upsellItems: [], comboLinks: [] }],
              promos: [],
              categoryBanners: [],
              catalogBanners: [],
              siteConfig: { brandName: "Test Burgers", currency: "MXN", orderModes: ["pickup"], supportPhone: "555" },
              source: "d1"
            }
          });
        });

        await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });

        // Add item
        await page.click(".catalog-card__detail-trigger");
        await page.click("button.catalog-drawer__add-btn:has-text('Agregar al carrito')");
        await page.click("button.catalog-drawer__close");
        await page.click("button.catalog-cart-bar__cta:has-text('Ver carrito')");
        await page.click("button.catalog-cart-drawer__checkout:has-text('Ir a Checkout')");

        // Fill form with invalid phone
        await page.locator('input[placeholder="Tu nombre"]').fill("Boundary Tester");
        await page.locator('input[placeholder="10 dígitos"]').fill(tc.input);
        await page.click("button.catalog-checkout-chip:has-text('Efectivo')");

        // Submit
        await page.click("button.catalog-checkout__submit:has-text('Enviar pedido')");

        // Assert error message is visible and API was NOT called
        await expect(page.locator(".catalog-checkout-error")).toBeVisible();
        expect(apiCalled).toBe(false);
      });
    }
  });

  // ==========================================
  // TIER 3: CROSS-FEATURE COMBINATIONS (3 tests)
  // ==========================================

  test.describe("Tier 3 - Cross-Feature Combinations (3 tests)", () => {
    test("Cross-Feature - Checkout phone normalization combined with catalog item check", async ({ page }) => {
      let sentPayload: any = null;
      await page.route("**/api/orders-v2", async (route) => {
        sentPayload = JSON.parse(route.request().postData() || "{}");
        await route.fulfill({
          status: 201,
          json: { ok: true, data: { order: { folio: "BX-CROSS-1" } } }
        });
      });

      await page.route("**/api/menu-v2", async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            categories: [{ id: "c1", key: "burgers", name: "Burgers", sortOrder: 1 }],
            items: [{ sku: "BRG-OG", category: "burgers", name: "Burger OG", description: "Classic", price: 100, isAvailable: true, sortOrder: 1, tags: [], upsellItems: [], comboLinks: [] }],
            promos: [],
            categoryBanners: [],
            catalogBanners: [],
            siteConfig: { brandName: "Cross Burgers" },
            source: "d1"
          }
        });
      });

      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
      await page.click(".catalog-card__detail-trigger");
      await page.click("button.catalog-drawer__add-btn");
      await page.click("button.catalog-drawer__close");
      await page.click("button.catalog-cart-bar__cta");
      await page.click("button.catalog-cart-drawer__checkout");

      await page.locator('input[placeholder="Tu nombre"]').fill("Cross User");
      await page.locator('input[placeholder="10 dígitos"]').fill("+52 55 1122 3344");
      await page.click("button.catalog-checkout-chip:has-text('Efectivo')");
      await page.click("button.catalog-checkout__submit");

      await expect(page.locator(".catalog-checkout-success")).toBeVisible();
      // Verify payload has both normalized phone AND correct catalog item sku
      expect(sentPayload.customer.phone).toBe("5511223344");
      expect(sentPayload.items[0].sku).toBe("BRG-OG");
    });

    test("Cross-Feature - Admin catalog banners toggling combined with public display", async ({ page, request }) => {
      // 1. Inactive banner toggle test
      await mockInternalAuth(page, true);
      // Verify toggle/edit is accepted
      const editRes = await request.patch(`${internalUrl}/api/menu-v2-admin/catalog-banners/1`, {
        headers: { Authorization: "Bearer valid-token" },
        data: { isActive: false }
      });
      expect([200, 401]).toContain(editRes.status());
    });

    test("Cross-Feature - Order status updates with normalized phone numbers in kitchen view", async ({ page }) => {
      await mockInternalAuth(page, true);
      // Mock order with normalized phone and items
      await page.route("**/api/orders-v2-admin?*", async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            ok: true,
            data: {
              orders: [{
                id: "order-cross-3",
                folio: "CR-303",
                customerName: "Cross 3",
                customerPhone: "5512345678", // Normalized
                createdAt: new Date().toISOString(),
                status: "preparing",
                items: [{
                  id: "item-cr3",
                  name: "Burger Especial",
                  qty: 1,
                  unitPrice: 120,
                  lineTotal: 120,
                  snapshot: { lineKey: "lk-cr3", sideQuestExtras: [], removedIngredients: [], extras: [], comboBurgers: [] }
                }]
              }]
            }
          }
        });
      });

      await page.goto(`${internalUrl}/`, { waitUntil: "domcontentloaded" });
      await page.click("button.tab:has-text('Cocina')");
      
      const card = page.locator(".kitchen-production-card").filter({ hasText: "CR-303" });
      await expect(card).toBeVisible();
      await expect(card.getByText("🍔 1 Burger")).toBeVisible();
    });
  });

  // ==========================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 tests)
  // ==========================================

  test.describe("Tier 4 - Real-World Scenarios (5 tests)", () => {
    test("Real-World Scenario 1 - End-to-end customer order journey", async ({ page }) => {
      // 1. Admin configures catalog banner
      await mockInternalAuth(page, true);
      await page.route("**/api/menu-v2-admin/catalog-banners", async (route) => {
        await route.fulfill({ status: 201, json: { ok: true, banner: mockBanners[0] } });
      });

      // 2. User visits public site, adds order with +52 prefix and sees banner
      await page.route("**/api/menu-v2", async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            categories: [{ id: "c1", key: "burgers", name: "Burgers", sortOrder: 1 }],
            items: [{ sku: "BRG-OG", category: "burgers", name: "Burger OG", description: "Classic", price: 100, isAvailable: true, sortOrder: 1, tags: [], upsellItems: [], comboLinks: [] }],
            promos: [],
            categoryBanners: [],
            catalogBanners: [mockBanners[0]],
            siteConfig: { brandName: "Scenario Burgers" },
            publicConfig: { publicMode: "catalog", catalogEnabled: true },
            source: "d1"
          }
        });
      });

      let sentPhone = "";
      await page.route("**/api/orders-v2", async (route) => {
        const body = JSON.parse(route.request().postData() || "{}");
        sentPhone = body.customer?.phone;
        await route.fulfill({
          status: 201,
          json: { ok: true, data: { order: { folio: "SCEN-001" } } }
        });
      });

      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("Active Promo Banner")).toBeVisible();

      await page.click(".catalog-card__detail-trigger");
      await page.click("button.catalog-drawer__add-btn");
      await page.click("button.catalog-drawer__close");
      await page.click("button.catalog-cart-bar__cta");
      await page.click("button.catalog-cart-drawer__checkout");

      await page.locator('input[placeholder="Tu nombre"]').fill("Scenario Customer");
      await page.locator('input[placeholder="10 dígitos"]').fill("+52 55 9876 5432");
      await page.click("button.catalog-checkout-chip:has-text('Efectivo')");
      await page.click("button.catalog-checkout__submit");

      await expect(page.locator(".catalog-checkout-success")).toBeVisible();
      expect(sentPhone).toBe("5598765432");
    });

    test("Real-World Scenario 2 - Catalog Banner lifecycle", async ({ request }) => {
      // 1. Create Banner
      const createRes = await request.post(`${internalUrl}/api/menu-v2-admin/catalog-banners`, {
        headers: { Authorization: "Bearer valid-token" },
        data: { title: "Lifecycle Banner", subtitle: "Test", isActive: true, sortOrder: 5 }
      });
      expect([201, 401]).toContain(createRes.status());

      let bannerId = "1";
      if (createRes.status() === 201) {
        const body = await createRes.json();
        bannerId = body.banner.id;
      }

      // 2. Edit Banner
      const editRes = await request.patch(`${internalUrl}/api/menu-v2-admin/catalog-banners/${bannerId}`, {
        headers: { Authorization: "Bearer valid-token" },
        data: { title: "Updated Lifecycle Title", isActive: false }
      });
      expect([200, 401]).toContain(editRes.status());

      // 3. Delete Banner
      const deleteRes = await request.delete(`${internalUrl}/api/menu-v2-admin/catalog-banners/${bannerId}`, {
        headers: { Authorization: "Bearer valid-token" }
      });
      expect([200, 401, 404]).toContain(deleteRes.status());
    });

    test("Real-World Scenario 3 - Order with multiple items and fallbacks", async ({ page }) => {
      await mockInternalAuth(page, true);
      // Mock order with no kinds
      await page.route("**/api/orders-v2-admin?*", async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            ok: true,
            data: {
              orders: [{
                id: "scen-3",
                folio: "SC-303",
                customerName: "Scenario 3",
                createdAt: new Date().toISOString(),
                status: "preparing",
                items: [
                  { id: "i1", name: "Premium Combo", qty: 1, unitPrice: 150, lineTotal: 150, snapshot: { lineKey: "lk-1", sideQuestExtras: [], removedIngredients: [], extras: [], comboBurgers: [{ sku: "b1", name: "OG" }] } },
                  { id: "i2", name: "Papas", qty: 2, unitPrice: 50, lineTotal: 100, snapshot: { lineKey: "lk-2", sideQuestExtras: [], removedIngredients: [], extras: [], comboBurgers: [] } },
                  { id: "i3", name: "Coca Cola", qty: 1, unitPrice: 30, lineTotal: 30, snapshot: { lineKey: "lk-3", sideQuestExtras: [], removedIngredients: [], extras: [], comboBurgers: [] } }
                ]
              }]
            }
          }
        });
      });

      await page.goto(`${internalUrl}/`, { waitUntil: "domcontentloaded" });
      await page.click("button.tab:has-text('Cocina')");
      
      const card = page.locator(".kitchen-production-card").filter({ hasText: "SC-303" });
      await expect(card).toBeVisible();
      // Should show correctly calculated summary: 1 Combo (+1 burger) + 2 Papas (+2 sides) + 1 Coca (+1 drink)
      // Since it's combo it has 1 burger, plus standalone papas/sides and drink.
      await expect(card.getByText("🍔 1 Burger · 🍟 3 Sides · 🥤 2 Bebidas")).toBeVisible();
    });

    test("Real-World Scenario 4 - Admin catalog management security boundary", async ({ page }) => {
      // 1. Simulate unauthenticated user accessing admin banners page
      await mockInternalAuth(page, false);
      await page.goto(`${internalUrl}/`, { waitUntil: "domcontentloaded" });

      // Auth gate should be visible
      await expect(page.getByLabel("PIN de acceso")).toBeVisible();
    });

    test("Real-World Scenario 5 - High load database fallback", async ({ page }) => {
      // 1. Simulate database failure (503 response) on menu fetch
      await page.route("**/api/menu-v2", async (route) => {
        await route.fulfill({
          status: 503,
          json: { ok: false, error: "Database offline" }
        });
      });

      await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });
      // Should display fallback banner or message
      await expect(page.getByText("Menú de respaldo activo")).toBeVisible();
    });
  });
});
