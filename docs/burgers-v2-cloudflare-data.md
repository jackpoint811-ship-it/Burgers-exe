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
