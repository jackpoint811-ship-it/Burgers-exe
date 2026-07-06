> Estado: vivo
> Uso: rutina diaria para Codex, QA, modelos, skills y PRs en Burgers.exe

# Fase 8 - Rutina diaria, modelos, prompts y QA

## 1. Rutina diaria

Esta rutina es el flujo estandar para trabajar en Burgers.exe con Codex sin perder trazabilidad ni mezclar preview con produccion.

1. Actualizar `main`:
   ```powershell
   git checkout main
   git pull origin main
   git status --short
   git branch --show-current
   ```
2. Revisar estado local:
   - Si hay cambios locales inesperados, detenerse y clasificarlos antes de crear rama.
   - No usar `git reset --hard`, `git checkout --`, `git add .` ni `git add -A`.
   - Confirmar que `.dev.vars`, `.wrangler/`, secrets, tokens y archivos locales no queden trackeados.
3. Correr tooling basico cuando aplique:
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\codex\verify-local-tooling.ps1
   powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\codex\verify-skills.ps1
   ```
4. Elegir modelo:
   - Mini solo para tareas sin riesgo.
   - GPT-5.4 para bugs localizados, QA y docs tecnicas.
   - GPT-5.5 Thinking para arquitectura, Cloudflare, D1/R2, migraciones, preview/prod o decisiones con riesgo.
5. Elegir skills:
   - `burgers-pr-workflow` si habra rama, commit, push o PR.
   - `obsidian-markdown` si se edita memoria viva o docs largas.
   - `playwright-qa` solo para QA visual/funcional autorizada.
   - `graphify` solo si el cambio requiere arquitectura, inventario, dependencias o multiarchivo no obvio.
6. Decidir si Graphify aplica:
   - Usar si el cambio toca varias areas, arquitectura, dependencias o fuente de verdad incierta.
   - No usar para docs aisladas, copy simple o ajustes de archivo conocido.
7. Crear rama desde `main`:
   ```powershell
   git checkout -b docs/nombre-corto
   ```
8. Trabajar en cambios:
   - Mantener PR pequeno y revisable.
   - No tocar runtime, legacy, Cloudflare, secrets, migrations o datos salvo que la fase lo autorice.
   - Actualizar tracker/memoria si se cierra una fase, cambia un riesgo o se agrega una decision.
9. Ejecutar checks:
   - Siempre: `git diff --check`.
   - Docs/tools: `verify-local-tooling.ps1` y `verify-skills.ps1` si la fase toca rutina, skills o tooling.
   - TypeScript/config/runtime: `npm run typecheck`.
   - Public V2/shared: `npm run build:public`.
   - Internal V2/shared: `npm run build:internal`.
   - UI: QA Playwright o checklist manual, solo contra targets autorizados.
10. Revisar diff completo:
    ```powershell
    git diff --stat
    git diff
    git status --short
    ```
11. Stage explicito por archivo:
    ```powershell
    git add path\to\file.md path\to\other-file.md
    git diff --cached --check
    ```
12. Commit, push y PR solo con aprobacion explicita:
    - Hacer commit, push y abrir PR solo cuando el usuario haya aprobado cerrar el trabajo o haya pedido explicitamente crear PR.
    - Si la tarea fue diagnostico, revision, auditoria, exploracion o follow-up sin autorizacion de cierre, entregar hallazgos y esperar autorizacion antes de modificar, cerrar o publicar.
    ```powershell
    git commit -m "tipo: resumen claro"
    git push -u origin nombre-de-rama
    gh pr create --base main --head nombre-de-rama
    ```
13. Esperar revision antes de merge.
14. Despues del merge, volver a `main`, hacer pull y preparar la siguiente fase solo si esta autorizada.

## Gate de publicacion

- Diagnostico, review, auditoria o investigacion no implican commit, push ni PR automatico.
- Cambios locales no deben publicarse hasta que el usuario apruebe cierre o pida explicitamente PR.
- Si el usuario solo pidio diagnostico, auditoria, revision o investigacion, Codex debe entregar hallazgos, riesgos y siguiente accion sugerida, y esperar autorizacion antes de modificar/cerrar/publicar.
- Si el usuario pidio explicitamente PR o aprobo cierre, entonces aplica rama, checks, staging explicito, commit, push y PR.
- Comentarios de bot en PR: si requieren cambiar archivos, hacer commit en la rama del PR; si solo piden ajustar PR body, checklist, replies o metadata, corregir como metadata sin tocar archivos.

## 2. Matriz de modelos

| Modelo | Usar para | No usar para | Riesgo |
| --- | --- | --- | --- |
| Mini | Copy/docs simples, exploracion corta, tareas sin riesgo, resumenes rapidos. | Cloudflare, D1/R2, migraciones, preview/prod, PRs multiarchivo, decisiones de arquitectura. | Puede pasar por alto restricciones o contexto cruzado. |
| GPT-5.4 | Bugs localizados, QA, Playwright, refactors medianos, docs tecnicas, PRs pequenos con alcance claro. | Operaciones remotas con riesgo, migraciones complejas, decisiones de arquitectura abiertas. | Adecuado si el alcance esta bien delimitado. |
| GPT-5.5 Thinking | PRs grandes controlados, arquitectura, Cloudflare, D1/R2, migrations/seeds, preview/prod, seguridad, decisiones con riesgo o varios documentos de memoria. | Copy trivial o tareas mecanicas donde seria exceso. | Mejor para razonar tradeoffs y mantener barreras de seguridad. |

## 3. Matriz de skills

| Skill | Cuando usar | Cuando no usar | Nota Burgers.exe |
| --- | --- | --- | --- |
| `burgers-pr-workflow` | Siempre que haya PR, commit, push, rama o cierre de fase. | Diagnostico puro cuando el prompt prohibe cambios o PR. | Seguir staging explicito y checks del repo. |
| `graphify` | Arquitectura, refactor, multiarchivo, inventario, dependencias o fuente de verdad incierta. | Docs aisladas, copy simple, ajustes con archivo conocido. | Si falla semantic analysis, usar fallback manual aprobado. |
| `playwright-qa` | QA visual/funcional, screenshots, smoke tests, responsive o regresiones visibles. | Docs-only o fases que prohiben URLs reales. | Nunca correr contra produccion o URLs reales sin autorizacion clara. |
| `burgers-brand` | Assets, copy, identidad visual, tono de marca o narrativa de producto. | Infraestructura o docs operativas sin copy visible. | Mantener tono Burgers.exe si se toca UX/copy. |
| `obsidian-markdown` | Memoria, bitacoras, docs largas, Markdown de `docs/codex-memory/`. | Codigo o scripts. | La fuente real para Codex sigue siendo Markdown versionado. |
| `ui-ux-pro-max` | Solo si esta disponible y completo para evaluacion UX adicional. | Si falta, esta incompleto o la fase es infra/docs operativa. | No recomendar como dependencia obligatoria. |

## 4. Checklist antes de PR

- [ ] `git status --short` muestra solo cambios esperados.
- [ ] No hay secrets, tokens, PINs, `.dev.vars`, `.wrangler/` ni credenciales en el diff.
- [ ] No hubo deploy accidental.
- [ ] No se toco produccion ni recursos `live`.
- [ ] No se toco `legacy/` salvo tarea explicita.
- [ ] No se tocaron `apps/`, `functions/api/`, `packages/`, `migrations/` o runtime si la fase era docs-only.
- [ ] `git diff --check` paso.
- [ ] `git diff --cached --check` paso despues de staging.
- [ ] `npm run typecheck` paso si se toco TypeScript, config o runtime.
- [ ] `npm run build:public` paso si se toco Public V2 o shared.
- [ ] `npm run build:internal` paso si se toco Internal V2 o shared.
- [ ] `verify-local-tooling.ps1` paso si la fase toca rutina/tooling.
- [ ] `verify-skills.ps1` paso si la fase toca skills.
- [ ] QA Playwright o manual ejecutado solo si aplica y contra targets autorizados.
- [ ] PR body incluye `Summary`, `Testing`, `Risks` y `QA checklist`.

## 5. Checklist despues de merge

- [ ] Verificar en GitHub que el PR quedo mergeado.
- [ ] Volver a `main`.
  ```powershell
  git checkout main
  git pull origin main
  git status --short
  ```
- [ ] Confirmar que `main` contiene el merge esperado.
- [ ] Actualizar tracker si aplica a la fase siguiente.
- [ ] Preparar la siguiente fase solo si hay autorizacion explicita.
- [ ] No borrar ramas, artefactos o legacy sin instruccion clara.

## 6. Reglas de preview/prod

Produccion real, no tocar sin autorizacion explicita:

- `burgers-exe`
- `chekeo2-0`
- `burgers-exe-menu-live`
- `burgers-exe-menu-assets`

Preview autorizado solo cuando la fase lo diga:

- `burgers-exe-public-v2-preview`
- `burgers-exe-internal-v2-preview`
- `burgers-exe-menu-v2-preview`
- `burgers-exe-assets-v2-preview`

Reglas:

- Produccion y preview nunca comparten escrituras.
- No ejecutar deploys, seeds, migrations, R2 writes, D1 writes, secret puts ni cambios de bindings sin autorizacion explicita.
- Para validar proyectos preview separados con bindings efectivos, usar URLs base:
  - `https://burgers-exe-public-v2-preview.pages.dev`
  - `https://burgers-exe-internal-v2-preview.pages.dev`
