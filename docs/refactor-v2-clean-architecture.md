# Burgers.exe V2 Clean Architecture

## Objetivo

Definir la migracion oficial para dejar el repo limpio, entendible y estandarizado alrededor de solo 2 superficies oficiales, sin mezclar runtime actual con legacy.

## Definicion oficial de Burgers.exe

- Burgers.exe son solo 2 apps funcionales oficiales:
  - `apps/public-order-v2`
  - `apps/internal-chekeo-v2`
- Cloudflare D1 es la source of truth para catalogo, pedidos, operacion, cierre y reportes V2.
- Cloudflare R2 es la source of truth para assets de catalogo y promos.
- Google Sheets, Apps Script, V1, docs historicas, assets no usados y experimentos viejos se consideran legacy.
- Sheets solo puede existir como historia, rollback o export/import manual legacy; no como runtime oficial ni source of truth actual.

## Activo, compartido, Cloudflare y legacy

### Activo

- `apps/public-order-v2`
- `apps/internal-chekeo-v2`
- `functions/api/*` que sirven V2
- `docs/codex-memory/*`
- documentacion activa de arquitectura y ambientes

### Compartido

- `packages/ui`
- `packages/config`

Nota Fase 4: la superficie compartida real actual es `packages/ui` y `packages/config`. `packages/domain` y `packages/cloudflare` siguen siendo parte del mapa objetivo futuro, pero todavia no existen como paquetes reales en el repo y no deben tratarse como superficie activa.

### Cloudflare

- Cloudflare Pages para cada superficie oficial
- Cloudflare D1 para datos operativos V2
- Cloudflare R2 para assets oficiales
- Wrangler y bindings solo como capa de configuracion y operacion

Nota Fase 3: la auditoria read-only confirmo existencia de los Pages projects `burgers-exe`, `chekeo2-0`, `burgers-exe-public-v2-preview` y `burgers-exe-internal-v2-preview`; D1 `burgers-exe-menu-live` y `burgers-exe-menu-v2-preview`; y R2 `burgers-exe-menu-assets` y `burgers-exe-assets-v2-preview`. Esta confirmacion no sustituye validar bindings/secrets por proyecto antes de deploy o escritura.

Nota Fase 4: `docs/codex-memory/14-active-surface-map.md` define la superficie activa antes de mover legacy. Fase 4 no movio carpetas, no cambio runtime y no autoriza borrar archivos.

Nota Fase 5: la cuarentena legacy clara vive ahora bajo `legacy/`: `legacy/cloudflare/`, `legacy/apps-script/`, `legacy/planning/`, `legacy/docs/` y `legacy/skills/`. Este movimiento no cambio runtime, Functions V2, D1/R2, migraciones, seeds, secrets ni deploys.

Nota Fase 6: se removieron del `package.json` activo los scripts legacy `public-order:*`. Las referencias restantes a Sheets/App Script o Cloudflare public-order anterior deben estar bajo `legacy/` o marcadas como historia/no runtime.

Nota Fase 7A: `docs/codex-memory/16-preview-mirror-runbook.md` documenta el preview 1:1 seguro con D1/R2 espejo. Fase 7A es read-only: no deploy, no migrations, no seeds, no resets, no cambios de bindings/secrets y no writes D1/R2.

### Legacy

- Google Sheets
- Google Apps Script
- V1
- carpetas historicas
- assets no usados
- experimentos viejos

## Mapa de carpetas objetivo

No implementar esta estructura todavia. Este es el objetivo documental de la migracion:

```text
apps/
  public-order-v2/
  internal-chekeo-v2/

packages/
  ui/
  config/
  domain/
  cloudflare/

functions/
  api/
    menu-v2/
    orders-v2/
    orders-v2-admin/
    assets-v2/
    internal-v2-auth/

migrations/
  active/
  legacy/

docs/
  codex-memory/
  active/
  architecture/
  environments/

legacy/
  apps/
  cloudflare/
  apps-script/
  google-sheets/
  docs/
  assets/
  planning/
  experiments/
```

## Que esta prohibido mezclar

