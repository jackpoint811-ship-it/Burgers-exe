# Fase 2.1 - QA operativo con pedidos seed en preview D1

Fecha de ejecucion: 2026-06-21
Batch ID: `QA-UIUX-PHASE2-1`
Preview interno validado: `https://burgers-exe-internal-v2-preview.pages.dev/`
Preview publico usado para crear pedidos: `https://burgers-exe-public-v2-preview.pages.dev/`
PIN: validado con el PIN operativo proporcionado en el brief; el valor no se persiste en este repo.
D1: ambos previews respondieron `source: "d1"` en `/api/menu-v2`; los pedidos seed quedaron con `source: "public-v2-preview"`.

## Confirmacion de deploy

- PR #299: `MERGED`.
- Merge commit: `9f9552bc65f838457d60df562d2cdbcbf853c9ba`.
- Base: `preview`.
- Deploy check: `Cloudflare Pages: burgers-exe-internal-v2-preview` en `SUCCESS`.
- La rama de QA se creo desde `origin/preview` despues del merge.

## Metodo

1. Se ejecuto Graphify antes de inspeccionar codigo y tocar datos, consultando endpoints de ordenes, D1 preview y admin.
2. Se revisaron los contratos reales:
   - `POST /api/orders-v2` crea pedidos preview con `environment: "preview"` y `source = "public-v2-preview"`.
   - Las rutas admin validan sesion y rechazan cruces de ambiente con `assertOrderMatchesEnvironment`.
   - En preview no se descuenta stock y no se disparan rifas.
3. Se entro a Chekeo preview con Playwright y PIN real.
4. Se capturo estado base antes del seed.
5. Se crearon 10 pedidos idempotentes por API publica preview y se ajustaron estados, pagos y checklist de cocina por API admin autenticada.
6. Se recorrio UI real con Playwright en mobile 320/390/430 y desktop.

## Pedidos seed

Total en batch despues del seed: 10 pedidos.

| Seq | Folio | Estado final | Pago | Metodo | Modo | Total | Cobertura |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| 01 | `PVW-04R1SN7KPM` | `new` | `pending` | `cash` | `pickup` | $102.00 | Burger OG, extras, nota corta |
| 02 | `PVW-04R1SN8FLO` | `preparing` | `paid` | `transfer` | `delivery` | $117.00 | BBQ, guarnicion, ubicacion |
| 03 | `PVW-04R1SNB2TA` | `ready` | `pending` | `transfer` | `pickup` | $146.00 | Combo, Side Quest, Resumen K |
| 04 | `PVW-04R1SNE43Z` | `delivered` | `paid` | `cash` | `delivery` | $120.00 | Entregado, efectivo, multi-item |
| 05 | `PVW-04R1SNKP1D` | `cancelled` | `cancelled` | `transfer` | `pickup` | $100.00 | Cancelado, historial |
| 06 | `PVW-04R1SNNMPC` | `new` | `paid` | `transfer` | `delivery` | $132.00 | Nuevo pagado, multi-item |
| 07 | `PVW-04R1SNPQKI` | `preparing` | `pending` | `cash` | `pickup` | $92.00 | Nota larga para wrap mobile |
| 08 | `PVW-04R1SNRCWM` | `ready` | `paid` | `transfer` | `delivery` | $146.00 | Combo BBQ listo y pagado |
| 09 | `PVW-04R1SNW2QN` | `delivered` | `pending` | `transfer` | `pickup` | $99.00 | Entregado con pago pendiente |
| 10 | `PVW-04R1SO1VNU` | `cancelled` | `pending` | `cash` | `delivery` | $115.00 | Cancelado delivery, efectivo |

Distribucion final:

- Estados: 2 `new`, 2 `preparing`, 2 `ready`, 2 `delivered`, 2 `cancelled`.
- Pagos: 5 `pending`, 4 `paid`, 1 `cancelled`.
- Metodos: 4 `cash`, 6 `transfer`.
- Modos: 5 `pickup`, 5 `delivery`.
- Catalogo real usado: `OG`, `BBQ`, `0001`, `COMBO-BBQ`, guarniciones y extras activos. No habia bebidas activas en preview, asi que no se inventaron SKUs.

Evidencia estructurada:

- `docs/assets/chekeo-phase-2-1-seed-qa/seed-result.json`
- `docs/assets/chekeo-phase-2-1-seed-qa/preview-menu-snapshot.json`
- `docs/assets/chekeo-phase-2-1-seed-qa/visual-qa-result.json`

## Capturas

Capturas base antes del seed:

- `docs/assets/chekeo-phase-2-1-seed-qa/before-seed-operacion-mobile-390.png`
- `docs/assets/chekeo-phase-2-1-seed-qa/before-seed-pedidos-mobile-390.png`

Capturas post-seed requeridas:

