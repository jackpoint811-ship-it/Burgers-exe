# Burgers.exe V2 Cloudflare Data Foundation (D1/R2 assets)

> Nota histórica: las secciones de fases preview anteriores conservan su contexto original. La configuración oficial de producción vigente está documentada abajo en `Official Cloudflare Pages production configuration`.


## Official Cloudflare Pages production configuration

### Public Pages project

- URL: <https://burgers-exe.pages.dev>
- Build command: `npm run build:public`
- Output directory: `dist/public-order-v2`
- Root directory: repo root / empty

Required bindings:

- `BOG_MENU_DB`
- `BOG_MENU_ASSETS`

Optional:

- `ORDERS_V2_WRITE_ENABLED`

Not required:

- `BOG_INTERNAL_PIN`
- Admin tokens
- Apps Script secrets

### Internal Pages project

- URL: <https://chekeo2-0.pages.dev>
- Build command: `npm run build:internal`
- Output directory: `dist/internal-chekeo-v2`
- Root directory: repo root / empty

Required bindings/secrets:

- `BOG_MENU_DB`
- `BOG_MENU_ASSETS`
- `BOG_INTERNAL_PIN`

Not required:

- `BOG_ORDERS_ADMIN_TOKEN`
- `BOG_MENU_ADMIN_TOKEN`
- Authorization Bearer
- Apps Script secrets

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
- Binding requerido en Pages Functions: `BOG_MENU_ASSETS`.
- Crear bucket:

```bash
npx wrangler r2 bucket create burgers-exe-assets-v2-preview
```

- `wrangler.example.toml` documenta el binding seguro:

```toml
[[r2_buckets]]
binding = "BOG_MENU_ASSETS"
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
- Sirve objetos desde `BOG_MENU_ASSETS` con `Cache-Control: public, max-age=3600`.
- Bloquea keys vacías, traversal (`..`), backslashes, doble slash y extensiones no permitidas.
- Extensiones permitidas: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`.
- No lista el bucket y no expone upload público.
- Si falta binding u objeto, responde 404.

### Estrategia de URLs

- `imageKey` apunta a R2 y la UI pública lo resuelve a `/api/assets-v2/<key>`.
- `imageKey` tiene prioridad sobre `imageUrl` para que los objetos R2 del catálogo real sean same-origin.
- `imageUrl` permite rutas same-origin que empiecen con `/` o URLs externas `https://` sin credenciales cuando no hay `imageKey` válido.
- Si la imagen falla, la UI mantiene el placeholder visual existente.
- No usar `r2.dev` como estrategia final de producción. Para producción, usar custom domain o continuar sirviendo por Pages Function según la estrategia de cache/seguridad.

## Producción: assets reales de menú en R2

El bucket oficial de catálogo es `burgers-exe-menu-assets` y el binding de Pages Functions debe mantenerse como `BOG_MENU_ASSETS`. Public Order V2 no lee el bucket directamente desde el navegador: los productos con `image_key` en D1 se resuelven en la UI como URLs same-origin bajo `/api/assets-v2/<image_key>`; por ejemplo, `menu/OG.png` se solicita como `/api/assets-v2/menu/OG.png`.

### Subir assets con Wrangler

No subas binarios pesados al repositorio. Guarda los archivos fuente localmente o en el flujo operativo de diseño, y súbelos al bucket R2 con keys que coincidan con D1:

```bash
npx wrangler r2 object put burgers-exe-menu-assets/menu/OG.png --file ./assets/menu/OG.png
```

Ejemplos para el catálogo actual:

```bash
npx wrangler r2 object put burgers-exe-menu-assets/menu/BBQ.png --file ./assets/menu/BBQ.png
npx wrangler r2 object put burgers-exe-menu-assets/menu/PAPAS_OG.png --file ./assets/menu/PAPAS_OG.png
npx wrangler r2 object put burgers-exe-menu-assets/menu/PAPAS_ESPECIALES.png --file ./assets/menu/PAPAS_ESPECIALES.png
npx wrangler r2 object put burgers-exe-menu-assets/menu/PAPAS_LEMON_PEPPER.png --file ./assets/menu/PAPAS_LEMON_PEPPER.png
npx wrangler r2 object put burgers-exe-menu-assets/menu/AROS_CEBOLLA.png --file ./assets/menu/AROS_CEBOLLA.png
npx wrangler r2 object put burgers-exe-menu-assets/menu/EXTRA_TOCINO.png --file ./assets/menu/EXTRA_TOCINO.png
```

