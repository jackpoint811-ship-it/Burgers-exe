> Estado: vivo
> Uso: tablero Kanban oficial para la migracion V2 limpia

# Burgers.exe V2 Clean Architecture Tracker

## Estado

- Vivo
- Fase actual: Fase 7B.1

## Kanban

### Backlog

- [ ] Fase 7B.2 - Ejecutar preview mirror autorizado
- [ ] Fase 8 - Estandarizar rutina diaria, modelos, prompts y QA

### En progreso

- Ninguna

### En revision

- [ ] Fase 7B.1 - Preparar preview mirror autorizado sin ejecutar remoto

### Bloqueado

- Ninguna

### Terminado

- [x] Fase 0 - Gobernanza, tracker Kanban, README limpio y control de herramientas
- [x] Fase 1 - Validacion local de skills/herramientas
- [x] Fase 1.1 - Skills oficiales: Obsidian, Graphify y skills faltantes
- [x] Fase 2 - Inventario real con Graphify
- [x] Fase 3 - Estandarizar ambientes Cloudflare
- [x] Fase 4 - Separar carpetas activas
- [x] Fase 5 - Mover legacy a cuarentena
- [x] Fase 6 - Remover Sheets/App Script del proyecto activo

## Fases de la migracion

- Fase 0 - Gobernanza, tracker Kanban, README limpio y control de herramientas.
- Fase 1 - Validacion local de skills y herramientas.
- Fase 1.1 - Skills oficiales: Obsidian, Graphify y skills faltantes.
- Fase 2 - Inventario real con Graphify.
- Fase 3 - Estandarizar ambientes Cloudflare.
- Fase 4 - Separar carpetas activas.
- Fase 5 - Mover legacy a cuarentena.
- Fase 6 - Remover Sheets y Apps Script del proyecto activo.
- Fase 7A - Preview 1:1 con DB/R2 espejo, auditoria y runbook seguro.
- Fase 7B.1 - Preparar preview mirror autorizado sin ejecutar remoto.
- Fase 7B.2 - Ejecutar preview mirror autorizado.
- Fase 8 - Estandarizar rutina diaria, modelos, prompts y QA.

## Principios activos

- Burgers.exe V2 tiene solo 2 superficies oficiales: Public Order V2 e Internal Chekeo V2.
- Cloudflare D1 y R2 son la base oficial de datos y assets.
- Preview y produccion nunca comparten escritura.
- Local nunca debe escribir a produccion por accidente.
- Legacy se documenta, aisla y mueve solo por fases autorizadas.
- Esta migracion es documental y operativa por PRs pequenos, no por cambios masivos sin control.

## Decisiones abiertas

- Confirmar bindings efectivos de los cuatro proyectos Pages en Cloudflare Dashboard o via auditoria read-only mas profunda.
- Confirmar el valor efectivo de `ORDERS_V2_WRITE_ENABLED` por ambiente sin imprimir secrets.
- Definir estrategia de reset preview 1:1 sin tocar produccion.
- Confirmar en Fase 7B bindings/secrets reales por Pages project sin imprimir valores.
- Decidir ejecucion autorizada de los scripts `db:v2:preview:*` y seed preview despues de validar Dashboard.

## Bloqueadores

- Ninguno para Fase 1.
- Ninguno para Fase 1.1.
- Ninguno para Fase 2. Graphify code graph quedo actualizado; semantic analysis fallo por cuota Gemini y se aplico fallback manual aprobado.
- Ninguno bloquea Fase 3. La lista read-only de Pages no expone bindings/secrets, asi que queda como riesgo documentado para Fase 7.
- Ninguno bloquea Fase 4. La fase es documental y no mueve legacy.
- Ninguno bloquea Fase 5. Se aplico cuarentena con `git mv`, sin borrar archivos ni tocar runtime.
- Ninguno bloquea Fase 6. La limpieza es de scripts/docs y no toca runtime, legacy, Cloudflare real, D1/R2, migrations, seeds ni secrets.
- Ninguno bloquea Fase 7A. La auditoria es read-only y no ejecuta mutaciones remotas.

## Riesgos

