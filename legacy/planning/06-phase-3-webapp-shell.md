# 06 — Fase 3: Web App shell móvil

## Objetivo
Implementar un shell móvil funcional en Apps Script (HTML/CSS/JS puro) para visualizar estado operativo, pedidos en solo lectura, resumen diario y ajustes mínimos del sistema sobre `Chekeo Nuevo`.

## Alcance
- Entrada Web App por `doGet()` renderizando `Index.html`.
- Navegación por tabs: `Inicio`, `Pedidos`, `Resumen`, `Ajustes`.
- Carga inicial de datos desde backend existente:
  - `healthCheck()`
  - `getDailySummary()`
  - `getAppOrders()`
  - `getBankConfig()`
- Sin edición de pedidos ni acciones de cocina.
- Sin ticket cliente.
- Sin WhatsApp.

## Arquitectura de archivos HTML
- `Index.html`: estructura visual, tabs y contenedores de datos.
- `styles.html`: estilos mobile-first y componentes base.
- `scripts.html`: bootstrap de app, llamadas a backend y renderizado.

## Funciones backend consumidas
- `healthCheck()`
- `getDailySummary()`
- `getAppOrders()`
- `syncOrdersFromMaster()`
- `getBankConfig()`

## Componentes visuales creados
- Header con botón `Sincronizar`.
- Tab `Inicio` con estado backend/hoja activa.
- Tab `Pedidos` con lista real de pedidos (solo lectura).
- Tab `Resumen` con tarjetas de montos y conteos por estado.
- Tab `Ajustes` con estado backend/configuración bancaria/nota de prueba.
- Toast de feedback y manejo de errores.

## Qué queda fuera de Fase 3
- Flujo de cocina y cambios de estado operativos (Fase 4).
- Ticket cliente (Fase 5).
- Flujo WhatsApp (Fase 5).
- Migración a hoja `Chekeo` oficial (Fase 7).

## Criterios de aceptación
1. `doGet()` renderiza `Index.html` con `HtmlService`.
2. Existe helper público `include(filename)` para incluir parciales.
3. Tabs visibles exactas: Inicio, Pedidos, Resumen, Ajustes.
4. Carga inicial invoca health, resumen, pedidos y configuración bancaria.
5. Sincronizar ejecuta `syncOrdersFromMaster()` y luego refresca resumen/pedidos.
6. Pedidos se muestran en solo lectura con campos operativos requeridos.
7. Resumen muestra montos y conteos por estado.
8. Ajustes muestra estado backend, estado bancario, hoja activa `Chekeo Nuevo` y nota de prueba.
