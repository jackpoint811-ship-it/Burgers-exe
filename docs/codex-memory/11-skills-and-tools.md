> Estado: vivo
> Uso: reglas oficiales para skills, herramientas y validacion local

# Burgers.exe V2 Skills and Tools

## Objetivo

Evitar que Codex falle por llamar skills no instaladas, usar herramientas incorrectas o perder precision durante una migracion larga.

## Regla base

- `AGENTS.md` sigue siendo la regla dura.
- `docs/codex-memory/` es la memoria viva real para Codex.
- Obsidian no reemplaza Codex ni reemplaza la lectura directa de Markdown en el repo.
- Si una skill o herramienta falta, primero se reporta el faltante y luego se sigue el mejor flujo manual permitido por la fase.

## Decision de estrategia

- Global = runtime real de Codex.
- Repo = respaldo, documentacion, scripts y control.
- No versionar repos externos completos dentro de Burgers.exe sin una razon explicita.
- La ruta primaria en esta PC es `$env:USERPROFILE\.codex\skills`.
- En esta PC, `$env:USERPROFILE` resuelve a `C:\Users\JackPoint`.
- `C:\Users\yoliz\.codex\skills` es una ruta historica de una PC anterior; puede revisarse como referencia si existe, pero no es canonica.
- `graphify install --platform codex` tambien instalo skill en `C:\Users\JackPoint\.agents\skills\graphify`.

## Skills oficiales

### `graphify`

- Uso principal: inventario, mapa de dependencias y lectura de arquitectura o cambios multiarchivo.
- Cuando es obligatoria: fases de inventario, arquitectura, migracion, o cuando la fuente de verdad no esta clara.
- Cuando es opcional: revisiones documentales pequenas o cambios muy localizados con archivo conocido.
- Cuando NO conviene usarla: tareas de copy simple o docs aisladas sin impacto estructural.
- Que hacer si falta: reportar el faltante, documentar el riesgo y continuar con inspeccion manual solo si la fase lo permite.
- PowerShell: usar `graphify .`.
- Codex: usar `$graphify`.
- Fase 2 debe usar Graphify CLI directo si la skill no responde.
- `graphify install --platform codex` instala la skill para Codex.
- `graphify install --platform agents` esta documentado upstream, pero fallo en Graphify `0.10.1` como plataforma desconocida.

### `burgers-pr-workflow`

- Uso principal: estandarizar rama, commit, push, PR y checklist final para este repo.
- Cuando es obligatoria: cierres de PR cuando la skill exista y la fase ya permita cerrar el trabajo.
- Cuando es opcional: cuando el flujo manual del repo ya cubre el cierre y la skill no aporta validacion adicional.
- Cuando NO conviene usarla: fases de solo diagnostico o cuando el prompt prohibe commit, push o PR.
- Que hacer si falta: seguir `AGENTS.md`, `08-agent-workflow.md` y `09-checklists.md` de forma manual.

### `playwright-qa`

- Uso principal: QA visual y de flujo en UI publica, Chekeo, checkout, responsive y regresiones visibles.
- Cuando es obligatoria: fases que toquen UI, interaccion, responsive, visual QA o navegacion critica.
- Cuando es opcional: cambios documentales o backend puro sin superficie visible.
- Cuando NO conviene usarla: Fase 0 documental o cambios que no alteran runtime ni interfaz.
- Que hacer si falta: reportar la limitacion y dejar checklist manual de QA; no inventar resultados.

### `ui-ux-pro-max`

- Uso principal: criterio adicional para claridad, consistencia y calidad de experiencia cuando una fase toca interfaz o documentacion de UX.
- Cuando es obligatoria: no es obligatoria por defecto.
- Cuando es opcional: redaccion de docs de producto, evaluacion de flujos o refinamiento de lenguaje UX.
- Cuando NO conviene usarla: tareas puramente operativas o de infraestructura sin impacto de experiencia.
- Que hacer si falta: continuar con criterios del repo y del usuario sin bloquear la fase.

### `burgers-brand`

- Uso principal: mantener tono Burgers.exe en docs, UX, copy y lineamientos de marca.
- Cuando es obligatoria: cuando la fase cambia copy visible, narrativa de marca o lineamientos permanentes.
- Cuando es opcional: docs tecnicas donde basta claridad operativa.
- Cuando NO conviene usarla: tareas puramente tecnicas sin copy de producto.
- Que hacer si falta: conservar tono Burgers.exe con las reglas permanentes del repo y reportar el faltante si era importante.

