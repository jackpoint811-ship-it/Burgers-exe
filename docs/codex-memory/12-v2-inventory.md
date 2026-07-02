> Estado: vivo
> Uso: inventario real de Burgers.exe V2 antes de mover legacy

# Inventario V2 - Fase 2

Fecha: 2026-07-02
Rama: `docs/phase-2-v2-inventory`
Base validada: `main` sincronizado con `origin/main`.

## Alcance

Este documento inventaria el repo actual antes de mover, borrar o reclasificar archivos. No autoriza cambios de runtime, Cloudflare, D1, R2, payloads, precios, promociones ni legacy cleanup.

## Confirmacion de fases previas

- Fase 0: PR #333 mergeado en `main`.
- Fase 1: PR #334 mergeado en `main`.
- Fase 1.1: PR #335 mergeado en `main`.
- Archivos obligatorios presentes: `docs/codex-memory/10-migration-tracker.md`, `docs/codex-memory/11-skills-and-tools.md`, `docs/refactor-v2-clean-architecture.md`, `docs/environments.md`, `tools/codex/verify-local-tooling.ps1`, `tools/codex/verify-skills.ps1`, `tools/codex/prepare-skills-sync.ps1`.

## Graphify

### Resultado

- `graphify --version`: `0.10.1`.
- Code graph OK: `graphify update . --force --no-description` reconstruyo el grafo de codigo con `1565` nodos, `2855` edges y `96` comunidades.
- Hubs principales del grafo: `generateOrderTicketImage()`, `requireAdminToken()`, `AdminEnv`, `errorResponse()`, `json()`.
- Diagnostico no bloqueante: Graphify no pudo extraer AST de los scripts PowerShell de `tools/codex/*.ps1` porque falta `tree-sitter-powershell`.
- Semantic analysis parcial/fallido:
  - `graphify .` fallo porque el corpus incluye documentos/imagenes y la CLI directa exige semantic extraction.
  - `GEMINI_API_KEY` estuvo presente en el proceso, validado sin imprimir el valor.
  - `graphify extract . --backend gemini ...` fallo por cuota del proveedor Gemini, no por key faltante.
- Fallback manual aplicado: `git ls-files`, `git grep`, lectura de imports, rutas, scripts, endpoints, bindings, migraciones, docs y assets.

### Archivos Graphify

- `.graphify/` queda como artefacto local ignorado por `.git/info/exclude`.
- No se versionan outputs pesados de Graphify en este PR.

## Apps oficiales

### Public V2

| Item | Ruta | Evidencia | Estado |
|---|---|---|---|
| Carpeta principal | `apps/public-order-v2` | `vite.config.ts` selecciona `apps/public-order-v2` cuando `APP_TARGET` no es `internal` | activo-v2 |
| HTML entrypoint | `apps/public-order-v2/index.html` | carga `./src/main.tsx` sobre `#root` | activo-v2 |
| React entrypoint | `apps/public-order-v2/src/main.tsx` | renderiza `PublicOrderApp` y ruta de tickets | activo-v2 |
| App principal | `apps/public-order-v2/src/components/PublicOrderApp.tsx` | importa `@config`, `@ui`, `loadMenuV2`, `createOrderV2`, `loadActiveRaffleV2` | activo-v2 |
| Consulta tickets | `apps/public-order-v2/src/components/TicketsLookupPage.tsx` | usa `lookupRaffleTicketsV2` | activo-v2 |
| Estilos app | `apps/public-order-v2/src/styles.css`, `apps/public-order-v2/src/tickets.css` | usados por `main.tsx` y ruta de tickets | activo-v2 |
| Menu client | `apps/public-order-v2/src/lib/menu-v2.ts` | `fetch('/api/menu-v2')` con fallback de `@config` | activo-v2 |
| Orden client | `apps/public-order-v2/src/lib/orders-v2.ts` | `POST /api/orders-v2` | activo-v2 |
| Orden helpers | `apps/public-order-v2/src/lib/order.ts` | calcula cart/payload desde tipos `MenuItem` | activo-v2 |
| Sorteos publicos | `apps/public-order-v2/src/lib/raffles-v2.ts` | `GET /api/raffles-v2/active` y `GET /api/raffles-v2/lookup` | activo-v2 |
| Assets R2 | `resolveAssetUrl()` en `PublicOrderApp.tsx` | genera `/api/assets-v2/<key>` desde `imageKey` | activo-v2 |
| Checkout | `PublicOrderApp.tsx` | validacion de nombre, telefono, ubicacion, pago, notas y carrito | activo-v2 |
| Tickets/sorteo | `PublicOrderApp.tsx`, `TicketsLookupPage.tsx`, `raffles-v2.ts` | banner activo, lookup por telefono/codigo | activo-v2 |
| WhatsApp | `PublicOrderApp.tsx` | captura `wantsWhatsappGroup` en notas de checkout | activo-v2 |
| Scripts | `package.json` | `dev:public`, `build:public`, `preview:public` | activo-v2 |

