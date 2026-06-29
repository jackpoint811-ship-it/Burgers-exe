> Estado: vivo
> Uso: memoria operativa para Codex/Burgers.exe

# Reglas del proyecto

## Jerarquía

- `AGENTS.md` es la regla dura.
- Esta memoria es apoyo operativo.
- Si hay contradicción, gana `AGENTS.md`.

## Workflow obligatorio

Todo cambio real debe seguir:

1. Crear rama.
2. Hacer cambios.
3. Probar.
4. Commit.
5. Push.
6. Crear Pull Request cuando el usuario apruebe el cierre.

## Codex

Antes de implementar:

- Leer `AGENTS.md`.
- Leer `docs/codex-memory/00-indice.md`.
- Usar Graphify si el cambio toca varios archivos o arquitectura.

## Restricciones

- No introducir dependencias nuevas sin autorización.
- No cambiar contratos de datos sin explicar riesgos.
- No tocar `legacy/` sin permiso explícito.
- Por defecto, usar PRs pequeños y controlados.
- PRs grandes solo cuando el alcance esté explícitamente aprobado.
- No mezclar bugfix + rediseño + refactor sin autorización.
- Todo cambio de Burgers.exe debe terminar en PR cuando el usuario apruebe cierre.
- El asistente crea el PR automáticamente cuando la rama ya esté subida; el usuario solo revisa y mergea.
