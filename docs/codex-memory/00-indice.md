> Estado: vivo
> Uso: memoria operativa para Codex/Burgers.exe

# Memoria Codex / Obsidian - Burgers.exe

Esta carpeta funciona como memoria viva del proyecto.

## Jerarquía

1. `AGENTS.md` es la regla dura del repositorio.
2. Esta memoria en `docs/codex-memory/` es apoyo operativo.
3. Si hay contradicción, gana `AGENTS.md`; el agente debe verificar el código y reportar la diferencia.

## Orden recomendado para Codex

1. Leer `AGENTS.md`.
2. Leer esta memoria base:
   - `01-estado-actual.md`
   - `02-reglas-del-proyecto.md`
   - `07-decisiones.md`
3. Leer workflow y checklists:
   - `08-agent-workflow.md`
   - `09-checklists.md`
4. Leer el archivo específico según el área:
   - Chekeo: `03-flujos-chekeo.md`
   - Public order: `04-flujo-public-order.md`
   - Backlog: `05-backlog.md`
   - Prompts reutilizables: `06-prompts-buenos.md`
5. Usar Graphify antes de cambios grandes, de arquitectura o de varios archivos.
6. Terminar cambios en rama, commit, push y PR cuando el usuario apruebe el cierre.

## Mapa rápido

| Archivo | Uso |
|---|---|
| `01-estado-actual.md` | Contexto operativo actual del proyecto. |
| `02-reglas-del-proyecto.md` | Reglas base de trabajo. |
| `03-flujos-chekeo.md` | Reglas de Pedidos, Pagos, Corte y Sorteo. |
| `04-flujo-public-order.md` | Reglas del flujo público de pedidos. |
| `05-backlog.md` | Pendientes e ideas futuras. |
| `06-prompts-buenos.md` | Prompts reutilizables para Codex/agentes. |
| `07-decisiones.md` | Decisiones de producto, UX, arquitectura y workflow. |
| `08-agent-workflow.md` | Flujo automático obligatorio para agentes. |
| `09-checklists.md` | Checklists de QA, PR y áreas críticas. |

## Nota

Obsidian solo edita estos archivos Markdown. La fuente real para Codex son estos `.md` dentro del repo.

El asistente prepara el PR cuando la rama ya esté subida y el usuario apruebe el cierre. El usuario revisa y mergea.
