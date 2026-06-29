# AGENTS.md — Reglas permanentes para Codex en Burgers.exe

Estas reglas aplican a todo el repositorio salvo que un `AGENTS.md` más específico indique algo distinto.

## Forma de trabajo
- Trabajar por PRs pequeños, controlados y fáciles de revisar.
- No hacer merges automáticos ni resolver conflictos sin instrucción explícita.
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

## Contratos de producto y datos
- No cambiar backend, payloads, contratos de datos, nombres de campos, precios, tickets, promociones ni reglas comerciales salvo autorización explícita.
- No modificar migraciones, esquemas, seeds ni servicios backend si el PR es de UI o documentación.
- Preservar compatibilidad con flujos existentes de pedidos, tickets, menú, ubicación y WhatsApp.

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

## Memoria del proyecto

Antes de cambios grandes, lee:

- `docs/codex-memory/00-indice.md`
- `docs/codex-memory/08-agent-workflow.md`
- `docs/codex-memory/09-checklists.md`

Estas notas son la memoria viva del proyecto para Codex/Obsidian. Si contradicen el código actual, verifica el código y reporta la diferencia.
