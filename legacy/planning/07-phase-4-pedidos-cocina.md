# 07 — Fase 4: Pedidos + Cocina

## Objetivo
Habilitar operación diaria de pedidos y flujo de cocina en la Web App móvil usando `Chekeo Nuevo` como hoja activa.

## Alcance implementado
- Tab `Pedidos` con filtros/chips mobile-first en memoria (sin recargar backend por filtro):
  - `Todos`
  - `Nuevo`
  - `Confirmado`
  - `Preparando`
  - `Listo`
  - `Pendiente pago`
  - `Con alerta`
- Estado visual del filtro activo y empty state claro cuando no hay resultados.
- Detalle de pedido en modal/drawer mobile-first con cierre explícito.
- Edición operativa movida al detalle para evitar saturación en tarjetas:
  - `Estado Pedido`
  - `Estado Pago`
  - `Método Pago`
  - `Nota Interna`
  - `Nota Cliente`
- Acciones operativas en detalle:
  - `Guardar pedido`
  - `Marcar pagado` (solo si `Estado Pago` no es `Pagado`)
- Tab `Inicio` con resumen rápido:
  - pedidos activos
  - pedidos listos
  - pedidos pendientes de pago
  - total pendiente
- Tab `Resumen` con tarjetas de montos y conteo adicional `Con alerta`.
- Tab `Cocina` se mantiene como decisión UI para flujo operativo rápido por estado (`Confirmar`, `Preparando`, `Listo`).

## Decisión de datos para detalle
El detalle/modal usa el objeto ya cargado en `APP_STATE.orders` para evitar llamada extra a `getOrderDetail(orderId)`.
Después de escrituras (`Guardar pedido`, `Marcar pagado`, cambios en Cocina), la app hace reload de datos (`getAppOrders()` + `getDailySummary()`) para mantener consistencia.

## Backend utilizado
- `updateOrderOperationalData(orderId, payload)` para guardar edición operativa en una sola escritura.
- `markOrderPaid(orderId)` para acción rápida de pago.
- `updateOrderStatus(orderId, nextStatus)` para flujo Cocina.

## Seguridad cliente
- Se mantiene `escapeHtml(value)` para render de datos dinámicos.
- No se usa `alert()`.
- No se usa `localStorage` para datos críticos.
- Mensajes de error al usuario se acotan para evitar mostrar errores técnicos extensos.

## Fuera de alcance
- Ticket cliente.
- Envío de WhatsApp.
- Migración a hoja `Chekeo` oficial.
- Cambios en `legacy/`.
- Librerías externas, CDN o frameworks.