## Obsidian Agent Skills

Fuente autorizada: `kepano/obsidian-skills`.

Estas skills siguen el formato Agent Skills y son compatibles con agentes que leen `SKILL.md`. Para Codex, la instalacion manual recomendada por el repo externo es copiar `skills/` al path de skills de Codex.

### `obsidian-markdown`

- Uso: editar memoria Markdown de Obsidian con wikilinks, embeds, callouts, propiedades y sintaxis Obsidian.
- Usar cuando se editen `.md` dentro de `docs/codex-memory/` o memoria Markdown compatible.
- No crea una memoria paralela; Codex sigue leyendo los `.md` del repo.

### `obsidian-bases`

- Uso: crear o editar archivos `.base`.
- Usar solo si el flujo requiere Obsidian Bases.
- No usar para docs Markdown normales.

### `json-canvas`

- Uso: crear o editar archivos `.canvas` con formato JSON Canvas.
- Usar solo si se crean canvases, mapas visuales o diagramas Obsidian Canvas.
- No sustituye diagramas Mermaid ni docs Markdown cuando no hay `.canvas`.

### `obsidian-cli`

- Uso: interactuar con vaults mediante Obsidian CLI.
- Usar solo si Obsidian CLI esta instalado y el flujo lo requiere.
- No instalar plugins de Obsidian dentro del repo de Burgers.exe.

### `defuddle`

- Uso: limpiar paginas web a Markdown cuando haya que guardar o analizar contenido web para memoria.
- Usar solo cuando se necesite limpiar paginas web; no usar para URLs que ya son Markdown.

## Graphify Skill

- `graphify --version` validado en Fase 1.1: `0.10.1`.
- `graphify install --platform codex` validado: instala `C:\Users\JackPoint\.agents\skills\graphify\SKILL.md`.
- `graphify install --platform agents` probado: falla en `0.10.1` por plataforma desconocida.
- No correr `graphify .` hasta Fase 2.
- Si se crea `graphify-out/`, debe ser tratado como artefacto de Fase 2 y decidir si se ignora o se conserva.

## Herramientas oficiales

### Git

- Uso: ramas, diff, staging, commit y control de cambios.
- Cuando aplica: siempre que haya cambios reales.
- Como validar presencia: `git --version`.
- Que hacer si falta: bloquear el cierre del PR y reportar la limitacion.

### GitHub CLI o flujo de PR disponible

- Uso: push, PR y consulta de estado remoto.
- Cuando aplica: cuando la fase requiere cerrar rama y abrir PR.
- Como validar presencia: `gh --version` o confirmar que existe otro flujo de PR disponible.
- Que hacer si falta: dejar rama lista y reportar el bloqueo para abrir PR.

### npm

- Uso: scripts del repo, checks y builds.
- Cuando aplica: validacion de TypeScript, build y tareas de proyecto.
- Como validar presencia: `npm --version`.
- Que hacer si falta: reportar limitacion y no inventar checks.

### node

- Uso: runtime base del repo y soporte para npm y herramientas JS.
- Cuando aplica: siempre que se ejecuten scripts Node.
- Como validar presencia: `node --version`.
- Que hacer si falta: bloquear checks y reportarlo.

### Wrangler

- Uso: Pages Functions, D1, R2 y validacion Cloudflare.
- Cuando aplica: fases que toquen Cloudflare, D1, R2, Pages o runtime local con Functions.
- Como validar presencia: `npx wrangler --version` o `wrangler --version`.
- Que hacer si falta: documentar el bloqueo y no simular validaciones Cloudflare.

### Graphify CLI

- Uso: inventario y mapa real del repo.
- Cuando aplica: fases de arquitectura, separacion de carpetas o migracion multi-area.
- Como validar presencia: ejecutar el comando o skill oficial de Graphify que use el equipo.
- Que hacer si falta: reportar que el inventario se hizo manualmente y marcar el riesgo.

### Playwright

- Uso: QA navegable automatizada o asistida para UI.
- Cuando aplica: fases con interfaz, responsive o regresion visual/funcional.
- Como validar presencia: ejecutar el comando o skill oficial de Playwright disponible en el clon.
- Que hacer si falta: dejar QA manual sugerido y marcar la limitacion.

### Obsidian