Payload critico: `CreateOrderV2Payload` vive en `packages/config/src/contracts.ts` y se envia por `createOrderV2()` a `/api/orders-v2` con `idempotency-key`.

### Internal Chekeo V2

| Item | Ruta | Evidencia | Estado |
|---|---|---|---|
| Carpeta principal | `apps/internal-chekeo-v2` | `vite.config.ts` selecciona esta app con `APP_TARGET=internal` | activo-v2 |
| HTML entrypoint | `apps/internal-chekeo-v2/index.html` | carga `./src/main.tsx` sobre `#root` | activo-v2 |
| React entrypoint | `apps/internal-chekeo-v2/src/main.tsx` | renderiza `InternalChekeoApp` dentro de `InternalV2ErrorBoundary` | activo-v2 |
| App principal | `apps/internal-chekeo-v2/src/components/InternalChekeoApp.tsx` | pedidos, pagos, cocina, admin, auth shell | activo-v2 |
| Admin catalogo | `apps/internal-chekeo-v2/src/components/CatalogAdminPanel.tsx` | usa `/api/menu-v2`, `/api/menu-v2-admin/*`, `/api/assets-v2/*` | activo-v2 |
| Admin sorteos | `apps/internal-chekeo-v2/src/components/RafflesAdminPanel.tsx` | usa `raffles-v2-admin.ts` y assets de campanas | activo-v2 |
| Cocina | `apps/internal-chekeo-v2/src/components/kitchen/KitchenQueue.tsx` | usa runtime D1/fallback y update de items de cocina | activo-v2 |
| Cocina helpers | `kitchen-helpers.ts`, `kitchen-types.ts` | clasificacion de produccion y tipos UI | activo-v2 |
| Auth client | `apps/internal-chekeo-v2/src/lib/internal-auth.ts` | `/api/internal-v2-auth/status`, login y logout | activo-v2 |
| Orders admin client | `apps/internal-chekeo-v2/src/lib/orders-v2-admin.ts` | list, summary, status, kitchen, payment, archive, CSV | activo-v2 |
| Ingredientes client | `apps/internal-chekeo-v2/src/lib/ingredients-v2-admin.ts` | ingredientes, recetas y resumen K | activo-v2 |
| Sorteos admin client | `apps/internal-chekeo-v2/src/lib/raffles-v2-admin.ts` | campanas, codigos, referidos, ajustes, imagenes | activo-v2 |
| Ticket PNG | `apps/internal-chekeo-v2/src/lib/order-ticket-image.ts` | Graphify hub principal `generateOrderTicketImage()` | activo-v2 |
| WhatsApp | `apps/internal-chekeo-v2/src/lib/whatsapp.ts` | mensajes de orden, pago y confirmacion | activo-v2 |
| Assets de sorteo | `apps/internal-chekeo-v2/src/lib/raffle-share-image.ts` | genera imagen de tickets y URL WhatsApp | activo-v2 |
| Estilos app | `apps/internal-chekeo-v2/src/styles.css` | shell Chekeo, modales, tabs, pagos, cocina | activo-v2 |
| Scripts | `package.json` | `dev:internal`, `build:internal`, `preview:internal` | activo-v2 |

Auth actual: PIN-only con `BOG_INTERNAL_PIN`, cookie HttpOnly `bog_internal_session` y helpers en `functions/api/_orders-v2-utils.ts`.

## Codigo compartido activo

