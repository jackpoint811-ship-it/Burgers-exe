# Visual QA preflight

This tooling prepares reproducible public UI visual checks for the next professional UI pass. It does not change app UI, UX copy, APIs, schema, D1, R2, Cloudflare settings, or `BOG_ACTIVE_ENV`.

## Install dependencies

```powershell
npm ci
```

On Windows, if `npm ci` fails with an `EPERM` error, close any running `node`, `vite`, `esbuild`, or preview server processes that may be locking `node_modules`, then run `npm ci` again.

## Build public

```powershell
npm run build:public
```

The public scripts use `cross-env` so `APP_TARGET=public` works on Windows and Linux.

## Install Playwright Chromium

```powershell
npx playwright install chromium
```

## Run visual QA

```powershell
npm run qa:visual
```

By default, the visual QA command starts the public Vite preview at:

```text
http://127.0.0.1:4173/
```

To run against an existing preview URL, set `PREVIEW_URL`.

PowerShell:

```powershell
$env:PREVIEW_URL = 'http://127.0.0.1:4173/'
npm run qa:visual
```

Bash:

```bash
PREVIEW_URL='http://127.0.0.1:4173/' npm run qa:visual
```

## Covered viewports

The preflight captures screenshots for these widths:

- 320
- 375
- 390
- 430
- 768
- 1024
- 1440

Screenshots and reports are local QA artifacts and are ignored by git under `test-results/` and `playwright-report/`.
