> Estado: vivo
> Uso: mapa oficial Fase 4 de superficie activa antes de mover legacy

# Fase 4 - Mapa de superficie activa V2

## Alcance

Esta fase separa documentalmente lo activo de lo legacy. No autoriza mover carpetas, borrar archivos, cambiar imports, tocar runtime, cambiar Cloudflare, ejecutar migrations, ejecutar seeds ni hacer deploy.

## Confirmacion de base

- Base: `main` sincronizado despues del merge de PR #337.
- Fase 3 en `main`: `docs/codex-memory/13-cloudflare-environments-audit.md` existe y documenta ambientes Cloudflare preview/prod/local.
- Graphify code graph: OK, `1565` nodos, `2855` edges, `96` comunidades.
- Nota Graphify: los scripts PowerShell de `tools/codex/*.ps1` no tienen AST por falta de `tree-sitter-powershell`; no bloquea porque se validan por ejecucion directa.
- No se ejecuto semantic analysis con Gemini.

## Apps oficiales

| Area | Ruta | Estado | Evidencia | Regla |
| --- | --- | --- | --- | --- |
| Public V2 | `apps/public-order-v2` | activo-v2 | `vite.config.ts` usa esta app cuando `APP_TARGET` no es `internal`; `README.md` la lista como app publica oficial; consume `/api/menu-v2`, `/api/orders-v2`, `/api/assets-v2`, `/api/raffles-v2/*` | no mover, no renombrar, no mezclar con legacy |
| Internal Chekeo V2 | `apps/internal-chekeo-v2` | activo-v2 | `vite.config.ts` usa esta app con `APP_TARGET=internal`; `README.md` la lista como app interna oficial; consume auth/admin V2 bajo `/api/internal-v2-auth/*`, `/api/orders-v2-admin*`, `/api/menu-v2-admin*`, `/api/ingredients-v2-admin*`, `/api/kitchen-v2-admin/*`, `/api/raffles-v2-admin*` | no mover, no renombrar, no mezclar con legacy |

## Runtime compartido activo

| Ruta | Usado por | Estado | Evidencia | Riesgo si se mueve |
| --- | --- | --- | --- | --- |
| `functions/api` | Public V2, Internal Chekeo V2, Cloudflare Pages Functions | activo-v2 | apps V2 hacen fetch a `/api/*`; endpoints usan `BOG_MENU_DB`, `BOG_MENU_ASSETS`, `BOG_INTERNAL_PIN` | critico: rompe backend V2 y Pages runtime |
| `packages/config` | apps V2 y Functions | activo-v2 | imports `@config/index` en apps; imports relativos en `functions/api/*`; aliases en `vite.config.ts` y `tsconfig.json` | critico: rompe contratos, payloads, tipos, fallback y runtime env |
| `packages/ui` | apps V2 | activo-v2 | imports `@ui/index` en ambas apps; aliases en `vite.config.ts` y `tsconfig.json` | alto: rompe UI compartida |
| `vite.config.ts` | builds public/internal | activo-v2 | selecciona `apps/internal-chekeo-v2` con `APP_TARGET=internal`; aliases `@ui` y `@config` | critico: rompe builds |
| `package.json` | scripts de desarrollo, build, checks y DB | activo/riesgo mixto | contiene scripts V2 activos y scripts legacy/riesgo `public-order:*` | alto: no modificar scripts sin fase autorizada |
| `migrations/` | D1 V2 schema/seed/reparaciones | activo/riesgo | contiene `0001` a `0013`; docs Fase 2/3 las mantienen activas | alto: mover o ejecutar mal puede romper D1 o mezclar prod/preview |
| `tests/internal-chekeo` | QA Internal/Cocina | activo con riesgo | specs actuales de cocina; una spec referencia seed faltante `0008_preview_realistic_orders_seed.sql` | medio: no mover hasta resolver estrategia Fase 7 |
| `tests/visual` | QA visual public | activo tooling | `public-preflight.spec.ts` para preflight visual | bajo/medio: mover rompe QA manual/visual |
| `tools/codex` | validacion local de agentes | activo tooling | `verify-local-tooling.ps1`, `verify-skills.ps1`, `prepare-skills-sync.ps1` | medio: mover rompe workflow de agentes |

Nota: `packages/domain` y `packages/cloudflare` son objetivo futuro de arquitectura, pero no existen como paquetes reales actuales. No deben tratarse como superficie activa hasta una fase que los cree.

## Endpoints activos