### Reglas de seguridad del endpoint público

- Endpoint: `GET /api/assets-v2/<key>`.
- Bucket usado por el endpoint: `env.BOG_MENU_ASSETS`.
- No lista objetos, no acepta uploads públicos y solo permite `GET`.
- Responde `404` si falta el binding, el objeto no existe o la key es inválida.
- Bloquea traversal (`..`), backslashes, segmentos vacíos, doble slash, caracteres fuera de `A-Z`, `a-z`, `0-9`, `.`, `_`, `-`, `/`, y extensiones no permitidas.
- Extensiones permitidas: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`.
- La UI prefiere `imageKey` sobre `imageUrl`; si `imageKey` existe y es válido, siempre solicita `/api/assets-v2/<image_key>`.
- `imageUrl` solo se usa como fallback cuando es una ruta same-origin segura (`/...`, no `//...`) o una URL `https://` sin credenciales.
- Si la imagen no existe en R2 o falla al cargar, la tarjeta conserva el placeholder visual y no rompe el layout.

### QA obligatorio post-deploy

1. Verificar que `/api/menu-v2` devuelve `source: "d1"` e incluye `imageKey` para los SKUs reales:

   ```bash
   curl -s https://burgers-exe.pages.dev/api/menu-v2 | python3 -c 'import json,sys; data=json.load(sys.stdin); items={item["sku"]: item for item in data["items"]}; assert data["source"]=="d1", data["source"]; assert items["OG"].get("imageKey")=="menu/OG.png", items["OG"]; print("OK", data["source"], items["OG"]["imageKey"])'
   ```

2. Verificar que el asset same-origin responde con tipo de imagen cuando ya fue subido:

   ```bash
   curl -I https://burgers-exe.pages.dev/api/assets-v2/menu/OG.png
   ```

3. Abrir Public Order V2 en DevTools Network y confirmar que la UI intenta cargar `/api/assets-v2/menu/OG.png` para el producto `OG`.
4. Probar temporalmente una key válida que no exista en R2; debe responder `404` y la tarjeta debe seguir mostrando el placeholder sin colapsar.
5. Probar viewport mobile de `320px` de ancho; no debe haber overflow horizontal en tarjetas, promos, diálogo de detalle ni CTA persistente.
6. Continuar solo hasta checkout para QA visual; no modificar `BOG_ACTIVE_ENV`, no activar escritura real de pedidos y no ejecutar flujos que creen órdenes reales salvo rollout separado.

## Preview admin de catálogo (V2)

- Endpoint de edición existente: `PATCH /api/menu-v2-admin/items/:sku` (solo preview/internal).
- Nuevos endpoints V2-8.2 para imágenes de catálogo:
  - `POST /api/menu-v2-admin/items/:sku/image` sube una imagen desde Internal Chekeo Catálogo, la guarda en R2 y actualiza D1 (`image_key = <key>`, `image_url = NULL`).
  - `DELETE /api/menu-v2-admin/items/:sku/image` quita la imagen del producto, limpia `image_key`/`image_url` en D1 y activa el placeholder público.
