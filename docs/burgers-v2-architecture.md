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

## V2-11A Manual WhatsApp order actions

V2-11A agrega acciones manuales de WhatsApp en Internal Chekeo V2 para órdenes reales operadas desde D1.

Alcance:

- Internal Chekeo V2 muestra acciones compactas “WhatsApp” y “Copiar mensaje” en tarjetas de pedido y en el modal de detalle.
- La acción “WhatsApp” solo abre un deep link `https://wa.me/<phone>?text=<mensaje>` en una pestaña nueva con mensaje prellenado.
- La acción “Copiar mensaje” usa el portapapeles del navegador y muestra estado inline de éxito o error.
- El modal permite elegir templates operativos: Recibido, En preparación, Listo y Entregado.
- El template default se deriva del status de la orden; `cancelled` usa el copy seguro de entregado/seguimiento y no introduce copy de cancelación.

Privacidad y seguridad:

- No hay envío automático de WhatsApp.
- No se integra WhatsApp Business/API ni proveedores externos.
- No se guarda el mensaje en D1, no se insertan eventos y no se llama ningún endpoint para estas acciones.
- No se loguea teléfono ni mensaje.
- No se agregan pagos reales.
- D1 sigue siendo source of truth para órdenes; WhatsApp manual es una acción local del navegador.

No cambia en V2-11A:

- No cambia backend (`functions/api/**`).
- No cambia Public Order V2.
- No cambia `/api/order` legacy ni `/api/rpc` legacy.
- No cambia Apps Script, Sheets, legacy, migrations, Cloudflare legacy apps, pagos reales, WhatsApp real API ni `BOG_ACTIVE_ENV`.

## V2-11B Pagos/Notas operativo manual

V2-11B convierte la tab `Pagos` de Internal Chekeo V2 en una vista operativa sobre órdenes reales V2 en D1. La consola usa el mismo token admin y consume `GET /api/orders-v2-admin` para listar órdenes y `PATCH /api/orders-v2-admin/:id/payment` para actualizar manualmente `payment_status` y, opcionalmente, `notes`.

El comportamiento es estrictamente operativo/manual:

- `payment_status` es declarado por operador: `pending`, `paid` o `cancelled`.
- No se realiza ningún cobro real ni cobro en línea.
- No se integra Stripe, MercadoPago, terminal bancaria ni payment provider.
- No se modifica `status`, total, items, customer data ni folio de la orden.
- D1 sigue siendo source of truth para órdenes, cierre y CSV.
- No hay sync automático con Sheets/App Script.

Cada actualización exitosa inserta un evento `PAYMENT_UPDATED` en `order_events_v2` con `actor: internal-v2`, `previousPaymentStatus`, `nextPaymentStatus`, `notesUpdated`, `reason` y `source: internal-v2` en `detail_json`. Si falla el update operativo no debe quedar evento de auditoría exitoso.

## V2-11C Cancelación manual con razón

V2-11C cambia la UX de cancelación en Internal Chekeo V2 para que ninguna acción “Cancelar” cambie directo el status. La consola abre un modal de cancelación, muestra folio y cliente, exige una razón real obligatoria y después llama el endpoint de status existente con `status=cancelled` y `reason`.

Comportamiento:

- Presets operativos: Cliente canceló, Sin stock, Pago no confirmado, Pedido duplicado, Error de captura y Otro.
- La razón es editable, requerida, con mínimo 3 caracteres y máximo 200 caracteres; “Otro” exige texto manual útil.
- La UI muestra “Cancelando…”, deshabilita acciones mientras actualiza y renderiza errores inline, sin `alert()`.
- En D1, Internal V2 usa `PATCH /api/orders-v2-admin/:id/status`; no se agregó endpoint nuevo.
- En fallback mock, la cancelación se simula solo en UI y se muestra el notice “Cancelación actualizada en fallback mock”.

Auditoría y vistas:

