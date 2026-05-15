# internal-chekeo (Cloudflare Pages)

Esta app contiene el **panel Chekeo completo** (Inicio, Pedidos, Cocina y Otros) y está protegida por PIN/sesión.

## Seguridad
- No usa Cloudflare Access por decisión del usuario.
- El PIN/sesión protege la UI interna.
- `POST /api/rpc` exige sesión válida y method allowlist.
- Apps Script exige `INTERNAL_API_SHARED_SECRET` en Script Properties para aceptar RPC.

## Variables Cloudflare requeridas
- `APPS_SCRIPT_INTERNAL_ENDPOINT`
- `INTERNAL_API_SHARED_SECRET`
- `INTERNAL_PANEL_PIN`
- `INTERNAL_SESSION_SECRET`

## Variable opcional
- `ALLOWED_IPS` (CSV de IPs permitidas)

## Deploy (Cloudflare Pages)
- Root directory: `cloudflare/internal-chekeo`
- Build command: `exit 0`
- Build output directory: `.`
