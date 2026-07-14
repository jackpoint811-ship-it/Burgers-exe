import { expect, test } from "@playwright/test";

const publicUrl = process.env.PREVIEW_URL || "http://127.0.0.1:4173";

const mockMenuData = {
  categories: [
    { id: "c1", key: "burgers", name: "Burgers", sortOrder: 1 }
  ],
  items: [
    { sku: "BRG-OG", category: "burgers", name: "Burger OG", description: "Rich taste", price: 100, isAvailable: true, sortOrder: 1, tags: [], upsellItems: [], comboLinks: [] }
  ],
  promos: [],
  categoryBanners: [],
  catalogBanners: [],
  siteConfig: { brandName: "A11y Test Burgers", currency: "MXN", orderModes: ["pickup"], supportPhone: "555" },
  publicConfig: { publicMode: "catalog", catalogEnabled: true },
  source: "d1"
};

test.describe("Catalog Drawers Accessibility & Focus Trap", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the menu endpoint
    await page.route("**/api/menu-v2", async (route) => {
      await route.fulfill({
        status: 200,
        json: mockMenuData
      });
    });
  });

  test("Product Drawer - focus trap, Escape closing, and focus restoration", async ({ page }) => {
    await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });

    // Find the triggering button
    const triggerBtn = page.locator(".catalog-card__detail-trigger");
    await expect(triggerBtn).toBeVisible();

    // Focus the trigger button first to establish previous active element
    await triggerBtn.focus();
    await triggerBtn.click();

    // The drawer should open
    const drawer = page.locator(".catalog-drawer");
    await expect(drawer).toBeVisible();

    // The close button inside drawer should receive initial focus
    const closeBtn = page.locator("button.catalog-drawer__close");
    await expect(closeBtn).toBeFocused();

    // Let's test the focus trap by pressing Tab
    // There are 2 focusable elements: close button and add-to-cart button
    await page.keyboard.press("Tab");
    const addBtn = page.locator("button.catalog-drawer__add-btn");
    await expect(addBtn).toBeFocused();

    // Tab again should wrap focus back to the close button
    await page.keyboard.press("Tab");
    await expect(closeBtn).toBeFocused();

    // Shift+Tab should wrap back to add-to-cart button
    await page.keyboard.press("Shift+Tab");
    await expect(addBtn).toBeFocused();

    // Press Escape to close the drawer
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    // Focus must return to the trigger button
    await expect(triggerBtn).toBeFocused();
  });

  test("Cart Drawer & Checkout Drawer - focus trap, Escape, and focus restoration", async ({ page }) => {
    await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });

    // Open product drawer to add an item to the cart
    await page.click(".catalog-card__detail-trigger");
    await page.click("button.catalog-drawer__add-btn");
    await page.click("button.catalog-drawer__close");

    // Establish focus on Cart Bar trigger CTA
    const cartBarCta = page.locator("button.catalog-cart-bar__cta");
    await expect(cartBarCta).toBeVisible();
    await cartBarCta.focus();
    await cartBarCta.click();

    // Cart Drawer opens
    const cartDrawer = page.locator(".catalog-cart-drawer");
    await expect(cartDrawer).toBeVisible();

    // Initial focus on Cart Close button
    const cartCloseBtn = page.locator(".catalog-cart-drawer button.catalog-drawer__close");
    await expect(cartCloseBtn).toBeFocused();

    // Pressing Escape should close Cart Drawer and return focus to cartBarCta
    await page.keyboard.press("Escape");
    await expect(cartDrawer).toBeHidden();
    await expect(cartBarCta).toBeFocused();

    // Open Cart Drawer again to proceed to checkout
    await cartBarCta.click();
    await expect(cartDrawer).toBeVisible();

    const checkoutBtn = page.locator("button.catalog-cart-drawer__checkout");
    await expect(checkoutBtn).toBeVisible();
    await checkoutBtn.focus();
    await checkoutBtn.click();

    // Checkout Drawer opens (and Cart Drawer exits)
    const checkoutDrawer = page.locator(".catalog-checkout-drawer");
    await expect(checkoutDrawer).toBeVisible();

    // Initial focus on Checkout Close button
    const checkoutCloseBtn = page.locator(".catalog-checkout-drawer button.catalog-drawer__close");
    await expect(checkoutCloseBtn).toBeFocused();

    // Let's verify focus trap inside Checkout Drawer:
    // Tab through fields to ensure focus stays inside
    const nameInput = page.locator('input[placeholder="Tu nombre"]');
    await expect(nameInput).toBeVisible();

    // Shift+Tab from close button should wrap focus to the submit button
    await page.keyboard.press("Shift+Tab");
    const submitBtn = page.locator(".catalog-checkout-drawer button.catalog-checkout__submit");
    await expect(submitBtn).toBeFocused();

    // Pressing Escape should close Checkout Drawer
    await page.keyboard.press("Escape");
    await expect(checkoutDrawer).toBeHidden();
  });

  test("Reduced motion - respects prefers-reduced-motion and opens instantly", async ({ page }) => {
    // Emulate reduced motion
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });

    const triggerBtn = page.locator(".catalog-card__detail-trigger");
    await triggerBtn.click();

    const drawer = page.locator(".catalog-drawer");
    await expect(drawer).toBeVisible();

    // Ensure it works and the close button is immediately focusable/clickable
    const closeBtn = page.locator("button.catalog-drawer__close");
    await expect(closeBtn).toBeFocused();
    await closeBtn.click();
    await expect(drawer).toBeHidden();
  });

  test("Checkout Drawer - inline validation, aria properties, first invalid focus, success focus redirection", async ({ page }) => {
    let createOrderPayload: any = null;
    await page.route("**/api/orders-v2", async (route) => {
      createOrderPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        json: {
          ok: true,
          data: {
            order: {
              id: "test-order-id-a11y",
              folio: "QA-FOLIO-123",
              status: "preparing",
              createdAt: new Date().toISOString(),
              subtotal: 100,
              total: 100,
              currency: "MXN",
              idempotencyKey: "test-key"
            }
          }
        }
      });
    });

    await page.goto(`${publicUrl}/`, { waitUntil: "domcontentloaded" });

    // Add item to cart
    await page.click(".catalog-card__detail-trigger");
    await page.click("button.catalog-drawer__add-btn");
    await page.click("button.catalog-drawer__close");

    // Open Cart Drawer
    await page.click("button.catalog-cart-bar__cta");

    // Click checkout button to open Checkout Drawer
    await page.click("button.catalog-cart-drawer__checkout");

    const checkoutDrawer = page.locator(".catalog-checkout-drawer");
    await expect(checkoutDrawer).toBeVisible();

    const nameInput = page.locator("#checkout-name");
    const phoneInput = page.locator("#checkout-phone");
    const submitBtn = page.locator("button.catalog-checkout__submit[type='submit']");

    // 1. Attempt submit with empty fields. Should trigger validation errors.
    await submitBtn.click();

    // Verify name has error
    const nameError = page.locator("#name-error");
    await expect(nameError).toBeVisible();
    await expect(nameError).toContainText("Por favor, ingresa tu nombre.");
    await expect(nameInput).toHaveAttribute("aria-invalid", "true");
    await expect(nameInput).toHaveAttribute("aria-describedby", "name-error");

    // Verify first invalid input is focused (name)
    await expect(nameInput).toBeFocused();

    // 2. Fill name but leave phone empty. Submit again.
    await nameInput.fill("John Doe");
    await submitBtn.click();

    // Name error should be gone, phone error should be visible
    await expect(nameError).toBeHidden();
    const phoneError = page.locator("#phone-error");
    await expect(phoneError).toBeVisible();
    await expect(phoneError).toContainText("Por favor, ingresa tu teléfono.");
    await expect(phoneInput).toHaveAttribute("aria-invalid", "true");
    await expect(phoneInput).toHaveAttribute("aria-describedby", "phone-error");
    await expect(phoneInput).toBeFocused();

    // 3. Fill invalid phone (e.g. 5 digits). Submit again.
    await phoneInput.fill("12345");
    await submitBtn.click();
    await expect(phoneError).toContainText("El teléfono debe tener exactamente 10 dígitos.");
    await expect(phoneInput).toBeFocused();

    // 4. Fill valid phone, but leave deliveryDate and location empty.
    await phoneInput.fill("55 1234 5678");

    // Wait, by default, deliveryDate is initialized to 'Hoy' (same day ordering is open/closed).
    // Let's verify delivery date and location errors.
    // If we click submit, location error should trigger because location is not selected yet.
    await submitBtn.click();
    const locationError = page.locator("#location-error");
    await expect(locationError).toBeVisible();
    await expect(locationError).toContainText("Por favor, elige tu ubicación de entrega.");
    
    // The first location chip button should receive focus
    const firstLocationChip = page.locator("#location-label + .catalog-checkout-chips button").first();
    await expect(firstLocationChip).toBeFocused();

    // Select location
    await firstLocationChip.click();
    await expect(locationError).toBeHidden();

    // Now submit successfully
    await submitBtn.click();

    // success screen should render
    const successScreen = page.locator(".catalog-checkout-success");
    await expect(successScreen).toBeVisible();

    // keyboard focus should shift to success heading to prevent focus loss
    const successHeading = page.locator("h2.catalog-cart-drawer__title");
    await expect(successHeading).toBeFocused();
    await expect(successHeading).toContainText("Pedido recibido");
  });
});