- No usar `--branch` salvo que se quiera validar un branch/preview environment especifico de Cloudflare Pages.
- No hacer QA contra `https://burgers-exe.pages.dev`, `https://chekeo2-0.pages.dev` o dominios custom productivos salvo autorizacion explicita de produccion.
- No imprimir ni guardar valores de secrets; validar solo presencia cuando aplique.

## 7. Plantillas de prompt

### Docs-only PR

```text
Actua como migration lead senior para Burgers.exe.

Objetivo: hacer un PR solo de documentacion.

Modelo recomendado: GPT-5.4.
Skills recomendadas: burgers-pr-workflow, obsidian-markdown si toca docs/codex-memory.
No usar: Playwright, Cloudflare remoto, Graphify salvo que haya dependencias inciertas.

Reglas duras:
- No tocar runtime, apps, functions/api, packages, migrations, legacy ni Cloudflare.
- No ejecutar deploys, seeds, migrations, D1/R2 writes ni secret puts.
- Staging explicito; no git add . ni git add -A.

Checks:
- git diff --check
- git diff --cached --check
- verify-local-tooling.ps1 si toca rutina/tooling
- verify-skills.ps1 si toca skills

PR requerido: si, solo despues de aprobacion explicita de cierre o si el usuario pidio PR.
Si la tarea es diagnostico/revision, no hacer commit/push/PR; entregar hallazgos.
```

