# Workflow automático para Codex / agentes

Este documento define el flujo que debe seguir cualquier agente que trabaje en Burgers.exe.

## Objetivo

Evitar que el agente se pierda, repita contexto o deje cambios locales sin cerrar. El repo debe guiar al agente por memoria, análisis, cambios, checks y Pull Request.

## Flujo obligatorio

Antes de tocar código:

1. Leer `AGENTS.md`.
2. Leer `docs/codex-memory/00-indice.md`.
3. Leer el archivo de memoria específico según el área:
   - Chekeo: `03-flujos-chekeo.md`.
   - Public order: `04-flujo-public-order.md`.
   - Decisiones previas: `07-decisiones.md`.
   - Backlog: `05-backlog.md`.
4. Si el cambio toca varios archivos, arquitectura, flujos conectados o hay duda de dependencias, usar Graphify antes de modificar.
5. Confirmar alcance:
   - qué archivos se planea tocar,
   - qué archivos NO se deben tocar,
   - qué checks aplican.

Durante el cambio:

1. Crear rama nueva desde la rama base correcta.
2. Hacer cambios mínimos suficientes para resolver el objetivo.
3. No hacer refactors oportunistas.
4. No introducir dependencias nuevas sin autorización explícita.
5. No cambiar contratos de datos, precios, tickets, promociones, payloads ni reglas comerciales sin autorización explícita.
6. Actualizar memoria si el cambio crea una decisión nueva, cambia backlog o modifica reglas de trabajo.

Antes de abrir PR:

1. Revisar diff completo.
2. Ejecutar `git diff --check`.
3. Ejecutar checks técnicos aplicables:
   - `npm run typecheck` si se toca TypeScript, configuración o código de app.
   - `npm run build:public` si se toca `apps/public-order-v2` o código compartido que pueda afectarlo.
4. Si un check no aplica o no pudo ejecutarse, reportarlo claramente.
5. Preparar resumen de PR con:
   - Summary,
   - Testing,
   - Risks,
   - QA checklist.

Al cerrar trabajo:

1. Commit con mensaje claro.
2. Push de la rama.
3. Crear Pull Request.
4. Reportar link del PR.
5. No hacer merge automático salvo instrucción explícita.

## Regla de memoria viva

El agente debe actualizar la memoria cuando aplique:

- `05-backlog.md`: si aparece una tarea nueva o se termina una pendiente relevante.
- `06-prompts-buenos.md`: si se descubre un prompt reusable.
- `07-decisiones.md`: si se toma una decisión de producto, UX, arquitectura o workflow.
- `08-agent-workflow.md`: si cambia el proceso de trabajo.
- `09-checklists.md`: si cambia el estándar de QA.

## Señales para usar Graphify

Usar Graphify primero cuando:

- El cambio toca 2 o más áreas del repo.
- El agente no sabe qué archivo es la fuente de verdad.
- El cambio puede afectar datos, tickets, pagos, pedidos, corte, sorteo o WhatsApp.
- El cambio involucra componentes compartidos.
- El cambio es de arquitectura, refactor o migración.
- El usuario pide diagnóstico antes de implementar.

No es obligatorio usar Graphify para:

- Copy simple.
- Documentación aislada.
- Cambios visuales muy localizados.
- Ajustes de una sola línea con archivo conocido.

## Formato mínimo de respuesta del agente

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
