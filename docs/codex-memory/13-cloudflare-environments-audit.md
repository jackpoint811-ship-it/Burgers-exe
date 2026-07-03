> Estado: vivo
> Uso: auditoria Fase 3 para separar ambientes Cloudflare preview/prod/local

# Fase 3 - Auditoria de ambientes Cloudflare

## Alcance

Esta fase documenta y estandariza ambientes. No autoriza deploys, creacion de recursos Cloudflare, cambios de bindings, cambios de secrets, migrations remotas, seeds remotos ni cambios de runtime.

## Resultado ejecutivo

- Apps oficiales: `apps/public-order-v2` e `apps/internal-chekeo-v2`.
- Endpoints activos V2: `functions/api/*`.
- Bindings esperados: `BOG_MENU_DB`, `BOG_MENU_ASSETS`, `BOG_INTERNAL_PIN` y `ORDERS_V2_WRITE_ENABLED`.
- Wrangler CLI respondio comandos read-only: `whoami`, Pages projects, D1 list y R2 bucket list.
- La auditoria no registra correo, account id, tokens ni valores de secrets.
- `cloudflare/public-order/.wrangler/` era artefacto local trackeado; se retiro del indice sin borrar archivos locales.
- Queda pendiente confirmar bindings reales en Cloudflare Dashboard o con una auditoria read-only mas profunda, porque `wrangler pages project list` no muestra bindings por proyecto.

## Matriz principal

| App | Ambiente | Pages project | URL | Build command | Output dir | D1 | R2 | Secrets | Write enabled |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public V2 | produccion | `burgers-exe` | `https://burgers-exe.pages.dev` | `npm run build:public` | `dist/public-order-v2` | `burgers-exe-menu-live` via `BOG_MENU_DB` | `burgers-exe-menu-assets` via `BOG_MENU_ASSETS` | Ninguno esperado para flujo publico | `ORDERS_V2_WRITE_ENABLED=true` solo cuando produccion de pedidos debe aceptar escrituras |
| Public V2 | preview | `burgers-exe-public-v2-preview` | `https://burgers-exe-public-v2-preview.pages.dev` | `npm run build:public` | `dist/public-order-v2` | `burgers-exe-menu-v2-preview` via `BOG_MENU_DB` | `burgers-exe-assets-v2-preview` via `BOG_MENU_ASSETS` | Ninguno esperado para flujo publico | Valor explicito por ambiente; puede estar activo solo para pruebas preview controladas |
| Internal Chekeo V2 | produccion | `chekeo2-0` | `https://chekeo2-0.pages.dev` | `npm run build:internal` | `dist/internal-chekeo-v2` | `burgers-exe-menu-live` via `BOG_MENU_DB` | `burgers-exe-menu-assets` via `BOG_MENU_ASSETS` | `BOG_INTERNAL_PIN` | No aplica al login; las acciones internas operan sobre D1 produccion y requieren auth |
| Internal Chekeo V2 | preview | `burgers-exe-internal-v2-preview` | `https://burgers-exe-internal-v2-preview.pages.dev` | `npm run build:internal` | `dist/internal-chekeo-v2` | `burgers-exe-menu-v2-preview` via `BOG_MENU_DB` | `burgers-exe-assets-v2-preview` via `BOG_MENU_ASSETS` | `BOG_INTERNAL_PIN` con valor preview | No aplica al login; las acciones internas deben operar solo sobre D1 preview |
| Local dev | local | Ninguno obligatorio | `localhost` | `npm run dev:public`, `npm run dev:internal`, `npm run build:*` | `dist/*` segun app | D1 local por defecto o preview explicita | R2 local/mock o preview explicita | `.dev.vars` local cuando aplique | Desactivado por defecto salvo prueba explicita |

## Reglas de separacion

- Local usa D1 local por defecto; si apunta a preview debe ser explicito.
- Preview usa D1/R2 preview y nunca escribe a recursos produccion.
- Produccion usa D1/R2 produccion y nunca recibe pedidos o assets de prueba.
- Chekeo preview debe operar sobre el mismo D1/R2 preview que Public V2 preview.
- Chekeo produccion debe operar sobre el mismo D1/R2 produccion que Public V2 produccion.
- `ORDERS_V2_WRITE_ENABLED` debe revisarse por ambiente antes de aceptar pedidos publicos.
- `BOG_INTERNAL_PIN` debe existir como secreto donde aplique, pero nunca documentarse con valor.
- `.dev.vars`, `wrangler.toml` local y `.wrangler/` no deben versionarse.

## Recursos Cloudflare observados

Auditoria ejecutada solo con comandos read-only.

