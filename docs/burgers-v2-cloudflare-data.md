# Burgers.exe V2 Cloudflare Data Foundation (D1/R2 assets)

> Advertencia: esta fase es **solo preview/mock-safe**. No usar para operación real todavía.

## D1 recomendado
- Nombre: `burgers-exe-menu-v2-preview`
- Binding: `BOG_MENU_DB`
- Crear DB:

```bash
npx wrangler d1 create burgers-exe-menu-v2-preview
```

Usa `wrangler.example.toml` como plantilla local. Si necesitas Wrangler local, copia a `wrangler.toml` y reemplaza `database_id` con el ID real. En Pages preview, configura `BOG_MENU_DB` desde el dashboard.

## Migraciones
- Schema: `migrations/0001_v2_menu_schema.sql`
- Seed: `migrations/0002_v2_menu_seed.sql`

Aplicar local:

```bash
npm run db:v2:migrate:local
npm run db:v2:seed:local
```

Aplicar remoto (preview):

```bash
npm run db:v2:migrate:remote
npm run db:v2:seed:remote
```

## Configurar binding en Cloudflare Pages
En cada proyecto Pages preview:
- `burgers-exe-public-v2-preview`
- `burgers-exe-internal-v2-preview`

Agrega binding D1:
- Variable/binding name: `BOG_MENU_DB`
- Database: `burgers-exe-menu-v2-preview`

## Validar API
Endpoint nuevo:
- `GET /api/menu-v2`

Esperado:
- JSON válido con `categories`, `items`, `promos`, `siteConfig`, `updatedAt`, `source`.
- `source: "d1"` cuando el binding funciona.
- `source: "fallback"` cuando falta binding o hay error de D1.

## Confirmar fallback
Quita temporalmente binding `BOG_MENU_DB` en local/preview y valida que:
- El endpoint responde 200.
- `source` cambia a `fallback`.
- UI pública V2 sigue operativa con catálogo local.

## R2 assets para catálogo V2
- Bucket preview recomendado: `burgers-exe-assets-v2-preview`.
- Binding requerido en Pages Functions: `BOG_ASSETS_BUCKET`.
- Crear bucket:

```bash
npx wrangler r2 bucket create burgers-exe-assets-v2-preview
```

- `wrangler.example.toml` documenta el binding seguro:

```toml
[[r2_buckets]]
binding = "BOG_ASSETS_BUCKET"
bucket_name = "burgers-exe-assets-v2-preview"
```

- Configurar el binding R2 en ambos proyectos Pages preview:
  - `burgers-exe-public-v2-preview`
  - `burgers-exe-internal-v2-preview`
- Después de agregar o cambiar el binding, hacer redeploy del proyecto Pages correspondiente.
- Subir assets por Cloudflare Dashboard o Wrangler; no subir binarios pesados al repo.
- Estructura recomendada de keys:
  - `menu/burger-og.webp`
  - `menu/burger-spicy.webp`
  - `menu/fries-og.webp`
  - `menu/cola-pixel.webp`
  - `promos/combo-og.webp`
  - `promos/spicy-night.webp`

### Endpoint público same-origin
- Endpoint: `GET /api/assets-v2/<key>`.
- Ejemplo: `/api/assets-v2/menu/burger-og.webp`.
- Sirve objetos desde `BOG_ASSETS_BUCKET` con `Cache-Control: public, max-age=3600`.
- Bloquea keys vacías, traversal (`..`), backslashes, doble slash y extensiones no permitidas.
- Extensiones permitidas: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`.
- No lista el bucket y no expone upload público.
- Si falta binding u objeto, responde 404.

### Estrategia de URLs
- `imageUrl` permite rutas same-origin que empiecen con `/` o URLs externas `https://`.
- `imageKey` apunta a R2 y la UI pública lo resuelve a `/api/assets-v2/<key>`.
- Si la imagen falla, la UI mantiene el placeholder visual existente.
- No usar `r2.dev` como estrategia final de producción. Para producción, usar custom domain o continuar sirviendo por Pages Function según la estrategia de cache/seguridad.