| Ruta | Usado por | Evidencia | Riesgo si se mueve |
|---|---|---|---|
| `packages/config/src/contracts.ts` | Public V2, Chekeo V2, Functions | exporta contratos `MenuV2Response`, `CreateOrderV2Payload`, `OrderV2`, `Raffle*`, `Ingredient*` | critico, rompe tipos/payloads |
| `packages/config/src/mock-data.ts` | Public fallback, Chekeo fallback/demo | importado por `menu-v2.ts` y usado como fallback visual | medio, rompe fallback y demos |
| `packages/config/src/bank-payment-config.ts` | Chekeo WhatsApp/ticket/pagos | importado por helpers de pago | alto, rompe copy y datos bancarios de transferencia |
| `packages/config/src/runtime-environment.ts` | Chekeo runtime/env links | usado para distinguir local/preview/production y URL publica | alto, puede mezclar preview/prod |
| `packages/config/src/index.ts` | Ambas apps | barrel `@config/index` | critico |
| `packages/ui/src/components.tsx` | Ambas apps | exporta `Button`, `Card`, `StatusPill`, `EmptyState` | alto, rompe UI compartida |
| `packages/ui/src/cn.ts` | UI compartida | `clsx` helper | medio |
| `packages/ui/src/shell-card.tsx` | UI compartida | `ShellCard` | bajo/medio |
| `packages/ui/src/index.ts` | Ambas apps | barrel `@ui/index` | critico para imports |
| `vite.config.ts` | Ambas apps | aliases `@ui` y `@config`, seleccion por `APP_TARGET` | critico |

Nota: `packages/domain` y `packages/cloudflare` aparecen en la arquitectura objetivo, pero no existen como paquetes actuales en el repo. No deben asumirse como presentes hasta Fase 4 o una fase de separacion.

## Endpoints y Functions