- El `reason` se guarda en el evento de status que devuelve Backend V2 y el timeline lo muestra como `Razón: <razón>`.
- El evento `STATUS_CHANGED` conserva `previousStatus` y `nextStatus`.
- Las órdenes `cancelled` dejan de aparecer en Pedidos/Cocina porque son terminales.
- Las órdenes `cancelled` aparecen en Historial, Cierre y CSV porque D1 sigue siendo source of truth y las consultas/exportaciones leen `status=cancelled`.
- Historial muestra la última razón de cancelación cuando existe en el timeline y no muestra teléfono.

No cambia en V2-11C:

- No cambia backend ni endpoints.
- No cambia Public V2.
- No cambia `/api/order` legacy ni `/api/rpc` legacy.
- No se agregan pagos reales.
- No se agrega WhatsApp API ni envío automático.
- No se agrega Sheets/App Script ni sync automático.
- No cambia legacy, Cloudflare legacy apps, migrations ni `BOG_ACTIVE_ENV`.

## V2-12 hardening pre-producción Internal/Public V2

V2-12 estabiliza las apps preview antes de continuar hacia producción sin agregar features de negocio.

Alcance aplicado:

- Internal Chekeo V2 queda envuelto por un `ErrorBoundary` de app para evitar pantalla blanca ante errores visuales inesperados.
- El fallback muestra “Algo falló en Internal V2” y un botón “Recargar”, sin exponer stack traces, headers, tokens ni detalles técnicos al usuario.
- Se revisó el copy operativo para reforzar que pagos son declarados/manuales y que no se realiza ningún cobro en línea.
- WhatsApp permanece como acción manual del navegador; no hay envío automático ni WhatsApp API.
- Public Order V2 conserva el flujo actual: submit deshabilitado mientras envía, errores inline recuperables, idempotency key por draft y limpieza de idempotencia después de success.
- El payload público sigue enviando solo `sku`/`qty` por item; precios y total se calculan/confirmán en Backend V2 desde D1.

No cambia en V2-12:

- No cambia API ni contratos de endpoints.
- No cambia schema ni migraciones.
- No cambia V1/legacy, `/api/order`, `/api/rpc`, Apps Script, Sheets sync, Cloudflare legacy apps ni `BOG_ACTIVE_ENV`.
- No se agregan pagos reales, providers de pago, WhatsApp API ni sync automático.
- D1 sigue siendo source of truth; Sheets sigue siendo export manual cuando aplica.

## V2-13 cutover readiness runbook

V2-13 adds documentation-only cutover readiness guidance for moving from preview V2 toward pilot/pre-production/production usage without executing the cutover in this PR. The runbook covers Cloudflare bindings/secrets, smoke tests, manual UI QA, cutover options, phased rollout, rollback, data reconciliation, known limitations, and go/no-go checks.

See [Burgers.exe V2 cutover readiness runbook](./burgers-v2-cutover-runbook.md).

## Fase 1 Public official order flow (2026-05-31)

- Public Order V2 deja de ser un formulario largo y opera con flujo público **Menú → Ordenar → Checkout**.
- La app abre en Menú con identidad Burgers.exe dark premium: negro profundo, verde neón como acento, glow sutil, cards modernas y copy orientado a ordenar comida.
- La carga inicial muestra una capa brandeada con wordmark Burgers.exe; transiciones internas usan estados de terminal y respetan `prefers-reduced-motion`.
- Menú muestra únicamente secciones operativas visibles al cliente: Combos, Hamburguesas, Guarniciones y Bebidas. Los extras no aparecen como productos principales; solo se ofrecen dentro del panel de ordenar por burger.
- Ordenar permite seleccionar `1 hamburguesa`, `2 hamburguesas` o `3 hamburguesas`; estas opciones representan cantidad de unidades, no tamaño ni cantidad de carne. `2 hamburguesas`/`3 hamburguesas` generan unidades separadas (`lineKey` distinto) para que cada burger sea editable de forma independiente.
- Personalización por unidad: ingredientes derivados del producto real editables excepto pan, extras reales del catálogo por burger, nota opcional por burger y guarnición obligatoria para combos; las burgers normales permanecen sin guarnición dentro del panel y cualquier guarnición se agrega aparte desde Menú con su propio SKU/precio.
- Checkout queda separado con pasos desbloqueables: ticket, datos cliente, ubicación/pago y confirmar. La ubicación visible al cliente está limitada a Torre GGA y Torre Valcob.
- Para compatibilidad interna el payload conserva `orderMode` hacia `/api/orders-v2`, pero la UI no muestra pickup/delivery ni tipo de envío.
- D1 sigue siendo source of truth para catálogo, precios base y creación de orden; el frontend no envía precios finales confiables.
- No se agregan productos, extras, guarniciones ni ubicaciones fuera de lo disponible en catálogo/config existente.
- No se toca Internal V2, legacy, `/api/order`, `/api/rpc`, Apps Script, Sheets sync, pagos reales, WhatsApp API ni `BOG_ACTIVE_ENV`.

