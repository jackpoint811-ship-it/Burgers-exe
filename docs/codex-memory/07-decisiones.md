> Estado: vivo
> Uso: memoria operativa para Codex/Burgers.exe

# Decisiones

## Decisiones activas

- Obsidian se usara como editor de memoria Markdown.
- La memoria real vive en `docs/codex-memory`.
- Codex debe leer esta memoria antes de cambios grandes.
- `AGENTS.md` sigue siendo la regla dura.
- Graphify debe usarse antes de modificar arquitectura o varios archivos, cuando este disponible.
- Todo cambio debe terminar en Pull Request cuando el usuario apruebe el cierre.

## Historial de decisiones

### Fecha

2026-07-15

### Decision

Implementar optimización estricta de tokens mediante flujo de chats cortos e independientes y sincronización con memoria local (Obsidian).

### Motivo

Mitigar el alto consumo de cuota de la API en interacciones sucesivas y prolongadas debido a la acumulación de historial.

### Impacto

- Se modifica `AGENTS.md` para incluir pautas de reducción de tokens.
- Se actualiza `docs/codex-memory/08-agent-workflow.md` para exigir la actualización de `01-estado-actual.md` antes del cierre de cada chat y sugerir el reinicio de conversación para nuevas tareas.
- El agente utilizará lectura y escritura de archivos estrictamente quirúrgicas (`replace_file_content` y `view_file` con rangos de líneas).

### Fecha

2026-07-02

### Decision

Burgers.exe V2 Clean Architecture se trabajara por fases con tracker Kanban.

### Motivo

Evitar que Codex, ChatGPT o el usuario pierdan el estado durante una migracion larga de arquitectura, ambientes, legacy y tooling.

### Impacto

- Se crea `10-migration-tracker.md`.
- Se crea `11-skills-and-tools.md`.
- Se documenta que Burgers.exe son solo 2 apps oficiales.
- Se documenta que D1 y R2 son source of truth.
- Se documenta que Sheets y Apps Script quedan legacy.
- Se exige actualizar el tracker en cada fase.

## Formato para nuevas decisiones

### Fecha

YYYY-MM-DD

### Decision

Descripcion corta.

### Motivo

Por que se decidio.

### Impacto

Que cambia para Codex, UX o desarrollo.
