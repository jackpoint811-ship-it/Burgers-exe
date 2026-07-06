> Estado: vivo
> Uso: readiness y bitacora de lanzamiento controlado a produccion

# Production launch readiness

## Estado final - 2026-07-06

Lanzamiento controlado bloqueado antes de deploy.

No se ejecuto deploy production porque el preflight read-only directo a D1 live fallo con Cloudflare `Authentication error [code: 10000]` al usar Wrangler contra `burgers-exe-menu-live`.

## Que se lanzo

Nada.

Los deploys autorizados a `burgers-exe` y `chekeo2-0` quedaron bloqueados por gate de preflight.

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
- `npx wrangler d1 list`: fallo con Cloudflare `Authentication error [code: 10000]`.
- `npx wrangler d1 execute burgers-exe-menu-live --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"`: fallo con Cloudflare `Authentication error [code: 10000]`.

Este fallo bloquea deploy porque no se pudo verificar schema/conteos live por D1 directo.

## Smoke production actual antes de deploy

| Target | Resultado |
| --- | --- |
| `https://burgers-exe.pages.dev` | `200 OK` |
| `https://burgers-exe.pages.dev/api/menu-v2` | `200 OK`, `source=d1`, `items=15`, `categories=4` |
| `https://chekeo2-0.pages.dev` | `200 OK` |
| `https://chekeo2-0.pages.dev/api/internal-v2-auth/status` | `200 OK`, `authenticated=false` |

Estos smokes son utiles, pero no sustituyen la verificacion D1 live directa requerida por el gate.

## Riesgos pendientes

- Wrangler D1 API no permite completar preflight read-only contra `burgers-exe-menu-live`.
- Assets 404 detectados en preview Fase 9A siguen pendientes de clasificacion/fix si se consideran bloqueantes visuales.
- Bindings efectivos de production siguen requiriendo confirmacion segura antes de cualquier cambio productivo de mayor alcance.
- `ORDERS_V2_WRITE_ENABLED` production no fue verificado por Dashboard en esta fase; no imprimir ni guardar valores.

## Rollback

No hubo rollback porque no hubo deploy.

Para un lanzamiento futuro exitoso:

- Mantener identificados los deployments previos de `burgers-exe` y `chekeo2-0`.
- Usar rollback de Cloudflare Pages si el smoke post-deploy falla.
- No tocar D1/R2 live para rollback salvo autorizacion nueva, literal y especifica.

## Requiere nueva accion antes de reintento

- Resolver autenticacion Wrangler D1 read-only.
- Repetir `npx wrangler d1 list`.
- Repetir schema y conteos read-only de `burgers-exe-menu-live`.
- Repetir gate antes de deploy.

## Requiere nueva autorizacion explicita

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