## V2-14 Public gamer order UX refinement

V2-14 refina Public Order V2 después de PR #179 sin tocar backend ni contratos.

Alcance UX:

- Public V2 conserva identidad Burgers.exe con dark premium, acentos neón y microinteracciones sutiles, pero reduce el lenguaje visual de terminal/consola.
- El flujo público visible queda como `Menú → Ordenar → Checkout`.
- `Ordenar` ya no es una página aparte ni queda incrustado al fondo del menú: se abre como drawer/modal accesible sobre la experiencia de Menú al seleccionar una burger o combo.
- Checkout sigue siendo sección separada para ticket, datos del cliente, ubicación, pago y confirmación.
- Extras no se muestran como sección principal del menú; se mantienen como customización por burger dentro del panel de ordenar.
- Guarniciones usan únicamente productos reales de la categoría `guarniciones`: son obligatorias dentro de combos; las burgers normales no muestran selector interno de guarnición y dirigen a agregar guarniciones aparte para conservar precio propio.

No cambia en V2-14:

- No cambia backend, schema, endpoints, `/api/order`, `/api/rpc`, Apps Script, Sheets sync, pagos reales, WhatsApp API ni `BOG_ACTIVE_ENV`.
- No cambia Internal V2, legacy ni Cloudflare legacy apps.
- Las customizaciones por item siguen enviando `lineKey`, `itemDisplayIndex`, `itemKind`, `removedIngredients`, `extras`, `burgerNote` y `garnish` en el snapshot público V2; `garnish` solo aplica dentro de combos, mientras una guarnición suelta viaja como línea `itemKind=garnish`.

## V2 Public Order navigation UX after PR #180

- Public Order V2 keeps the menu as the primary browsing surface, but burger/combo customization now opens in an accessible order drawer/bottom sheet instead of rendering inline inside the menu.
- The order drawer uses `role="dialog"`, `aria-modal`, an `aria-labelledby` product header, a visible close button, Escape-to-close behavior, and focus return to the opener where possible.
- The drawer has a sticky header with the selected product name and a sticky footer with the builder state/total plus the primary CTA “Confirmar al ticket”, so users do not need to scroll to the bottom of a long builder.
- `1 hamburguesa`, `2 hamburguesas` y `3 hamburguesas` remain separate unit builders. The UI states “Vas a pedir 2 hamburguesas. Cada una se puede editar por separado.” / “Vas a pedir 3 hamburguesas. Cada una se puede editar por separado.” and adds “No cambia el tamaño ni la carne; solo la cantidad.” near the quantity buttons. Each editor is labeled `Burger OG #1`, `Burger OG #2`, etc. Ticket lines stay separate and show unit pricing.
- Burger extras, removed ingredients, and per-burger notes stay scoped to each unit. Extras are operational kitchen customizations in the current pricing contract; the drawer total mirrors ticket/checkout by using catalog SKU base prices only. Pan remains included and non-editable.
- Combos keep mandatory garnish selection inside the combo and validate inline when garnish is missing.
- The guided flow header keeps the secondary “Regresar” control sticky at the top with safe-area spacing so step-by-step navigation remains visible on mobile without competing with the bottom primary CTA.
- Normal burgers do not persist `garnish` internally and the burger editor no longer shows an internal garnish selector or redundant garnish microcopy. The persistent “Continuar” CTA advances to the guarniciones step, where guarniciones can be added as separate menu products with their own SKU/price (`itemKind="garnish"`).
- Primary products (burgers/combos) use “Ordenar” with neon primary styling. Simple products (guarniciones, bebidas, otros) use “Agregar” with a distinct amber/outline treatment.
- A persistent floating ticket/cart is available once the cart has items, showing item count, total, and a checkout CTA while respecting mobile safe-area insets. The drawer footer also exposes ticket access when ordering with an existing cart.
- Checkout remains a separate section with the same four steps: Ticket, Datos, Ubicación y pago, Confirmar. It is visually more compact, keeps persistent labels, inline errors, optional general note, and limits location choices to Torre GGA / Torre Valcob; pickup/delivery is not exposed to the user.
- No backend, `/api/order`, `/api/rpc`, Apps Script, Sheets sync, real payments, WhatsApp API, Internal V2, legacy, `packages/config`, or `BOG_ACTIVE_ENV` changes are part of this UX update.

