# AGENTS.md — Reglas permanentes para Codex en Burgers.exe

Estas reglas aplican a todo el repositorio salvo que un `AGENTS.md` más específico indique algo distinto.

## Forma de trabajo
- Trabajar por PRs pequeños, controlados y fáciles de revisar.
- No hacer merges automáticos ni resolver conflictos sin instrucción explícita.
- No hacer merge directo a producción ni deploy directo sin instrucción explícita.
- No hacer push, commit, PR o publicación si el prompt pide diagnóstico, pausa o revisión previa.
- No usar `git add .`, `git add -A` ni `git reset --hard` salvo autorización explícita del prompt.
- No introducir frameworks, CDNs ni librerías externas salvo autorización explícita del prompt.
- No modificar `package.json`, lockfiles ni dependencias salvo autorización explícita.
- No tocar carpetas legacy, especialmente `legacy/`, salvo que el prompt lo autorice.
- Reportar siempre archivos modificados, riesgos, testing ejecutado y checklist manual de QA sugerido.

## Workflow automático para agentes
- Antes de cambios reales, leer `docs/codex-memory/00-indice.md`.
- Seguir `docs/codex-memory/08-agent-workflow.md` para rama, cambios, checks, memoria, commit, push y PR.
- Usar `docs/codex-memory/09-checklists.md` para validar el área tocada y preparar la descripción del PR.
- Usar Graphify antes de cambios grandes, arquitectura, varios archivos o flujos conectados.
- Actualizar `docs/codex-memory/05-backlog.md`, `06-prompts-buenos.md` o `07-decisiones.md` cuando el cambio altere backlog, prompts reutilizables o decisiones.
- No dejar cambios locales sin PR salvo instrucción explícita.
- El asistente puede preparar rama, commit, push y PR solo cuando el usuario apruebe el cierre; el usuario revisa y mergea.

## Contratos de producto y datos
- No cambiar backend, payloads, contratos de datos, nombres de campos, precios, tickets, promociones ni reglas comerciales salvo autorización explícita.
- No modificar migraciones, esquemas, seeds ni servicios backend si el PR es de UI o documentación.
- No promover seeds destructivos, datos de preview/testing ni migraciones de limpieza a producción sin aprobación explícita.
- Preservar compatibilidad con flujos existentes de pedidos, tickets, menú, ubicación y WhatsApp.
- No tocar secretos, `.dev.vars`, `.wrangler/`, variables locales, credenciales ni tokens.

## UX/UI permanente
- Mantener enfoque mobile-first en layout, copy, interacción y validación.
- Mantener estética Burgers.exe: cyberpunk, gaming, fondo oscuro, verde neón, glow y tono de quest.
- Mantener accesibilidad: foco visible, `aria-*` cuando aplique, labels persistentes, errores inline y targets táctiles de al menos 44px.
- Mantener soporte para `prefers-reduced-motion`; no agregar animaciones obligatorias para personas que reducen movimiento.
- Evitar cambios visuales amplios si el prompt pide una mejora puntual.

## Reglas específicas para `apps/public-order-v2`
- No romper el public order flow mobile-first ni los aprendizajes de PRs 237–240.
- Mantener CTA claro para iniciar pedido, personalización comprensible, checkout con labels/helper text/errores inline y acciones táctiles cómodas.
- No cambiar payloads enviados desde `orders-v2`, lectura de menú, tickets, promociones, precios ni ubicación sin autorización explícita.
- Validar visualmente en viewport móvil cuando el cambio sea perceptible en la UI.
- Priorizar cambios locales en componentes/estilos existentes antes de crear abstracciones nuevas.

## Checks esperados
- Ejecutar `git diff --check` en todo PR.
- Ejecutar `npm run typecheck` cuando se toque TypeScript, configuración o código de app.
- Ejecutar `npm run build:public` cuando se toque `apps/public-order-v2` o código compartido que pueda afectarlo.
- Si un check no aplica o no puede ejecutarse por limitación del entorno, reportarlo claramente.

## No hacer
- No hacer refactors masivos oportunistas.
- No reescribir arquitectura ni mover archivos sin necesidad directa del prompt.
- No cambiar copy crítico, precios, nombres de productos, promociones o lógica de negocio por criterio propio.
- No agregar dependencias, assets remotos, tracking, analytics, iframes ni llamadas externas no autorizadas.
- No ocultar errores de validación ni reemplazar labels persistentes por placeholders.
- No dejar cambios sin test/check reportado ni riesgos sin mencionar.

## Metodología de trabajo (PRs 350–355+)
- Dividir features grandes en roadmap secuencial de PRs antes de implementar (PR1 → contrato, PR2 → flag, PR3 → shell, PR4 → drawer, etc.). Cada PR tiene un único objetivo; nunca mezclar responsabilidades.
- Funcionalidad primero, polish después. Animaciones, micro-interacciones, responsive fino y UX visual van en PRs separados posteriores.
- Reutilizar componentes, helpers, tipos, hooks y contratos existentes antes de crear código nuevo.
- Follow-ups pequeños: si el bot comenta algo, se corrige en el mismo PR o en un follow-up mínimo. No se abre un PR enorme para atender feedback.
- Verificar siempre el estado real del PR en GitHub antes de darlo por terminado: comentarios del bot, code review, conflictos, merge status y checks.
- Resumen estándar al cerrar PR:
  1. Resumen ejecutivo.
  2. Archivos modificados.
  3. Qué se implementó.
  4. Qué NO se implementó.
  5. Riesgos.
  6. Testing ejecutado.
  7. Estado del PR (número, URL, estado, merge status, comentarios pendientes, checks).

## Uso de Modelos y Subagentes (Playbook)
- **Gemini Pro (Razonamiento)**: Usar para planificar, diseñar el `implementation_plan.md`, resolver problemas complejos de accesibilidad y definir contratos de datos.
- **Gemini Flash (Ejecución)**: Usar para codificación rápida, ejecutar comandos de testing/typecheck en background y correr validaciones visuales con `browser_subagent`.
- **Delegación**: Usar `invoke_subagent` para paralelizar tareas del roadmap de PRs (ej. un subagente para el PR de contratos, otro para la UI) manteniendo las responsabilidades aisladas.

## Memoria del proyecto

Antes de cambios grandes, lee:

- `docs/codex-memory/00-indice.md`
- `docs/codex-memory/08-agent-workflow.md`
- `docs/codex-memory/09-checklists.md`

Estas notas son la memoria viva del proyecto para Codex/Obsidian. Si contradicen el código actual, verifica el código y reporta la diferencia.
