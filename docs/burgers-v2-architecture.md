# Burgers.exe V2 Radical Rebuild Architecture (Fase V2-0)

## Objetivos V2
- Levantar una base paralela para public-order-v2 e internal-chekeo-v2 sin reemplazar V1.
- Aislar UI y contratos de datos para evolucionar frontend sin tocar backend actual.
- Preparar integración futura con Cloudflare D1/R2 manteniendo compatibilidad de endpoints existentes.

## Stack
- React + Vite + TypeScript.
- Tailwind CSS para sistema visual.
- Radix primitives para bloques de interfaz escalables.
- Framer Motion para microinteracciones.
- Lucide para iconografía.

## Estructura propuesta
- `apps/public-order-v2`: landing + ordering shell.
- `apps/internal-chekeo-v2`: consola operativa dark-only.
- `packages/ui`: componentes compartidos V2.
- `packages/config`: contratos y mock data V2.
- `docs/`: arquitectura, CMS y placeholders.

## Decisiones técnicas
- V2 corre en paralelo, sin mutar `cloudflare/public-order` ni `cloudflare/internal-chekeo`.
- Configuración single-repo con `APP_TARGET` para dev/build independiente por app.
- Contratos TS explícitos para reducir acoplamiento con backend.

## Contratos intocables
- No cambios a endpoints productivos actuales (`/api/menu`, `/api/order`, auth/rpc actual).
- No cambios a backend operativo Apps Script ni contratos legacy.

## Estrategia de migración
1. V2-0: scaffold + mocks (este PR).
2. V2-1: conectar `/api/menu-v2` con adapter de lectura.
3. V2-2: activar flujo de pedido V2 detrás de flag/ruta paralela.
4. Cutover controlado posterior con rollback inmediato a V1.

## Riesgos
- Divergencia entre mock y datos reales si no se valida contrato temprano.
- Drift visual entre apps V2 si no se centraliza tokens/components.

## Rollback
- Mantener V1 intacta y desplegada.
- V2 se elimina de build/deploy sin impacto en operaciones actuales.

## Qué no cambia todavía
- Producción V1.
- Backend operativo.
- Cloudflare apps en uso actual.
- Legacy y variables de entorno existentes.

## Revisión de futuros PRs V2
- Verificar no-touch zones.
- Exigir compatibilidad con contratos actuales.
- Exigir evidencia de build + typecheck.

## V2-1 public-order mock experience
- `apps/public-order-v2` ahora implementa landing + flujo de pedido mock en una sola página.
- El submit de checkout es simulado localmente y no llama endpoints productivos.

## V2-2 internal-chekeo operator console mock
- `apps/internal-chekeo-v2` evoluciona de placeholder a consola operativa mock con PIN shell, tabs, dashboard, pedidos, cocina, pagos/notas e historial.
- No conecta auth/session/rpc reales ni endpoints productivos; toda la interacción es local mock.
- Acciones (mover estado, marcar listo, cancelar, logout) son simuladas en estado cliente.
- V1 interna y backend operativo permanecen intactos.


## V2-3 componentization + shared UI
- Se componentizan `apps/public-order-v2` e `apps/internal-chekeo-v2` en bloques reutilizables para evitar componentes gigantes.
- Se introduce una capa shared UI en `packages/ui` (Button, Badge, Card, SectionHeader, EmptyState, StatusPill, IconButton).
- Se mantiene comportamiento mock 100% local (sin fetch, sin auth real, sin endpoints productivos).
- No se toca backend operativo, Cloudflare Functions actuales, ni V1/legacy.
- La base queda lista para siguiente fase de integración o deploy preview V2.

## V2-4 safe deploy preview preparation
- Se formaliza workflow de build/preview independiente para `public-order-v2` e `internal-chekeo-v2`.
- Outputs separados para despliegue seguro en preview (`dist/public-order-v2`, `dist/internal-chekeo-v2`).
- Se agrega documentación para configurar 2 proyectos de Cloudflare Pages de preview sin reemplazar producción.
- V2 permanece mock-only: sin `/api/order`, sin `/api/rpc`, sin auth real, sin Sheets, sin D1/R2.
- Confirmación explícita de no-touch en V1, backend operativo, legacy, `BOG_ACTIVE_ENV` y Functions actuales.