## V2-10 Public Order kiosko McDonald's-style flow (2026-06-01)

- Public Order V2 ahora inicia en un menú visual tipo kiosko: categorías Hamburguesas, Combos, Guarniciones y Bebidas, con cards de exploración solamente.
- Las cards del menú no abren builder ni agregan productos; abren un modal informativo con nombre, imagen si existe, descripción, precio, disponibilidad y cierre accesible.
- Se agrega un CTA persistente y mobile-first que respeta safe-area y cambia de copy según el paso: Ordenar, Continuar, Ir a checkout y Confirmar pedido.
- El flujo guiado pregunta primero “¿Qué quieres ordenar?” y solo muestra opciones con productos reales disponibles en `menuData.items`; Combo aparece únicamente si hay combos reales como `menu_items`.
- La cantidad se mantiene como selección de `1 hamburguesa`, `2 hamburguesas` o `3 hamburguesas`, crea unidades separadas editables y usa copy explícito: “Vas a pedir 1 hamburguesa editable.” / “Vas a pedir 2 hamburguesas. Cada una se puede editar por separado.” / “Vas a pedir 3 hamburguesas. Cada una se puede editar por separado.”
- Cada unidad de burger/combo mantiene edición individual de ingredientes removibles, extras operativos para cocina y nota opcional; el pan sigue no editable.
- Después de editar se agrega un paso de guarniciones opcionales. “No quiero guarnición · Saltar guarniciones” permite ir a checkout sin agregar extras.
- Si el usuario pidió burger normal, cualquier guarnición extra elegida se agrega como línea separada `itemKind="garnish"` con precio propio; no se guarda como `garnish` dentro de la burger.
- Si el usuario pidió combo, cada combo exige una guarnición incluida antes de continuar; esa guarnición se guarda dentro del combo. Las guarniciones elegidas en el paso posterior se agregan como líneas separadas con precio propio.
- Checkout conserva ticket, datos, ubicación Torre GGA/Torre Valcob, pago y confirmación. No se muestra pickup/delivery al usuario aunque el payload backend conserva el modo operativo interno existente.
- No hubo cambios de backend: no se tocaron `functions/api/**`, `/api/order`, `/api/rpc`, Apps Script, Sheets sync, pagos reales, WhatsApp API, `BOG_ACTIVE_ENV`, Internal V2, legacy ni paquetes de configuración.

### Pendiente futuro

- Fase futura: reducir microcopy/texto innecesario una vez validado el flujo operativo.

## V2 Public quest kiosk shell (2026-06-01)

