# internal-chekeo (Cloudflare Pages)

Esta app usa **PIN interno** para acceso rápido; no usa login formal.

## Decisión de seguridad
- No usa Cloudflare Access por decisión del usuario.
- No usa usuario/password ni OAuth.
- El PIN protege la UI, pero **no sustituye** controles empresariales completos.

## Recomendaciones
- Usar PIN largo (mínimo 6-8 dígitos).
- Rotar PIN si se comparte accidentalmente.
- Configurar `ALLOWED_IPS` cuando sea posible.

## Variables Cloudflare
- `APPS_SCRIPT_INTERNAL_ENDPOINT`
- `INTERNAL_API_SHARED_SECRET`
- `INTERNAL_PANEL_PIN`
- `INTERNAL_SESSION_SECRET`
- `ALLOWED_IPS` (opcional, lista separada por comas)

## Apps Script (Script Properties)
- `INTERNAL_API_SHARED_SECRET`

## Deploy (Cloudflare Pages)
- Root directory: `cloudflare/internal-chekeo`
- Build command: `exit 0`
- Build output directory: `.`

## Rollback
Seguir usando la Web App actual de Apps Script.

## Limitación de rate limit
Sin KV/Durable Objects, el rate limit es básico y limitado (solo por IP permitida y validación de sesión).
