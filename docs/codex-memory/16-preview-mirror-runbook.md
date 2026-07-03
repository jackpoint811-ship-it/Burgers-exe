> Estado: vivo
> Uso: Fase 7A, runbook seguro para preview 1:1 con D1/R2 espejo

# Fase 7A - Preview mirror runbook

## Objetivo

Preparar un preview 1:1 para Burgers.exe V2 sin tocar produccion ni mutar recursos Cloudflare en esta fase.

El objetivo operativo es que:

- Public V2 preview use solo Pages preview, D1 preview y R2 preview.
- Internal Chekeo V2 preview use los mismos D1/R2 preview.
- Produccion siga usando D1/R2 live.
- Local nunca apunte a produccion por default.
- Todo comando remoto quede documentado como futuro y requiera autorizacion explicita.

Fase 7A es auditoria, documentacion y tooling read-only. No ejecuta deploys, migrations, seeds, resets, writes D1/R2, creacion de recursos, cambios de bindings ni cambios de secrets.

## Auditoria read-only ejecutada

Comandos ejecutados:

```powershell
npx wrangler whoami
npx wrangler pages project list
npx wrangler d1 list
npx wrangler r2 bucket list
```

Notas de seguridad:

- `whoami` confirmo sesion Wrangler activa, pero no se registra account id ni tokens en esta memoria.
- El token local tiene permisos amplios; cualquier comando que mute recursos debe considerarse de alto riesgo.
- La lista read-only confirma existencia de recursos, pero no confirma bindings/secrets por Pages project.

## Recursos esperados

| Recurso | Tipo | Ambiente | Existe | Riesgo | Accion futura |
| --- | --- | --- | --- | --- | --- |
| `burgers-exe` | Pages | produccion public | si | alto si se usa para QA preview | no tocar en Fase 7A; validar bindings solo read-only/manual |
| `chekeo2-0` | Pages | produccion internal | si | alto si se opera con datos preview/prod mezclados | no tocar en Fase 7A; validar bindings solo read-only/manual |
| `burgers-exe-public-v2-preview` | Pages | preview public | si | medio si sus bindings apuntan a live | confirmar bindings en Dashboard antes de deploy/QA |
| `burgers-exe-internal-v2-preview` | Pages | preview internal | si | medio si sus bindings/secrets apuntan a live | confirmar D1/R2 preview y `BOG_INTERNAL_PIN` preview |
| `burgers-exe-menu-live` | D1 | produccion | si | critico; contiene/recibe datos reales | nunca usar para seeds/reset preview |
| `burgers-exe-menu-v2-preview` | D1 | preview | si | medio; puede contener datos de QA | usar solo con autorizacion en Fase 7B |
| `burgers-exe-menu-assets` | R2 | produccion | si | critico; assets reales | no subir/borrar en Fase 7A |
| `burgers-exe-assets-v2-preview` | R2 | preview | si | medio; assets de QA/preview | usar solo con autorizacion en Fase 7B |
| `nutrimoney` | Pages | fuera de Burgers.exe | si | fuera de alcance | no tocar |

## Matriz prod vs preview

| App | Ambiente | Pages project | D1 esperado | R2 esperado | Secrets/vars esperados | Confirmacion disponible | Falta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Public V2 | produccion | `burgers-exe` | `burgers-exe-menu-live` via `BOG_MENU_DB` | `burgers-exe-menu-assets` via `BOG_MENU_ASSETS` | `ORDERS_V2_WRITE_ENABLED` explicito | recursos existen por Wrangler read-only | binding real y valor de write flag en Dashboard |
| Public V2 | preview | `burgers-exe-public-v2-preview` | `burgers-exe-menu-v2-preview` via `BOG_MENU_DB` | `burgers-exe-assets-v2-preview` via `BOG_MENU_ASSETS` | `ORDERS_V2_WRITE_ENABLED` preview explicito | recursos existen por Wrangler read-only | binding real y valor de write flag en Dashboard |
| Internal Chekeo V2 | produccion | `chekeo2-0` | `burgers-exe-menu-live` via `BOG_MENU_DB` | `burgers-exe-menu-assets` via `BOG_MENU_ASSETS` | `BOG_INTERNAL_PIN` prod | recursos existen por Wrangler read-only | binding real y presencia de secret sin imprimir valor |
| Internal Chekeo V2 | preview | `burgers-exe-internal-v2-preview` | `burgers-exe-menu-v2-preview` via `BOG_MENU_DB` | `burgers-exe-assets-v2-preview` via `BOG_MENU_ASSETS` | `BOG_INTERNAL_PIN` preview | recursos existen por Wrangler read-only | binding real y presencia de secret sin imprimir valor |