- Requiere binding D1 en `burgers-exe-internal-v2-preview`: `BOG_MENU_DB`.
- Requiere binding R2 en `burgers-exe-internal-v2-preview`: `BOG_MENU_ASSETS` para upload; en DELETE es opcional para limpiar D1, pero si existe intenta borrar el objeto R2 actual.
- Requiere login interno con `BOG_INTERNAL_PIN`; los endpoints admin aceptan únicamente la cookie HttpOnly `bog_internal_session` creada por `/api/internal-v2-auth/login`.
- Si `BOG_INTERNAL_PIN`, `BOG_MENU_DB` o el R2 requerido para upload no existe, el endpoint responde `503 { ok:false, error:{ code:"AUTH_NOT_CONFIGURED", message:"Internal auth is not configured." } }` o el error de binding correspondiente.
- Upload usa `multipart/form-data` con un solo campo `file`. Límite máximo: 5 MB. Tipos aceptados: `image/jpeg`, `image/png`, `image/webp`, `image/avif`. No acepta SVG, GIF, data URLs, content-type vacío ni múltiples archivos.
- El key se genera automáticamente bajo `menu/` con SKU normalizado y timestamp, por ejemplo `menu/brg-og-20260528T184000Z.webp`; no se confía en rutas del filename original.
- Al subir una imagen nueva, si existía un `image_key` previo bajo `menu/`, se intenta borrar de R2 sin bloquear la actualización si falla el delete. No se borran URLs externas.
- El flujo UI en Catálogo es: iniciar sesión, editar producto, seleccionar archivo, `Subir imagen`, confirmar nuevo `imageKey` en la card/lista y validar Public V2 sin redeploy.
- El botón `Quitar imagen / usar placeholder` llama DELETE, limpia referencias en D1 y Public V2 vuelve al placeholder por fallback.
- No hay upload público ni upload desde el cliente público; los endpoints admin son same-origin y requieren cookie HttpOnly de sesión interna.
- Después de configurar bindings + `BOG_INTERNAL_PIN`, hacer redeploy de internal preview.
- Validar desde la UI del tab Catálogo después de iniciar sesión con PIN interno.
- Este flujo es solo admin preview; no reemplaza producción final ni conecta órdenes reales.

## V2-8.3 admin de promos con imágenes (preview)

- Internal Chekeo V2 ahora administra promociones desde Catálogo > Promos usando la misma sesión interna HttpOnly de productos.
- Endpoints admin nuevos, same-origin y sin CORS:
  - `PATCH /api/menu-v2-admin/promos/:id` edita texto y referencias seguras de asset para una promo existente.
  - `POST /api/menu-v2-admin/promos/:id/image` sube una imagen de promo a R2 y actualiza D1.
  - `DELETE /api/menu-v2-admin/promos/:id/image` quita `asset_image_key`/`asset_image_url` y fuerza placeholder público.
- Requisitos:
  - `BOG_MENU_DB` para leer/actualizar `promo_cards`.
  - `BOG_INTERNAL_PIN` como único secreto de Internal V2; crea la cookie HttpOnly `bog_internal_session` después del login.
  - `BOG_MENU_ASSETS` para `POST`; en `DELETE` es opcional y solo se usa para intentar borrar el objeto anterior.
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
- No existe upload público, no hay listado de bucket, no se expone ninguna credencial y Public V2 solo lee assets desde `/api/assets-v2/<key>`.
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
- `BOG_INTERNAL_PIN`: único secreto de Internal V2; firma la cookie HttpOnly de sesión y valida el login PIN.
- No configurar credenciales adicionales para Internal V2; no hay fallback operativo a otros secretos.

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
- Requiere cookie HttpOnly `bog_internal_session` válida.
- Soporta filtros `status`, `includeTerminal`, `limit`, `from`, `to`.
- Por defecto excluye órdenes terminales (`delivered`, `cancelled`).

#### `PATCH /api/orders-v2-admin/:id/status`

- Cambia estado de una orden V2.
- Requiere cookie HttpOnly `bog_internal_session` válida.
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

### Sesión interna por PIN

- La consola interna requiere login PIN y mantiene sesión en cookie HttpOnly durante la sesión operativa.
- El backend valida únicamente la cookie `bog_internal_session`, firmada con `BOG_INTERNAL_PIN`.
- La sesión se reutiliza con el flujo del Catálogo para evitar credenciales duplicadas o exponer acceso en Public V2.

### Endpoints usados

- `GET /api/orders-v2-admin?includeTerminal=<bool>&limit=<n>` lista órdenes D1 con items/eventos para Pedidos, Cocina e Historial.
- `PATCH /api/orders-v2-admin/:id/status` actualiza estados válidos y registra el evento de cambio.

### Comportamiento de datos