## Preview admin de catálogo (V2)
- Endpoint de edición existente: `PATCH /api/menu-v2-admin/items/:sku` (solo preview/internal).
- Nuevos endpoints V2-8.2 para imágenes de catálogo:
  - `POST /api/menu-v2-admin/items/:sku/image` sube una imagen desde Internal Chekeo Catálogo, la guarda en R2 y actualiza D1 (`image_key = <key>`, `image_url = NULL`).
  - `DELETE /api/menu-v2-admin/items/:sku/image` quita la imagen del producto, limpia `image_key`/`image_url` en D1 y activa el placeholder público.
- Requiere binding D1 en `burgers-exe-internal-v2-preview`: `BOG_MENU_DB`.
- Requiere binding R2 en `burgers-exe-internal-v2-preview`: `BOG_ASSETS_BUCKET` para upload; en DELETE es opcional para limpiar D1, pero si existe intenta borrar el objeto R2 actual.
- Requiere secret/env en `burgers-exe-internal-v2-preview`: `BOG_MENU_ADMIN_TOKEN`.
- Si `BOG_MENU_ADMIN_TOKEN`, `BOG_MENU_DB` o el R2 requerido para upload no existe, el endpoint responde `503 { ok:false, error:"Admin disabled" }`.
- Upload usa `multipart/form-data` con un solo campo `file`. Límite máximo: 5 MB. Tipos aceptados: `image/jpeg`, `image/png`, `image/webp`, `image/avif`. No acepta SVG, GIF, data URLs, content-type vacío ni múltiples archivos.
- El key se genera automáticamente bajo `menu/` con SKU normalizado y timestamp, por ejemplo `menu/brg-og-20260528T184000Z.webp`; no se confía en rutas del filename original.
- Al subir una imagen nueva, si existía un `image_key` previo bajo `menu/`, se intenta borrar de R2 sin bloquear la actualización si falla el delete. No se borran URLs externas.
- El flujo UI en Catálogo es: activar token admin en `sessionStorage`, editar producto, seleccionar archivo, `Subir imagen`, confirmar nuevo `imageKey` en la card/lista y validar Public V2 sin redeploy.
- El botón `Quitar imagen / usar placeholder` llama DELETE, limpia referencias en D1 y Public V2 vuelve al placeholder por fallback.
- No hay upload público ni upload desde el cliente público; los endpoints admin son same-origin y requieren `Authorization: Bearer <token>`.
- Después de configurar bindings + secret, hacer redeploy de internal preview.
- Validar con curl/UI del tab Catálogo (Authorization Bearer token).
- Este flujo es solo admin preview; no reemplaza producción final ni conecta órdenes reales.

## V2-8.3 admin de promos con imágenes (preview)
- Internal Chekeo V2 ahora administra promociones desde Catálogo > Promos usando el mismo token admin de productos.
- Endpoints admin nuevos, same-origin y sin CORS:
  - `PATCH /api/menu-v2-admin/promos/:id` edita texto y referencias seguras de asset para una promo existente.
  - `POST /api/menu-v2-admin/promos/:id/image` sube una imagen de promo a R2 y actualiza D1.
  - `DELETE /api/menu-v2-admin/promos/:id/image` quita `asset_image_key`/`asset_image_url` y fuerza placeholder público.
- Requisitos:
  - `BOG_MENU_DB` para leer/actualizar `promo_cards`.
  - `BOG_MENU_ADMIN_TOKEN` para todos los endpoints admin con `Authorization: Bearer <token>`.
  - `BOG_ASSETS_BUCKET` para `POST`; en `DELETE` es opcional y solo se usa para intentar borrar el objeto anterior.