| Familia | Rutas principales | Archivos | Consumidor |
| --- | --- | --- | --- |
| Menu V2 | `/api/menu-v2` | `functions/api/menu-v2.ts` | Public V2, CatalogAdminPanel |
| Orders V2 | `/api/orders-v2` | `functions/api/orders-v2.ts` | Public V2 |
| Assets V2 | `/api/assets-v2/[[key]]` | `functions/api/assets-v2/[[key]].ts` | Public V2, Chekeo catalogo/sorteos |
| Internal auth V2 | `/api/internal-v2-auth/login`, `/logout`, `/status` | `functions/api/internal-v2-auth/*` | Internal Chekeo V2 |
| Orders admin V2 | `/api/orders-v2-admin`, `/summary`, `/export.csv`, `/[id]/status`, `/[id]/payment`, `/[id]/kitchen-item`, `/[id]/archive` | `functions/api/orders-v2-admin*` | Internal Chekeo V2 |
| Menu admin V2 | `/api/menu-v2-admin/items*`, `/promos*`, `/category-banners*` | `functions/api/menu-v2-admin/**` | Internal Chekeo V2 CatalogAdminPanel |
| Ingredients admin V2 | `/api/ingredients-v2-admin`, `/[id]`, `/recipes/[sku]` | `functions/api/ingredients-v2-admin*` | Internal Chekeo V2 |
| Kitchen admin V2 | `/api/kitchen-v2-admin/summary-k` | `functions/api/kitchen-v2-admin/summary-k.ts` | Internal Chekeo V2 KitchenQueue |
| Raffles public V2 | `/api/raffles-v2/active`, `/lookup` | `functions/api/raffles-v2/*` | Public V2 tickets/sorteo |
| Raffles admin V2 | `/api/raffles-v2-admin/campaigns*`, `/referral-codes*`, `/referrals*`, `/summary`, `/ticket-adjustments*` | `functions/api/raffles-v2-admin/**` | Internal Chekeo V2 RafflesAdminPanel |
| Campaign config | `/api/campaign-config` | `functions/api/campaign-config.ts` | Public V2 `main.tsx` |
| Referral tickets | `/api/referral-tickets` | `functions/api/referral-tickets.ts` | riesgo: no se encontro consumo directo en apps V2 |

Helpers activos: `functions/api/_asset-utils.ts`, `_menu-v2-utils.ts`, `_orders-v2-utils.ts`, `_ingredients-v2-utils.ts`.

## Docs activas

| Ruta | Estado | Uso |
| --- | --- | --- |
| `README.md` | activo | entrada humana al repo y superficie oficial |
| `docs/codex-memory/` | activo | memoria viva, tracker, inventarios, checklists |
| `docs/refactor-v2-clean-architecture.md` | activo | spec de migracion y reglas de arquitectura |
| `docs/environments.md` | activo | matriz de ambientes |
| `docs/burgers-v2-architecture.md` | activo con historia | bitacora de arquitectura V2; leer con fechas/contexto |
| `docs/burgers-v2-cloudflare-data.md` | activo con historia | datos Cloudflare/D1/R2; contiene comandos legacy que requieren cautela |
| `docs/burgers-v2-cutover-runbook.md` | activo | runbook V2 |
| `docs/burgers-v2-deploy-preview.md` | activo | preview V2, sin usar como permiso de deploy |
| `docs/burgers-v2-menu-cms-plan.md` | activo | catalogo/menu V2 |
| `docs/burgers-v2-qa-preview-checklist.md` | activo | QA preview |
| `docs/chekeo-v2-catalog-availability-qa.md` | activo | QA catalogo Chekeo V2 |
| `docs/chekeo-v2-preview-environment.md` | activo | contexto preview Chekeo V2 |
| `docs/public-order-v2-live-menu-qa.md` | activo | QA Public V2 |
| `docs/public-v2-premium-redesign-spec.md` | activo | spec visual Public V2 futura, sin permiso de runtime |
| `docs/visual-qa-preflight.md` | activo tooling | preflight visual |
| `docs/adr-ui-libraries-2026.md` | activo decision | ADR de librerias UI |
| `docs/v2-official-cutover.md` | activo | cutover oficial V2 |
| `docs/v2-deprecated-cleanup-plan.md` | activo para legacy cleanup | guia futura, no permiso de borrar |
| `docs/operations/2026-07-01-d1-0013-ticket-adjustments-live.md` | activo operacional | evidencia de operacion D1 0013 |

Docs historicas o candidatas a legacy deben conservarse hasta Fase 5/Fase 6; no se mueven en Fase 4.

## Scripts activos

| Script | Clasificacion | Uso | Regla |
| --- | --- | --- | --- |
| `dev`, `dev:public`, `dev:internal` | activo V2 local | dev frontend Vite | seguro local; no valida Pages Functions |
| `build`, `build:public`, `build:internal` | activo V2 | builds public/internal | ejecutar para validacion |
| `typecheck` | activo V2 | TypeScript | ejecutar en PRs con cambios relevantes |
| `preview:public`, `preview:internal` | activo local | preview Vite post-build | no equivale a deploy Cloudflare |
| `qa:visual` | tooling QA | Playwright visual | usar solo cuando aplique UI/QA |
| `db:v2:*:local` | D1 local/preview explicita | migrar/seed local | no ejecutar salvo intencion explicita |
| `db:v2:*:remote` | riesgo remoto | muta D1 remoto preview | prohibido sin autorizacion explicita |
| `public-order:*` | legacy/riesgo live | usa `cloudflare/public-order/wrangler.toml` y recursos live | prohibido en Fase 4; revisar en Fase 5 |

