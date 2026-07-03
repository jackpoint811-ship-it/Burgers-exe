# Preview Mirror Record: Fase 7B.2 Retry

## 1. Resumen

Reintento de Fase 7B.2 autorizado solo para recursos preview:

- Pages public preview: `burgers-exe-public-v2-preview`
- Pages internal preview: `burgers-exe-internal-v2-preview`
- D1 preview: `burgers-exe-menu-v2-preview`
- R2 preview: `burgers-exe-assets-v2-preview`

Produccion quedo fuera de alcance y no se toco.

## 2. Estado previo

- PR #343 ya estaba mergeado en `main`.
- El bloqueo anterior de Wrangler fue resuelto manualmente por el usuario.
- Consultas read-only a `burgers-exe-menu-v2-preview` respondieron correctamente antes de ejecutar mutaciones preview.
- Checks locales antes de remoto: `npm run typecheck`, `npm run build:public`, `npm run build:internal` y validacion local del seed pasaron.

## 3. D1 preview

Se ejecuto el seed preview/test-only:

```powershell
npx wrangler d1 execute burgers-exe-menu-v2-preview --remote --file=./migrations/0008_preview_realistic_orders_seed.sql
```

Primer intento: fallo porque D1 remoto rechazo transacciones explicitas en el archivo SQL. Wrangler reporto que la base quedo en su estado original.

Correccion aplicada al seed: se removieron solo `BEGIN TRANSACTION;` y `COMMIT;`. El seed conserva timestamps relativos, datos ficticios, folios `PVW-*`, `source` `public-v2-preview`, marcador `[FIXTURE:PREVIEW_REALISTIC_ORDERS]` y no incluye `DELETE`.

Segundo intento: OK.

Verificacion posterior:

- `fixture_orders`: `3`
- `fixture_items`: `6`
- `fixture_events`: `3`
- folios: `PVW-1001`, `PVW-1002`, `PVW-1003`
- fecha derivada de ejecucion: `2026-07-03`
- `changed_db`: `true` solo en el seed exitoso

## 4. Pages preview

Se desplegaron builds preview a proyectos preview, sin tocar produccion.

Primer despliegue con rama `main`:

- Public: `https://main.burgers-exe-public-v2-preview.pages.dev`
- Internal: `https://main.burgers-exe-internal-v2-preview.pages.dev`

Segundo despliegue con rama `preview-mirror-7b2` para forzar ambiente Preview:

- Public: `https://preview-mirror-7b2.burgers-exe-public-v2-preview.pages.dev`
- Internal: `https://preview-mirror-7b2.burgers-exe-internal-v2-preview.pages.dev`

Wrangler mostro warning no fatal: ignoro `wrangler.toml` local porque no contiene `pages_build_output_dir`.

## 5. QA preview

QA HTTP read-only sobre aliases preview:

- Public page: `200`
- Public `/api/menu-v2`: `200`, pero `source=fallback`
- Internal page: `200`
- Internal `/api/internal-v2-auth/status`: `503`

Se verifico que el esquema D1 preview contiene las columnas esperadas de `menu_items`, `menu_categories`, `promo_cards`, `menu_category_banners` y `site_config`. El `503` interno coincide con `BOG_INTERNAL_PIN` no disponible para la Function, y el fallback publico apunta a que `BOG_MENU_DB` no esta llegando efectivamente al runtime Pages desplegado.

## 6. Decision de seguridad

Se detuvo la fase sin modificar:

- bindings,
- secrets,
- R2,
- produccion,
- runtime V2,
- legacy.

No se ejecuto Playwright porque la QA HTTP ya mostro que las Functions preview no estaban usando bindings/secrets efectivos.

## 7. Estado final

- D1 preview: seed preview/test-only aplicado correctamente.
- Pages preview public/internal: desplegados correctamente.
- Runtime preview: bloqueado por bindings/secrets no efectivos en Pages Functions.
- Produccion: no tocada.

## 8. Siguiente accion requerida

Verificar en Cloudflare Pages que los deployments de ambiente Preview para `burgers-exe-public-v2-preview` y `burgers-exe-internal-v2-preview` reciben efectivamente:

- `BOG_MENU_DB` -> `burgers-exe-menu-v2-preview`
- `BOG_MENU_ASSETS` -> `burgers-exe-assets-v2-preview`
- `BOG_INTERNAL_PIN` en internal preview

No reintentar QA funcional ni Playwright hasta que `/api/menu-v2` responda `source=d1` y `/api/internal-v2-auth/status` deje de responder `503`.