## V2-5 live QA polish (2026-05-26)
- Public-order-v2 and internal-chekeo-v2 received UI/UX polish for preview QA only.
- Scope remained mock-only local flows; no backend, V1, or production endpoints were touched.
- Added stronger visual hierarchy, placeholder variants, denser operator layouts, and refined microcopy.

## V2-5.2 final preview polish before real data (2026-05-26)
- Se aplicó polish final de preview enfocado en densidad operativa y legibilidad mobile-first antes de conectar datos reales.
- Continúa 100% mock-only local (sin integración backend, sin endpoints productivos, sin auth real).
- No se modificó V1, backend operativo actual, legacy ni Cloudflare Functions actuales.
- Si QA de screenshots de preview pasa, la siguiente fase habilitada es V2-6 para integración con datos reales.

## V2-8 R2 catalog assets (preview)
- `GET /api/assets-v2/<key>` sirve imágenes same-origin desde el binding R2 `BOG_ASSETS_BUCKET` para catálogo V2.
- Public Order V2 resuelve `imageUrl` seguro o `imageKey` R2 y conserva placeholders visuales si falta o falla la imagen.
- Internal Chekeo V2 permite editar referencias `imageUrl`/`imageKey` de productos; no sube archivos.
- La validación bloquea traversal, backslashes, doble slash, esquemas inseguros y extensiones no permitidas.
- No cambia V1, `/api/order`, `/api/rpc`, Apps Script, Sheets, legacy ni `BOG_ACTIVE_ENV`.

## V2-8.2 Internal catalog image upload (preview)
- Internal Chekeo V2 Catálogo agrega upload protegido por `BOG_MENU_ADMIN_TOKEN` para imágenes de producto.
- `POST /api/menu-v2-admin/items/:sku/image` valida `multipart/form-data`, limita a 5 MB, acepta solo JPG/PNG/WebP/AVIF, guarda en R2 (`BOG_ASSETS_BUCKET`) bajo `menu/` y actualiza D1 (`BOG_MENU_DB`).
- `DELETE /api/menu-v2-admin/items/:sku/image` limpia `image_key`/`image_url` para volver al placeholder y, si hay R2 disponible, intenta borrar el asset previo bajo `menu/`.
- Public Order V2 no sube imágenes: solo lee `imageKey` desde `/api/assets-v2/<key>` y mantiene fallback visual si no hay imagen o si falla la carga.
- Esta fase no conecta órdenes reales, pagos reales, `/api/order`, `/api/rpc`, Apps Script, Sheets, V1 ni producción.

## V2-8.3 Internal promo admin + R2 images (preview)
- Internal Chekeo V2 Catálogo agrega subtab Promos para editar `promo_cards` en D1 con `BOG_MENU_ADMIN_TOKEN`.
- Se agregan endpoints admin protegidos para actualizar promos y subir/quitar imágenes de promo en R2 bajo `promos/`.
- Public Order V2 continúa solo leyendo `/api/menu-v2` y `/api/assets-v2/<key>`; no tiene upload público ni endpoints admin.
- La fase mantiene órdenes reales, pagos reales, `/api/order`, `/api/rpc`, Apps Script, Sheets, V1, legacy y `BOG_ACTIVE_ENV` sin cambios.

## V2-9A D1 orders backend foundation

V2-9A introduce la base backend para órdenes reales V2 en Cloudflare Pages Functions usando D1 como fuente principal. Las órdenes viven en el mismo binding `BOG_MENU_DB` que el catálogo V2 para mantener el preview simple y reversible.

