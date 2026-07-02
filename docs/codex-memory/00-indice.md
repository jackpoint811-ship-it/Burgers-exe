> Estado: vivo
> Uso: memoria operativa para Codex/Burgers.exe

# Memoria Codex / Obsidian - Burgers.exe

Esta carpeta funciona como memoria viva del proyecto.

## Jerarquia

1. `AGENTS.md` es la regla dura del repositorio.
2. Esta memoria en `docs/codex-memory/` es apoyo operativo.
3. Si hay contradiccion, gana `AGENTS.md`; el agente debe verificar el codigo y reportar la diferencia.

## Orden recomendado para Codex

1. Leer `AGENTS.md`.
2. Leer `docs/codex-memory/00-indice.md`.
3. Si el cambio pertenece a la migracion V2 Clean Architecture, leer `docs/codex-memory/10-migration-tracker.md`.
4. Si la fase requiere herramientas, skills, QA o Cloudflare, leer `docs/codex-memory/11-skills-and-tools.md`.
5. Si la fase requiere inventario de superficies V2, leer `docs/codex-memory/12-v2-inventory.md`.
6. Si la fase requiere ambientes Cloudflare, leer `docs/codex-memory/13-cloudflare-environments-audit.md`.
7. Si la fase requiere separar activo vs legacy, leer `docs/codex-memory/14-active-surface-map.md`.
8. Si la fase requiere limpiar Sheets/App Script del proyecto activo, leer `docs/codex-memory/15-active-cleanup-sheets-appscript.md`.
9. Leer esta memoria base:
   - `01-estado-actual.md`
   - `02-reglas-del-proyecto.md`
   - `07-decisiones.md`
10. Leer workflow y checklists:
   - `08-agent-workflow.md`
   - `09-checklists.md`
11. Leer el archivo especifico segun el area:
   - Chekeo: `03-flujos-chekeo.md`
   - Public order: `04-flujo-public-order.md`
   - Backlog: `05-backlog.md`
   - Prompts reutilizables: `06-prompts-buenos.md`
12. Usar Graphify antes de cambios grandes, de arquitectura o de varios archivos, si esta disponible.
13. Terminar cambios en rama, commit, push y PR cuando el usuario apruebe el cierre o cuando el prompt lo pida explicitamente.

## Mapa rapido

| Archivo | Uso |
|---|---|
| `01-estado-actual.md` | Contexto operativo actual del proyecto. |
| `02-reglas-del-proyecto.md` | Reglas base de trabajo. |
| `03-flujos-chekeo.md` | Reglas de Pedidos, Pagos, Corte y Sorteo. |
| `04-flujo-public-order.md` | Reglas del flujo publico de pedidos. |
| `05-backlog.md` | Pendientes e ideas futuras. |
| `06-prompts-buenos.md` | Prompts reutilizables para Codex/agentes. |
| `07-decisiones.md` | Decisiones de producto, UX, arquitectura y workflow. |
| `08-agent-workflow.md` | Flujo automatico obligatorio para agentes. |
| `09-checklists.md` | Checklists de QA, PR y areas criticas. |
| `10-migration-tracker.md` | Tracker Kanban oficial de la migracion V2 Clean Architecture. |
| `11-skills-and-tools.md` | Reglas oficiales de skills, herramientas y validacion local. |
| `12-v2-inventory.md` | Inventario real de apps V2, shared code, endpoints, D1/R2, docs, assets y legacy. |
| `13-cloudflare-environments-audit.md` | Auditoria Fase 3 de ambientes Cloudflare, recursos Pages/D1/R2, scripts seguros y riesgos preview/prod. |
| `14-active-surface-map.md` | Mapa oficial Fase 4 de superficie activa V2 y candidatos legacy para Fase 5. |
| `15-active-cleanup-sheets-appscript.md` | Cierre Fase 6: scripts `public-order:*` removidos y referencias Sheets/App Script reclasificadas. |

## Nota

Obsidian solo edita estos archivos Markdown. La fuente real para Codex son estos `.md` dentro del repo.

El asistente prepara el PR cuando la rama ya este subida y el usuario apruebe el cierre. El usuario revisa y mergea.