- El README y parte de la memoria tenian rastros de la arquitectura previa basada en Sheets/App Script.
- Algunas herramientas o skills mencionadas en prompts pueden no estar instaladas en todos los clones.
- Si no se mantiene este tracker al dia, la migracion puede perder continuidad entre PRs y sesiones.
- La separacion preview vs produccion sigue dependiendo de validar configuracion real en fases posteriores.
- La Fase 1 se trabajo sobre la rama de Fase 0 porque `origin/main` todavia no tenia los documentos del PR #333.
- `C:\Users\yoliz\.codex\skills` existe como ruta historica de una PC anterior. La ruta canonica actual es `$env:USERPROFILE\.codex\skills`, que en esta PC resuelve a `C:\Users\JackPoint\.codex\skills`.
- El inventario Fase 2 detecto `cloudflare/public-order/.wrangler/` con 15 archivos trackeados dentro de una carpeta que `.gitignore` ya ignora; Fase 3 los retiro del indice sin borrar archivos locales.
- El inventario Fase 2 detecto Apps Script/Sheets todavia en la raiz del repo; son legacy y candidatos para Fase 5/Fase 6.
- `migrations/0008_preview_realistic_orders_seed.sql` existe como fixture PREVIEW/TEST ONLY; no debe ejecutarse contra produccion ni sin autorizacion.
- Wrangler local esta autenticado con permisos amplios; en Fase 3 solo se usaron comandos read-only.
- `wrangler.toml` existe como config local ignorada y no debe versionarse.
- `legacy/cloudflare/public-order/wrangler.toml` sigue como config legacy/riesgo porque apunta a recursos live.
- Los scripts `public-order:*` de `package.json` fueron removidos en Fase 6; si se requiere un flujo legacy futuro, debe definirse de nuevo con ambiente explicito y aprobacion.
- `functions/api/referral-tickets.ts` existe como endpoint D1, pero no se encontro consumo directo desde apps V2; requiere revision antes de mover o borrar.
- Los scripts `db:v2:preview:*` apuntan a `burgers-exe-menu-v2-preview`, pero usan `--remote`; requieren autorizacion explicita antes de ejecutarse.

## Hallazgos Fase 1 - 2026-07-02

### Herramientas OK

- `node --version`: `v24.18.0`
- `npm --version`: `11.16.0`
- `git --version`: `2.54.0.windows.1`
- `gh --version`: `2.95.0`
- `graphify --version`: `0.10.1`
- `npx wrangler --version`: `4.86.0`
- `npx playwright --version`: `1.60.0`

### Skills encontradas

- `graphify`: encontrada en la ruta historica `C:\Users\yoliz\.codex\skills\graphify`, con `SKILL.md`.
- `ui-ux-pro-max`: encontrada en la ruta historica `C:\Users\yoliz\.codex\skills\ui-ux-pro-max`, con `SKILL.md`.
- `ui-ux-pro-max`: `C:\Documentos\Burgers-exe\Preview\.agents\skills\ui-ux-pro-max`, con `SKILL.md`.
- `ui-ux-pro-max`: `C:\Documentos\Burgers-exe\Preview\skills\ui-ux-pro-max`, incompleta porque no tiene `SKILL.md`.

### Skills faltantes

- `burgers-pr-workflow`
- `playwright-qa`
- `burgers-brand`

### Clones/carpetas locales

- `C:\Documentos\Burgers-exe\Preview`: mantener; carpeta canonica.
- `C:\Documentos\Burgers-exe\Produccion`: clon duplicado limpio, borrado en Fase 1.
- `C:\Documentos\Burgers-exe\Agent-Lab`: no parece clon del repo; ignorado.
- `C:\Documentos\Burgers-exe\Graphify-CodeOnly`: no parece clon del repo; ignorado.

### Limpieza de indice

- `.wrangler/` estaba trackeado con 25 archivos locales de Wrangler/Miniflare.
- Se retiro `.wrangler/` del indice con `git rm --cached -r -- .wrangler` y se amplio `.gitignore`.

### Scripts agregados

- `tools/codex/verify-local-tooling.ps1`
- `tools/codex/verify-skills.ps1`
- `tools/codex/prepare-skills-sync.ps1`

## Hallazgos Fase 1.1 - 2026-07-02

### Graphify

- `graphify --version`: `0.10.1`.
- `graphify install --platform codex`: OK; instalo `C:\Users\JackPoint\.agents\skills\graphify\SKILL.md`.
- `graphify install --platform agents`: fallo en `0.10.1` con plataforma desconocida, aunque la documentacion actual ya menciona `agents`.
- En PowerShell se usa `graphify .`.
- En Codex se usa `$graphify`.
- No se ejecuto extraccion grande ni se creo `graphify-out/`.

