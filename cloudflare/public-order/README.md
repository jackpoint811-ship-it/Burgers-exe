# Burgers.exe Public Order (Cloudflare) — Fase 1

## Objetivo
Preparar una estructura separada para desplegar una página pública estática en Cloudflare Pages con Functions como proxy seguro hacia Apps Script.

## Root de deploy recomendado
- **Project root en Cloudflare Pages:** `cloudflare/public-order`
- Esto permite que `functions/` sea detectada automáticamente por Pages Functions.

## Estructura
- `index.html`: landing/order minimal mobile-first (placeholder visual Burgers.exe).
- `styles.css`: estilo retro terminal (negro + verde neón `#39FF14`).
- `app.js`: draft mínimo en `localStorage`, detección de draft y simulación de submit a `/api/order`.
- `functions/api/order.js`: endpoint POST proxy/validador con recalculo de total.
- `functions/api/bank-config.js`: stub GET para futura entrega de datos bancarios.
- `assets/README.md`: inventario de assets pendientes.

## Flujo Fase 1
1. Frontend envía `POST /api/order` (mismo origen).
2. `functions/api/order.js` valida payload mínimo y recalcula total con tabla fija.
3. Function prepara request server-to-server hacia Apps Script:
   - `action: "createPublicOrder"`
   - `payload: <normalizado>`
   - `auth: { secret, scheme }` dentro del body JSON.
4. Apps Script valida auth en body (no headers) y procesa.

## Variables de entorno en Cloudflare (NO commitear valores reales)
Configurar en el proyecto Pages:
- `APPS_SCRIPT_ORDER_ENDPOINT`
- `APPS_SCRIPT_SHARED_SECRET`

## Script Properties en Apps Script
Configurar en Apps Script:
- `PUBLIC_ORDER_SHARED_SECRET`

## Deploy rápido (referencia)
1. Crear proyecto Pages conectado al repo.
2. Setear **Root directory**: `cloudflare/public-order`.
3. Build command: vacío (sitio estático sin build).
4. Output directory: `/` (root del project).
5. Cargar env vars en entorno Preview/Production.

## Estado de Fase 1
- Estructura base lista.
- UI completa y personalización individual quedan para Fase 2.
- Persistencia final/mapeo completo de columnas quedan para Fase 2.