- Pedidos y Cocina cargan órdenes activas (`new`, `preparing`, `ready`) para operación diaria.
- Historial carga con `includeTerminal=true&limit=50` para incluir `delivered` y `cancelled`.
- Si falta credencial o Backend V2 falla, Internal V2 mantiene `mockOrders` como fallback visual/QA y muestra error explícito.

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

La consola interna sigue usando D1 orders mediante Backend V2 y sesión interna por cookie HttpOnly; Public V2 sigue creando órdenes con `Idempotency-Key`. No se modifica `/api/order`, `/api/rpc`, Apps Script, Sheets, legacy, `cloudflare/public-order`, `cloudflare/internal-chekeo`, pagos, WhatsApp ni `BOG_ACTIVE_ENV`.

## V2-10A.1 Protected orders CSV export

V2-10A.1 adds a read-only CSV export endpoint for operational reporting from D1 orders. D1 remains the source of truth; Sheets can consume the downloaded CSV manually, but there is no automatic Sheets sync and no Apps Script integration.

### Endpoint

#### `GET /api/orders-v2-admin/export.csv`

- Returns `text/csv; charset=utf-8` with `Content-Disposition: attachment; filename="orders-v2-export.csv"`.
- Requires a valid HttpOnly `bog_internal_session` cookie.
- Uses the same Internal V2 session behavior as the V2 admin order endpoints: PIN login creates an HttpOnly cookie, and requests use `credentials: include`.
- Requires the existing `BOG_MENU_DB` binding.
- Does not require new bindings.
- Reads from `orders_v2`, `order_items_v2`, and `order_events_v2`.
- Does not update orders, insert events, write Apps Script, or sync Sheets.

### Query params

| Param             | Default | Behavior                                                                                                               |
| ----------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `includeTerminal` | `false` | When false, excludes `delivered` and `cancelled`; when true, includes terminal orders.                                 |
| `status`          | omitted | Optional filter: `new`, `preparing`, `ready`, `delivered`, or `cancelled`. Invalid values return `400 INVALID_STATUS`. |
| `from`            | omitted | Optional `YYYY-MM-DD`; filters `created_at >= fromT00:00:00.000Z`. Invalid values return `400 INVALID_DATE`.           |
| `to`              | omitted | Optional `YYYY-MM-DD`; filters `created_at <= toT23:59:59.999Z`. Invalid values return `400 INVALID_DATE`.             |
| `limit`           | `500`   | Integer from 1 to 1000. Invalid values return `400 INVALID_LIMIT`.                                                     |

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

Internal Chekeo V2 can trigger the existing protected CSV export from the operator UI. Operators must first sign in; the browser sends the HttpOnly session cookie with `credentials: include` when calling `GET /api/orders-v2-admin/export.csv`.

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
- Requires a valid HttpOnly `bog_internal_session` cookie using the same Internal V2 session behavior as other V2 order admin endpoints.
- Reads from `orders_v2`, `order_items_v2`, and `order_events_v2`.
- Does not update orders, insert events, write Apps Script, sync Sheets, or require migrations.
- Non-GET methods return `405 METHOD_NOT_ALLOWED`.

### Query params

| Param             | Default | Max    | Behavior                                                                   |
| ----------------- | ------- | ------ | -------------------------------------------------------------------------- |
| `from`            | omitted | —      | Optional `YYYY-MM-DD`; filters `created_at >= fromT00:00:00.000Z`.         |
| `to`              | omitted | —      | Optional `YYYY-MM-DD`; filters `created_at <= toT23:59:59.999Z`.           |
| `includeTerminal` | `true`  | —      | When false, excludes `delivered` and `cancelled` from the summary dataset. |
| `limit`           | `1000`  | `5000` | Caps `recentOrders`.                                                       |
| `topLimit`        | `10`    | `50`   | Caps `topItems`.                                                           |

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

The Cierre tab does not use mock fallback; missing credencial or backend errors are shown explicitly.

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
- No se introducen credenciales, secrets ni bindings nuevos.
- D1 permanece como source of truth para órdenes; Sheets continúa siendo solo destino manual/export cuando aplica.
- Los pagos siguen siendo declarados/operativos; no hay pagos reales ni captura de pago.