## Reglas de seguridad

- Produccion nunca debe ser default para pruebas.
- Preview debe ser explicito en nombres de scripts, docs y comandos.
- No usar `live` en scripts preview.
- No usar `legacy/cloudflare/public-order/wrangler.toml` para nuevos flujos.
- No usar scripts historicos `public-order:*`; fueron removidos en Fase 6.
- No ejecutar remoto sin autorizacion explicita.
- No ejecutar `wrangler pages deploy` en Fase 7A.
- No ejecutar `wrangler d1 execute --remote` en Fase 7A.
- No ejecutar `wrangler r2 object put/delete` en Fase 7A.
- No modificar ni crear Pages secrets en Fase 7A.
- No crear Pages, D1 ni R2 en Fase 7A.
- No imprimir secrets, tokens ni valores reales de PIN.

## Scripts actuales

| Script | Comando | Ambiente inferido | Mutacion | Estado | Recomendacion |
| --- | --- | --- | --- | --- | --- |
| `dev` | `vite` | local frontend | no Cloudflare | activo | seguro para frontend; no valida Functions |
| `dev:public` | `APP_TARGET=public vite` | local public | no Cloudflare | activo | seguro para frontend; no valida Functions |
| `dev:internal` | `APP_TARGET=internal vite` | local internal | no Cloudflare | activo | seguro para frontend; no valida Functions |
| `build` | public + internal build | local | no Cloudflare | activo | usar en checks |
| `build:public` | public Vite build | local | no Cloudflare | activo | usar en checks |
| `build:internal` | internal Vite build | local | no Cloudflare | activo | usar en checks |
| `typecheck` | `tsc --noEmit` | local | no | activo | usar en checks |
| `preview:public` | build + Vite preview | local | no Cloudflare | activo | no equivale a Pages preview |
| `preview:internal` | build + Vite preview | local | no Cloudflare | activo | no equivale a Pages preview |
| `qa:visual` | Playwright visual | local/segun config | no por si solo | activo | solo contra targets aprobados |
| `db:v2:migrate:local` | D1 execute `--local` 0001 | local D1 | si local | permitido solo con intencion | no ejecutar automaticamente |
| `db:v2:seed:local` | D1 execute `--local` 0002 | local D1 | si local | permitido solo con intencion | no ejecutar automaticamente |
| `db:v2:orders:migrate:local` | D1 execute `--local` 0003 | local D1 | si local | permitido solo con intencion | no ejecutar automaticamente |
| `db:v2:migrate:remote` | D1 execute `--remote` 0001 sobre `burgers-exe-menu-v2-preview` | preview remoto | si remoto | prohibido en Fase 7A | renombrar/proponer `db:v2:preview:migrate` en Fase 7B |
| `db:v2:seed:remote` | D1 execute `--remote` 0002 sobre `burgers-exe-menu-v2-preview` | preview remoto | si remoto | prohibido en Fase 7A | renombrar/proponer `db:v2:preview:seed` en Fase 7B |
| `db:v2:orders:migrate:remote` | D1 execute `--remote` 0003 sobre `burgers-exe-menu-v2-preview` | preview remoto | si remoto | prohibido en Fase 7A | renombrar/proponer `db:v2:preview:orders:migrate` en Fase 7B |

## Bindings esperados

| App | Ambiente | Binding | Recurso esperado | Confirmacion disponible | Falta |
| --- | --- | --- | --- | --- | --- |
| Public V2 | produccion | `BOG_MENU_DB` | `burgers-exe-menu-live` | D1 existe | confirmar binding real del Pages project |
| Public V2 | produccion | `BOG_MENU_ASSETS` | `burgers-exe-menu-assets` | R2 existe | confirmar binding real del Pages project |
| Public V2 | produccion | `ORDERS_V2_WRITE_ENABLED` | var Pages prod | nombre en codigo/docs | confirmar valor sin imprimirlo |
| Public V2 | preview | `BOG_MENU_DB` | `burgers-exe-menu-v2-preview` | D1 existe | confirmar binding real del Pages project |
| Public V2 | preview | `BOG_MENU_ASSETS` | `burgers-exe-assets-v2-preview` | R2 existe | confirmar binding real del Pages project |
| Public V2 | preview | `ORDERS_V2_WRITE_ENABLED` | var Pages preview | nombre en codigo/docs | confirmar valor sin imprimirlo |
| Internal Chekeo V2 | produccion | `BOG_MENU_DB` | `burgers-exe-menu-live` | D1 existe | confirmar binding real del Pages project |
| Internal Chekeo V2 | produccion | `BOG_MENU_ASSETS` | `burgers-exe-menu-assets` | R2 existe | confirmar binding real del Pages project |
| Internal Chekeo V2 | produccion | `BOG_INTERNAL_PIN` | secret Pages prod | nombre en codigo/docs | confirmar presencia sin imprimir valor |
| Internal Chekeo V2 | preview | `BOG_MENU_DB` | `burgers-exe-menu-v2-preview` | D1 existe | confirmar binding real del Pages project |
| Internal Chekeo V2 | preview | `BOG_MENU_ASSETS` | `burgers-exe-assets-v2-preview` | R2 existe | confirmar binding real del Pages project |
| Internal Chekeo V2 | preview | `BOG_INTERNAL_PIN` | secret Pages preview | nombre en codigo/docs | confirmar presencia sin imprimir valor |

