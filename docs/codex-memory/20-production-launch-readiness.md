> Estado: vivo
> Uso: readiness y bitacora de lanzamiento controlado a produccion

# Production launch readiness

## Estado final - 2026-07-06

Lanzamiento controlado completado despues de reintento de preflight.

El primer intento quedo bloqueado porque Wrangler D1 live read-only fallo con Cloudflare `Authentication error [code: 10000]`. El reintento del mismo gate read-only paso, se verifico D1 live y se ejecuto deploy production autorizado solo a `burgers-exe` y `chekeo2-0`.

La autorizacion literal del 2026-07-06 quedo consumida unicamente para este lanzamiento documentado. Ningun agente debe reutilizar esa autorizacion para futuros deploys production o reintentos de deploy production.

## Que se lanzo

- Public V2 a Pages production project `burgers-exe`.
- Internal Chekeo V2 a Pages production project `chekeo2-0`.

No se uso `--branch`.

Deployments:

- `burgers-exe`: `https://92ebc252.burgers-exe.pages.dev`, alias `https://ops-controlled-production-la.burgers-exe.pages.dev`.
- `chekeo2-0`: `https://05f5003a.chekeo2-0.pages.dev`, alias `https://ops-controlled-production-la.chekeo2-0.pages.dev`.

## Que no se toco

- No D1 writes.
- No R2 writes.
- No migrations.
- No seeds.
- No secrets.
- No bindings.
- No Pages settings.
- No PIN.
- No pedidos reales.
- No formularios enviados.

## Preflight local

- `verify-local-tooling.ps1`: OK.
- `verify-skills.ps1`: OK.
- `npm run typecheck`: OK.
- `npm run build:public`: OK.
- `npm run build:internal`: OK, con warning Vite existente de chunk grande.

## Preflight production read-only

- `npx wrangler whoami`: OK.
- `npx wrangler d1 list`: primer intento fallo con Cloudflare `Authentication error [code: 10000]`; reintento OK.
- `npx wrangler d1 execute burgers-exe-menu-live --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"`: primer intento fallo con Cloudflare `Authentication error [code: 10000]`; reintento OK.
- `menu_items=15`, `changed_db=false`, `rows_written=0`.
- `menu_categories=4`, `changed_db=false`, `rows_written=0`.
- `promo_cards=0`, `changed_db=false`, `rows_written=0`.
- `raffle_campaigns=2`, `changed_db=false`, `rows_written=0`.

El gate D1 live paso antes de deploy.

## Smoke production antes y despues de deploy

| Target | Resultado |
| --- | --- |
| `https://burgers-exe.pages.dev` | `200 OK` |
| `https://burgers-exe.pages.dev/api/menu-v2` | `200 OK`, `source=d1`, `items=15`, `categories=4` |
| `https://chekeo2-0.pages.dev` | `200 OK` |
| `https://chekeo2-0.pages.dev/api/internal-v2-auth/status` | `200 OK`, `authenticated=false` |

Playwright production read-only tambien paso `2/2` y no detecto writes, page errors ni response issues.

## Riesgos pendientes

- Assets 404 detectados en preview Fase 9A siguen pendientes de clasificacion/fix si se consideran bloqueantes visuales.
- Bindings efectivos de production siguen requiriendo confirmacion segura antes de cualquier cambio productivo de mayor alcance.
- `ORDERS_V2_WRITE_ENABLED` production no fue verificado por Dashboard en esta fase; no imprimir ni guardar valores.

## Rollback

No hubo rollback porque el post-deploy smoke paso.

Para un lanzamiento futuro exitoso:

- Mantener identificados los deployments previos de `burgers-exe` y `chekeo2-0`.
- Usar rollback de Cloudflare Pages si el smoke post-deploy falla.
- No tocar D1/R2 live para rollback salvo autorizacion nueva, literal y especifica.

## Siguiente accion sugerida

- No hay rollback inmediato requerido por esta evidencia.
- Decidir si se corrigen los assets 404 de preview para mantener paridad visual.
- Mantener cualquier cambio futuro de datos/config production bajo nueva autorizacion explicita.
- Mantener cualquier futuro deploy production bloqueado hasta nueva autorizacion literal del usuario.

## Requiere nueva autorizacion explicita

- Futuros deploys production a `burgers-exe`.
- Futuros deploys production a `chekeo2-0`.
- Cualquier reintento de deploy production, incluso si el intento anterior fallo por preflight, auth o error de Cloudflare.
- D1 writes.
- R2 writes.
- Migrations.
- Seeds.
- Secret puts.
- Binding changes.
- Pages settings changes.
- PIN usage.
- Crear pedidos reales.
- Modificar datos live.

La autorizacion del 2026-07-06 no es reutilizable. Todo nuevo deploy production requiere una nueva autorizacion literal, especifica y posterior del usuario.
