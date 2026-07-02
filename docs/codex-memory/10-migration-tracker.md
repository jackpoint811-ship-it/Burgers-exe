> Estado: vivo
> Uso: tablero Kanban oficial para la migracion V2 limpia

# Burgers.exe V2 Clean Architecture Tracker

## Estado

- Vivo
- Fase actual: Fase 0

## Kanban

### Backlog

- [ ] Fase 1 - Validacion local de skills/herramientas
- [ ] Fase 2 - Inventario real con Graphify
- [ ] Fase 3 - Estandarizar ambientes Cloudflare
- [ ] Fase 4 - Separar carpetas activas
- [ ] Fase 5 - Mover legacy a cuarentena
- [ ] Fase 6 - Remover Sheets/App Script del proyecto activo
- [ ] Fase 7 - Preview 1:1 con DB/R2 espejo
- [ ] Fase 8 - Estandarizar rutina diaria, modelos, prompts y QA

### En progreso

- [ ] Fase 0 - Gobernanza, tracker Kanban, README limpio y control de herramientas

### En revision

- Ninguna

### Bloqueado

- Ninguna

### Terminado

- Ninguna

## Fases de la migracion

- Fase 0 - Gobernanza, tracker Kanban, README limpio y control de herramientas.
- Fase 1 - Validacion local de skills y herramientas.
- Fase 2 - Inventario real con Graphify.
- Fase 3 - Estandarizar ambientes Cloudflare.
- Fase 4 - Separar carpetas activas.
- Fase 5 - Mover legacy a cuarentena.
- Fase 6 - Remover Sheets y Apps Script del proyecto activo.
- Fase 7 - Preview 1:1 con DB y R2 espejo.
- Fase 8 - Estandarizar rutina diaria, modelos, prompts y QA.

## Principios activos

- Burgers.exe V2 tiene solo 2 superficies oficiales: Public Order V2 e Internal Chekeo V2.
- Cloudflare D1 y R2 son la base oficial de datos y assets.
- Preview y produccion nunca comparten escritura.
- Local nunca debe escribir a produccion por accidente.
- Legacy se documenta, aisla y mueve solo por fases autorizadas.
- Esta migracion es documental y operativa por PRs pequenos, no por cambios masivos sin control.

## Decisiones abiertas

- Confirmar instalacion real de `graphify` para Fase 2.
- Confirmar disponibilidad real de la skill `burgers-pr-workflow` o su reemplazo operativo.
- Confirmar nombres finales y bindings efectivos de los proyectos Pages preview antes de Fase 3.
- Confirmar la estrategia exacta de local: D1 local por defecto o preview explicita segun cada flujo.

## Bloqueadores

- Ninguno para Fase 0.
- Para Fase 1 y Fase 2, validar si las skills y CLIs esperadas existen en cada clon local de trabajo.

## Riesgos

- El README y parte de la memoria tenian rastros de la arquitectura previa basada en Sheets/App Script.
- Algunas herramientas o skills mencionadas en prompts pueden no estar instaladas en todos los clones.
- Si no se mantiene este tracker al dia, la migracion puede perder continuidad entre PRs y sesiones.
- La separacion preview vs produccion sigue dependiendo de validar configuracion real en fases posteriores.

## Checklist para aprobar la siguiente fase

- [x] Existe este tracker oficial.
- [x] Existe la guia oficial de skills y herramientas.
- [x] Existe la spec de clean architecture.
- [x] Existe la matriz de ambientes.
- [x] El README ya posiciona solo 2 apps oficiales y D1/R2 como arquitectura actual.
- [x] La memoria de Codex enlaza y exige leer este tracker.
- [ ] Confirmar que la siguiente fase autorizada es Fase 1.
- [ ] Validar presencia real de skills y herramientas en el clon local de trabajo.
- [ ] Confirmar si Graphify sera obligatorio o si habra fallback documentado en Fase 2.

## Ultima actualizacion

- 2026-07-02
- Responsable: Codex

## Regla permanente

Cada PR futuro de esta migracion debe actualizar este tracker antes de cerrar.
