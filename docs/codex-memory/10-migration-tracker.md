> Estado: vivo
> Uso: tablero Kanban oficial para la migracion V2 limpia

# Burgers.exe V2 Clean Architecture Tracker

## Estado

- Vivo
- Fase actual: Fase 1.1

## Kanban

### Backlog

- [ ] Fase 2 - Inventario real con Graphify
- [ ] Fase 3 - Estandarizar ambientes Cloudflare
- [ ] Fase 4 - Separar carpetas activas
- [ ] Fase 5 - Mover legacy a cuarentena
- [ ] Fase 6 - Remover Sheets/App Script del proyecto activo
- [ ] Fase 7 - Preview 1:1 con DB/R2 espejo
- [ ] Fase 8 - Estandarizar rutina diaria, modelos, prompts y QA

### En progreso

- Ninguna

### En revision

- [ ] Fase 1.1 - Skills oficiales: Obsidian, Graphify y skills faltantes

### Bloqueado

- Ninguna

### Terminado

- [x] Fase 0 - Gobernanza, tracker Kanban, README limpio y control de herramientas
- [x] Fase 1 - Validacion local de skills/herramientas

## Fases de la migracion

- Fase 0 - Gobernanza, tracker Kanban, README limpio y control de herramientas.
- Fase 1 - Validacion local de skills y herramientas.
- Fase 1.1 - Skills oficiales: Obsidian, Graphify y skills faltantes.
- Fase 2 - Inventario real con Graphify.
- Fase 3 - Estandarizar ambientes Cloudflare.
- Fase 4 - Separar carpetas activas.
- Fase 5 - Mover legacy a cuarentena.
- Fase 6 - Remover Sheets y Apps Script del proyecto activo.
- Fase 7 - Preview 1:1 con DB y R2 espejo.
- Fase 8 - Estandarizar rutina diaria, modelos, prompts y QA.

## Principios activos

- Burgers.exe V2 tiene solo 2 superficies oficiales: Public Order V2 e Internal Chekeo V2.
- Cloudflare D1 y R2 son la base oficial de datos y assets.
- Preview y produccion nunca comparten escritura.
- Local nunca debe escribir a produccion por accidente.
- Legacy se documenta, aisla y mueve solo por fases autorizadas.
- Esta migracion es documental y operativa por PRs pequenos, no por cambios masivos sin control.

## Decisiones abiertas

- Confirmar si Fase 2 usara solo Graphify CLI directo o tambien la skill `$graphify`.
- Confirmar nombres finales y bindings efectivos de los proyectos Pages preview antes de Fase 3.
- Confirmar la estrategia exacta de local: D1 local por defecto o preview explicita segun cada flujo.

## Bloqueadores

- Ninguno para Fase 1.
- Ninguno para Fase 1.1.
- Para Fase 2, Graphify CLI esta disponible; si la skill falla, usar fallback manual documentado.

## Riesgos

- El README y parte de la memoria tenian rastros de la arquitectura previa basada en Sheets/App Script.
- Algunas herramientas o skills mencionadas en prompts pueden no estar instaladas en todos los clones.
- Si no se mantiene este tracker al dia, la migracion puede perder continuidad entre PRs y sesiones.
- La separacion preview vs produccion sigue dependiendo de validar configuracion real en fases posteriores.
- La Fase 1 se trabajo sobre la rama de Fase 0 porque `origin/main` todavia no tenia los documentos del PR #333.
- `C:\Users\yoliz\.codex\skills` existe como ruta historica de una PC anterior. La ruta canonica actual es `$env:USERPROFILE\.codex\skills`, que en esta PC resuelve a `C:\Users\JackPoint\.codex\skills`.

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
- [ ] Confirmar que la siguiente fase autorizada es Fase 2.
- [x] Instalar o preparar `burgers-pr-workflow`, `playwright-qa` y `burgers-brand` antes de Fase 2.
- [x] Instalar o preparar Obsidian Agent Skills.
- [x] Validar Graphify para Codex.

## Ultima actualizacion

- 2026-07-02
- Responsable: Codex

## Siguiente fase sugerida

- Fase 2 - Inventario real con Graphify.

## Regla permanente

Cada PR futuro de esta migracion debe actualizar este tracker antes de cerrar.