### Bugfix localizado

```text
Actua como senior engineer para Burgers.exe.

Objetivo: corregir un bug localizado en [archivo/flujo].

Modelo recomendado: GPT-5.4.
Skills recomendadas: burgers-pr-workflow; graphify solo si la causa cruza varios archivos.
No usar: Cloudflare remoto salvo autorizacion explicita.

Reglas duras:
- No cambiar payloads, precios, tickets, promociones o reglas de negocio sin autorizacion.
- No tocar legacy ni migraciones si no son parte del bug.
- Mantener cambio minimo.

Checks:
- npm run typecheck
- build correspondiente segun app afectada
- git diff --check
- git diff --cached --check

PR requerido: si, solo despues de aprobacion explicita de cierre o si el usuario pidio PR.
Si la tarea es diagnostico/revision, no hacer commit/push/PR; entregar hallazgos.
```

### UI/UX polish

```text
Actua como UI engineer senior para Burgers.exe.

Objetivo: pulir UI/UX de [pantalla/flujo] sin cambiar contratos de datos.

Modelo recomendado: GPT-5.4.
Skills recomendadas: burgers-pr-workflow, playwright-qa si hay QA visual autorizado, burgers-brand si toca copy/tono.
No usar: Cloudflare remoto, migrations, seeds.

Reglas duras:
- Mantener mobile-first, accesibilidad, foco visible y targets tactiles.
- No cambiar precios, payloads, promociones, tickets ni reglas comerciales.
- No hacer refactor masivo.

Checks:
- npm run typecheck
- build correspondiente
- QA visual/manual segun target autorizado
- git diff --check
- git diff --cached --check

PR requerido: si, solo despues de aprobacion explicita de cierre o si el usuario pidio PR.
Si la tarea es diagnostico/revision, no hacer commit/push/PR; entregar hallazgos.
```

### QA Playwright

```text
Actua como QA lead para Burgers.exe.

Objetivo: ejecutar QA Playwright contra [target autorizado].

Modelo recomendado: GPT-5.4.
Skills recomendadas: playwright-qa, burgers-pr-workflow si se documentan cambios.
No usar: URLs productivas reales salvo autorizacion explicita.

Reglas duras:
- Confirmar target antes de correr.
- No escribir datos reales.
- No usar PINs/secrets en logs.
- No tocar Cloudflare config.

Checks:
- comando Playwright autorizado
- capturas/evidencia si aplica
- git diff --check si se generan docs

PR requerido: solo si se documentan hallazgos o se cambian archivos, y solo despues de aprobacion explicita de cierre o si el usuario pidio PR.
Si la tarea es diagnostico/revision, no hacer commit/push/PR; entregar hallazgos.
```

