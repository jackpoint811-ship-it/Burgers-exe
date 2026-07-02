# 09 — Fase 6: Summary + History

## Objetivo
Implementar cierre operativo diario sin bloquear operación pendiente, con:
- preview de cierre,
- guardado de resumen diario en `Resumen Pedidos`,
- archivado de pedidos completados en `Historico` (solo `Listo + Pagado`),
- vista básica de histórico y cortes.

## Alcance
- Mantener `Chekeo Nuevo` como hoja activa de operación.
- No migrar a `Chekeo` oficial.
- No usar librerías externas/CDN/frameworks.
- No tocar `legacy/`.

## Hojas involucradas
- `Chekeo Nuevo` (operación activa)
- `Historico` (archivo de completados)
- `Resumen Pedidos` (registro de cortes)

## Funciones backend creadas/ajustadas
Wrappers públicos requeridos:
- `getCloseDayPreview()`
- `writeDailySummary()`
- `archiveCompletedOrders()`
- `closeDay()`
- `getHistoryPreview()`

Aliases de compatibilidad:
- `archiveReadyPaidOrders()` → alias de `archiveCompletedOrders()`
- `getHistoryOrders(limit)` → lectura derivada de history preview

## Contrato final — `Historico`
Incluye:
- Todas las columnas de `Chekeo Nuevo`.
- Metadatos requeridos:
  - `Fecha Archivado`
  - `Hora Archivado`
  - `Corte ID`
- Campo opcional extra:
  - `Motivo Archivo`

## Contrato final — `Resumen Pedidos`
Columnas requeridas:
- `Corte ID`
- `Fecha Corte`
- `Hora Corte`
- `Total Pedidos`
- `Pedidos Archivables`
- `Pedidos No Archivables`
- `Total Vendido`
- `Total Pagado`
- `Total Pendiente`
- `Con Alerta`
- `Sin Ticket Enviado`
- `Notas`

Columnas extras opcionales implementadas:
- `IDs Archivables`
- `IDs No Archivables`
- `Generado En`

## Reglas de archivado
- Archivable solo si:
  - `Estado Pedido = Listo`
  - `Estado Pago = Pagado`
- `Alerta = ⚠️` no bloquea archivado.
- `Ticket Enviado != Si` no bloquea archivado.
- Nunca borrar en `Chekeo Nuevo` antes de copiar/verificar en `Historico`.
- Si `ID Pedido` ya existe en `Historico`, se omite inserción duplicada y puede limpiarse de `Chekeo Nuevo` por idempotencia.
- Borrado en `Chekeo Nuevo` siempre de abajo hacia arriba.

## Componentes UI creados
- Tab `Resumen` con:
  - métricas de preview,
  - lista de archivables,
  - lista de no archivables con razón,
  - advertencias (`Con alerta`, `Sin ticket enviado`).
- Botones:
  - `Actualizar preview`
  - `Guardar resumen`
  - `Archivar completados`
  - `Cerrar día`
- Confirmación previa en acciones destructivas mediante modal simple propio (decisión temporal para evitar `alert()`).
- Tab `Historico` con:
  - total histórico,
  - últimos pedidos archivados (máx. 20),
  - últimos cortes inferidos por `Corte ID`.

## Fuera de alcance
- Migración a `Chekeo` oficial.
- Automatizaciones externas.
- Integraciones externas o librerías de terceros.

## Criterios de aceptación
1. Wrappers públicos exactos disponibles con envelope seguro.
2. `Historico` y `Resumen Pedidos` se crean si faltan y validan headers si existen.
3. `getCloseDayPreview()` expone métricas completas y listas resumidas.
4. `writeDailySummary()` guarda corte sin requerir archivado.
5. `archiveCompletedOrders()` copia primero y luego elimina de abajo hacia arriba.
6. `closeDay()` ejecuta preview → resumen → archivo → preview final sin bloquear por no archivables.
7. UI muestra preview, advertencias, listas y histórico básico.
8. Sin `alert()`.

## Riesgos / pendientes
- Si existen filas históricas antiguas con contrato previo, la validación de encabezados puede requerir ajuste manual en hoja antes del primer corte.
- `Corte ID` usa timestamp; múltiples cierres muy cercanos dentro del mismo segundo pueden requerir reintento para evitar colisión lógica.