- `PATCH` solo permite campos seguros: `title`, `description`, `badge`, `promoLabel`, `isAvailable`, `isFeatured`, `sortOrder`, `imageUrl`, `imageKey`. No inserta, no borra, no modifica `id`, no toca productos, no toca órdenes.
- Validación de imagen manual:
  - `imageUrl` vacío/null, ruta same-origin que empieza con `/` o URL `https://`.
  - `imageKey` vacío/null o key sin traversal (`..`), backslashes ni doble slash, con extensión `.jpg`, `.jpeg`, `.png`, `.webp` o `.avif`.
- Upload usa `multipart/form-data` con exactamente un campo `file`.
- Límite máximo: 5 MB.
- Tipos aceptados: `image/jpeg`, `image/png`, `image/webp`, `image/avif`.
- Tipos rechazados: SVG, GIF, data URLs, content-type vacío y múltiples archivos.
- Las keys se generan automáticamente bajo el prefijo R2 `promos/`, con ID normalizado + timestamp, por ejemplo `promos/promo-combo-og-20260528T190000Z.jpg`.
- Al subir una nueva imagen, si existía un `asset_image_key` previo bajo `promos/`, se intenta borrar de R2 best-effort sin bloquear la actualización. No se borran URLs externas.
- El botón “Quitar imagen / usar placeholder” limpia referencias en D1 y, si hay bucket, intenta borrar el objeto anterior bajo `promos/`; Public V2 vuelve al placeholder.
- No existe upload público, no hay listado de bucket, no se expone el token y Public V2 solo lee assets desde `/api/assets-v2/<key>`.
- Este flujo sigue siendo preview/admin-only y no conecta órdenes reales, pagos reales, `/api/order`, `/api/rpc`, Apps Script, Sheets, V1 ni producción.

## V2-9A órdenes reales: backend base D1

Esta fase agrega la base backend para órdenes reales V2 sin conectar todavía Public V2 UI ni Internal V2 UI.

### Persistencia
- Fuente principal: D1 usando el binding existente `BOG_MENU_DB`.
- Tablas nuevas:
  - `orders_v2`
  - `order_items_v2`
  - `order_events_v2`
- No se usa Sheets como fuente de órdenes V2 en esta fase.
- No se exporta a Apps Script/Sheets en esta fase.
- No se envía WhatsApp real.
- No hay pagos reales; `payment_status` inicia como `pending`.

### Migración

Local:

```bash
npm run db:v2:orders:migrate:local
```

Remota preview:

```bash
npm run db:v2:orders:migrate:remote
```

Ambos scripts ejecutan `migrations/0003_v2_orders_schema.sql` sobre `burgers-exe-menu-v2-preview`, el D1 usado por `BOG_MENU_DB`.

### Variables y flags
- `BOG_MENU_DB`: requerido para todos los endpoints de órdenes V2.
- `ORDERS_V2_WRITE_ENABLED`: opcional para `POST /api/orders-v2`.
  - Si no existe, la escritura se permite para preview.
  - Si existe y es exactamente `false`, el endpoint responde `ORDERING_DISABLED`.
- `BOG_ORDERS_ADMIN_TOKEN`: token admin opcional para endpoints admin.
- `BOG_MENU_ADMIN_TOKEN`: fallback para endpoints admin si `BOG_ORDERS_ADMIN_TOKEN` no existe.

### Endpoints

#### `POST /api/orders-v2`
- Crea una orden V2 en D1.
- Acepta `Idempotency-Key` por header o `idempotencyKey` en body.
- Si no recibe idempotency key, genera una server-side y la devuelve en la respuesta para facilitar pruebas con curl.
- Recalcula subtotal/total desde `menu_items.price_cents`; no confía en totales del cliente.
- Valida que todos los SKUs existan y estén disponibles.
- Inserta evento `ORDER_CREATED`.

#### `GET /api/orders-v2-admin`
- Lista órdenes V2 desde D1.
- Requiere `Authorization: Bearer <token>`.
- Soporta filtros `status`, `includeTerminal`, `limit`, `from`, `to`.
- Por defecto excluye órdenes terminales (`delivered`, `cancelled`).

