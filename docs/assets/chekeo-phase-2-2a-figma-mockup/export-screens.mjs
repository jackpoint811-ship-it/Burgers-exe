import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const directory = path.dirname(fileURLToPath(import.meta.url));
const htmlUrl = pathToFileURL(path.join(directory, "index.html")).href;

const mobileScreens = [
  "login",
  "operacion",
  "pedidos",
  "detalle",
  "cocina",
  "resumen",
  "pagos",
  "pago-detalle",
  "corte",
  "admin",
  "catalogo",
  "sorteos",
];

const shots = [
  ...mobileScreens.map((screen) => ({ variant: "A", screen, width: 390, height: 844 })),
  ...mobileScreens.map((screen) => ({ variant: "B", screen, width: 390, height: 844 })),
  { variant: "A", screen: "operacion", width: 320, height: 844 },
  { variant: "A", screen: "pedidos", width: 320, height: 844 },
  { variant: "A", screen: "cocina", width: 320, height: 844 },
  { variant: "A", screen: "desktop", width: 1360, height: 920, desktop: true },
  { variant: "B", screen: "desktop", width: 1360, height: 920, desktop: true },
];

const browser = await chromium.launch();
const results = [];

for (const shot of shots) {
  const out = `mockup-${shot.variant.toLowerCase()}-${shot.screen}-${shot.desktop ? "desktop" : shot.width}.png`;
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 1,
  });

  const url = new URL(htmlUrl);
  url.searchParams.set("variant", shot.variant);
  url.searchParams.set("screen", shot.screen);
  url.searchParams.set("vw", String(shot.desktop ? 390 : shot.width));
  url.searchParams.set("capture", "1");

  await page.goto(url.href);
  await page.waitForLoadState("networkidle");
  await page.locator(shot.desktop ? ".desktop-shell" : ".phone-shell").screenshot({
    path: path.join(directory, out),
  });
  await page.close();

  results.push({
    file: out,
    variant: shot.variant,
    screen: shot.screen,
    width: shot.width,
    height: shot.height,
    type: shot.desktop ? "desktop" : "mobile",
  });
}

await browser.close();

await fs.writeFile(
  path.join(directory, "export-manifest.json"),
  JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      source: "index.html",
      figmaFile: "https://www.figma.com/design/NWwIZgKQbNflMs4XrqSrN1",
      note: "Fallback exports generated because Figma MCP writes were blocked by Starter plan tool call limit.",
      files: results,
    },
    null,
    2,
  ),
);

console.log(`Exported ${results.length} PNG files to ${directory}`);