| Recurso Cloudflare | Tipo | Ambiente inferido | Binding esperado | Estado |
| --- | --- | --- | --- | --- |
| `burgers-exe` | Pages project | Public V2 produccion | `BOG_MENU_DB`, `BOG_MENU_ASSETS`, `ORDERS_V2_WRITE_ENABLED` | existe |
| `chekeo2-0` | Pages project | Internal Chekeo V2 produccion | `BOG_MENU_DB`, `BOG_MENU_ASSETS`, `BOG_INTERNAL_PIN` | existe |
| `burgers-exe-public-v2-preview` | Pages project | Public V2 preview | `BOG_MENU_DB`, `BOG_MENU_ASSETS`, `ORDERS_V2_WRITE_ENABLED` | existe |
| `burgers-exe-internal-v2-preview` | Pages project | Internal Chekeo V2 preview | `BOG_MENU_DB`, `BOG_MENU_ASSETS`, `BOG_INTERNAL_PIN` | existe |
| `nutrimoney` | Pages project | fuera de Burgers.exe | ninguno | no tocar |
| `burgers-exe-menu-live` | D1 database | produccion | `BOG_MENU_DB` | existe |
| `burgers-exe-menu-v2-preview` | D1 database | preview/local explicito | `BOG_MENU_DB` | existe |
| `burgers-exe-menu-assets` | R2 bucket | produccion | `BOG_MENU_ASSETS` | existe |
| `burgers-exe-assets-v2-preview` | R2 bucket | preview/local explicito | `BOG_MENU_ASSETS` | existe |

Nota: `wrangler d1 list` es inventario de recursos, no verificacion de schema ni de bindings Pages. No sustituye una revision de `d1_migrations`, tablas o Dashboard.

## Configuracion local y repo

| Ruta | Tipo | Ambiente | Estado | Riesgo |
| --- | --- | --- | --- | --- |
| `wrangler.example.toml` | template | local/preview | `template` | seguro si mantiene placeholders y no secrets |
| `/wrangler.toml` | config local raiz ignorada | local/preview | `riesgo controlado` | contiene bindings locales reales; no versionar; protegido por `.gitignore` |
| `.dev.vars` | secrets locales ignorados | local | `riesgo controlado` | no leer, imprimir ni versionar |
| `legacy/cloudflare/public-order/wrangler.toml` | config legacy trackeada | legacy/live | `riesgo` | apunta a recursos live; no usar sin aprobacion explicita |
| `legacy/cloudflare/public-order/.wrangler/` | artefactos Wrangler/Miniflare | local legacy | `riesgo resuelto en indice` | retirado del indice; archivos locales preservados |
| `legacy/cloudflare/internal-chekeo/` | Pages legacy/deprecated | legacy | `legacy` | cuarentena Fase 5 |
| `legacy/cloudflare/tickets/` | Worker legacy/deprecated | legacy | `legacy` | cuarentena Fase 5 |
| `functions/api/*` | Pages Functions activas | prod/preview segun binding | `activo` | requiere bindings correctos por proyecto |
| `migrations/*.sql` | migraciones D1 | prod/preview segun comando | `activo/riesgo` | comandos remotos prohibidos en fases documentales |

## Scripts npm

| Script o familia | Clasificacion | Uso seguro en Fase 3 | Riesgo |
| --- | --- | --- | --- |
| `dev`, `dev:public`, `dev:internal` | activo V2 local | si, solo frontend local | Vite solo no valida Pages Functions |
| `build`, `build:public`, `build:internal` | activo V2 | si | ninguno esperado |
| `typecheck` | activo V2 | si | ninguno esperado |
| `preview:public`, `preview:internal` | preview local Vite | si, local | no valida bindings Cloudflare |
| `qa:visual` | QA visual | no requerido en Fase 3 | solo aplicar si hay cambio UI |
| `db:v2:*:local` | D1 local/preview explicita | no ejecutado | puede mutar DB local; requiere intencion explicita |
| `db:v2:*:remote` | D1 remoto preview | prohibido en Fase 3 | muta recurso Cloudflare |
| `public-order:*` | legacy/public live | removido en Fase 6 | ya no existe en `package.json`; no hay reemplazo automatico ni permiso de uso |

Propuestas futuras para Fase 7, no implementadas en Fase 3:

- `db:v2:preview:migrate`
- `db:v2:preview:seed`
- `db:v2:preview:reset-orders`
- `preview:public:cloudflare`
- `preview:internal:cloudflare`