- Uso: edicion visual/manual de la memoria Markdown.
- Cuando aplica: mantenimiento manual del conocimiento del repo fuera de Codex.
- Como validar presencia: confirmar que el usuario tiene acceso a su vault o app, si realmente importa para la fase.
- Que hacer si falta: continuar editando Markdown directo en el repo; no es bloqueador para Codex.

### VS Code

- Uso: inspeccion y edicion manual del repo por humanos.
- Cuando aplica: soporte de revision humana, no como requisito de runtime.
- Como validar presencia: confirmar disponibilidad local si el usuario lo necesita.
- Que hacer si falta: no bloquear la fase; Codex puede trabajar sin VS Code.

### Cloudflare Dashboard

- Uso: revisar proyectos Pages, bindings, secrets, D1, R2 y estado de despliegue.
- Cuando aplica: fases de ambientes, bindings, preview, produccion o auditoria Cloudflare.
- Como validar presencia: confirmar acceso humano cuando una fase requiera verificaciones remotas manuales.
- Que hacer si falta: documentar que la validacion remota queda pendiente y no asumir estado actual.

## Regla sobre Obsidian

- Obsidian no reemplaza Codex.
- Obsidian es editor visual/manual de memoria Markdown.
- La fuente real de memoria para Codex vive en `docs/codex-memory/`.
- `AGENTS.md` sigue siendo la regla dura.
- Codex debe leer los `.md` desde el repo, no depender de la app Obsidian.

## Regla de validacion local

Cada carpeta local de trabajo tipo:

- `Preview`
- `Preview-fase2`
- `Burgers-exe-pr`
- cualquier clon futuro

debe poder validar, segun la fase:

- existe `AGENTS.md`,
- existe `docs/codex-memory/00-indice.md`,
- existe `docs/codex-memory/10-migration-tracker.md`,
- existe `docs/codex-memory/11-skills-and-tools.md`,
- existen las skills oficiales o se reportan faltantes,
- Graphify responde si la fase lo requiere,
- npm y node responden,
- Wrangler responde si la fase toca Cloudflare,
- Playwright responde si la fase toca UI.

## Checklist operativo de validacion local

- [ ] Confirmar presencia de `AGENTS.md`.
- [ ] Confirmar presencia de `docs/codex-memory/00-indice.md`.
- [ ] Confirmar presencia de `docs/codex-memory/10-migration-tracker.md`.
- [ ] Confirmar presencia de `docs/codex-memory/11-skills-and-tools.md`.
- [ ] Confirmar skills oficiales o documentar faltantes.
- [ ] Confirmar Graphify si la fase lo requiere.
- [ ] Confirmar npm y node.
- [ ] Confirmar Wrangler si la fase toca Cloudflare.
- [ ] Confirmar Playwright si la fase toca UI.
- [ ] Si algo falta, reportar si es bloqueo total o limitacion operativa.

## Validacion local Fase 1 - 2026-07-02

### Comandos ejecutados

- `node --version`
- `npm --version`
- `git --version`
- `gh --version`
- `graphify --version`
- `npx wrangler --version`
- `npx playwright --version`
- `git status --short`
- `git branch --show-current`

### Resultado de herramientas

- Node: OK, `v24.18.0`.
- npm: OK, `11.16.0`.
- Git: OK, `2.54.0.windows.1`.
- GitHub CLI: OK, `2.95.0`.
- Graphify CLI: OK, `0.10.1`.
- Wrangler: OK, `4.86.0`.
- Playwright: OK, `1.60.0`.

### Resultado de skills registrado en Fase 1

- `graphify`: encontrada en ruta historica `C:\Users\yoliz\.codex\skills\graphify`, con `SKILL.md`.
- `ui-ux-pro-max`: encontrada en ruta historica `C:\Users\yoliz\.codex\skills\ui-ux-pro-max`, con `SKILL.md`.
- `ui-ux-pro-max`: encontrada en `C:\Documentos\Burgers-exe\Preview\.agents\skills\ui-ux-pro-max`, con `SKILL.md`.
- `ui-ux-pro-max`: encontrada en `C:\Documentos\Burgers-exe\Preview\skills\ui-ux-pro-max`, incompleta porque no tiene `SKILL.md`.
- `burgers-pr-workflow`: faltante.
- `playwright-qa`: faltante como skill local, aunque Playwright CLI esta disponible.
- `burgers-brand`: faltante.

### Estrategia recomendada para skills