| Endpoint | Archivo | App que lo usa | Estado |
|---|---|---|---|
| `/api/menu-v2` | `functions/api/menu-v2.ts` | Public V2, CatalogAdminPanel | activo-v2 |
| `/api/orders-v2` | `functions/api/orders-v2.ts` | Public V2 | activo-v2, write-gated por `ORDERS_V2_WRITE_ENABLED` |
| `/api/assets-v2/[[key]]` | `functions/api/assets-v2/[[key]].ts` | Public V2, Chekeo V2 | activo-v2 |
| `/api/raffles-v2/active` | `functions/api/raffles-v2/active.ts` | Public V2 | activo-v2 |
| `/api/raffles-v2/lookup` | `functions/api/raffles-v2/lookup.ts` | Public V2 tickets | activo-v2 |
| `/api/internal-v2-auth/login` | `functions/api/internal-v2-auth/login.ts` | Chekeo V2 | activo-v2 |
| `/api/internal-v2-auth/logout` | `functions/api/internal-v2-auth/logout.ts` | Chekeo V2 | activo-v2 |
| `/api/internal-v2-auth/status` | `functions/api/internal-v2-auth/status.ts` | Chekeo V2 | activo-v2 |
| `/api/orders-v2-admin` | `functions/api/orders-v2-admin.ts` | Chekeo V2 | activo-v2 |
| `/api/orders-v2-admin/summary` | `functions/api/orders-v2-admin/summary.ts` | Chekeo V2 | activo-v2 |
| `/api/orders-v2-admin/export.csv` | `functions/api/orders-v2-admin/export.csv.ts` | Chekeo V2 | activo-v2 |
| `/api/orders-v2-admin/[id]/status` | `functions/api/orders-v2-admin/[id]/status.ts` | Chekeo V2 | activo-v2 |
| `/api/orders-v2-admin/[id]/payment` | `functions/api/orders-v2-admin/[id]/payment.ts` | Chekeo V2 | activo-v2 |
| `/api/orders-v2-admin/[id]/kitchen-item` | `functions/api/orders-v2-admin/[id]/kitchen-item.ts` | Chekeo V2 | activo-v2 |
| `/api/orders-v2-admin/[id]/archive` | `functions/api/orders-v2-admin/[id]/archive.ts` | Chekeo V2 | activo-v2 |
| `/api/menu-v2-admin/items` | `functions/api/menu-v2-admin/items.ts` | Chekeo V2 CatalogAdminPanel | activo-v2 |
| `/api/menu-v2-admin/items/[sku]` | `functions/api/menu-v2-admin/items/[sku].ts` | Chekeo V2 CatalogAdminPanel | activo-v2 |
| `/api/menu-v2-admin/items/[sku]/availability` | `functions/api/menu-v2-admin/items/[sku]/availability.ts` | Chekeo V2 CatalogAdminPanel | activo-v2 |
| `/api/menu-v2-admin/items/[sku]/image` | `functions/api/menu-v2-admin/items/[sku]/image.ts` | Chekeo V2 CatalogAdminPanel | activo-v2 |
| `/api/menu-v2-admin/promos/[id]` | `functions/api/menu-v2-admin/promos/[id].ts` | Chekeo V2 CatalogAdminPanel | activo-v2 |
| `/api/menu-v2-admin/promos/[id]/image` | `functions/api/menu-v2-admin/promos/[id]/image.ts` | Chekeo V2 CatalogAdminPanel | activo-v2 |
| `/api/menu-v2-admin/category-banners` | `functions/api/menu-v2-admin/category-banners.ts` | Chekeo V2 CatalogAdminPanel | activo-v2 |
| `/api/menu-v2-admin/category-banners/[categoryKey]/image` | `functions/api/menu-v2-admin/category-banners/[categoryKey]/image.ts` | Chekeo V2 CatalogAdminPanel | activo-v2 |
| `/api/ingredients-v2-admin` | `functions/api/ingredients-v2-admin.ts` | Chekeo V2 | activo-v2 |
| `/api/ingredients-v2-admin/[id]` | `functions/api/ingredients-v2-admin/[id].ts` | Chekeo V2 | activo-v2 |
| `/api/ingredients-v2-admin/recipes/[sku]` | `functions/api/ingredients-v2-admin/recipes/[sku].ts` | Chekeo V2 | activo-v2 |
| `/api/kitchen-v2-admin/summary-k` | `functions/api/kitchen-v2-admin/summary-k.ts` | Chekeo V2 KitchenQueue | activo-v2 |
| `/api/raffles-v2-admin/campaigns` | `functions/api/raffles-v2-admin/campaigns.ts` | Chekeo V2 RafflesAdminPanel | activo-v2 |
| `/api/raffles-v2-admin/campaigns/[id]` | `functions/api/raffles-v2-admin/campaigns/[id].ts` | Chekeo V2 RafflesAdminPanel | activo-v2 |
| `/api/raffles-v2-admin/campaigns/[id]/banner-image` | `functions/api/raffles-v2-admin/campaigns/[id]/banner-image.ts` | Chekeo V2 RafflesAdminPanel | activo-v2 |
| `/api/raffles-v2-admin/campaigns/[id]/detail-image` | `functions/api/raffles-v2-admin/campaigns/[id]/detail-image.ts` | Chekeo V2 RafflesAdminPanel | activo-v2 |
| `/api/raffles-v2-admin/referral-codes` | `functions/api/raffles-v2-admin/referral-codes.ts` | Chekeo V2 RafflesAdminPanel | activo-v2 |
| `/api/raffles-v2-admin/referral-codes/[id]` | `functions/api/raffles-v2-admin/referral-codes/[id].ts` | Chekeo V2 RafflesAdminPanel | activo-v2 |
| `/api/raffles-v2-admin/referrals` | `functions/api/raffles-v2-admin/referrals.ts` | Chekeo V2 RafflesAdminPanel | activo-v2 |
| `/api/raffles-v2-admin/referrals/[id]` | `functions/api/raffles-v2-admin/referrals/[id].ts` | Chekeo V2 RafflesAdminPanel | activo-v2 |
| `/api/raffles-v2-admin/summary` | `functions/api/raffles-v2-admin/summary.ts` | Chekeo V2 RafflesAdminPanel | activo-v2 |
| `/api/raffles-v2-admin/ticket-adjustments` | `functions/api/raffles-v2-admin/ticket-adjustments.ts` | Chekeo V2 RafflesAdminPanel | activo-v2 |
| `/api/raffles-v2-admin/ticket-adjustments/[id]` | `functions/api/raffles-v2-admin/ticket-adjustments/[id].ts` | Chekeo V2 RafflesAdminPanel | activo-v2 |
| `/api/campaign-config` | `functions/api/campaign-config.ts` | no se encontro uso directo en apps V2 | desconocido |
| `/api/referral-tickets` | `functions/api/referral-tickets.ts` | no se encontro uso directo en apps V2 | riesgo |
| Helpers `_asset-utils`, `_menu-v2-utils`, `_orders-v2-utils`, `_ingredients-v2-utils` | `functions/api/_*.ts` | usados por endpoints V2 | activo-v2 interno |

## D1, R2 y migraciones

### Bindings

| Binding | Tipo | Evidencia | Estado |
|---|---|---|---|
| `BOG_MENU_DB` | D1 | usado por `menu-v2`, `orders-v2`, admin endpoints, raffle endpoints e ingredientes | activo-v2 |
| `BOG_MENU_ASSETS` | R2 | usado por `/api/assets-v2`, uploads de catalogo y sorteos | activo-v2 |
| `BOG_INTERNAL_PIN` | secret | usado por auth interno y cookie `bog_internal_session` | activo-v2 |
| `ORDERS_V2_WRITE_ENABLED` | var | gate de escritura en `/api/orders-v2` | activo-v2 |

