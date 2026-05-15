# Cloudflare Internal Chekeo (Fase 3)

## Propósito
Este directorio contiene la app interna independiente `cloudflare/internal-chekeo` para la migración de Chekeo hacia Cloudflare Pages.

## Estado actual
- **Fase 3 — RPC read-only mínimo**.
- Requiere PIN/session de Fase 2.
- Agrega endpoint `/api/rpc` protegido por sesión.

## Alcance actual
Métodos permitidos en RPC:
- `healthCheck`
- `getAppOrders`
- `getDailySummary`
- `getBankConfig`

Limitaciones de fase:
- No hay acciones write.
- No hay cierre de día.
- No hay pagos operativos.
- No hay cocina operativa.
- No hay edición de pedidos.

## Variables de entorno (Cloudflare)
Requeridas:
- `INTERNAL_PANEL_PIN`
- `INTERNAL_SESSION_SECRET`
- `APPS_SCRIPT_INTERNAL_ENDPOINT`
- `INTERNAL_API_SHARED_SECRET`

Opcional:
- `ALLOWED_IPS`

## Script Properties (Apps Script)
- `INTERNAL_API_SHARED_SECRET`

## Deploy sugerido (Cloudflare Pages)
- **Root directory**: `cloudflare/internal-chekeo`
- **Build command**: `exit 0`
- **Build output directory**: `.`

## Siguiente fase
- **Fase 4 — Panel read-only completo**.