## Assets activos

| Asset/carpeta | Estado | Evidencia | Regla |
| --- | --- | --- | --- |
| R2 `BOG_MENU_ASSETS` | activo-v2 | `/api/assets-v2/[[key]].ts`; uploads admin de catalogo/sorteos | source of truth actual para assets oficiales |
| `imageKey` / `imageUrl` en D1 | activo-v2 | Public V2 resuelve `/api/assets-v2/<key>`; CatalogAdminPanel edita imagenes | no mover como archivos locales |
| `docs/assets/**` | docs/QA historico | screenshots y mockups referenciados por docs de auditoria/redesign | no mover sin Fase 5/Fase 6 |
| `cloudflare/public-order/assets/` | legacy public-order | bajo carpeta deprecated; no usado por apps V2 actuales | candidato Fase 5 |
| assets locales en `apps/public-order-v2` | no aplica | no hay carpeta dedicada; usa CSS y R2 | no crear/mover en Fase 4 |
| assets locales en `apps/internal-chekeo-v2` | runtime generado | ticket/share image se generan en canvas desde codigo | no crear/mover en Fase 4 |
| brand board dedicado | no encontrado | no se encontro carpeta/archivo canonico de brand board activo en Fase 4 | no inventar ni mover assets |

## Candidatos para Fase 5 - mover a legacy

| Ruta | Motivo | Riesgo | Requiere validacion antes de mover |
| --- | --- | --- | --- |
| `cloudflare/public-order/` | public order Cloudflare anterior con `/api/order`, assets locales y config legacy | alto: contiene `wrangler.toml` live y rollback historico | confirmar que ninguna app V2 ni script activo lo usa; preservar `DEPRECATED.md` |
| `cloudflare/internal-chekeo/` | Chekeo Cloudflare anterior con `/api/rpc` y Apps Script RPC | alto: rollback/operacion historica | confirmar que Chekeo V2 no depende de ningun archivo |
| `cloudflare/tickets/` | superficie historica de tickets | medio | confirmar uso real o archivarlo completo |
| `Code.gs`, `appsscript.json`, `backend_*.gs`, `menu_live_service.gs`, `setup_chekeo_2_sheets.gs`, `Index.html`, `scripts.html`, `styles.html` | Apps Script / Google Sheets en raiz | alto: riesgo de romper rollback si se mueve sin mapa | decidir estructura `legacy/apps-script` y validar referencias humanas |
| `planning/` | planeacion historica fuera de docs activas | medio | confirmar si queda como `legacy/planning` o docs historicas |
| `docs/chekeo-2-*.md` | contratos Sheets/Drive historicos | medio | marcar como historico o mover a `legacy/docs` |
| `docs/cloudflare-internal-chekeo-*.md` | Cloudflare internal legacy | medio | confirmar si se conserva como rollback |
| `docs/menu-live-contract.md`, `docs/normalized-*.md`, `docs/ui-ux-mobile-first-plan.md` | docs con `/api/order`, Apps Script o Sheets | medio | separar historia vs vigente |
| `docs/assets/chekeo-phase-*` | evidencia visual historica/redesign | bajo/medio | mantener si docs activas la enlazan; mover solo con referencias actualizadas |
| `deep-research-report-actualizado.md` | reporte suelto de investigacion | bajo/medio | clasificar si es referencia activa o legacy docs |
| `skills/ui-ux-pro-max` | skill incompleta sin `SKILL.md` | bajo | no corregir en Fase 4; ya documentado como incompleto |

## Carpetas y archivos que NO se deben tocar en Fase 4

- `apps/public-order-v2`
- `apps/internal-chekeo-v2`
- `functions/api`
- `packages/config`
- `packages/ui`
- `migrations`
- `cloudflare/public-order`
- `cloudflare/internal-chekeo`
- `cloudflare/tickets`
- `legacy`
- Apps Script / Sheets en raiz
- `.dev.vars`, `/wrangler.toml`, `/wrangler.local.toml`, `.wrangler/`, `.graphify/`

## Riesgos residuales

- `referral-tickets.ts` existe como endpoint D1 pero no se encontro consumo directo en apps V2; revisar antes de mover o borrar.
- `tests/internal-chekeo/kitchen-production-board.spec.ts` referencia `migrations/0008_preview_realistic_orders_seed.sql`, que no existe; candidato Fase 7.
- `docs/burgers-v2-cloudflare-data.md` y docs historicas contienen comandos y referencias legacy; Fase 5/Fase 6 debe reclasificarlas para evitar confusion.
- `public-order:*` scripts siguen presentes y apuntan a config legacy/live; no ejecutarlos sin aprobacion explicita.
- `.graphify/` existe como artefacto local ignorado en varias rutas; no versionar.

## Siguiente fase sugerida

Fase 5 - Mover legacy a cuarentena.