## V2-11B Manual payment/notes operations

V2-11B adds one protected write endpoint for manual payment operations on real V2 orders in D1. D1 remains the source of truth for Internal V2, operational close, and CSV export.

#### `PATCH /api/orders-v2-admin/:id/payment`

- Requires `BOG_MENU_DB`.
- Requires a valid HttpOnly `bog_internal_session` cookie using the Internal V2 session check.
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
- Missing or invalid internal session cookie returns `401 UNAUTHORIZED`.
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

## V2-11C cancellation reason data contract

V2-11C does not add a new Cloudflare endpoint or D1 migration. Internal Chekeo V2 reuses the existing protected status endpoint:

- `PATCH /api/orders-v2-admin/:id/status`
- Payload: `{ "status": "cancelled", "reason": "<operator reason>" }`
- Auth: existing admin bearer credencial.

Data behavior:

- D1 remains the source of truth for V2 orders.
- The cancellation reason is stored in the status-change event detail (`detail.reason`) returned with the order timeline.
- `STATUS_CHANGED` events continue to carry `previousStatus` and `nextStatus` for auditability.
- `orders_v2.status = cancelled` is enough for Cierre totals and CSV export; no endpoint changes are required.
- Historial reads the timeline and displays the latest cancellation reason when present.

Explicit non-goals:

- No new D1 tables or migrations.
- No Public V2 changes.
- No legacy `/api/order` or `/api/rpc` changes.
- No Apps Script, Sheets sync, payment provider, real payments, WhatsApp API, Cloudflare legacy app, legacy code, or `BOG_ACTIVE_ENV` changes.

## V2-12 hardening pre-producción de datos y seguridad

V2-12 no introduce cambios de API, schema, bindings ni migraciones. La estabilización se limita a frontend preview y documentación operativa.

Confirmaciones de data flow:

- D1 (`BOG_MENU_DB`) sigue siendo source of truth para menú, órdenes, cierre y CSV.
- Public V2 crea órdenes mediante `POST /api/orders-v2` sin enviar precios ni total desde el frontend; solo envía `sku` y `qty` por item.
- Internal V2 opera órdenes/cierre/export con endpoints admin existentes usando únicamente la cookie HttpOnly de sesión interna.
- No se usa `localStorage`/`sessionStorage` para credenciales internas; logout limpia la cookie HttpOnly y no se imprimen secretos en consola ni se mandan por query string.
- CSV y Sheets siguen siendo procesos manuales/export; no hay sync automático con Sheets ni Apps Script.
- Pagos siguen siendo estados declarados (`pending`, `paid`, `cancelled`) sobre D1. No hay cobro real, Stripe, MercadoPago ni provider de pagos.
- WhatsApp sigue siendo deep link/manual en navegador. No hay WhatsApp Business/API ni envío automático.

No-touch V2-12:

- No se modifican `functions/api/**`, migraciones, legacy, Cloudflare legacy apps, Apps Script, Sheets ni `BOG_ACTIVE_ENV`.
- No se modifica `/api/order` legacy ni `/api/rpc` legacy.

## Fase 1 Public customizations snapshot (2026-05-31)

- `POST /api/orders-v2` acepta clientes existentes con items `{ sku, qty }` y clientes nuevos con customizaciones por item.
- Las customizaciones se guardan en `order_items_v2.snapshot_json`; no requiere migración ni cambio de schema.
- Campos operativos por item personalizado:
  - `sku`, `name`, `qty`
  - `lineKey` estable
  - `itemDisplayIndex`
  - `itemKind`: `burger | combo | garnish | drink | other`
  - `removedIngredients: string[]`
  - `extras: Array<{ sku?: string, name: string, price?: number }>`
  - `burgerNote?: string`
  - `garnish?: { sku?: string, name: string } | null`
- El backend sigue validando SKU/disponibilidad y recalculando precio base desde D1 `menu_items.price_cents`.
- Los extras se persisten como customización operativa. En esta fase no se suman al total porque no hay contrato D1 confiable para precio de extras por unidad en el endpoint público; no se inventan precios.
- La ubicación Torre GGA/Torre Valcob viaja en `notes` para conservar compatibilidad sin migración; `orderMode` se mantiene solo como campo interno requerido por el contrato actual.
- No hay integración nueva con pagos reales, WhatsApp API, Apps Script ni Sheets sync.

