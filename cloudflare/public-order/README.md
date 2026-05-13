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
3. Si `PUBLIC_ORDER_WRITE_ENABLED !== "true"`: responde en **modo dry-run** (`mode: "dry-run"`) y **no llama Apps Script**.
4. Solo si `PUBLIC_ORDER_WRITE_ENABLED === "true"`: hace request server-to-server a Apps Script con `action`, `payload` y `auth` en body JSON.

## Variables de entorno en Cloudflare (NO commitear valores reales)
Configurar en el proyecto Pages:
- `PUBLIC_ORDER_WRITE_ENABLED` (`false` por defecto; solo `true` permite escritura real)
- `APPS_SCRIPT_ORDER_ENDPOINT` (requerida solo si `PUBLIC_ORDER_WRITE_ENABLED=true`)
- `APPS_SCRIPT_SHARED_SECRET` (requerida solo si `PUBLIC_ORDER_WRITE_ENABLED=true`)

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
