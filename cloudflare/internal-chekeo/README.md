# Cloudflare Internal Chekeo (Fase 2)

## Propósito
Este directorio contiene el scaffold de la app interna independiente `cloudflare/internal-chekeo` para la migración de Chekeo hacia Cloudflare Pages.

## Estado actual
- **Fase 2 — PIN/session aislado**.
- Autenticación interna con PIN y cookie de sesión temporal.
- Sin integración con backend de negocio.

## Alcance actual
- Usa PIN interno.
- No usa Cloudflare Access.
- No usa login formal.
- No hay backend de negocio.
- No hay RPC.
- No hay Apps Script.
- No hay datos reales.

## Variables de entorno
Requeridas:
- `INTERNAL_PANEL_PIN`
- `INTERNAL_SESSION_SECRET`

Opcional:
- `ALLOWED_IPS`

## Deploy sugerido (Cloudflare Pages)
- **Root directory**: `cloudflare/internal-chekeo`
- **Build command**: `exit 0`
- **Build output directory**: `.`

## Siguiente fase
- **Fase 3 — RPC read-only mínimo**.