### Configs

- `wrangler.example.toml`: plantilla local/preview con `BOG_MENU_DB` y `BOG_MENU_ASSETS`.
- `cloudflare/public-order/wrangler.toml`: config legacy/deprecated que apunta a `burgers-exe-menu-live` y `burgers-exe-menu-assets`; contiene identificadores reales y debe revisarse en Fase 3/Fase 5 antes de mantenerlo o moverlo.
- No se ejecuto ningun comando remoto de Cloudflare.
- No se ejecutaron migraciones ni seeds.

### Migraciones activas o relevantes

| Archivo | Tipo | Estado recomendado |
|---|---|---|
| `migrations/0001_v2_menu_schema.sql` | schema menu V2 | mantener-activo |
| `migrations/0002_v2_menu_seed.sql` | seed menu V2 | requiere-revision antes de prod |
| `migrations/0003_v2_orders_schema.sql` | schema orders V2 | mantener-activo |
| `migrations/0004_v2_raffles_schema.sql` | schema sorteos V2 | mantener-activo |
| `migrations/0005_v2_raffles_referrals_schema.sql` | schema referidos V2 | mantener-activo |
| `migrations/0006_public_live_menu_d1_schema.sql` | schema live menu/public | mantener-activo |
| `migrations/0007_public_live_menu_seed.sql` | seed live menu | requiere-revision antes de prod |
| `migrations/0008_v2_raffle_detail_images.sql` | ALTER raffle images | mantener-activo |
| `migrations/0009_orders_archive_raffles_delete.sql` | archive/delete soft fields | mantener-activo |
| `migrations/0010_catalog_creation_stock_category_banners.sql` | stock/category banners | mantener-activo |
| `migrations/0011_ingredients_recipe_summary.sql` | ingredientes/recetas/resumen K | mantener-activo |
| `migrations/0012_add_combo_bbq_live.sql` | combo BBQ live/fallback | mantener-activo |
| `migrations/0013_v2_raffles_ticket_adjustments.sql` | ajustes manuales de tickets | mantener-activo |

Riesgo detectado: `tests/internal-chekeo/kitchen-production-board.spec.ts` referencia `migrations/0008_preview_realistic_orders_seed.sql`, pero ese archivo no existe actualmente en `migrations/`.

## Legacy detectado

| Ruta | Referencia | Estado recomendado | Motivo |
|---|---|---|---|
| `legacy/` | Apps Script, HTML historico y planning | mantener-doc-historica | ya tiene `DEPRECATED.md`; no tocar sin fase explicita |
| `Code.gs`, `appsscript.json`, `backend_*.gs`, `menu_live_service.gs`, `setup_chekeo_2_sheets.gs`, `Index.html`, `scripts.html`, `styles.html` | Apps Script / Google Sheets en raiz | mover-a-legacy en Fase 5 o Fase 6 | siguen fuera de `legacy/` y no son runtime oficial V2 |
| `cloudflare/public-order/` | public order Cloudflare anterior, `/api/menu`, `/api/order`, Apps Script vars | mover-a-legacy en Fase 5 | tiene `DEPRECATED.md`; contiene assets historicos y `.wrangler` trackeado |
| `cloudflare/internal-chekeo/` | Chekeo anterior, `/api/auth`, `/api/session`, `/api/logout`, `/api/rpc`, Apps Script RPC | mover-a-legacy en Fase 5 | tiene `DEPRECATED.md`; no es Chekeo V2 actual |
| `cloudflare/tickets/` | tickets Cloudflare historico | requiere-revision | no forma parte de las dos apps oficiales V2 |
| `docs/chekeo-2-*.md` | contratos Google Sheets/Drive | mantener-doc-historica o mover a `legacy/docs` | contradicen arquitectura D1/R2 si se leen como actuales |
| `docs/menu-live-contract.md`, `docs/normalized-*.md`, `docs/ui-ux-mobile-first-plan.md` | `/api/order`, Apps Script, Sheets | mantener-doc-historica o mover a `legacy/docs` | utiles como historia, no como runtime actual |
| `docs/cloudflare-internal-chekeo-*.md` | Chekeo Cloudflare viejo, PIN/session/RPC legacy | mantener-doc-historica o mover a `legacy/docs` | describe flujo anterior |
| `cloudflare/public-order/.wrangler/` | artefactos Wrangler/Miniflare trackeados | eliminar-en-fase-futura del indice, no borrar sin revision | `.gitignore` ignora `.wrangler/`, pero hay 15 archivos trackeados en esa subcarpeta |
| `APPS_SCRIPT_*` referencias | legacy Cloudflare y docs | mover-a-legacy/requiere-revision | no deben ser runtime V2 oficial |
| `BOG_ACTIVE_ENV` | busqueda sin hallazgos relevantes | no-tocar | no se detecto uso activo |
| `public-order-v1` | busqueda sin hallazgos | no-tocar | no existe referencia directa |

