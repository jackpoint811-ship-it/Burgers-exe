# Chekeo Phase 2.2A - Figma mockup operacional

## 1. Link a Figma

Archivo creado: [Burgers.exe Chekeo - Operational Mockup Fase 2.2A](https://www.figma.com/design/NWwIZgKQbNflMs4XrqSrN1).

Estado real: el archivo existe, pero el canvas no pudo construirse por Figma MCP. Despues de crear el archivo, el MCP devolvio el bloqueo de plan: Starter plan tool call limit. Por esta razon no se documenta un mockup Figma falso.

Entregable fallback: prototipo HTML navegable y PNGs exportables en [`docs/assets/chekeo-phase-2-2a-figma-mockup/`](./assets/chekeo-phase-2-2a-figma-mockup/). Esta carpeta queda lista para importar manualmente a Figma como referencias de frame.

## 2. Paginas creadas

En Figma no se crearon paginas operativas por el bloqueo anterior. La unica pagina disponible en el archivo remoto es la pagina inicial vacia.

En el fallback se crearon estas secciones navegables:

- `index.html`: prototipo navegable con selector de variante A/B.
- `prototype.css`: tokens visuales, layout mobile 390/320 y desktop.
- `prototype.js`: data QA, navegacion y render de pantallas.
- `export-screens.mjs`: exportador reproducible con Playwright.
- `export-manifest.json`: listado de PNGs generados.
- `prototype-qa-result.json`: validacion automatizada de carga, dimensiones y errores de consola.

## 3. Frames creados

Se modelaron 12 frames mobile por variante y 1 frame desktop por variante.

Mobile: Login PIN, Operacion, Pedidos, Detalle pedido, Cocina, Resumen K, Pagos, Detalle pago, Corte, Admin, Catalogo y Sorteos.

Desktop: overview denso con pedidos activos, cocina, pagos y referencias visuales de Phase 2.1.

Tambien se exportaron frames de control 320 px para Operacion, Pedidos y Cocina.

## 4. Screenshots usados

Base principal: [`docs/assets/chekeo-phase-2-1-seed-qa/`](./assets/chekeo-phase-2-1-seed-qa/).

Screenshots usados como referencia: `operacion-seeded-mobile-390.png`, `resumen-k-seeded-mobile-390.png`, `pedidos-seeded-mobile-390.png`, `pedidos-detail-mobile-390.png`, `cocina-seeded-mobile-390.png`, `pagos-seeded-mobile-390.png`, `admin-mobile-390.png`, `corte-seeded-mobile-390.png`, `historial-seeded-mobile-390.png`, `catalogo-mobile-390.png`, `sorteos-mobile-390.png`, `pedidos-seeded-mobile-320.png`, `pedidos-seeded-mobile-430.png`, `cocina-seeded-mobile-430.png` y `desktop-seeded-overview.png`.

Data usada: `seed-result.json`, `visual-qa-result.json`, y la verificacion live guardada en [`reference-live-check/`](./assets/chekeo-phase-2-2a-figma-mockup/reference-live-check/).

Nota de consistencia: el chequeo live del 2026-06-22 encontro la preview accesible con PIN `BOG_INTERNAL_PIN`, pero el estado operativo actual ya no conserva toda la cola activa de 10 pedidos de Phase 2.1. Por eso el mockup usa la siembra `QA-UIUX-PHASE2-1` y sus screenshots/JSON como baseline operativo reproducible.

## 5. Variante recomendada

Recomendacion: Variante A.

Motivo: conserva la estructura operacional ya probada en Phase 2, usa carriles de decision claros, mantiene mejor densidad en mobile y minimiza el costo de implementacion para Fase 2.2B. Variante B funciona como exploracion para presion operativa y heatmaps, pero introduce mas cambios cognitivos para staff.

## 6. Diferencia A/B

Variante A:

- Navegacion por flujo: Operacion -> Pedidos -> Cocina -> Pagos -> Admin.
- Metricas, carriles y listas con prioridad por accion.
- Mejor para implementacion incremental sobre el Chekeo actual.

Variante B:

- Navegacion por presion operativa: radar, heatmap y board por bloqueo.
- Mas visual y compacta para staff experto.
- Mayor riesgo de sobrecargar pantallas chicas si se implementa sin pruebas en turno real.

## 7. Componentes creados

Componentes del fallback, listos para mapear a Figma:

- App shell mobile con header, estado y bottom nav.
- PIN gate.
- Metric cards.
- Status chips: nuevo, preparando, listo, entregado, cancelado.
- Payment chips: pagado, pendiente, cancelado.
- Order cards.
- Kitchen lanes con barra de progreso.
- Payment validation cards.
- Timeline/checklist.
- Admin action rows.
- Menu rows.
- Raffle participant rows.
- Desktop command layout.

## 8. Decisiones visuales

- Se mantuvo Control Room Dark: `#020617`, `#09090b`, `#111113`, texto `#f8fafc`.
- Se conservaron acentos reales de Chekeo: verde `#22c55e`, lime `#84cc16`, cyan `#22d3ee`, warning `#facc15` y danger `#fb7185`.
- Se incorporo energia Burgers.exe de forma contenida con `#39FF14`, cyan y pink, sin dominar la interfaz.
- Tipografia objetivo: Fira Sans para UI y Fira Code para folios, codigos y etiquetas tecnicas.
- Bordes de 6-8 px, sin tarjetas anidadas, priorizando lectura rapida en operacion.
- Mobile-first con frames 390 px y pruebas puntuales en 320 px.

## 9. Decisiones pendientes con usuario

- Confirmar si Fase 2.2B debe implementar Variante A completa o tomar elementos puntuales de Variante B.
- Confirmar si Sorteos debe mantenerse dentro de Admin o subir a tab principal en fechas de campana.
- Definir si el pago pendiente debe bloquear visualmente el boton de entrega o solo marcar advertencia.
- Definir si el desktop overview sera una vista soportada formalmente o solo una referencia para staff administrativo.

## 10. Que implementar en Fase 2.2B

- Implementar Variante A como UI objetivo.
- Mantener el flujo mobile: Operacion, Pedidos, Cocina, Pagos, Admin.
- Agregar detalle de pago con checklist de conciliacion.
- Mejorar Resumen K con top items y guarniciones visibles.
- Reforzar estados de bloqueo por pago o nota critica.
- Agregar pruebas visuales de 320, 390, 430 y desktop si se implementa el overview.

## 11. Que codigo no se toco

No se modifico codigo de produccion, runtime, API, Cloudflare Worker ni app interna.

Cambios realizados solo en documentacion y assets:

- `docs/chekeo-phase-2-2a-figma-mockup.md`
- `docs/assets/chekeo-phase-2-2a-figma-mockup/`

## 12. Riesgos

- El Figma remoto no contiene los frames por bloqueo MCP de plan; requiere importacion manual de PNGs o reintento cuando haya cuota.
- La preview live del 2026-06-22 ya habia derivado respecto a la siembra Phase 2.1; el baseline confiable para esta fase son los screenshots y JSON guardados.
- Variante B requiere prueba en turno real antes de implementarse porque concentra mas informacion por pantalla.
- Los PNGs son artefactos de mockup, no pruebas de UI productiva.

## 13. PNG exports

Carpeta: [`docs/assets/chekeo-phase-2-2a-figma-mockup/`](./assets/chekeo-phase-2-2a-figma-mockup/).

Exports principales:

- Variante A mobile 390: `mockup-a-login-390.png`, `mockup-a-operacion-390.png`, `mockup-a-pedidos-390.png`, `mockup-a-detalle-390.png`, `mockup-a-cocina-390.png`, `mockup-a-resumen-390.png`, `mockup-a-pagos-390.png`, `mockup-a-pago-detalle-390.png`, `mockup-a-corte-390.png`, `mockup-a-admin-390.png`, `mockup-a-catalogo-390.png`, `mockup-a-sorteos-390.png`.
- Variante B mobile 390: `mockup-b-login-390.png`, `mockup-b-operacion-390.png`, `mockup-b-pedidos-390.png`, `mockup-b-detalle-390.png`, `mockup-b-cocina-390.png`, `mockup-b-resumen-390.png`, `mockup-b-pagos-390.png`, `mockup-b-pago-detalle-390.png`, `mockup-b-corte-390.png`, `mockup-b-admin-390.png`, `mockup-b-catalogo-390.png`, `mockup-b-sorteos-390.png`.
- Tight mobile 320: `mockup-a-operacion-320.png`, `mockup-a-pedidos-320.png`, `mockup-a-cocina-320.png`.
- Desktop: `mockup-a-desktop-desktop.png`, `mockup-b-desktop-desktop.png`.

Validacion local: `prototype-qa-result.json` registra 29 frames cargados sin errores de consola ni page errors.