### Fase 1 correction — customizations validation

- `POST /api/orders-v2` now rejects custom extras or combo garnishes without `sku` as `400 INVALID_CUSTOMIZATIONS`.
- Extra SKUs are loaded from D1 and must exist, be available, and belong to `category_key='extras'` before being persisted in `snapshot_json`.
- Garnish SKUs are loaded from D1 and must exist, be available, and belong to `category_key='guarniciones'` before being persisted in `snapshot_json`.
- Snapshot extras/garnish are rewritten from D1 name/category/price data; client-sent names and prices are not trusted.
- Extras remain operational customizations in the snapshot and still do not increase totals until a dedicated real pricing contract for extras is configured.

## Public quest kiosk data contract (2026-06-01)

- Public Order V2 sigue leyendo catálogo únicamente desde `GET /api/menu-v2`: `categories`, `items`, `promos`, `siteConfig`, `updatedAt` y `source`.
- No se hardcodean productos, precios, extras, guarniciones, promos, concursos ni assets. Las imágenes se resuelven con `imageUrl` seguro o `imageKey` vía `/api/assets-v2` usando el R2 existente (`BOG_MENU_ASSETS`).
- Las promos/concursos de la primera pantalla salen de `menuData.promos`; si no hay promos disponibles, la sección se oculta.
- Los extras no aparecen en `Menu`; solo se ofrecen como `UPGRADE` dentro de `Workbench` y deben existir como `menu_items.category_key = 'extras'` disponibles en D1.
- `POST /api/orders-v2` valida cada extra por SKU contra D1, exige categoría `extras` y disponibilidad, normaliza nombre/precio desde D1 y guarda el arreglo normalizado en `snapshot_json`.
- El backend suma el precio real de extras al `line_total_cents` y al total de la orden desde D1; no confía en precios enviados por el frontend.
- Las guarniciones incluidas de combo se validan contra D1 como categoría `guarniciones` y se guardan dentro del snapshot del combo. Las guarniciones de `Side Quest` viajan como líneas separadas con su propio SKU/precio.
- Los combos ordenables deben existir como registros reales disponibles en `menuData.items`/D1 `menu_items`; `promoCards` no se transforman en líneas de pedido.

## Fase 2 kitchen item checklist sobre D1 events (2026-06-01)

- No se agrega migración, tabla ni columna nueva para cocina. La persistencia del checklist usa `order_events_v2`.
- `order_items_v2.snapshot_json` es el contrato operativo para cocina: Internal V2 lee de ahí `lineKey`, `itemDisplayIndex`, `itemKind`, `removedIngredients`, `extras`, `burgerNote`, `garnish` y `extrasTotalCents`.
- MOD corresponde a `removedIngredients`; UPGRADE corresponde a `extras`; la nota por burger corresponde a `burgerNote`.
- Las guarniciones extra se identifican por `itemKind="garnish"`. La guarnición incluida de un combo viaja como `garnish` dentro del snapshot del combo y no debe duplicarse como Side Quest pendiente.
- Endpoint admin protegido: `PATCH /api/orders-v2-admin/:id/kitchen-item` con cookie HttpOnly `bog_internal_session`.
- Payload válido: `{ "lineKey": string, "itemKind": "burger" | "combo" | "garnish", "done": boolean }`.
- Validaciones del endpoint: orden existente, `lineKey` requerido, `itemKind` permitido, `done` boolean, `lineKey` presente dentro de `order_items_v2.snapshot_json` de esa orden y coincidencia contra `snapshot.itemKind` cuando exista.
- Si `done=true`, se inserta `type="KITCHEN_ITEM_DONE"`; si `done=false`, se inserta `type="KITCHEN_ITEM_REOPENED"`. Ambos eventos usan `detail_json={ lineKey, itemKind, source: "internal-v2" }` y actor `internal-v2`.
- El endpoint no cambia `orders_v2.status`, no marca `ready` automáticamente y no toca pagos, WhatsApp, Sheets sync, Apps Script, `/api/order` ni `/api/rpc`.
- La lectura admin de órdenes incluye los eventos de la orden para que Internal pueda restaurar el checklist después de recargar; el último evento por `lineKey` define si ese item está hecho o pendiente.

