# Cloudflare Internal Chekeo (Fase 4)

## Estado
- **Fase 4 — Panel read-only completo**.
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

## Restricciones de fase
- No hay acciones write.
- No hay edición de pedidos.
- No hay cierre/archivado/guardado.
- No hay cambios a Sheets desde esta UI.

## Variables de entorno (Cloudflare)
- `INTERNAL_PANEL_PIN`
- `INTERNAL_SESSION_SECRET`
- `APPS_SCRIPT_INTERNAL_ENDPOINT`
- `INTERNAL_API_SHARED_SECRET`
- `ALLOWED_IPS` (opcional)

## Script Properties (Apps Script)
- `INTERNAL_API_SHARED_SECRET`

## Siguiente fase
- **Fase 5 — Acciones operativas controladas**.
