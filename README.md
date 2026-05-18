# Burger-OG

## Estado final del proyecto
Proyecto operativo por fases con transición hacia arquitectura de dos superficies: **Burgers.exe** (pública) y **Chekeo 2.0** (interna), usando Google Sheets como backend.

## Fases completadas
- Fase 0: Reset legacy.
- Fase 1: Contrato de datos y hojas.
- Fase 2: Backend Apps Script base.
- Fase 3: Web App shell móvil.
- Fase 4: Pedidos + Cocina.
- Fase 5: Ticket cliente + WhatsApp.
- Fase 6: Resumen operativo + histórico.
- Fase 7: Migración a producción (validación, preview y preparación segura).

## Stack permitido
- Google Sheets
- Google Apps Script (solo backend/bridge, no como superficie operativa visible)
- HTML/CSS/JS embebido (sin librerías externas, CDN ni frameworks)

## Superficie operativa actual
- **Burgers.exe**: app pública de pedidos.
- **Chekeo 2.0**: app interna de operación (Home, Pedidos, Cocina, Opciones).
- Apps Script puede permanecer como backend/bridge técnico cuando sea necesario, pero ya no se considera la superficie visible de operación.

## Modo prueba / producción
La app usa `ScriptProperties` con la clave `BOG_ACTIVE_ENV`:
- `TEST` → opera sobre `Chekeo Nuevo`.
- `PROD` → opera sobre `Chekeo`.

### Regla de seguridad
- Si `BOG_ACTIVE_ENV` falta o tiene valor inválido, el sistema usa **TEST** por defecto.
- **Producción no se activa automáticamente**.
- Cambiar a `PROD` requiere aprobación manual del usuario y checklist validado.
- Rollback operativo: regresar `BOG_ACTIVE_ENV` a `TEST`.

## Restricciones críticas
- No borrar `legacy/`.
- No borrar hojas ni datos.
- No borrar: `Chekeo Nuevo`, `Chekeo`, `Historico`, `Resumen Pedidos`.
- No activar producción automáticamente.
- No migrar datos automáticamente.
