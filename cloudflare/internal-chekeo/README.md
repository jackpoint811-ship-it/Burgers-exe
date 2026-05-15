# Cloudflare Internal Chekeo (Fase 5)

## Estado
- **Fase 5 — Acciones operativas controladas**.
- PIN/session obligatorio.
- `/api/rpc` protegido por sesión.

## Métodos read-only permitidos
- `healthCheck`
- `getAppOrders`
- `getDailySummary`
- `getBankConfig`
- `getOrderDetail`
- `getClientTicketData`
- `getCloseDayPreview`
- `getHistoryPreview`
- `validateProductionReadiness`
- `getProductionMigrationPreview`
- `getHistoryOrders`

## Métodos write operativos permitidos
- `syncOrdersFromMaster`
- `updateOrderStatus`
- `updateOrderOperationalData`
- `updateOrderPayment`
- `markOrderPaid`
- `markOrderSideReady`
- `updateOrderNotes`
- `markTicketSent`

## Reglas de operación
- Confirmaciones obligatorias para writes.
- Botones write bloqueados durante loading.
- Resultado visible por toast/status.
- Refresh de datos al finalizar cada write.
- Cierre/archivado/resumen/producción siguen fuera de alcance en esta fase.

## Variables de entorno (Cloudflare)
- `INTERNAL_PANEL_PIN`
- `INTERNAL_SESSION_SECRET`
- `APPS_SCRIPT_INTERNAL_ENDPOINT`
- `INTERNAL_API_SHARED_SECRET`
- `ALLOWED_IPS` (opcional)

## Script Properties (Apps Script)
- `INTERNAL_API_SHARED_SECRET`

## Siguiente fase
- **Fase 6 — Cierre, resumen e histórico operativo**.