#### `PATCH /api/orders-v2-admin/:id/status`
- Cambia estado de una orden V2.
- Requiere `Authorization: Bearer <token>`.
- Transiciones permitidas:
  - `new -> preparing | cancelled`
  - `preparing -> ready | cancelled`
  - `ready -> delivered | cancelled`
  - `delivered` y `cancelled` son terminales.
- Inserta `STATUS_CHANGED` u `ORDER_CANCELLED` en `order_events_v2`.

### No cambia en V2-9A
- No se toca `/api/order` legacy.
- No se toca `/api/rpc` legacy.
- No se toca Apps Script.
- No se tocan Sheets.
- No se toca `BOG_ACTIVE_ENV`.
- No se conecta UI pública o interna todavía.

## V2-9B Public Order V2 escribe órdenes reales

Public Order V2 ahora usa `POST /api/orders-v2` para registrar pedidos reales en D1 durante preview. La UI pública continúa leyendo catálogo desde `GET /api/menu-v2` y assets desde `GET /api/assets-v2/<key>` cuando el catálogo entrega `imageKey`.

### Requisitos de datos
- `BOG_MENU_DB` debe estar configurado en el proyecto de Cloudflare Pages que sirve Public V2.
- Las tablas V2 deben estar migradas en ese D1:
  - `orders_v2`
  - `order_items_v2`
  - `order_events_v2`
- `menu_items` debe contener los SKUs disponibles para que el backend pueda validar disponibilidad y recalcular precios.

### Escritura pública
- Public V2 manda `customer.name`, `customer.phone`, `orderMode`, `paymentMethod`, `notes` e `items` con pares `{ sku, qty }`.
- Public V2 manda `Idempotency-Key` por header para evitar duplicados por doble click, reintentos o fallos recuperables de red.
- Public V2 no manda precios ni total; `POST /api/orders-v2` recalcula subtotal/total desde `menu_items.price_cents`.
- `ORDERS_V2_WRITE_ENABLED=false` apaga la escritura y hace que `POST /api/orders-v2` responda `ORDERING_DISABLED`.

### Límites explícitos
- No hay pagos reales: `paymentMethod` es intención y `payment_status` permanece `pending` hasta una fase posterior.
- No hay WhatsApp real: el texto de confirmación solo indica que el equipo puede contactar por WhatsApp/teléfono si necesita confirmar algo.
- No hay integración con Sheets ni Apps Script para órdenes V2.
- Internal Chekeo V2 todavía no consume estas órdenes reales desde la UI en esta fase.

## V2-9C Internal Chekeo V2 live orders

Internal Chekeo V2 usa los endpoints admin de órdenes V2 para leer y operar pedidos reales en D1 desde preview.

### Token admin
- La consola interna requiere un token admin guardado solo en `sessionStorage` durante la sesión del navegador.
- El backend valida `BOG_ORDERS_ADMIN_TOKEN` y puede usar `BOG_MENU_ADMIN_TOKEN` como fallback operativo según la configuración existente de Functions.
- El token se reutiliza con el flujo admin del Catálogo para evitar guardar credenciales duplicadas o exponerlas en Public V2.

### Endpoints usados
- `GET /api/orders-v2-admin?includeTerminal=<bool>&limit=<n>` lista órdenes D1 con items/eventos para Pedidos, Cocina e Historial.
- `PATCH /api/orders-v2-admin/:id/status` actualiza estados válidos y registra el evento de cambio.

### Comportamiento de datos
- Pedidos y Cocina cargan órdenes activas (`new`, `preparing`, `ready`) para operación diaria.
- Historial carga con `includeTerminal=true&limit=50` para incluir `delivered` y `cancelled`.
- Si falta token o Backend V2 falla, Internal V2 mantiene `mockOrders` como fallback visual/QA y muestra error explícito.

