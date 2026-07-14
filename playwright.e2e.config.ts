import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results/e2e-catalog-kitchen",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npx wrangler pages dev dist/public-order-v2 --port 4173 --compatibility-date=2026-05-03 --d1 BOG_MENU_DB",
      url: "http://127.0.0.1:4173/",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npx wrangler pages dev dist/internal-chekeo-v2 --port 4174 --compatibility-date=2026-05-03 --d1 BOG_MENU_DB",
      url: "http://127.0.0.1:4174/",
      reuseExistingServer: true,
      timeout: 120_000,
    }
  ],
});