### Obsidian skills

- Fuente autorizada revisada: `kepano/obsidian-skills`.
- Instalada copia manual controlada en `C:\Users\JackPoint\.codex\skills`.
- Skills instaladas con `SKILL.md`: `obsidian-markdown`, `obsidian-bases`, `json-canvas`, `obsidian-cli`, `defuddle`.
- No se copio el repo externo completo dentro de Burgers.exe.
- No se instalaron plugins de Obsidian dentro del repo.
- Intento previo de copia a `C:\Users\yoliz\.codex\skills`: fallo por permisos, no dejo carpetas parciales de Obsidian skills, y esa ruta queda como historica/no canonica.

### Skills propias Burgers.exe

- `burgers-pr-workflow`: creada en `C:\Users\JackPoint\.codex\skills\burgers-pr-workflow\SKILL.md`.
- `playwright-qa`: creada en `C:\Users\JackPoint\.codex\skills\playwright-qa\SKILL.md`.
- `burgers-brand`: creada en `C:\Users\JackPoint\.codex\skills\burgers-brand\SKILL.md`.

### Limpieza local

- `git-fix.js`: borrado; era script temporal no trackeado que escribia app code.
- `update-public-app.js`: borrado; era script temporal no trackeado que escribia app code.

### Validacion

- `tools/codex/verify-skills.ps1`: OK con 10 skills oficiales efectivas.
- `tools/codex/verify-skills.ps1`: usa `$env:USERPROFILE` como ruta primaria y descubre rutas historicas dinamicamente bajo `C:\Users`.
- `tools/codex/verify-local-tooling.ps1`: OK e incluye `skills-cli`.
- `tools/codex/prepare-skills-sync.ps1`: dry-run OK desde `C:\Users\JackPoint\.codex\skills`.

## Hallazgos Fase 2 - 2026-07-02

### Inventario

- Se creo `docs/codex-memory/12-v2-inventory.md`.
- Apps oficiales confirmadas: `apps/public-order-v2` y `apps/internal-chekeo-v2`.
- Codigo compartido activo confirmado: `packages/config`, `packages/ui`, `vite.config.ts` y helpers de `functions/api/_*.ts`.
- Endpoints activos V2 confirmados bajo `functions/api/*`: `menu-v2`, `orders-v2`, `assets-v2`, `internal-v2-auth`, `orders-v2-admin`, `menu-v2-admin`, `ingredients-v2-admin`, `kitchen-v2-admin`, `raffles-v2` y `raffles-v2-admin`.
- Bindings activos esperados: `BOG_MENU_DB`, `BOG_MENU_ASSETS`, `BOG_INTERNAL_PIN` y `ORDERS_V2_WRITE_ENABLED`.
- Migraciones actuales inventariadas de `0001` a `0013`.

### Graphify

- Code graph OK: `1565` nodos, `2855` edges, `96` comunidades.
- Semantic analysis no quedo completa: el corpus tiene documentos e imagenes; el intento con Gemini fallo por cuota del proveedor.
- Fallback manual aplicado con `git ls-files`, `git grep`, imports, rutas, scripts, endpoints, D1/R2, legacy, docs y assets.

### Legacy y riesgos

- `legacy/` ya esta marcado como deprecated.
- `cloudflare/public-order/`, `cloudflare/internal-chekeo/` y `cloudflare/tickets/` quedaron como candidatos para Fase 5 y fueron movidos a `legacy/cloudflare/` en Fase 5.
- Apps Script/Sheets de la raiz quedan como candidatos para Fase 5/Fase 6.
- Docs historicas con Sheets/App Script deben reclasificarse en Fase 5/Fase 6 para no contradecir D1/R2 como source of truth.

## Hallazgos Fase 3 - 2026-07-02

### Auditoria Cloudflare

- Se creo `docs/codex-memory/13-cloudflare-environments-audit.md`.
- Wrangler CLI respondio comandos read-only: version, whoami, Pages project list, D1 list y R2 bucket list.
- Pages projects Burgers.exe detectados: `burgers-exe`, `chekeo2-0`, `burgers-exe-public-v2-preview` y `burgers-exe-internal-v2-preview`.
- D1 detectados: `burgers-exe-menu-live` y `burgers-exe-menu-v2-preview`.
- R2 detectados: `burgers-exe-menu-assets` y `burgers-exe-assets-v2-preview`.
- `nutrimoney` aparece en la cuenta como Pages project no relacionado y no debe tocarse desde Burgers.exe.