Endpoints paralelos nuevos:
- `POST /api/orders-v2`: crea órdenes V2 con validación server-side de catálogo/precios e idempotencia.
- `GET /api/orders-v2-admin`: lista órdenes reales V2 para consola interna futura.
- `PATCH /api/orders-v2-admin/:id/status`: cambia estados válidos y registra eventos.

Tablas nuevas:
- `orders_v2`
- `order_items_v2`
- `order_events_v2`

Decisiones de control:
- No se reutiliza `/api/order` legacy para V2 inicial.
- No se reutiliza `/api/rpc` legacy para V2 inicial.
- No se conecta Public V2 UI todavía.
- No se conecta Internal V2 UI todavía.
- No se exporta a Sheets todavía.
- No se envía WhatsApp real.
- No se hacen pagos reales.
- No se cambia `BOG_ACTIVE_ENV`.

## V2-9B Public order flow conectado a D1

V2-9B conecta `apps/public-order-v2` al backend real de órdenes V2. El checkout público deja de simular el submit localmente y ahora crea órdenes en D1 mediante `POST /api/orders-v2` con `Idempotency-Key` por intento/draft.

Alcance de la fase:
- Public Order V2 lee catálogo con `GET /api/menu-v2`, imágenes con `GET /api/assets-v2/<key>` cuando existen y crea órdenes con `POST /api/orders-v2`.
- El cliente público envía `customer`, `orderMode`, `paymentMethod`, `notes` e `items` como `{ sku, qty }`.
- El cliente público no envía precios ni total; el backend sigue recalculando subtotal/total desde D1.
- `paymentMethod` representa solo intención de pago; no hay cobro en línea y `payment_status` sigue pendiente desde backend.
- Internal Chekeo V2 todavía no consume órdenes reales en este PR.

No cambia en V2-9B:
- No se reutiliza ni se toca `/api/order` legacy.
- No se reutiliza ni se toca `/api/rpc` legacy.
- No se conectan pagos reales.
- No se envía WhatsApp real.
- No se exporta a Apps Script ni Sheets.
- No se modifica `BOG_ACTIVE_ENV`.

## V2-9C Internal Chekeo V2 conectado a órdenes D1

V2-9C conecta `apps/internal-chekeo-v2` a órdenes reales V2 en D1 para que la consola interna pueda observar y operar pedidos creados desde Public V2.

Alcance de la fase:
- Internal Chekeo V2 consume `GET /api/orders-v2-admin` con token admin y muestra “Pedidos live D1” cuando la carga responde desde Backend V2.
- Pedidos, Cocina e Historial comparten el mismo dataset live y pueden avanzar estados con `PATCH /api/orders-v2-admin/:id/status`.
- Historial solicita terminales con `includeTerminal=true` para listar `delivered` y `cancelled`.
- Si no hay token o falla Backend V2, la consola conserva `mockOrders` como fallback visual/QA y muestra el estado de fallback explícitamente.

No cambia en V2-9C:
- No se reutiliza ni se toca `/api/order` legacy.
- No se reutiliza ni se toca `/api/rpc` legacy.
- No se modifica Public Order V2 ni su submit flow validado.
- No se conectan pagos reales.
- No se envía WhatsApp real.
- No se exporta a Apps Script ni Sheets.
- No se modifica `BOG_ACTIVE_ENV`.

## V2-9D Live orders UX polish/QA

V2-9D pule el flujo live de órdenes V2 sin cambiar arquitectura ni endpoints. La consola interna mantiene D1 como fuente live cuando responde Backend V2 y conserva fallback mock explícito solo para QA visual ante falta de token o error de backend.

Alcance de la fase:
- Internal Chekeo V2 muestra timeline legible para eventos `ORDER_CREATED`, `STATUS_CHANGED` y `ORDER_CANCELLED`, incluyendo actor, cambios de estado y razón cuando existe.
- Pedidos, Cocina e Historial agregan empty states reales para source D1 cuando no hay órdenes activas o terminales.
- Acciones de estado usan copy operativo: “Iniciar preparación”, “Marcar listo”, “Entregar” y “Cancelar”, con error visible si falla el PATCH.
- El modal de detalle mejora teléfono, notas, total, items con precio unitario/subtotal y timeline legible.
- Public Order V2 agrega acciones post-success: “Crear otro pedido” limpia confirmación/form/idempotencia y “Volver al menú” desplaza al menú manteniendo la confirmación visible.