## Internal V2 auth/session (Fase 3)

- Configurar `BOG_INTERNAL_PIN` en Cloudflare Pages para el PIN humano de Internal Chekeo V2.
- No existe credencial admin adicional: `/api/orders-v2-admin*` y `/api/menu-v2-admin*` se protegen únicamente con la cookie HttpOnly `bog_internal_session` firmada con `BOG_INTERNAL_PIN`.
- Endpoints nuevos:
  - `POST /api/internal-v2-auth/login` recibe `{ "pin": "..." }`, valida únicamente contra `BOG_INTERNAL_PIN`, y crea `bog_internal_session` sin devolver secretos.
  - `GET /api/internal-v2-auth/status` devuelve solo `authenticated: true/false`.
  - `POST /api/internal-v2-auth/logout` limpia la cookie.
- La cookie `bog_internal_session` es `HttpOnly`, `SameSite=Lax`, `Path=/`, dura 12 horas y usa `Secure` en HTTPS; por diseño el frontend no puede leerla ni copiar credenciales a storage.
- No guardar ni commitear valores reales de `BOG_INTERNAL_PIN` en el repo. Para rotar acceso, cambiar `BOG_INTERNAL_PIN` y redeploy.

## Fase 4A — D1 raffle_campaigns_v2

La migración `migrations/0004_v2_raffles_schema.sql` crea `raffle_campaigns_v2`:

- `id TEXT PRIMARY KEY`
- `title TEXT NOT NULL`
- `description TEXT`
- `rules_text TEXT`
- `banner_image_key TEXT`
- `banner_image_url TEXT`
- `starts_at TEXT`
- `ends_at TEXT`
- `is_active INTEGER NOT NULL DEFAULT 0`
- `ticket_per_burger INTEGER NOT NULL DEFAULT 1`
- `ticket_per_referral INTEGER NOT NULL DEFAULT 2`
- timestamps `created_at` y `updated_at`

Índices:

- `idx_raffle_campaigns_active`
- `idx_raffle_campaigns_dates`

Puede haber campañas históricas, pero Public V2 usa solo una campaña activa. Cuando Chekeo activa una campaña, las demás se desactivan en la misma operación. No existe tabla de tickets todavía: el resumen se calcula desde `orders_v2` y `order_items_v2`.

### Cálculo de tickets desde D1

`GET /api/raffles-v2-admin/summary` toma la campaña activa o `campaignId`, filtra órdenes `new`, `preparing`, `ready` y `delivered`, excluye `cancelled`, y cuenta `qty * ticket_per_burger` solo cuando `snapshot_json.itemKind` es `burger` o `combo`. Guarniciones, bebidas y otros no suman. Si falta `itemKind`, no se infiere ni se cuenta en Fase 4A.

Los participantes se agrupan por `customer_phone` normalizado. La respuesta usa `customerPhoneMasked`; la búsqueda puede usar teléfono completo, normalizado o últimos 4 dígitos, pero el teléfono completo nunca se devuelve a Chekeo.

`BOG_INTERNAL_PIN` sigue siendo el único secret Internal V2 y la sesión admin usa cookie HttpOnly `bog_internal_session`. No se agregan tokens administrativos, bearer auth headers, WhatsApp API, pagos reales nuevos ni Sheets sync. Referidos quedan para Fase 4B e imagen brandeada/WhatsApp para Fase 4C.

## D1 Fase 4B — Referidos de sorteos

La migración `migrations/0005_v2_raffles_referrals_schema.sql` agrega dos tablas operativas:

### `raffle_referral_codes_v2`

Guarda un código por participante y campaña:

- `campaign_id` referencia `raffle_campaigns_v2(id)`.
- `owner_phone` se guarda normalizado para deduplicar por campaña; las APIs admin devuelven `ownerPhoneMasked`.
- `code` es único por campaña y se genera en backend desde nombre + palabra burger permitida + número 1–100.
- `is_active` permite desactivar códigos sin borrar campañas ni participantes.