### Separacion prod/preview/local

- Public V2 prod usa `burgers-exe`, D1 live y R2 live.
- Internal Chekeo V2 prod usa `chekeo2-0`, D1 live, R2 live y `BOG_INTERNAL_PIN`.
- Public V2 preview usa `burgers-exe-public-v2-preview`, D1 preview y R2 preview.
- Internal Chekeo V2 preview usa `burgers-exe-internal-v2-preview`, D1 preview, R2 preview y `BOG_INTERNAL_PIN` preview.
- Local debe usar D1 local por defecto o preview explicita; nunca produccion por default.

### Limpieza de indice

- `cloudflare/public-order/.wrangler/` seguia trackeado con 15 artefactos locales de Wrangler/Miniflare.
- Se retiro del indice con staging explicito y sin borrar archivos locales.

### Riesgos para fases siguientes

- La lista read-only de Pages no confirma bindings ni secrets por proyecto.
- Nota Fase 7B.1: `migrations/0008_preview_realistic_orders_seed.sql` existe como fixture PREVIEW/TEST ONLY; en Fase 3 aun faltaba.
- Los scripts `public-order:*` siguen clasificados como legacy/riesgo; no se reescribieron en Fase 5.

## Hallazgos Fase 4 - 2026-07-02

### Superficie activa

- Se creo `docs/codex-memory/14-active-surface-map.md`.
- Apps oficiales confirmadas: `apps/public-order-v2` y `apps/internal-chekeo-v2`.
- Runtime compartido activo confirmado: `functions/api`, `packages/config`, `packages/ui`, `vite.config.ts`, `package.json`, `migrations/`, tests y `tools/codex`.
- Graphify code graph OK: `1565` nodos, `2855` edges, `96` comunidades.
- `packages/domain` y `packages/cloudflare` siguen siendo objetivo futuro, no paquetes reales actuales.

### Endpoints y scripts

- Endpoints V2 activos documentados: `menu-v2`, `orders-v2`, `assets-v2`, `internal-v2-auth`, `orders-v2-admin`, `menu-v2-admin`, `ingredients-v2-admin`, `kitchen-v2-admin`, `raffles-v2`, `raffles-v2-admin` y `campaign-config`.
- `campaign-config` queda como activo/soporte porque `apps/public-order-v2/src/main.tsx` lo consume.
- `referral-tickets` queda como riesgo porque no se encontro consumo directo desde apps V2.
- Scripts `dev:*`, `build:*`, `typecheck`, `preview:*` y `qa:visual` quedan clasificados; en Fase 7B.1 los scripts `db:v2:*:remote` fueron reemplazados por `db:v2:preview:*`, que siguen como riesgo/prohibidos sin autorizacion.

### Candidatos Fase 5

- `cloudflare/public-order/`, `cloudflare/internal-chekeo/`, `cloudflare/tickets/`, Apps Script raiz, `planning/` y docs historicas claras fueron movidos a cuarentena en Fase 5; assets legacy de docs quedaron en revision.
- No se movio ni borro legacy en Fase 4.

## Hallazgos Fase 5 - 2026-07-02

### Cuarentena aplicada

- Se movieron con `git mv` las carpetas legacy `cloudflare/public-order/`, `cloudflare/internal-chekeo/` y `cloudflare/tickets/` a `legacy/cloudflare/`.
- Se movieron los archivos root de Apps Script/Sheets a `legacy/apps-script/`.
- Se movio `planning/` a `legacy/planning/`.
- Se movieron docs historicas claras a `legacy/docs/`: `docs/chekeo-2-*.md`, `docs/cloudflare-internal-chekeo-*.md`, `docs/menu-live-contract.md`, `docs/normalized-*.md`, `docs/ui-ux-mobile-first-plan.md`, `docs/public-order-mobile-qa.md` y `deep-research-report-actualizado.md`.
- Se movio `skills/ui-ux-pro-max/` a `legacy/skills/ui-ux-pro-max/` porque era una copia incompleta sin `SKILL.md`; la skill valida permanece en `.agents/skills/ui-ux-pro-max/`.
- Se agregaron `legacy/README.md` y `legacy/MOVED.md` como guia y ledger de movimientos.

### No movido