No cambia en V2-9D:
- No se agregan endpoints ni bindings.
- No se modifica `/api/order`, `/api/rpc`, `functions/api`, migrations, Apps Script, Sheets, legacy, `cloudflare/public-order`, `cloudflare/internal-chekeo` ni `BOG_ACTIVE_ENV`.
- No se conectan pagos reales ni WhatsApp real.

## V2-10A.1 Protected orders CSV export

V2-10A.1 adds a protected backend-only CSV export for V2 orders while keeping D1 as the source of truth. The new `GET /api/orders-v2-admin/export.csv` endpoint reads `orders_v2`, `order_items_v2`, and `order_events_v2` from D1 and returns an operational CSV snapshot for manual reporting/import.

Decisions:
- D1 remains the canonical store for V2 orders.
- Sheets is treated only as a manual/export destination, not a source of truth.
- No automatic Sheets sync is introduced in this phase.
- No Apps Script, legacy `/api/order`, legacy `/api/rpc`, Public V2 UI, Internal V2 UI, migrations, payments, WhatsApp, or `BOG_ACTIVE_ENV` are changed.

## V2-10A.2 Internal orders CSV export button

V2-10A.2 adds a minimal Internal Chekeo V2 control to download the protected orders CSV from `GET /api/orders-v2-admin/export.csv`. The UI reuses the shared sessionStorage admin token flow and sends that token only through the `Authorization: Bearer <token>` header.

Decisions:
- Internal Chekeo V2 now exposes an “Exportar CSV” button near the live orders source controls for Pedidos, Cocina, and Historial.
- Export filters are UI-only query params for the existing endpoint: `includeTerminal`, `status`, `from`, `to`, and `limit`.
- D1 remains the source of truth for V2 orders and reporting exports.
- Sheets remains a manual/export destination only; this phase does not add automatic sync, Sheets API calls, or Apps Script.
- No backend endpoints, D1 migrations, legacy `/api/order`, legacy `/api/rpc`, Public V2, payments, WhatsApp, Cloudflare legacy apps, legacy code, or `BOG_ACTIVE_ENV` are changed.

## V2-10B Operational close dashboard

V2-10B adds a read-only operational close/reporting surface for real V2 orders stored in D1.

Architecture additions:
- New protected endpoint `GET /api/orders-v2-admin/summary` in Cloudflare Pages Functions.
- New Internal Chekeo V2 tab `Cierre` for shift close metrics.
- The endpoint reads `orders_v2`, `order_items_v2`, and `order_events_v2` from the existing `BOG_MENU_DB` binding.
- D1 remains the source of truth for operational reporting.
- The CSV export remains a manual output for Sheets/import workflows, not a reporting source of truth.

Reporting rules:
- `grossSales` sums non-cancelled orders.
- `deliveredSales` sums only `delivered` orders.
- `averageTicket` is `grossSales / non-cancelled orders`.
- `paymentMethod` is a declared payment method only; V2-10B does not add real payment capture or reconciliation.
- `topItems` excludes cancelled orders.
- `recentOrders` excludes `customerPhone` and is capped by the endpoint `limit` query param.
- Date filters use the same UTC-boundary behavior as CSV export (`YYYY-MM-DDT00:00:00.000Z` through `YYYY-MM-DDT23:59:59.999Z`); there is no timezone conversion yet.

No-touch confirmations:
- No changes to Public V2 checkout behavior.
- No changes to `/api/order` legacy or `/api/rpc` legacy.
- No Apps Script or Sheets sync is introduced.
- No changes to `cloudflare/public-order`, `cloudflare/internal-chekeo`, legacy code, migrations, payments, WhatsApp, or `BOG_ACTIVE_ENV`.
