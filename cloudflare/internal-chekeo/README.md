# Cloudflare Internal Chekeo (Fase 7)

## Estado
- **Fase 7 — Hardening, QA y deploy final**.
- App interna en Cloudflare Pages separada de `cloudflare/public-order`.
- Backend operativo en Google Apps Script/Sheets por RPC protegido.

## Propósito
- Operar Chekeo interno desde Cloudflare sin romper la Web App actual de Apps Script.
- Mantener aislamiento del flujo público (`public-order`) y del panel interno.
- Usar un proxy server-side (`/api/rpc`) para proteger credenciales y validar sesión.

## Seguridad
- Autenticación por PIN + sesión.
- Cookie `bog_internal_session` con `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age=43200`.
- `/api/rpc` protegido por sesión activa.
- `INTERNAL_API_SHARED_SECRET` solo via server-to-server (Cloudflare Functions → Apps Script).
- `ALLOWED_IPS` opcional para restringir acceso por IP.
- No se usa Cloudflare Access por decisión del usuario.
- No se exponen secrets en frontend.

## Variables requeridas en Cloudflare Pages
- `INTERNAL_PANEL_PIN`
- `INTERNAL_SESSION_SECRET`
- `APPS_SCRIPT_INTERNAL_ENDPOINT`
- `INTERNAL_API_SHARED_SECRET`
- `ALLOWED_IPS` (opcional)

## Script Properties (Apps Script)
- `INTERNAL_API_SHARED_SECRET`

## Deploy settings de Cloudflare Pages
- Root directory: `cloudflare/internal-chekeo`
- Build command: `exit 0`
- Build output directory: `.`
- Framework preset: `None` / `Static`
- Functions: usar la carpeta `functions/` incluida en el proyecto Pages.

## Checklist de deploy (resumen)
- Configurar variables de Cloudflare.
- Configurar Script Properties en Apps Script.
- Confirmar endpoint de Apps Script desplegado.
- Confirmar que Web App actual de Apps Script sigue funcionando.
- Confirmar que `public-order` sigue funcionando.
- Confirmar que `BOG_ACTIVE_ENV` no cambió.
- Validar login por PIN y expiración de sesión.
- Validar operaciones read-only.
- Validar writes operativos de Fase 5.
- Validar cierre/resumen/histórico de Fase 6.
- Validar rollback.

## Rollback
- Si Cloudflare falla, continuar operación con la Web App actual de Apps Script.
- No borrar Web App de Apps Script.
- No borrar datos ni hojas.
- No usar cambio de `BOG_ACTIVE_ENV` como estrategia de rollback.
