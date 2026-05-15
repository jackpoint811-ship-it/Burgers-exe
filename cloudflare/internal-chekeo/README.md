# Cloudflare Internal Chekeo (Fase 1)

## Propósito
Este directorio contiene el scaffold inicial de la app interna independiente `cloudflare/internal-chekeo` para la migración de Chekeo hacia Cloudflare Pages.

## Estado actual
- **Fase 1**: scaffold estático.
- No existe integración con backend.

## Qué incluye
- Estructura base de app interna móvil con tabs y navegación inferior.
- Placeholders visuales para Inicio, Pedidos, Cocina y Otros.
- Estilos base locales (`styles.css`).
- Lógica local mínima de tabs y toast (`app.js`).
- `robots.txt` con bloqueo total de indexación.

## Qué NO incluye
- Sin PIN.
- Sin API.
- Sin RPC.
- Sin Apps Script.
- Sin datos reales.
- Sin funciones de escritura (write).

## Deploy sugerido (Cloudflare Pages)
- **Root directory**: `cloudflare/internal-chekeo`
- **Build command**: `exit 0`
- **Build output directory**: `.`

## Siguiente fase
- **Fase 2** — PIN/session aislado.

## Reglas
- Mantener este proyecto separado de `cloudflare/public-order`.
- No tocar Apps Script en esta fase.
- No cambiar `BOG_ACTIVE_ENV` durante esta fase.
