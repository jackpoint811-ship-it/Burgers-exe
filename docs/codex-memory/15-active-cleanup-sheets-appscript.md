> Estado: vivo
> Uso: cierre Fase 6 para remover Sheets/App Script del proyecto activo

# Fase 6 - Cleanup Sheets/App Script activo

## Alcance

Esta fase remueve rastros activos que podian sugerir que Burgers.exe V2 dependia de Google Sheets, Apps Script, `APPS_SCRIPT_*`, `BOG_ACTIVE_ENV` o scripts legacy `public-order:*`.

No autoriza cambios de runtime, Cloudflare real, D1/R2, migrations, seeds, secrets, deploys, payloads, precios, tickets, promociones, ni carpetas dentro de `legacy/`.

## Resultado ejecutivo

- `package.json` ya no contiene scripts `public-order:*`.
- No se creo reemplazo automatico para flujos legacy.
- Sheets/App Script quedan como historia, rollback o referencia bajo `legacy/` o docs marcadas como historicas.
- Cloudflare D1 y R2 siguen siendo source of truth oficial para V2.
- `BOG_ACTIVE_ENV` queda como referencia historica/no-touch; no es selector activo V2.
- `functions/api/referral-tickets.ts` no se movio ni se modifico.
- `docs/assets/chekeo-phase-*` no se movio.

## Scripts legacy removidos

| Script | Motivo |
| --- | --- |
| `public-order:dev` | apuntaba a la superficie Cloudflare public-order anterior |
| `public-order:d1:migrate:local` | flujo legacy ligado a config antigua |
| `public-order:d1:seed:local` | seed legacy; no ejecutar desde scripts activos |
| `public-order:d1:raffles:schema:migrate:local` | migracion granular legacy |
| `public-order:d1:raffles:referrals:migrate:local` | migracion granular legacy |
| `public-order:d1:raffles:migrate:local` | agregador legacy |
| `public-order:d1:migrate:remote` | mutaba D1 remoto/live con config antigua |
| `public-order:d1:seed:remote` | seed remoto/live legacy |
| `public-order:d1:raffles:schema:migrate:remote` | migracion remota/live legacy |
| `public-order:d1:raffles:referrals:migrate:remote` | migracion remota/live legacy |
| `public-order:d1:raffles:migrate:remote` | agregador remoto/live legacy |

## Matriz de referencias

| Referencia | Ruta | Tipo | Estado | Accion |
| --- | --- | --- | --- | --- |
| `public-order:*` | `package.json` | scripts npm legacy | removido Fase 6 | eliminado de scripts activos |
| `public-order:*` | docs activas | comandos historicos | doc-activa-corregida | marcado como removido/no reemplazo automatico |
| `APPS_SCRIPT_*` | `legacy/**` | variables legacy | legacy-historico-permitido | conservar sin ejecutar |
| `APPS_SCRIPT_*` | docs activas | inventario/referencia | reclasificado | documentar como legacy-only |
| `SpreadsheetApp` | `legacy/**` | Apps Script API | legacy-historico-permitido | conservar como historia |
| `script.google.com` | repo | URL literal | sin hallazgos | no aplica |
| `BOG_ACTIVE_ENV` | docs activas | referencia no-touch/historica | no activo V2 | conservar solo como restriccion historica |
| `legacy/cloudflare/public-order/wrangler.toml` | `legacy/cloudflare/public-order/` | config legacy live-risk | legacy/riesgo | no usar sin aprobacion explicita |
| `cloudflare/public-order` | docs historicas fuera de legacy | ruta antigua | historica | leer como `legacy/cloudflare/public-order` |
| `cloudflare/internal-chekeo` | docs historicas fuera de legacy | ruta antigua | historica | leer como `legacy/cloudflare/internal-chekeo` |

## Referencias historicas permitidas

- Material dentro de `legacy/`.
- Docs de auditoria UI/UX antiguas que ahora incluyen nota Fase 6.
- Bitacoras que dicen explicitamente "no tocar", "historico", "legacy" o "no runtime".
- Operaciones ya documentadas bajo `docs/operations/`.

## Referencias pendientes

- `BOG_ACTIVE_ENV` sigue apareciendo en runbooks y bitacoras como regla de no-touch. No se borra porque ayuda a evitar cambios accidentales.
- Algunas docs historicas fuera de `legacy/` siguen citando rutas antiguas como parte de auditorias. Quedan marcadas como historicas en Fase 6.
- `tests/internal-chekeo/kitchen-production-board.spec.ts` sigue referenciando `migrations/0008_preview_realistic_orders_seed.sql`, que no existe; queda para Fase 7.
- Bindings reales de Pages por ambiente siguen pendientes de confirmacion read-only mas profunda o Dashboard.

## Validacion esperada

- `package.json` no debe listar scripts `public-order:*`.
- `git grep` fuera de `legacy/` puede encontrar referencias historicas en docs, pero no debe encontrar uso activo en `apps/`, `functions/`, `packages/`, `migrations/` o `tests/`.
- `git diff --check` y `git diff --cached --check` deben pasar antes de PR.
- Para este PR se permite ejecutar `npm run typecheck`, `npm run build:public` y `npm run build:internal` porque `package.json` cambio, aunque no hubo runtime change.

## Preguntas antes de Fase 7

- Cual sera la estrategia exacta de seed/reset preview 1:1 sin tocar produccion?
- Se restaurara o reemplazara `migrations/0008_preview_realistic_orders_seed.sql` para QA?
- Como se confirmaran bindings reales por Pages project sin imprimir secrets?
- Los scripts `db:v2:*:remote` se renombraran a preview explicito o se mantendran como riesgo documentado?

## Siguiente fase sugerida

Fase 7A - Preview 1:1 con DB/R2 espejo, auditoria y runbook seguro.
