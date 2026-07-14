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
});
