# Workflow automatico para Codex / agentes

Este documento define el flujo que debe seguir cualquier agente que trabaje en Burgers.exe.

## Objetivo

Evitar que el agente se pierda, repita contexto o deje cambios locales sin cerrar. El repo debe guiar al agente por memoria, analisis, cambios, checks y Pull Request.

## Flujo obligatorio

Antes de tocar codigo:

1. Leer `AGENTS.md`.
2. Leer `docs/codex-memory/00-indice.md`.
3. Si el trabajo pertenece a la migracion V2 Clean Architecture, leer `docs/codex-memory/10-migration-tracker.md`.
4. Si el trabajo requiere herramientas, QA o Cloudflare, leer `docs/codex-memory/11-skills-and-tools.md`.
5. Leer el archivo de memoria especifico segun el area:
   - Chekeo: `03-flujos-chekeo.md`.
   - Public order: `04-flujo-public-order.md`.
   - Decisiones previas: `07-decisiones.md`.
   - Backlog: `05-backlog.md`.
6. Si el cambio toca varios archivos, arquitectura, flujos conectados o hay duda de dependencias, usar Graphify antes de modificar, si esta disponible.
7. Confirmar alcance:
   - que archivos se planea tocar,
   - que archivos NO se deben tocar,
   - que checks aplican.

## Continuidad para migracion V2 Clean Architecture

Antes de iniciar cualquier fase de la migracion V2 Clean Architecture, el agente debe:

1. Leer `docs/codex-memory/10-migration-tracker.md`.
2. Identificar la fase actual.
3. Confirmar el ultimo PR aprobado.
4. Confirmar la siguiente fase autorizada.
5. Leer `docs/codex-memory/11-skills-and-tools.md` si hay uso de herramientas.
6. No saltar fases sin aprobacion explicita.
7. Actualizar el tracker antes de cerrar el PR.
8. Reportar fase completada, fase siguiente sugerida, decisiones nuevas, bloqueadores, riesgos y preguntas para el usuario.

## Durante el cambio

1. Crear rama nueva desde la rama base correcta.
2. Hacer cambios minimos suficientes para resolver el objetivo.
3. No hacer refactors oportunistas.
4. No introducir dependencias nuevas sin autorizacion explicita.
5. No cambiar contratos de datos, precios, tickets, promociones, payloads ni reglas comerciales sin autorizacion explicita.
6. Actualizar memoria si el cambio crea una decision nueva, cambia backlog o modifica reglas de trabajo.

## Antes de abrir PR

1. Revisar diff completo.
2. Ejecutar `git diff --check`.
3. Ejecutar checks tecnicos aplicables:
   - `npm run typecheck` si se toca TypeScript, configuracion o codigo de app.
   - `npm run build:public` si se toca `apps/public-order-v2` o codigo compartido que pueda afectarlo.
   - `npm run build:internal` si se toca `apps/internal-chekeo-v2` o codigo compartido que pueda afectarlo.
4. Si un check no aplica o no pudo ejecutarse, reportarlo claramente.
5. Preparar resumen de PR con:
   - Summary,
   - Testing,
   - Risks,
   - QA checklist.

## Al cerrar trabajo

1. Commit con mensaje claro.
2. Push de la rama.
3. Crear Pull Request.
4. Reportar link del PR.
5. No hacer merge automatico salvo instruccion explicita.
6. **Actualización de Memoria (Obsidian)**: Actualizar `docs/codex-memory/01-estado-actual.md` con el estado en el que queda el proyecto.
7. **Recomendación de Reinicio**: Indicar al usuario que cierre el chat actual para limpiar el contexto acumulado y reducir el consumo de tokens en la siguiente tarea.

## Regla de memoria viva

El agente debe actualizar la memoria cuando aplique:

- `05-backlog.md`: si aparece una tarea nueva o se termina una pendiente relevante.
- `06-prompts-buenos.md`: si se descubre un prompt reusable.
- `07-decisiones.md`: si se toma una decision de producto, UX, arquitectura o workflow.
- `08-agent-workflow.md`: si cambia el proceso de trabajo.
- `09-checklists.md`: si cambia el estandar de QA.

## Senales para usar Graphify

Usar Graphify primero cuando:

- El cambio toca 2 o mas areas del repo.
- El agente no sabe que archivo es la fuente de verdad.
- El cambio puede afectar datos, tickets, pagos, pedidos, corte, sorteo o WhatsApp.
- El cambio involucra componentes compartidos.
- El cambio es de arquitectura, refactor o migracion.
- El usuario pide diagnostico antes de implementar.

No es obligatorio usar Graphify para:

- Copy simple.
- Documentacion aislada.
- Cambios visuales muy localizados.
- Ajustes de una sola linea con archivo conocido.

## Formato minimo de respuesta del agente

Al terminar, el agente debe responder con:

```text
Resumen:
- ...

Archivos modificados:
- ...

Checks:
- ...

Riesgos:
- ...

QA sugerido:
- ...

PR:
- ...
```

## Regla anti-desorden

Si el agente detecta que una rama existente tiene cambios no relacionados, no debe abrir PR desde esa rama. Debe cerrar o evitar ese PR y crear una rama limpia desde `main`.
