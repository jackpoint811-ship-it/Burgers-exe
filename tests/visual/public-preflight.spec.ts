import { expect, test } from '@playwright/test';

const previewUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4173/';

const viewports = [
  { name: 'mobile-320', width: 320, height: 740 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1024', width: 1024, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 }
] as const;

test.describe('public visual preflight', () => {
  for (const viewport of viewports) {
    test(`captures ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(previewUrl, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(250);

      const hasRenderedContent = await page.evaluate(() => {
        return document.body.innerText.trim().length > 0 || document.body.querySelectorAll('*').length > 0;
      });

      expect(hasRenderedContent).toBe(true);

      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach(`public-${viewport.width}px`, {
        body: screenshot,
        contentType: 'image/png'
      });
    });
  }

  test('shows manual ticket adjustments in the public lookup', async ({ page }) => {
    await page.route('**/api/raffles-v2/lookup**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          ok: true,
          data: {
            found: true,
            campaign: {
              id: 'raffle-june-2026',
              title: 'Rifa Burger Lovers',
              ticketPerBurger: 1,
              ticketPerReferral: 2
            },
            participant: {
              participantKey: 'pk-luna-4821',
              customerName: 'Luna Smash',
              customerPhoneMasked: '****4821',
              burgerTickets: 6,
              referralTickets: 2,
              manualExtraTickets: 4,
              totalTickets: 12,
              lastOrderFolio: 'BX-4821',
              lastOrderAt: '2026-06-17T18:15:00.000Z'
            },
            referralCode: null
          }
        }
      });
    });

    await page.goto(new URL('/tickets', previewUrl).toString(), { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Teléfono').fill('5551234567');
    await page.getByRole('button', { name: 'Consultar tickets' }).click();

    await expect(page.getByRole('heading', { name: 'Tus oportunidades' })).toBeVisible();
    await expect(page.getByText('Tickets extra manuales', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Total tickets')).toContainText('12');
  });
});