### Límites explícitos
- No hay llamadas a `/api/order` ni `/api/rpc` desde Internal V2.
- No hay pagos reales ni cambios a estado de pago automático.
- No hay WhatsApp real.
- No hay integración con Apps Script ni Sheets para órdenes V2.

## V2-9D Live orders polish data note

V2-9D no agrega endpoints, tablas, migrations ni bindings de Cloudflare. El flujo se mantiene sobre los endpoints existentes de órdenes D1 V2:
- `POST /api/orders-v2`
- `GET /api/orders-v2-admin`
- `PATCH /api/orders-v2-admin/:id/status`

La consola interna sigue usando D1 orders mediante Backend V2 y token admin compartido en `sessionStorage`; Public V2 sigue creando órdenes con `Idempotency-Key`. No se modifica `/api/order`, `/api/rpc`, Apps Script, Sheets, legacy, `cloudflare/public-order`, `cloudflare/internal-chekeo`, pagos, WhatsApp ni `BOG_ACTIVE_ENV`.

## V2-10A.1 Protected orders CSV export

V2-10A.1 adds a read-only CSV export endpoint for operational reporting from D1 orders. D1 remains the source of truth; Sheets can consume the downloaded CSV manually, but there is no automatic Sheets sync and no Apps Script integration.

### Endpoint

#### `GET /api/orders-v2-admin/export.csv`
- Returns `text/csv; charset=utf-8` with `Content-Disposition: attachment; filename="orders-v2-export.csv"`.
- Requires `Authorization: Bearer <token>`.
- Uses the same admin token behavior as the V2 admin order endpoints: `BOG_ORDERS_ADMIN_TOKEN`, with fallback to `BOG_MENU_ADMIN_TOKEN`.
- Requires the existing `BOG_MENU_DB` binding.
- Does not require new bindings.
- Reads from `orders_v2`, `order_items_v2`, and `order_events_v2`.
- Does not update orders, insert events, write Apps Script, or sync Sheets.

### Query params

| Param | Default | Behavior |
| --- | --- | --- |
| `includeTerminal` | `false` | When false, excludes `delivered` and `cancelled`; when true, includes terminal orders. |
| `status` | omitted | Optional filter: `new`, `preparing`, `ready`, `delivered`, or `cancelled`. Invalid values return `400 INVALID_STATUS`. |
| `from` | omitted | Optional `YYYY-MM-DD`; filters `created_at >= fromT00:00:00.000Z`. Invalid values return `400 INVALID_DATE`. |
| `to` | omitted | Optional `YYYY-MM-DD`; filters `created_at <= toT23:59:59.999Z`. Invalid values return `400 INVALID_DATE`. |
| `limit` | `500` | Integer from 1 to 1000. Invalid values return `400 INVALID_LIMIT`. |

Timestamps are exported exactly as stored in D1; no timezone conversion is performed in this phase.

### CSV contract

Headers are emitted exactly in this order:

```csv
folio,order_id,created_at,updated_at,status,customer_name,customer_phone,order_mode,payment_method,payment_status,notes,subtotal,total,items_summary,item_skus,item_qtys,event_count,source
```

Column notes:
- `subtotal` and `total` are exported in pesos with two decimals.
- `items_summary` is formatted like `2x Burger OG; 1x Fries OG`.
- `item_skus` joins SKUs with `|`.
- `item_qtys` joins quantities with `|` in the same order as `item_skus`.
- `event_count` is the number of related `order_events_v2` records.
- Empty notes export as an empty string.

### Security and CSV safety

