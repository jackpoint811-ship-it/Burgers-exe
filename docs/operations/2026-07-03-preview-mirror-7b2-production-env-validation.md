# Preview Mirror Record: Fase 7B.2 Production Environment Validation

## 1. Resumen

Validacion final de Fase 7B.2 para confirmar que los proyectos preview funcionan cuando se despliegan sin `--branch` y se consumen desde las URLs base del Production environment interno de esos proyectos preview.

La autorizacion vigente fue solo para recursos preview:

- Pages public preview: `burgers-exe-public-v2-preview`
- Pages internal preview: `burgers-exe-internal-v2-preview`
- D1 preview: `burgers-exe-menu-v2-preview`
- R2 preview: `burgers-exe-assets-v2-preview`

Produccion real quedo fuera de alcance y no se toco.

## 2. Contexto confirmado

- PR #344 ya estaba mergeado en `main`.
- Dashboard fue confirmado manualmente por el usuario en `Choose Environment: Production` de los proyectos preview.
- Public preview project tenia `BOG_MENU_DB` hacia `burgers-exe-menu-v2-preview`, `BOG_MENU_ASSETS` hacia `burgers-exe-assets-v2-preview` y write flags preview en `true`.
- Internal preview project tenia `BOG_MENU_DB` hacia `burgers-exe-menu-v2-preview`, `BOG_MENU_ASSETS` hacia `burgers-exe-assets-v2-preview` y `BOG_INTERNAL_PIN` como secret encrypted.

## 3. Hipotesis validada

El bloqueo anterior se debio probablemente a que los deploys con `--branch preview-mirror-7b2` usaron branch/preview environment sin bindings/secrets efectivos.

En este reintento se desplego sin `--branch` para validar las URLs base:

- `https://burgers-exe-public-v2-preview.pages.dev`
- `https://burgers-exe-internal-v2-preview.pages.dev`

Resultado: las URLs base usaron bindings/secrets efectivos.

## 4. Checks locales

- `npm run typecheck`: OK.
- `npm run build:public`: OK.
- `npm run build:internal`: OK con warning no fatal de chunk grande de Vite.
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\codex\verify-preview-readiness.ps1`: OK.

## 5. D1 preview read-only

Solo se ejecutaron consultas read-only contra `burgers-exe-menu-v2-preview`.

- `fixture_orders`: `30`
- `fixture_items`: `6`
- `changed_db`: `false`

No se ejecutaron seeds, migrations ni writes D1.

## 6. Deploys preview sin branch

Public preview:

```powershell
npx wrangler pages deploy dist/public-order-v2 --project-name burgers-exe-public-v2-preview
```

- Deployment URL: `https://df22dc75.burgers-exe-public-v2-preview.pages.dev`
- Deployment alias URL: `https://docs-phase-7b2-preview-produ.burgers-exe-public-v2-preview.pages.dev`
- QA URL base: `https://burgers-exe-public-v2-preview.pages.dev`

Internal preview:

```powershell
npx wrangler pages deploy dist/internal-chekeo-v2 --project-name burgers-exe-internal-v2-preview
```

- Deployment URL: `https://3a62d79d.burgers-exe-internal-v2-preview.pages.dev`
- Deployment alias URL: `https://docs-phase-7b2-preview-produ.burgers-exe-internal-v2-preview.pages.dev`
- QA URL base: `https://burgers-exe-internal-v2-preview.pages.dev`

Wrangler mostro warning no fatal: ignoro `wrangler.toml` local porque no contiene `pages_build_output_dir`.

## 7. QA HTTP preview

Public preview:

- Page: `200`.
- `/api/menu-v2`: `200`, `source=d1`, `items=15`, `categories=4`.

Internal preview:

- Page: `200`.
- `/api/internal-v2-auth/status`: `200`, `{"ok":true,"data":{"authenticated":false}}`.

El status interno `authenticated=false` es aceptable como smoke sin PIN porque confirma que la Function existe y `BOG_INTERNAL_PIN` ya no falta. No se imprimio ni uso ningun PIN.

## 8. Seguridad

No se tocaron:

- produccion real,
- `burgers-exe`,
- `chekeo2-0`,
- `burgers-exe-menu-live`,
- `burgers-exe-menu-assets`,
- secrets,
- bindings,
- Pages settings,
- R2,
- runtime V2,
- legacy,
- migrations.

## 9. Estado final

- Fase 7B.2 queda validada en las URLs base de los proyectos preview.
- Public preview usa D1 preview efectivamente.
- Internal preview tiene auth Function configurada y no falla por secret missing.
- Siguiente fase sugerida: Fase 8.
