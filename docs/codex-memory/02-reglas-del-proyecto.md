> Estado: vivo
> Uso: memoria operativa para Codex/Burgers.exe

# Reglas del proyecto

## Jerarquia

- `AGENTS.md` es la regla dura.
- Esta memoria es apoyo operativo.
- Si hay contradiccion, gana `AGENTS.md`.

## Workflow obligatorio

Todo cambio real debe seguir:

1. Crear rama.
2. Hacer cambios.
3. Probar.
4. Commit.
5. Push.
6. Crear Pull Request cuando el usuario apruebe el cierre o cuando el prompt lo autorice explicitamente.

## Codex

Antes de implementar:

- Leer `AGENTS.md`.
- Leer `docs/codex-memory/00-indice.md`.
- Leer `docs/codex-memory/08-agent-workflow.md` y `docs/codex-memory/09-checklists.md` cuando el cambio sea real.
- Usar Graphify si el cambio toca varios archivos o arquitectura, cuando la herramienta este disponible.

## Arquitectura oficial V2

- Burgers.exe V2 se entiende solo como 2 apps oficiales:
  - `apps/public-order-v2`
  - `apps/internal-chekeo-v2`
- Cloudflare D1 es la source of truth de catalogo, pedidos, operacion, cierre y reportes V2.
- Cloudflare R2 es la source of truth de assets de catalogo y promos.
- Google Sheets, Apps Script, V1 y carpetas historicas se consideran legacy.
- Sheets puede existir solo como historia, rollback o export/import manual legacy; nunca como runtime oficial ni source of truth actual.

## Regla de ambientes

- Preview y produccion nunca se mezclan.
- Preview y produccion nunca deben compartir escritura de pedidos.
- Preview puede ser 1:1 en funciones, pero debe usar D1 y R2 separados.
- Local nunca debe escribir a produccion por accidente.
- Si una configuracion apunta a produccion, debe documentarse como riesgo y requerir aprobacion manual.

## Migracion V2 Clean Architecture

- Legacy cleanup queda autorizado solo en fases explicitas de la migracion.
- No mover legacy, borrar archivos ni cambiar runtime fuera de la fase autorizada.
- Cada fase de la migracion debe actualizar `docs/codex-memory/10-migration-tracker.md`.
- No saltar fases sin aprobacion explicita del usuario.
- Antes de pedir el siguiente prompt o proponer la siguiente fase, se deben listar preguntas abiertas, bloqueadores y riesgos residuales.

## Restricciones

- No introducir dependencias nuevas sin autorizacion.
- No cambiar contratos de datos sin explicar riesgos.
- No tocar `legacy/` sin permiso explicito, salvo documentacion o planeacion cuando una fase lo autorice.
- Por defecto, usar PRs pequenos y controlados.
- PRs grandes solo cuando el alcance este explicitamente aprobado.
- No mezclar bugfix + rediseno + refactor sin autorizacion.
- Todo cambio de Burgers.exe debe terminar en PR cuando el usuario apruebe cierre.
- El asistente crea el PR automaticamente cuando la rama ya este subida; el usuario solo revisa y mergea.
- No hacer commit, push o PR cuando el prompt pida diagnostico o pausa.
- No promover seeds destructivos ni migraciones de preview/testing a produccion sin aprobacion explicita.