The endpoint:
- Requires admin authorization and returns JSON error envelopes for failures.
- Uses `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.
- Escapes CSV values with RFC-style double quote escaping.
- Prefixes string values that start with `=`, `+`, `-`, `@`, tab, or carriage return with an apostrophe to reduce CSV/Excel formula injection risk.

### No changes in V2-10A.1

V2-10A.1 does not change Public V2, Internal V2, `/api/order`, `/api/rpc`, Apps Script, Sheets, legacy code, `cloudflare/public-order`, `cloudflare/internal-chekeo`, migrations, payments, WhatsApp, or `BOG_ACTIVE_ENV`.

## V2-10A.2 Internal CSV export usage

Internal Chekeo V2 can trigger the existing protected CSV export from the operator UI. Operators must first activate admin mode; the browser then reads the shared sessionStorage admin token and sends it only as `Authorization: Bearer <token>` when calling `GET /api/orders-v2-admin/export.csv`.

The Internal UI can send these query params to the existing endpoint:
- `includeTerminal`: defaults to `false` in Pedidos/Cocina and `true` in Historial.
- `status`: optional status filter (`new`, `preparing`, `ready`, `delivered`, `cancelled`) or omitted for all statuses.
- `from` and `to`: optional `YYYY-MM-DD` date filters.
- `limit`: defaults to `500` and is blocked in the UI outside the backend-supported `1..1000` range.

Cloudflare/data impact:
- No new bindings are required.
- D1 remains the source of truth for orders.
- Sheets remains a manual destination for downloaded/imported CSV files.
- No automatic Sheets sync, Apps Script, Sheets API integration, backend change, migration, Public V2 change, legacy `/api/order`, legacy `/api/rpc`, payments, WhatsApp, Cloudflare legacy app, or `BOG_ACTIVE_ENV` change is introduced.

## V2-10B Operational close summary endpoint

V2-10B adds a read-only admin summary endpoint for shift close/reporting from real V2 orders in D1.

### Endpoint

#### `GET /api/orders-v2-admin/summary`
- Requires `BOG_MENU_DB`.
- Requires `Authorization: Bearer <token>` using the same admin-token behavior as other V2 order admin endpoints (`BOG_ORDERS_ADMIN_TOKEN`, with fallback to `BOG_MENU_ADMIN_TOKEN`).
- Reads from `orders_v2`, `order_items_v2`, and `order_events_v2`.
- Does not update orders, insert events, write Apps Script, sync Sheets, or require migrations.
- Non-GET methods return `405 METHOD_NOT_ALLOWED`.

### Query params

| Param | Default | Max | Behavior |
| --- | --- | --- | --- |
| `from` | omitted | — | Optional `YYYY-MM-DD`; filters `created_at >= fromT00:00:00.000Z`. |
| `to` | omitted | — | Optional `YYYY-MM-DD`; filters `created_at <= toT23:59:59.999Z`. |
| `includeTerminal` | `true` | — | When false, excludes `delivered` and `cancelled` from the summary dataset. |
| `limit` | `1000` | `5000` | Caps `recentOrders`. |
| `topLimit` | `10` | `50` | Caps `topItems`. |

Invalid dates return `400 INVALID_DATE`; `from > to` returns `400 INVALID_DATE_RANGE`. Invalid limits return `400 INVALID_LIMIT` or `400 INVALID_TOP_LIMIT`.

### Metrics

The summary response includes:
- Totals: orders, active orders, delivered orders, cancelled orders, gross sales, delivered sales, average ticket.
- `byStatus`: counts for `new`, `preparing`, `ready`, `delivered`, `cancelled`.
- `byPaymentMethod`: declared payment method counts/totals; these are not real payment confirmations.
- `byOrderMode`: pickup vs delivery counts/totals.
- `topItems`: SKU/name/quantity/total/orders, excluding cancelled orders.
- `recentOrders`: latest orders for the selected range, without `customerPhone`.
- `durations`: average seconds for `new -> ready` and `new -> delivered` derived from `order_events_v2`.

All money values are returned in pesos, not cents. Date filters use UTC boundaries and V2-10B does not perform timezone conversion.

### Internal Cierre tab

Internal Chekeo V2 adds a `Cierre` tab that calls `GET /api/orders-v2-admin/summary` with the selected range and shows:
- “Cierre operativo preview”.
- “D1 source of truth”.
- “Pagos declarados, no pagos reales”.
- Range filters, include-terminal toggle, close metrics, status/payment/mode breakdowns, top items, recent orders, and average times.
- “Exportar CSV del rango”, which reuses the existing protected CSV export with the same date/include-terminal filters.

The Cierre tab does not use mock fallback; missing token or backend errors are shown explicitly.

### No changes in V2-10B

V2-10B does not change Public V2, `/api/order`, `/api/rpc`, Apps Script, Sheets sync, `cloudflare/public-order`, `cloudflare/internal-chekeo`, legacy code, migrations, payments, WhatsApp, or `BOG_ACTIVE_ENV`. Sheets remains a manual destination for downloaded CSV files only.

## V2-11A Manual WhatsApp data policy

V2-11A no agrega superficie de datos en Cloudflare. Las acciones de WhatsApp manual en Internal Chekeo V2 son completamente client-side:

- El teléfono se normaliza en el navegador para construir un link `wa.me` manual.
- El mensaje se arma en memoria desde los datos de la orden ya cargados en Internal Chekeo V2.
- “WhatsApp” abre una pestaña nueva con mensaje prellenado; no confirma ni envía el mensaje automáticamente.
- “Copiar mensaje” usa `navigator.clipboard.writeText` y no persiste el contenido.
- No hay nuevas tablas, columnas, migraciones, eventos D1 ni escrituras asociadas al mensaje.
- No hay llamadas a WhatsApp API, Sheets API, Apps Script ni servicios externos.
- No se introducen tokens, secrets ni bindings nuevos.
- D1 permanece como source of truth para órdenes; Sheets continúa siendo solo destino manual/export cuando aplica.
- Los pagos siguen siendo declarados/operativos; no hay pagos reales ni captura de pago.

## V2-11B Manual payment/notes operations

V2-11B adds one protected write endpoint for manual payment operations on real V2 orders in D1. D1 remains the source of truth for Internal V2, operational close, and CSV export.

#### `PATCH /api/orders-v2-admin/:id/payment`

- Requires `BOG_MENU_DB`.
- Requires `Authorization: Bearer <admin token>` using the existing admin token check.
- Accepts only `PATCH`.
- Updates `orders_v2.payment_status` to `pending`, `paid`, or `cancelled`.
- Optionally replaces the existing `orders_v2.notes` value, capped at 500 characters.
- Accepts optional `reason`, capped at 200 characters.
- Inserts `PAYMENT_UPDATED` into `order_events_v2` after the update path succeeds.
- Returns the updated order bundle with items/events like the other admin order endpoints.

Request body:

```json
{
  "paymentStatus": "pending",
  "notes": "Nota operativa opcional",
  "reason": "Motivo operativo opcional"
}
```

Error behavior:

- Missing D1 binding returns `503 D1_NOT_CONFIGURED`.
- Invalid admin token returns `401 UNAUTHORIZED`.
- Invalid payment status returns `400 INVALID_PAYMENT_STATUS`.
- Missing order returns `404 ORDER_NOT_FOUND`.
- Non-`PATCH` methods return `405 METHOD_NOT_ALLOWED`.
- Unexpected write/read failures return `500 PAYMENT_UPDATE_FAILED`.

Audit event shape:

```json
{
  "type": "PAYMENT_UPDATED",
  "actor": "internal-v2",
  "detail_json": {
    "previousPaymentStatus": "pending",
    "nextPaymentStatus": "paid",
    "notesUpdated": true,
    "reason": "Pago operativo manual: paid",
    "source": "internal-v2"
  }
}
```

### Manual-only payment policy

This endpoint does not charge money, does not call external APIs, does not integrate a payment gateway, does not sync Sheets/App Script, and does not change Public V2. `payment_status` is a manual/operator-declared field for food-ordering operations. Existing close and CSV flows reflect the latest value because both read from `orders_v2`.