- Public Order V2 usa una shell pública tipo quest/kiosko con secciones `Menu`, `Main Quest`, `Workbench`, `Side Quest`, `Checkout` y `Success` separadas.
- La primera pantalla siempre es `Menu`: hero visual Burgers.exe, cards grandes del catálogo real y banners de `promos`/concursos si `/api/menu-v2` los expone como disponibles.
- No hay tabs Menú/Checkout ni checkout vacío; el header superior solo muestra `Burgers.exe` y el indicador `Ticket: X items · $total`.
- `Menu` no muestra extras ni agrega productos. Las cards abren un modal informativo accesible con datos reales de D1 y assets existentes vía `imageUrl`, `imageKey` y `/api/assets-v2`.
- `Main Quest` pregunta qué se ordenará y filtra productos reales disponibles por tipo inferido del catálogo; `Combo` solo aparece si existe en `menuData.items`.
- `Workbench` personaliza cada unidad con cantidad `[-] x1 [+]` hasta x3; x2/x3 son unidades separadas, no tamaño. `MOD` significa quitar ingredientes; `UPGRADE` significa extras reales del catálogo. Los combos también permiten MOD/UPGRADE y exigen guarnición incluida por unidad.
- `Side Quest` solo maneja guarniciones extra opcionales desde D1; si se agregan, viajan como líneas separadas `itemKind="garnish"` con precio propio.
- `Checkout` solo renderiza con `cart.length > 0`, muestra loadout/ticket, datos cliente, ubicación limitada a Torre GGA/Torre Valcob, pago, total y CTA `EJECUTAR PEDIDO`.
- `Success` está separado del checkout y `NUEVA QUEST` limpia confirmación, ticket, cliente e idempotencia antes de regresar a `Menu`.
- La shell conserva enfoque mobile-first, controles táctiles mínimos de 44px, foco visible, modal con `role="dialog"`/`aria-modal` y soporte `prefers-reduced-motion`.
- `Main Quest` solo renderiza opciones seleccionables para productos reales disponibles en `menuData.items`: `availableBurgerItems` para hamburguesas y `availableComboItems` para combos. Si no existen combos reales como `menu_items`, la opción `Combo` se oculta y cualquier selección stale se limpia.
- Las `promoCards`/promos/concursos del `Menu` siguen siendo banners informativos; no se convierten en productos ordenables ni generan SKUs de combo inventados.

## Fase 2 Internal Cocina y Side Quest checklist (2026-06-01)

- Internal V2 Cocina opera sobre órdenes reales D1 cuando existe token admin; el fallback mock queda solo como vista visual y muestra aviso de que los estados no se persisten en D1.
- Cocina lee las customizaciones desde `order_items_v2.snapshot_json` expuestas como `OrderV2Item.snapshot`: `lineKey`, `itemDisplayIndex`, `itemKind`, `removedIngredients`, `extras`, `burgerNote`, `garnish` y `extrasTotalCents`.
- La vista Cocina deja de usar la tarjeta administrativa pesada: no muestra teléfono, pago, WhatsApp, source, export CSV ni acciones de pago; muestra folio, cliente, ubicación extraída de `notes`, burgers/combos por unidad, MOD, UPGRADE, nota por burger, guarnición incluida de combo y nota general.
- Las líneas `itemKind="burger"` y `itemKind="combo"` se muestran como acordeones de preparación. La primera burger pendiente abre por default; al marcarla hecha queda verde, se repliega y se abre la siguiente pendiente. Si todas están hechas, la orden muestra `Burgers listas`.
- Side Quest es una subvista separada para guarniciones extra: solo líneas `itemKind="garnish"`. La guarnición incluida de combo se renderiza dentro del combo y no entra como pendiente de Side Quest.
- Burgers/combos y guarniciones extra tienen checklist independiente. Marcar una burger hecha no marca guarniciones, y marcar una guarnición hecha no cambia burgers.
- El checklist por item se persiste sin migración ni tabla nueva usando eventos en `order_events_v2`: `KITCHEN_ITEM_DONE` y `KITCHEN_ITEM_REOPENED` con `detail_json={ lineKey, itemKind, source: "internal-v2" }`.
- Internal deriva el estado por item desde eventos: el último evento del `lineKey` gana. No hay auto-ready; el estado de orden `ready` sigue siendo una acción manual existente.
