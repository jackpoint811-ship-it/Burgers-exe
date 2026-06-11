import { defineConfig } from '@playwright/test';

const defaultPreviewUrl = 'http://127.0.0.1:4173/';
const previewUrl = process.env.PREVIEW_URL || defaultPreviewUrl;

export default defineConfig({
  testDir: './tests/visual',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/visual', open: 'never' }]
  ],
  outputDir: 'test-results/visual',
  use: {
    baseURL: previewUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  ...(process.env.PREVIEW_URL
    ? {}
    : {
        webServer: {
          command: 'npm run preview:public -- --host 127.0.0.1 --port 4173 --strictPort',
          url: defaultPreviewUrl,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000
        }
      })
});
