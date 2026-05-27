# Burgers.exe V2 Cloudflare Data Foundation (D1/R2 prep)

> Advertencia: esta fase es **solo preview/mock-safe**. No usar para operación real todavía.

## D1 recomendado
- Nombre: `burgers-exe-menu-v2-preview`
- Binding: `BOG_MENU_DB`
- Crear DB:

```bash
npx wrangler d1 create burgers-exe-menu-v2-preview
```

Actualiza `database_id` en `wrangler.toml` con el ID real.

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

## Preparación R2 (siguiente fase)
- Contratos soportan `imageUrl` + `imageKey`.
- Si existe `imageUrl`, UI puede renderizar esa URL.
- Si solo existe `imageKey`, usar placeholder por ahora.
- Upload/publicación de assets en R2 queda fuera de esta fase.