- No se movieron `apps/`, `functions/api/`, `packages/`, `migrations/`, `tests/` ni `tools/`.
- No se movio `functions/api/referral-tickets.ts`.
- No se movieron `docs/assets/chekeo-phase-*` porque `tests/internal-chekeo/kitchen-screenshots.spec.ts` todavia referencia `docs/assets/chekeo-phase-2-3-kitchen-production-line`.
- No se modifico `package.json`; los scripts `public-order:*` quedan como legacy/riesgo prohibido y requieren decision de Fase 6 o cleanup especifico.

### Validacion Fase 5

- `git grep` no encontro dependencias desde `apps`, `functions`, `packages`, `migrations` o `tests` hacia `cloudflare/public-order`, `cloudflare/internal-chekeo`, `cloudflare/tickets` o `skills/ui-ux-pro-max`.
- Graphify code graph OK despues del move: `1352` nodos, `2388` edges, `88` comunidades.
- Graphify semantic analysis no se ejecuto en Fase 5; se aplico fallback manual con `git grep`, `git ls-files`, revision de rutas, docs, endpoints y scripts.
- No se ejecutaron deploys, migrations, seeds, cambios de bindings, cambios de secrets ni comandos remotos de Cloudflare.

## Hallazgos Fase 6 - 2026-07-02

### Cleanup activo aplicado

- Se creo `docs/codex-memory/15-active-cleanup-sheets-appscript.md`.
- Se removieron del `package.json` activo los 11 scripts legacy `public-order:*`.
- No se creo reemplazo automatico para flujos legacy ni comandos live.
- Se actualizaron README, matriz de ambientes, spec de clean architecture, inventario, audit Cloudflare y mapa de superficie activa.
- Se marcaron docs UI/UX historicas para que rutas antiguas `cloudflare/public-order` y `cloudflare/internal-chekeo` se lean como `legacy/cloudflare/*`, no como superficie V2 activa.

### Referencias reclasificadas

- `APPS_SCRIPT_*` y `SpreadsheetApp` quedan permitidos solo como legacy/historico bajo `legacy/` o docs marcadas.
- `BOG_ACTIVE_ENV` queda como referencia historica/no-touch; no se detecto selector activo V2.
- `script.google.com` no aparecio como URL literal en el repo auditado.

### No tocado

- No se modifico runtime V2 en `apps/`, `functions/api/`, `packages/`, `migrations/` ni `tests/`.
- No se modifico `legacy/` salvo `legacy/README.md` para aclarar contexto.
- No se modifico `functions/api/referral-tickets.ts`.
- No se movieron `docs/assets/chekeo-phase-*`.
- No se ejecutaron deploys, migrations, seeds, comandos remotos de Cloudflare, cambios de bindings ni cambios de secrets.

## Hallazgos Fase 7A - 2026-07-02

### Auditoria Cloudflare read-only

- Se creo `docs/codex-memory/16-preview-mirror-runbook.md`.
- Wrangler read-only confirmo Pages projects: `burgers-exe`, `chekeo2-0`, `burgers-exe-public-v2-preview`, `burgers-exe-internal-v2-preview` y `nutrimoney` fuera de alcance.
- Wrangler read-only confirmo D1: `burgers-exe-menu-live` y `burgers-exe-menu-v2-preview`.
- Wrangler read-only confirmo R2: `burgers-exe-menu-assets` y `burgers-exe-assets-v2-preview`.
- `whoami` confirmo sesion activa; no se registran account id, tokens ni secretos en memoria.
- El token local tiene permisos amplios; no ejecutar comandos de mutacion sin autorizacion explicita.

### Scripts y bindings

- En Fase 7A, los scripts `db:v2:*:remote` apuntaban a `burgers-exe-menu-v2-preview`, pero ejecutaban `wrangler d1 execute --remote`; quedaron prohibidos.
- En Fase 7B.1, fueron reemplazados por scripts `db:v2:preview:*` con ambiente explicito; siguen prohibidos sin autorizacion.
- Bindings esperados siguen siendo `BOG_MENU_DB`, `BOG_MENU_ASSETS`, `BOG_INTERNAL_PIN` y `ORDERS_V2_WRITE_ENABLED`.
- La lista read-only no confirma bindings/secrets por Pages project; requiere Dashboard o auditoria read-only mas profunda.

### Seed faltante