- Preview con produccion.
- Escrituras de prueba con datos reales.
- Docs activas con docs historicas sin marcar contexto.
- Runtime oficial con Google Sheets o Apps Script como source of truth.
- Legacy cleanup fuera de fases autorizadas.
- Migrations o seeds destructivos dentro de PRs documentales o UI.

## Plan de fases

1. Fase 0 - Gobernanza, tracker Kanban, README limpio y control de herramientas.
2. Fase 1 - Validacion local de skills y herramientas.
3. Fase 2 - Inventario real con Graphify.
4. Fase 3 - Estandarizar ambientes Cloudflare.
5. Fase 4 - Separar carpetas activas.
6. Fase 5 - Mover legacy a cuarentena.
7. Fase 6 - Remover Sheets y Apps Script del proyecto activo.
8. Fase 7A - Auditoria/runbook preview mirror read-only.
9. Fase 7B.1 - Preparar preview mirror autorizado sin ejecutar remoto.
10. Fase 7B.2 - Ejecucion preview mirror solo con autorizacion explicita.
11. Fase 8 - Estandarizar rutina diaria, modelos, prompts y QA.

## Reglas de preview vs produccion

- Preview debe ser 1:1 en funciones, pero con D1 y R2 separados.
- Preview y produccion nunca deben compartir escritura ni pedidos.
- Los pedidos de prueba deben vivir solo en D1 preview.
- Las listas y assets de preview deben vivir en recursos preview.
- Cualquier copia de datos desde produccion hacia preview debe ser explicita, segura y auditada.
- Local debe usar D1 local o preview explicita; nunca produccion por default.

## Reglas para mover legacy

- No mover legacy en Fase 0.
- No borrar legacy sin aprobacion explicita.
- Antes de mover legacy, debe existir inventario real y criterio de cuarentena.
- Toda carpeta movida a `legacy/` debe quedar marcada como historica, rollback o referencia.
- Si un archivo legacy sigue siendo necesario para rollback o auditoria, no se elimina.

## Reglas para eliminar rastros de proyectos anteriores

- No borrar historia util; reclasificarla como legacy.
- No dejar README, memoria o docs diciendo que Sheets/App Script siguen siendo backend oficial.
- No dejar referencias ambiguas sobre proyectos Pages, bindings o fuentes de verdad.
- No dejar scripts o prompts que asuman mezcla entre preview y produccion.
- Toda eliminacion futura debe pasar por fase autorizada y PR explicito.

## Riesgos

- Mezclar legacy con activo puede romper trazabilidad y continuidad operativa.
- Mezclar preview con produccion puede contaminar pedidos, assets o reportes.
- La falta de inventario real puede ocultar dependencias vivas antes de mover carpetas.
- La ausencia de control de tooling puede hacer que distintos clones ejecuten fases con criterios distintos.
- Fase 5 movio Apps Script/Sheets de la raiz y carpetas Cloudflare deprecated a `legacy/`; no usar esos archivos como runtime oficial.
- Fase 6 removio scripts root legacy `public-order:*`; no existe reemplazo automatico ni permiso implicito para ejecutar flujos antiguos.
- Fase 3 detecto que los recursos Cloudflare canonicos existen, pero los bindings/secrets reales por Pages project siguen pendientes de confirmacion segura.
- `legacy/cloudflare/public-order/wrangler.toml` sigue como legacy/riesgo porque apunta a recursos live; no usarlo para nuevos flujos.
- Fase 4 dejo `functions/api/referral-tickets.ts` como endpoint de riesgo porque no se encontro consumo directo desde apps V2; no mover ni borrar sin revision puntual.

## Checklist de seguridad

- [ ] No tocar secrets ni `.dev.vars`.
- [ ] No tocar IDs reales de Cloudflare sin fase autorizada.
- [ ] No ejecutar migraciones ni seeds en fases documentales.
- [ ] No mover ni borrar legacy sin autorizacion explicita.
- [ ] No cambiar payloads, precios, tickets, promociones ni reglas comerciales.
- [ ] No mezclar preview con produccion.
- [ ] No cerrar una fase sin actualizar el tracker.

## Regla final

Esta spec define el objetivo de migracion. No autoriza por si sola cambios de runtime, deploy, borrado, migraciones ni movimientos de carpetas.