### Cloudflare preview read-only

```text
Actua como Cloudflare engineer senior para Burgers.exe.

Objetivo: auditoria read-only de preview.

Modelo recomendado: GPT-5.5 Thinking.
Skills recomendadas: burgers-pr-workflow si habra docs/PR; obsidian-markdown para bitacora.
No usar: Playwright salvo target preview autorizado.

Reglas duras:
- Solo comandos read-only.
- No deploys, seeds, migrations, writes D1/R2, secret puts ni cambios de bindings.
- No tocar produccion real.
- No imprimir secrets.

Checks:
- verify-preview-readiness.ps1
- git diff --check si se documenta
- git diff --cached --check

PR requerido: si se actualiza memoria/bitacora, y solo despues de aprobacion explicita de cierre o si el usuario pidio PR.
Si la tarea es diagnostico/revision, no hacer commit/push/PR; entregar hallazgos.
```

### Cloudflare preview autorizado

```text
Actua como Cloudflare migration lead senior para Burgers.exe.

Objetivo: ejecutar operacion preview autorizada: [detalle exacto].

Modelo recomendado: GPT-5.5 Thinking.
Skills recomendadas: burgers-pr-workflow, obsidian-markdown, playwright-qa solo contra URLs preview autorizadas.
No usar: burgers-brand, ui-ux-pro-max.

Reglas duras:
- La autorizacion solo cubre recursos preview nombrados explicitamente.
- No tocar burgers-exe, chekeo2-0, burgers-exe-menu-live ni burgers-exe-menu-assets.
- No ejecutar secrets/bindings/migrations/seeds/deploys fuera del alcance autorizado.
- Para proyectos preview separados con bindings efectivos, validar URLs base y no usar --branch salvo que se quiera validar branch/preview environment.

Checks:
- preflight local
- D1 read-only antes/despues si aplica
- QA HTTP/Playwright solo contra preview
- git diff --check
- git diff --cached --check

PR requerido: si, con bitacora operacional, solo despues de aprobacion explicita de cierre o si el usuario pidio PR.
Si la tarea es diagnostico/revision, no hacer commit/push/PR; entregar hallazgos.
```

### Review follow-up de PR

```text
Actua como maintainer senior para Burgers.exe.

Objetivo: corregir comentarios de review en PR #[numero].

Modelo recomendado: GPT-5.4; GPT-5.5 Thinking si toca Cloudflare/D1/R2.
Skills recomendadas: burgers-pr-workflow.
No usar: cambios fuera del comentario.

Reglas duras:
- Leer comentario y diff actual antes de editar.
- Fix minimo.
- No tocar runtime/Cloudflare/legacy si el comentario es docs-only.
- No resolver conversaciones ni mergear sin instruccion.

Checks:
- checks indicados por el comentario
- git diff --check
- git diff --cached --check

PR requerido: usar la misma rama del PR salvo instruccion distinta, solo si el comentario requiere cambios de archivo o el usuario pidio actualizar la rama.
Si la tarea es diagnostico/revision, no hacer commit/push/PR; entregar hallazgos.
```

### Fix de bot comments

```text
Actua como maintainer senior para Burgers.exe.

Objetivo: corregir comentarios validos del bot en PR #[numero].

Modelo recomendado: GPT-5.4; GPT-5.5 Thinking si el bot senala riesgo de datos, Cloudflare o migraciones.
Skills recomendadas: burgers-pr-workflow.
No usar: refactors oportunistas.

Reglas duras:
- Arreglar solo comentarios P1/P2/P3 aceptados.
- No tocar secrets, bindings, produccion, D1/R2 ni migrations salvo que el comentario lo requiera y este autorizado.
- Mantener diff pequeno.

Checks:
- checks pedidos por el usuario o bot
- git diff --check
- git diff --cached --check

PR requerido: actualizar la rama existente del PR solo si el bot requiere cambios de archivo. Si el fix es PR body, checklist, replies o metadata, corregir metadata sin commit.
Si la tarea es diagnostico/revision, no hacer commit/push/PR; entregar hallazgos.
```