- `tests/internal-chekeo/kitchen-production-board.spec.ts` lee `migrations/0008_preview_realistic_orders_seed.sql`.
- El archivo sigue faltante en Fase 7A.
- No se crea en Fase 7A porque seria un seed bajo `migrations/` y podria ejecutarse por error contra remoto.
- Fase 7B debe crear un seed preview/test-only con marcador unico, datos ficticios y comandos separados por ambiente.

### Tooling read-only

- Se agrego `tools/codex/verify-preview-readiness.ps1`.
- El script no ejecuta deploy, migrations, seeds, creates, puts, deletes ni cambios de secrets.

## Hallazgos Fase 7B.1 - 2026-07-02

### Preparacion local sin ejecucion remota

- Se reemplazaron los scripts ambiguos `db:v2:*:remote` por `db:v2:preview:*` en `package.json`.
- Los scripts `db:v2:preview:migrate`, `db:v2:preview:seed` y `db:v2:preview:orders:migrate` siguen siendo mutaciones remotas sobre `burgers-exe-menu-v2-preview`; no se ejecutaron y requieren autorizacion explicita futura.
- Se creo `migrations/0008_preview_realistic_orders_seed.sql` como PREVIEW/TEST ONLY, con datos ficticios, folios `PVW-*`, `source` `public-v2-preview`, marcador `[FIXTURE:PREVIEW_REALISTIC_ORDERS]` y sin `DELETE`.
- Se actualizo `docs/codex-memory/16-preview-mirror-runbook.md` con checklist Dashboard para bindings/secrets y comandos futuros marcados como `REQUIEREN AUTORIZACION`.
- No se ejecutaron comandos con `--remote`, deploys, migrations remotas, seeds remotos, cambios D1/R2, cambios de bindings ni cambios de secrets.

## Checklist para aprobar la siguiente fase

- [x] Existe este tracker oficial.
- [x] Existe la guia oficial de skills y herramientas.
- [x] Existe la spec de clean architecture.
- [x] Existe la matriz de ambientes.
- [x] El README ya posiciona solo 2 apps oficiales y D1/R2 como arquitectura actual.
- [x] La memoria de Codex enlaza y exige leer este tracker.
- [x] Confirmar que la siguiente fase autorizada es Fase 1.
- [x] Validar presencia real de skills y herramientas en el clon local de trabajo.
- [x] Confirmar que Graphify CLI esta disponible.
- [x] Confirmar que la siguiente fase autorizada es Fase 2.
- [x] Instalar o preparar `burgers-pr-workflow`, `playwright-qa` y `burgers-brand` antes de Fase 2.
- [x] Instalar o preparar Obsidian Agent Skills.
- [x] Validar Graphify para Codex.
- [x] Crear inventario real de Fase 2 antes de mover legacy.
- [x] Crear auditoria Fase 3 de ambientes Cloudflare antes de separar carpetas.
- [x] Confirmar recursos Pages/D1/R2 por comandos read-only.
- [x] Documentar scripts Cloudflare seguros, prohibidos y legacy.
- [x] Retirar `.wrangler` trackeado del indice sin borrar archivos locales.
- [x] Crear mapa oficial de superficie activa antes de mover legacy.
- [x] Actualizar README con Active repo surface.
- [x] Preparar lista de candidatos Fase 5 sin mover ni borrar archivos.
- [x] Mover legacy claro a cuarentena sin borrar archivos.
- [x] Documentar estructura de `legacy/` y ledger de movimientos.
- [x] Remover scripts legacy `public-order:*` del `package.json` activo.
- [x] Crear memoria Fase 6 para Sheets/App Script cleanup.
- [x] Reclasificar referencias Sheets/App Script como historicas o legacy-only.
- [x] Auditar Cloudflare read-only para Fase 7A.
- [x] Crear runbook preview mirror Fase 7A.
- [x] Clasificar scripts remotos preview y seed faltante sin ejecutarlos.
- [x] Preparar scripts `db:v2:preview:*` sin ejecutarlos.
- [x] Crear seed preview/test-only `0008_preview_realistic_orders_seed.sql` sin ejecutarlo.
- [x] Documentar checklist Dashboard antes de preview mirror autorizado.

## Ultima actualizacion

- 2026-07-02
- Responsable: Codex

## Siguiente fase sugerida

- Fase 7B.2 - Ejecutar preview mirror autorizado.

## Regla permanente

Cada PR futuro de esta migracion debe actualizar este tracker antes de cerrar.
