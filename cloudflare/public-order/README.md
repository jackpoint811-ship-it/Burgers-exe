# Burgers.exe Public Order (Cloudflare Pages Functions)

## Runtime actual
Este frontend público usa **Cloudflare Pages + Pages Functions**:

- Sitio vanilla mobile-first en `cloudflare/public-order/index.html`, `styles.css` y `app.js`.
- Endpoints Pages Functions en `cloudflare/public-order/functions/api/*`.
- `GET /api/menu` lee el Live Menu desde **Cloudflare D1** (`BOG_MENU_DB`).
- R2 (`BOG_MENU_ASSETS`) queda configurado para imágenes/assets del menú; la tabla guarda `image_key` y puede exponer `image_url` cuando exista dominio público o endpoint de assets.

El menú público ya no consulta Google Sheets ni Apps Script en runtime. Apps Script sigue existiendo únicamente como upstream de escritura de pedidos mientras se migra persistencia de órdenes.

## Contrato de `GET /api/menu`
Respuesta exitosa:

```json
{
  "ok": true,
  "source": "d1",
  "burgers": [],
  "sides": [],
  "extras": [],
  "data": {
    "burgers": [],
    "sides": [],
    "guarniciones": [],
    "extras": [],
    "all": []
  },
  "warnings": [],
  "timestamp": "2026-06-02T00:00:00.000Z"
}
```

Cada item incluye:

```json
{
  "menu_item_id": "OG",
  "sku": "OG",
  "item_type": "Burger",
  "name": "OG",
  "description": "...",
  "price_cents": 8500,
  "price": 85,
  "image_url": "",
  "image_key": "menu/OG.png"
}
```

## Contrato de envío público
`POST /api/order` acepta líneas separadas:

```json
{
  "payload": {
    "customerName": "Ada",
    "phone": "5512345678",
    "location": "Torre GGA",
    "paymentMethod": "Pago mismo dia",
    "note": "",
    "order_items": [
      { "menu_item_id": "OG", "item_type": "Burger", "quantity": 1, "unit_price_cents": 8500 },
      { "menu_item_id": "PAPAS_OG", "item_type": "Guarnicion", "quantity": 2, "unit_price_cents": 2000 },
      { "menu_item_id": "EXTRA_TOCINO", "item_type": "Extra", "quantity": 2, "unit_price_cents": 500 }
    ],
    "personalizations": {
      "burgers": [
        { "sku": "OG", "burgerIndex": 1, "without": [], "extras": ["Tocino", "Tocino"], "extras_qty": { "EXTRA_TOCINO": 2 } }
      ]
    }
  }
}
```

El endpoint recalcula precios desde D1 y rechaza diferencias con `PRICE_MISMATCH`.

## SQL creado

- `migrations/0006_public_live_menu_d1_schema.sql`
  - Crea `menu_categories` y `menu_items` si no existen.
  - Añade columnas compatibles con MENU_LIVE (`origin_cost_ref`, `updated_by`) para bases nuevas.
  - Crea `order_items` line-oriented para futura persistencia D1 de órdenes públicas.
  - Crea índices por categoría/disponibilidad/orden, SKU y líneas de pedido.
- `migrations/0007_public_live_menu_seed.sql`
  - Inserta las burgers, guarniciones y extras de `MENU_LIVE` con `price_cents`.

> Nota: si tu D1 ya tenía `menu_items` de v2, SQLite no agrega columnas con `CREATE TABLE IF NOT EXISTS`. El runtime no depende de `origin_cost_ref` ni `updated_by`; si quieres conservar esos metadatos en una DB existente, agrega una migración `ALTER TABLE` separada.

## Crear recursos Cloudflare

```bash
npx wrangler d1 create burgers-exe-menu-live
npx wrangler r2 bucket create burgers-exe-menu-assets
```

Después de crear D1, copia el `database_id` real y reemplaza `REPLACE_WITH_D1_DATABASE_ID` en `cloudflare/public-order/wrangler.toml` o configúralo en el dashboard/entorno de Pages.

## Aplicar migraciones y seed

Local:

```bash
npm run public-order:d1:migrate:local
npm run public-order:d1:seed:local
```

Remoto:

```bash
npm run public-order:d1:migrate:remote
npm run public-order:d1:seed:remote
```

## Correr localmente en Codespaces

```bash
npm install
npm run public-order:d1:migrate:local
npm run public-order:d1:seed:local
npm run public-order:dev
```

> Wrangler Pages lee `wrangler.toml` desde el directorio del proyecto Pages; por eso `public-order:dev` entra a `cloudflare/public-order` antes de iniciar. Si reemplazaste `database_id` en `wrangler.toml`, ajusta también el valor del flag `--d1 BOG_MENU_DB=<database_id>` en `package.json` para que `pages dev` use la misma D1 local.

Luego abre la URL local de Wrangler y verifica:

```bash
curl http://127.0.0.1:8788/api/menu
```

## QA manual

- [ ] `GET /api/menu` responde `ok: true`, `source: d1`, y contiene `burgers`, `sides`, `extras`.
- [ ] En la pantalla MENÚ se ven burgers, guarniciones y extras desde D1.
- [ ] En GUARNICIONES se puede seleccionar `2 Papas OG`, `1 Aros de Cebolla`, `1 Papas Lemon&Pepper`.
- [ ] En EXTRAS se puede seleccionar `2 Tocino` y `1 Queso americano` para una burger.
- [ ] El resumen muestra cada guarnición como línea independiente con cantidad y subtotal.
- [ ] El total se calcula con `price_cents` de D1.
- [ ] Al enviar, DevTools muestra `payload.order_items[]` con líneas separadas.
- [ ] A 320px de ancho no hay overflow horizontal.
- [ ] Si se rompe o desconfigura D1, el MENÚ muestra estado de error con botón Reintentar y no queda en blanco.

## Riesgos / deuda técnica

- Las imágenes en R2 quedan configuradas por binding y `image_key`, pero falta definir la estrategia final de entrega pública (`/api/assets`, custom domain o URLs firmadas).
- La escritura de pedidos continúa pasando por Apps Script; `order_items` queda listo para migrar persistencia pública a D1 en una fase posterior.
- El contrato legacy `items` sigue viajando por compatibilidad con Apps Script; el contrato nuevo autoritativo es `order_items`.