## Seed faltante

Hallazgo:

- `tests/internal-chekeo/kitchen-production-board.spec.ts` lee `migrations/0008_preview_realistic_orders_seed.sql`.
- El archivo no existe.
- El test solo valida contenido textual: `PVW-`, `public-v2-preview`, `[FIXTURE:PREVIEW_REALISTIC_ORDERS]`, ubicaciones Torre Valcob/GGA, nombres realistas, y ausencia de marcadores antiguos `QA-COCINA`/`CRIT-001`.

Decision Fase 7A:

- No se crea ni ejecuta el seed en Fase 7A.
- Aunque parece test/local-only, vive bajo `migrations/` y podria ejecutarse por error contra remoto.
- Fase 7B debe crearlo con encabezado `PREVIEW/TEST ONLY`, datos ficticios, marcador unico, sin datos reales, y comandos de ejecucion separados por ambiente.
- El seed no debe usar nombres de clientes reales ni telefonos reales.
- El seed no debe incluir instrucciones para prod.

## Plan Fase 7B

1. Confirmar bindings en Cloudflare Dashboard para los cuatro Pages projects.
2. Confirmar presencia de secrets/vars sin imprimir valores.
3. Proponer scripts `db:v2:preview:*` con nombres preview explicitos.
4. Crear seed/reset preview local/test-only con marcador unico.
5. Si se autoriza, ejecutar migrations preview contra `burgers-exe-menu-v2-preview`.
6. Si se autoriza, ejecutar seed preview contra `burgers-exe-menu-v2-preview`.
7. Si se autoriza, deploy preview de Public V2 e Internal V2.
8. Ejecutar QA Playwright solo contra URLs preview.
9. Validar que prod no cambio: sin nuevos pedidos, assets ni schema inesperado.

## Comandos futuros

Todos los siguientes son **NO EJECUTAR EN FASE 7A** y **REQUIEREN AUTORIZACION**:

```powershell
npm run db:v2:migrate:remote
npm run db:v2:seed:remote
npm run db:v2:orders:migrate:remote
npx wrangler d1 execute burgers-exe-menu-v2-preview --remote --file=./migrations/0008_preview_realistic_orders_seed.sql
npx wrangler pages deploy dist/public-order-v2 --project-name burgers-exe-public-v2-preview
npx wrangler pages deploy dist/internal-chekeo-v2 --project-name burgers-exe-internal-v2-preview
npx wrangler r2 object put burgers-exe-assets-v2-preview/<key> --file <file>
# Pages secret de Internal preview: configurar en Cloudflare Dashboard o con Wrangler Pages; no usar el comando de Workers.
```

Nota: `BOG_INTERNAL_PIN` es un secret de Cloudflare Pages. Para Fase 7B, usar Cloudflare Dashboard o Wrangler Pages con `--project-name`; no usar el comando de Workers porque apunta al target equivocado.

## Script read-only

Fase 7A agrega `tools/codex/verify-preview-readiness.ps1`.

Uso seguro default:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\codex\verify-preview-readiness.ps1
```

Uso con inventario Cloudflare read-only:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\codex\verify-preview-readiness.ps1 -CloudflareReadOnly
```

El script no ejecuta deploys, migrations, seeds, writes R2, secrets, creates ni comandos remotos de mutacion.

## Bloqueadores para ejecutar preview mirror

- No se confirmaron bindings reales por Pages project desde Dashboard.
- No se confirmo valor de `ORDERS_V2_WRITE_ENABLED`.
- No se confirmo presencia de `BOG_INTERNAL_PIN` preview/prod sin imprimir valor.
- El seed `0008_preview_realistic_orders_seed.sql` sigue pendiente.
- Los scripts remotos actuales usan nombre `remote` aunque apuntan a preview; renombrar reduce riesgo humano.

## Siguiente fase sugerida

Fase 7B - Ejecutar preview mirror autorizado.