- `docs/assets/chekeo-phase-2-1-seed-qa/operacion-seeded-mobile-390.png`
- `docs/assets/chekeo-phase-2-1-seed-qa/pedidos-seeded-mobile-320.png`
- `docs/assets/chekeo-phase-2-1-seed-qa/pedidos-seeded-mobile-390.png`
- `docs/assets/chekeo-phase-2-1-seed-qa/pedidos-detail-mobile-390.png`
- `docs/assets/chekeo-phase-2-1-seed-qa/cocina-seeded-mobile-390.png`
- `docs/assets/chekeo-phase-2-1-seed-qa/resumen-k-seeded-mobile-390.png`
- `docs/assets/chekeo-phase-2-1-seed-qa/pagos-seeded-mobile-390.png`
- `docs/assets/chekeo-phase-2-1-seed-qa/corte-seeded-mobile-390.png`
- `docs/assets/chekeo-phase-2-1-seed-qa/historial-seeded-mobile-390.png`
- `docs/assets/chekeo-phase-2-1-seed-qa/admin-mobile-390.png`
- `docs/assets/chekeo-phase-2-1-seed-qa/catalogo-mobile-390.png`
- `docs/assets/chekeo-phase-2-1-seed-qa/sorteos-mobile-390.png`
- `docs/assets/chekeo-phase-2-1-seed-qa/desktop-seeded-overview.png`

Capturas extra:

- `docs/assets/chekeo-phase-2-1-seed-qa/pedidos-seeded-mobile-430.png`
- `docs/assets/chekeo-phase-2-1-seed-qa/cocina-seeded-mobile-430.png`
- `docs/assets/chekeo-phase-2-1-seed-qa/pedidos-filter-listo-mobile-390.png`

## Flujos validados

- Login PIN real y sesion HttpOnly.
- Operacion/Home con metricas de preview D1 y mini Resumen K.
- Pedidos con lista seeded, detalle de ticket y filtro `Listo`.
- Cocina con items de burgers, combos, guarniciones y Side Quest.
- Pagos con pendientes, confirmados, efectivo, transferencia y terminales.
- Corte con rango del dia, totales, metodos y productos destacados.
- Historial con entregados/cancelados y acciones de ocultar solo cancelados.
- Admin hub, Catalogo y Sorteos sin mutaciones.
- Responsive: 320, 390, 430 y desktop.

## UX/UI y accesibilidad

Lentes usados:

- UI UX Pro Max: mobile cards sobre tablas, foco visible, input mode, overflow, legibilidad de estados y densidad operativa.
- Taste/design-taste: solo como filtro anti-slop; este producto es una herramienta interna densa, no una landing.

Resultado:

- No se detecto overflow horizontal en las capturas automatizadas.
- No hubo `pageerror`.
- No hubo errores de consola.
- Los textos largos del pedido 07 se mantuvieron dentro de tarjetas y detalle operativo.
- Los targets tactiles principales se mantuvieron usables en 320/390.
- El filtro `Listo` funciono y conservo el batch visible.

## Bugs y fixes

No se aplicaron fixes de codigo en esta fase porque no aparecieron bloqueos P0/P1/P2 en la preview seeded.

Observaciones no bloqueantes:

- El banner de "Entraron pedidos nuevos" permanece hasta que el operador lo descarta; es correcto funcionalmente, pero mete ruido visual en capturas largas.
- La build internal conserva la advertencia de Vite por chunk mayor a 500 kB. No bloqueo QA, pero conviene abrir una tarea futura de code splitting si el bundle sigue creciendo.
- No habia bebidas activas en el D1 preview; se cubrieron combos/guarniciones/extras sin forzar datos falsos.

## Limpieza

Estado actual: los seeds quedan activos para revision visual del equipo. No se limpiaron.

Archivo de limpieza seguro:

- `docs/chekeo-phase-2-1-seed-cleanup.sql`

Comando previsto, solo para preview D1:

```powershell
npx wrangler d1 execute burgers-exe-menu-v2-preview --remote --file=docs/chekeo-phase-2-1-seed-cleanup.sql
```

Guardas del SQL:

- Filtra `source = 'public-v2-preview'`.
- Requiere marcador `QA-UIUX-PHASE2-1` en `idempotency_key`, `customer_name` o `notes`.
- Borra primero `order_events_v2`, despues `order_items_v2`, y al final `orders_v2`.
- No debe ejecutarse contra `burgers-exe-menu-live`.

## Checks

- `npm run typecheck`: passed.
- `APP_TARGET=internal npm run build:internal`: passed.
- `npx playwright test --config=playwright.internal-kitchen.config.ts`: 7 passed, 1 skipped (`admin-only` previsto).
- Visual Playwright remoto seeded: 15 capturas registradas + 1 captura extra de filtro, 0 overflow failures, 0 console errors, 0 page errors.
- `git diff --check`: passed.
- `graphify update .`: passed desde `C:\Documentos\Burgers-exe` porque el worktree no contiene `graphify-out`; sin cambios de topologia.

## Recomendacion

Preview seeded queda apto para revision operativa de Fase 2.1. No hay bloqueo de UX/UI para avanzar a PR de QA/documentacion. Antes de cualquier promocion operativa, decidir si se conservan los seeds para demo o se ejecuta el cleanup preview; no mezclar esta limpieza con comandos de D1 live.
