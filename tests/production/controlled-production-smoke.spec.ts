import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const publicProductionUrl = "https://burgers-exe.pages.dev";
const internalProductionUrl = "https://chekeo2-0.pages.dev";
const evidenceDir = "docs/operations/production-launch-2026-07-06";

const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

type ResponseIssue = {
  status: number;
  url: string;
};

const writeEvidenceJson = (fileName: string, data: unknown) => {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(`${evidenceDir}/${fileName}`, `${JSON.stringify(data, null, 2)}\n`);
};

const installReadOnlyGuard = async (page: Page) => {
  const blockedWrites: string[] = [];

  await page.route("**/*", async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      blockedWrites.push(`${method} ${request.url()}`);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  return blockedWrites;
};

const collectPageIssues = (page: Page) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const responseIssues: ResponseIssue[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400) responseIssues.push({ status, url: response.url() });
  });

  return { pageErrors, consoleErrors, responseIssues };
};

const expectRenderedBody = async (page: Page) => {
  await expect(page.locator("body")).toBeVisible();
  const rendered = await page.evaluate(() => {
    const text = document.body.innerText.trim();
    const elementCount = document.body.querySelectorAll("*").length;
    const rect = document.body.getBoundingClientRect();
    return {
      textLength: text.length,
      elementCount,
      width: rect.width,
      height: rect.height,
    };
  });

  expect(rendered.textLength).toBeGreaterThan(0);
  expect(rendered.elementCount).toBeGreaterThan(0);
  expect(rendered.width).toBeGreaterThan(0);
  expect(rendered.height).toBeGreaterThan(0);
};

test.describe("Controlled production launch read-only smoke", () => {
  test("public production loads menu from D1 and captures evidence", async ({ page, request }) => {
    const blockedWrites = await installReadOnlyGuard(page);
    const pageIssues = collectPageIssues(page);

    const menuResponse = await request.get(`${publicProductionUrl}/api/menu-v2`);
    expect(menuResponse.status()).toBe(200);
    const menu = await menuResponse.json() as {
      source?: string;
      items?: unknown[];
      categories?: unknown[];
    };
    expect(menu.source).toBe("d1");
    expect(menu.items?.length ?? 0).toBeGreaterThan(0);
    expect(menu.categories?.length ?? 0).toBeGreaterThan(0);

    await page.setViewportSize(viewports.desktop);
    await page.goto(publicProductionUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await expectRenderedBody(page);
    await expect(page.getByText(/Pedir ahora|Burgers|OG/i).first()).toBeVisible();
    await page.screenshot({
      path: `${evidenceDir}/public-production-desktop-1440.png`,
      fullPage: true,
    });

    await page.setViewportSize(viewports.mobile);
    await page.goto(publicProductionUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await expectRenderedBody(page);
    await expect(page.getByText(/Pedir ahora|Burgers|OG/i).first()).toBeVisible();
    await page.screenshot({
      path: `${evidenceDir}/public-production-mobile-390.png`,
      fullPage: true,
    });

    const nonAssetFailures = pageIssues.responseIssues.filter(
      (issue) => !issue.url.includes("/api/assets-v2/"),
    );
    writeEvidenceJson("public-production-result.json", {
      target: publicProductionUrl,
      menu: {
        status: menuResponse.status(),
        source: menu.source,
        items: menu.items?.length ?? 0,
        categories: menu.categories?.length ?? 0,
      },
      blockedWrites,
      pageErrors: pageIssues.pageErrors,
      consoleErrors: pageIssues.consoleErrors,
      responseIssues: pageIssues.responseIssues,
      nonAssetFailures,
      screenshots: [
        `${evidenceDir}/public-production-desktop-1440.png`,
        `${evidenceDir}/public-production-mobile-390.png`,
      ],
    });

    expect(blockedWrites).toEqual([]);
    expect(pageIssues.pageErrors).toEqual([]);
    expect(nonAssetFailures).toEqual([]);
  });

  test("internal production shows access screen and auth status is unauthenticated", async ({ page, request }) => {
    const blockedWrites = await installReadOnlyGuard(page);
    const pageIssues = collectPageIssues(page);

    const authResponse = await request.get(`${internalProductionUrl}/api/internal-v2-auth/status`);
    expect(authResponse.status()).toBe(200);
    const authStatus = await authResponse.json() as {
      ok?: boolean;
      data?: { authenticated?: boolean };
    };
    expect(authStatus.ok).toBe(true);
    expect(authStatus.data?.authenticated).toBe(false);

    await page.setViewportSize(viewports.desktop);
    await page.goto(internalProductionUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await expectRenderedBody(page);
    await expect(page.locator('input[type="password"], input[name*="pin" i]').first()).toBeVisible();
    await page.screenshot({
      path: `${evidenceDir}/internal-production-desktop-1440.png`,
      fullPage: true,
    });

    await page.setViewportSize(viewports.mobile);
    await page.goto(internalProductionUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await expectRenderedBody(page);
    await expect(page.locator('input[type="password"], input[name*="pin" i]').first()).toBeVisible();
    await page.screenshot({
      path: `${evidenceDir}/internal-production-mobile-390.png`,
      fullPage: true,
    });

    writeEvidenceJson("internal-production-result.json", {
      target: internalProductionUrl,
      authStatus: {
        status: authResponse.status(),
        ok: authStatus.ok,
        authenticated: authStatus.data?.authenticated,
      },
      blockedWrites,
      pageErrors: pageIssues.pageErrors,
      consoleErrors: pageIssues.consoleErrors,
      responseIssues: pageIssues.responseIssues,
      screenshots: [
        `${evidenceDir}/internal-production-desktop-1440.png`,
        `${evidenceDir}/internal-production-mobile-390.png`,
      ],
    });

    expect(blockedWrites).toEqual([]);
    expect(pageIssues.pageErrors).toEqual([]);
    expect(pageIssues.responseIssues).toEqual([]);
  });
});