## Docs

### Docs activas V2

- `README.md`
- `docs/refactor-v2-clean-architecture.md`
- `docs/environments.md`
- `docs/burgers-v2-architecture.md`
- `docs/burgers-v2-cloudflare-data.md`
- `docs/burgers-v2-cutover-runbook.md`
- `docs/burgers-v2-deploy-preview.md`
- `docs/burgers-v2-menu-cms-plan.md`
- `docs/burgers-v2-qa-preview-checklist.md`
- `docs/public-order-v2-live-menu-qa.md`
- `docs/v2-official-cutover.md`
- `docs/v2-deprecated-cleanup-plan.md`
- `docs/operations/2026-07-01-d1-0013-ticket-adjustments-live.md`

### Memoria viva

- `docs/codex-memory/00-indice.md` a `docs/codex-memory/12-v2-inventory.md`.

### Docs historicas utiles o candidatas a mover despues

- `docs/chekeo-2-*.md`
- `docs/cloudflare-internal-chekeo-*.md`
- `docs/menu-live-contract.md`
- `docs/normalized-*.md`
- `docs/ui-redesign-*.md`
- `docs/ui-ux-*.md`
- `docs/public-order-mobile-qa.md`
- `docs/chekeo-phase-*.md`

No se mueven en Fase 2. La clasificacion fina de docs debe hacerse en Fase 5/Fase 6.

## Assets

| Asset/carpeta | Usado por | Estado | Evidencia |
|---|---|---|---|
| R2 via `BOG_MENU_ASSETS` | Public V2, Chekeo V2 | activo-v2 | `/api/assets-v2/[[key]].ts` y helpers de upload |
| `imageKey` / `imageUrl` en D1 | Public V2, Chekeo catalogo/sorteos | activo-v2 | `resolveAssetUrl()` y admin upload endpoints |
| `cloudflare/public-order/assets/` | legacy public-order | mover-a-legacy en Fase 5 | carpeta bajo `cloudflare/public-order` deprecated |
| `docs/assets/chekeo-phase-*` | docs historicas, QA, mockups | mantener-doc-historica | evidencia de auditorias y prototipos |
| `apps/public-order-v2` assets locales | Public V2 | no aplica | no hay carpeta de assets dedicada; usa CSS y R2 |
| `apps/internal-chekeo-v2` assets locales | Chekeo V2 | no aplica | no hay carpeta de assets dedicada; genera canvas/PNG en runtime |

## Candidatos para Fase 5 y Fase 6

- Mover `cloudflare/public-order/`, `cloudflare/internal-chekeo/` y `cloudflare/tickets/` a cuarentena legacy, preservando `DEPRECATED.md` y cualquier rollback util.
- Mover Apps Script y HTML historico de la raiz a `legacy/apps-script` o estructura equivalente.
- Separar docs activas de docs historicas para evitar que Sheets/App Script parezcan source of truth actual.
- Retirar del indice los artefactos `cloudflare/public-order/.wrangler/` si se confirma que son residuos locales y no rollback deliberado.
- Revisar o corregir el test que referencia `migrations/0008_preview_realistic_orders_seed.sql`, porque el archivo no existe.

## Bloqueadores

- Ninguno para cerrar Fase 2 como inventario documental.
- Pendiente para Fase 3: validar proyectos Pages, D1 preview/prod y R2 preview/prod reales desde Cloudflare sin mezclar ambientes.

## Preguntas antes de Fase 3

- Cuales son los nombres definitivos de los proyectos Pages preview para Public V2 e Internal V2?
- Cuales son los nombres definitivos de D1/R2 preview frente a produccion?
- `cloudflare/public-order/wrangler.toml` debe conservarse como rollback historico o moverse completo a legacy en Fase 5?
- El test que referencia `0008_preview_realistic_orders_seed.sql` debe actualizarse, restaurar fixture no destructiva o moverse a legacy?

## Siguiente fase sugerida

Fase 3 - Estandarizar ambientes Cloudflare preview/prod.