- Estrategia preferida: mantener skills canonicas en `$env:USERPROFILE\.codex\skills`.
- En esta PC, la ruta canonica actual es `C:\Users\JackPoint\.codex\skills`.
- Estrategia local: usar `.agents\skills` solo para skills aprobadas que deban viajar con el repo o con un clon de trabajo.
- Sincronizacion: ejecutar siempre primero `tools/codex/prepare-skills-sync.ps1` en dry-run.
- No sobrescribir carpetas existentes sin revision humana.
- No copiar skills pesadas o incompletas al repo sin decidir que deben versionarse.

### Scripts agregados

- `tools/codex/verify-local-tooling.ps1`: valida herramientas, archivos base de Fase 0 y estado Git.
- `tools/codex/verify-skills.ps1`: valida rutas de skills oficiales y presencia de `SKILL.md`.
- `tools/codex/prepare-skills-sync.ps1`: prepara copia de skills oficiales en modo dry-run por defecto.

### Resultado de dry-run de sync

- Fuente probada en Fase 1 antes de normalizar esta PC: ruta historica `C:\Users\yoliz\.codex\skills`.
- `graphify`: se podria copiar a `.agents\skills` si el equipo decide versionarla localmente.
- `ui-ux-pro-max`: no se copia porque ya existe en `.agents\skills`.
- `burgers-pr-workflow`, `playwright-qa` y `burgers-brand`: no se copian porque no existen en la fuente validada.

## Validacion local Fase 1.1 - 2026-07-02

### Resultado de skills

- `graphify`: OK en `C:\Users\JackPoint\.agents\skills\graphify`; tambien existe una copia historica en `C:\Users\yoliz\.codex\skills\graphify`.
- `ui-ux-pro-max`: OK en `.agents\skills\ui-ux-pro-max`; tambien existe una copia historica en `C:\Users\yoliz\.codex\skills\ui-ux-pro-max`; incompleta en `skills\ui-ux-pro-max` porque no tiene `SKILL.md`.
- `burgers-pr-workflow`: OK en `C:\Users\JackPoint\.codex\skills\burgers-pr-workflow`.
- `playwright-qa`: OK en `C:\Users\JackPoint\.codex\skills\playwright-qa`.
- `burgers-brand`: OK en `C:\Users\JackPoint\.codex\skills\burgers-brand`.
- `obsidian-markdown`: OK en `C:\Users\JackPoint\.codex\skills\obsidian-markdown`.
- `obsidian-bases`: OK en `C:\Users\JackPoint\.codex\skills\obsidian-bases`.
- `json-canvas`: OK en `C:\Users\JackPoint\.codex\skills\json-canvas`.
- `obsidian-cli`: OK en `C:\Users\JackPoint\.codex\skills\obsidian-cli`.
- `defuddle`: OK en `C:\Users\JackPoint\.codex\skills\defuddle`.

### Instalacion Obsidian

- `npx skills --help` esta disponible, pero la instalacion global con `npx skills` sigue el usuario activo.
- Se uso copia manual controlada desde un clon temporal de `kepano/obsidian-skills`.
- El clon temporal se borro despues de copiar las skills necesarias.
- La copia a la ruta historica `C:\Users\yoliz\.codex\skills` fallo por permisos y no dejo carpetas parciales de Obsidian skills.
- La copia a `C:\Users\JackPoint\.codex\skills` fue exitosa.

### Scripts actualizados

- `verify-skills.ps1` detecta 10 skills oficiales, usa `$env:USERPROFILE` como ruta primaria, descubre rutas historicas dinamicamente bajo `C:\Users`, y compara actual vs historica.
- `verify-skills.ps1` diferencia `OK`, `FALTA`, `INCOMPLETA`, `EXTERNAL` y `PROPIA`.
- `verify-local-tooling.ps1` valida tambien `npx skills`.
- `prepare-skills-sync.ps1` incluye Obsidian skills y skills propias en su dry-run.

### Fallback si Graphify falla en Fase 2

Graphify CLI esta disponible en este clon. Si falla durante Fase 2, el fallback manual aprobado es:

- `git ls-files`
- `git grep`
- `npm run typecheck`
- `npm run build:public`
- `npm run build:internal`
- revision de imports, rutas y scripts
- busqueda de referencias a Apps Script, Sheets, legacy, `.wrangler`, `/api/order` y `/api/rpc`

## Regla permanente

Los scripts de validacion local viven en `tools/codex/`. Deben ser no destructivos por defecto y documentar cualquier accion antes de ejecutarla.
