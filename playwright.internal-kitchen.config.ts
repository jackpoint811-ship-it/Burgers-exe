import { defineConfig } from "@playwright/test";

const defaultPreviewUrl = "http://127.0.0.1:4174/";
const previewUrl = process.env.INTERNAL_PREVIEW_URL || defaultPreviewUrl;

export default defineConfig({
  testDir: "./tests/internal-chekeo",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results/internal-chekeo",
  use: {
    baseURL: previewUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  ...(process.env.INTERNAL_PREVIEW_URL
    ? {}
    : {
        webServer: {
          command:
            "npm run preview:internal -- --host 127.0.0.1 --port 4174 --strictPort",
          url: defaultPreviewUrl,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