Índices: campaña, código, owner, unique `(campaign_id, code)` y unique `(campaign_id, owner_phone)`.

### `raffle_referrals_v2`

Guarda el pedido referido cuando Public V2 crea una orden con código aceptado:

- `campaign_id` referencia `raffle_campaigns_v2(id)`.
- `referral_code_id` referencia `raffle_referral_codes_v2(id)`.
- `referred_order_id` referencia `orders_v2(id)` y es único para evitar doble referido por orden.
- `status` puede ser `pending`, `valid` o `invalid`.
- `tickets_awarded` usa `ticket_per_referral` de la campaña activa, default 2.
- `invalid_reason` se requiere al invalidar desde Chekeo.

Regla de conteo: `pending` y `valid` suman referral tickets; `invalid` no suma. No se borran campañas ni órdenes: se invalidan referidos cambiando status.

Public V2 nunca bloquea una orden por código inválido, self-referral o falla aislada del referido. Si el teléfono referido coincide con `owner_phone`, no se crea ticket de referido.

## Fase 4C — Datos y persistencia de imagen brandeada

Fase 4C no agrega tablas, migraciones ni endpoints. La imagen de tickets se genera en el navegador de Chekeo V2 con Canvas nativo desde el summary administrativo y los códigos de invitado ya cargados en el panel.

No existe upload a R2, no existe tabla D1 de imágenes y no se persisten blobs generados. `wa.me` se usa solo para abrir WhatsApp con texto encoded; no hay WhatsApp API ni envío automático. La descarga del PNG queda en el dispositivo del operador para adjuntarse manualmente.

Los datos permitidos en la imagen son: nombre del participante, `customerPhoneMasked`, campaña, total tickets, burger tickets, referral tickets, código de invitado solo si existe un match seguro y único por nombre normalizado + teléfono enmascarado, último folio, último pedido y fecha/hora de generación. El teléfono completo no se devuelve ni se pinta en el canvas. Si el match no es seguro o es ambiguo, el canvas muestra el fallback “solicita tu código en Burgers.exe”.

La validación final del sorteo sigue dependiendo de D1 y de las reglas operativas: órdenes canceladas no cuentan, `pending`/`valid` suman referidos e `invalid` no suma. La imagen incluye el aviso “Tickets sujetos a validación final.”

## Fase 4D — Public order raffle reward response

`CreateOrderV2Response.data` now remains backward-compatible and may include these optional fields only when there is an active raffle campaign:

- `customerReferralCode`: the buyer's own shareable code for the active campaign. It never includes `owner_phone` or full phone data.
- `activeRaffleTitle`: display title for the active raffle.
- `earnedTickets`: `{ burgerTickets, referralUsedTickets, totalTickets }`, informational for the just-created order only.

Operational rules:

- `POST /api/orders-v2` first creates the real order and then performs raffle success enrichment.
- If `raffle_referral_codes_v2` already has a row for `(campaign_id, owner_phone)`, the existing `code` is reused.
- If no owner row exists, the endpoint attempts to insert a new active row with normalized `owner_name`, normalized `owner_phone`, safe burger word and number 1–100. Collisions on `code` are retried; a concurrent insert for the same owner returns the owner row when it appears.
- Failures in customer code generation or earned-ticket calculation do not block order creation and do not change order totals or payment rules. Safe telemetry may be written to `order_events_v2`.
- Burger tickets are calculated from `order_items_v2.snapshot_json.itemKind`; only `burger` and `combo` count. If `itemKind` is unavailable or unsafe, that line is not counted rather than inferred.
- `referralCode` sent from Checkout is the inviter code used by the buyer. `customerReferralCode` returned in Success is the buyer's own code to share.
- Referral tickets from a used checkout code belong to the owner of that code, not to the buyer; therefore `earnedTickets.referralUsedTickets` is 0 in this response.
- No full phone, WhatsApp API, tokens, bearer auth, admin token envs, Sheets sync or legacy endpoints are involved.