Nota Fase 7A: los scripts actuales `db:v2:*:remote` apuntan a `burgers-exe-menu-v2-preview`, pero siguen usando `--remote` y mutan D1. No ejecutarlos en Fase 7A. Antes de Fase 7B, preferir nombres `db:v2:preview:*` o guardas explicitas de ambiente.

## Comandos

### Permitidos como read-only

- `npx wrangler --version`
- `npx wrangler whoami` sin registrar correo, account id ni token en docs
- `npx wrangler pages project list`
- `npx wrangler d1 list`
- `npx wrangler r2 bucket list`

### Prohibidos en Fase 3

- `wrangler pages deploy`
- `wrangler d1 execute --remote`
- `wrangler d1 migrations apply`
- `wrangler r2 object put`
- `wrangler r2 object delete`
- `wrangler secret put`
- `wrangler secret delete`
- crear, borrar o renombrar recursos Cloudflare
- activar escrituras reales sin aprobacion explicita

## `.wrangler` trackeado

Fase 2 detecto `cloudflare/public-order/.wrangler/` trackeado. En Fase 3 se confirmo que eran artefactos locales de Wrangler/Miniflare y bundles temporales:

- cache local de Cloudflare
- sqlite local de Miniflare D1
- archivos `sqlite-shm` y `sqlite-wal`
- bundles temporales de Pages dev

Accion: se retiro del indice con staging explicito y sin borrar archivos locales. La carpeta queda ignorada por `.gitignore`.

## Seed/test faltante

`tests/internal-chekeo/kitchen-production-board.spec.ts` referencia `migrations/0008_preview_realistic_orders_seed.sql`, pero el archivo no existe actualmente.

Clasificacion:

- riesgo de ambiente preview/test
- candidato Fase 7
- no corregir en Fase 3 porque implicaria decidir datos seed y reglas de reset preview

Impacto: cualquier QA que dependa de ese seed puede fallar o no representar preview 1:1 hasta que Fase 7 defina estrategia de DB espejo.

## Pendientes para Fase 7

- Confirmar bindings reales de los cuatro Pages projects en Cloudflare Dashboard o via API read-only.
- Confirmar valor efectivo de `ORDERS_V2_WRITE_ENABLED` por ambiente sin imprimir secrets.
- Confirmar que Public preview e Internal preview usan el mismo D1/R2 preview.
- Confirmar que Public prod e Internal prod usan el mismo D1/R2 produccion.
- Definir seed preview controlado y no destructivo para QA.
- Definir estrategia de reset de pedidos preview sin tocar produccion.
- Validar que Chekeo preview abre/usa URLs de Public preview y que Chekeo prod abre/usa Public prod.
- `legacy/cloudflare/public-order/wrangler.toml` queda como legacy/riesgo; no usarlo para nuevos flujos ni comandos live sin aprobacion explicita.

## Auditoria Fase 7A - 2026-07-02

Auditoria ejecutada solo con comandos read-only. Recursos confirmados:

| Recurso | Tipo | Ambiente | Existe | Riesgo | Accion futura |
| --- | --- | --- | --- | --- | --- |
| `burgers-exe` | Pages | produccion public | si | no usar para QA preview | confirmar bindings solo read-only/manual |
| `chekeo2-0` | Pages | produccion internal | si | no operar preview desde prod | confirmar bindings solo read-only/manual |
| `burgers-exe-public-v2-preview` | Pages | preview public | si | binding equivocado podria escribir live | confirmar Dashboard antes de deploy |
| `burgers-exe-internal-v2-preview` | Pages | preview internal | si | binding/secret equivocado podria operar live | confirmar Dashboard antes de deploy |
| `burgers-exe-menu-live` | D1 | produccion | si | critico | no usar para seed/reset preview |
| `burgers-exe-menu-v2-preview` | D1 | preview | si | medio | usar solo con autorizacion en Fase 7B |
| `burgers-exe-menu-assets` | R2 | produccion | si | critico | no usar para assets preview |
| `burgers-exe-assets-v2-preview` | R2 | preview | si | medio | usar solo con autorizacion en Fase 7B |
| `nutrimoney` | Pages | fuera de Burgers.exe | si | fuera de alcance | no tocar |

## Bloqueadores abiertos

- La lista read-only de Pages no expone bindings ni secrets por proyecto.
- No se valido Dashboard porque Fase 3 no debe modificar ni depender de cambios manuales.
- El test seed faltante requiere decision de Fase 7.

## Cierre Fase 3

Fase 3 queda completa cuando este documento, `docs/environments.md`, `docs/refactor-v2-clean-architecture.md`, `docs/codex-memory/09-checklists.md` y el tracker esten actualizados en PR documental, sin deploys ni mutaciones remotas.
