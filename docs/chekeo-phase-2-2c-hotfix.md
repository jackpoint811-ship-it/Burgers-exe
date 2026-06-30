# Fase 2.2C - Hotfix Cocina, Pedidos y Pagos

## Resumen

Hotfix enfocado en Chekeo internal v2 despues del merge de la Fase 2.2B. No cambia produccion ni instala dependencias. El objetivo fue recuperar flujo operacional fino: Cocina separada por burgers y Side Quest, Pedidos sin cobro, Pagos con modal singleton, ticket limpio, Resumen K ampliado e iconos rapidos en header.

## Cocina

- Las tabs de Cocina quedan simples: `Preparacion`, `Side Quest`, `Resumen K`.
- Las tabs ya no muestran contadores, hints, metricas ni cards internas.
- `Preparacion` muestra solo burgers individuales y combos como trabajo de burger.
- `Side Quest` muestra guarniciones, extras no-burger y bebidas incluidas como items separados.
- Los items se agrupan por orden y funcionan como acordeon: solo una unidad abierta por orden.
- La primera unidad pendiente se abre automaticamente.
- Las unidades hechas siguen visibles, colapsadas y marcadas como `Hecha`.
- Cada card conserva una sola accion primaria: `Hecha`.

## Separacion Preparacion / Side Quest

Los items originales `burger` y `combo` alimentan Preparacion. Los complementos de combo se expanden como items sinteticos `garnish` con line keys `::sidequest-*`, siguiendo el patron ya usado por el endpoint admin. Esto permite que:

- marcar burger no marque automaticamente Side Quest,
- marcar Side Quest no marque automaticamente burger,
- el pedido solo avance a listo cuando todos los items operativos de la orden esten hechos.

## Pedido Listo

Al marcar un item, la UI evalua todos los items operativos de esa orden. Solo llama el avance a `ready` si todos estan hechos. Casos cubiertos:

- Burger hecha + Side Quest pendiente: pedido no listo.
- Burger pendiente + Side Quest hecha: pedido no listo.
- Burger hecha + Side Quest hecha: pedido listo.

## Pedidos

- Pedidos queda enfocado en movimientos de estado, detalle, informacion del cliente, ticket y confirmacion corta.
- Se retiraron badges/facts de pago del detalle, card compacta y preview de ticket en Pedidos.
- El copy de WhatsApp de Pedidos ahora es corto: cliente + total + confirmacion Burgers.exe.
- No incluye datos bancarios, metadata, source, D1, preview, IDs internos ni acciones de cobro.

## Ticket

- El ticket PNG pasa a recibo vertical mas alto.
- Se mejora wrap de texto para palabras largas, notas, extras y modificaciones.
- Se retiran metricas de pago del PNG.
- Mantiene folio, cliente, entrega, total, items, extras, ingredientes quitados, modificaciones y nota.

## Pagos / Modal

- Se elimino el menu flotante por card basado en `details`.
- `Mas` abre un solo modal/bottom sheet activo.
- Si se abre otro pedido, se actualiza el contenido del mismo modal.
- Copiar WhatsApp mantiene el modal abierto y muestra aviso de copiado.
- Escape y back handler siguen cerrando el modal antes de salir de la app.

## Navegacion

- Se agrego una quicknav de iconos en el header flotante con las secciones principales.
- No se retiro la navegacion actual por tabs/bottom.
- El icono activo se distingue visualmente.
- En mobile, la quicknav se acomoda en una segunda linea compacta para mantener targets tactiles.

## Resumen K

- Recupera lectura amplia: burgers por tipo, guarniciones por tipo, costo de produccion, ventas visibles, ganancia estimada e insumos.
- La ganancia se calcula localmente como ventas visibles de ordenes unicas menos costo estimado cuando el endpoint trae costo.
- No se mezclan cards de Resumen K dentro de las tabs.

## Screenshots

Guardadas en `docs/assets/chekeo-phase-2-2c-hotfix/`:

- `cocina-tabs-mobile-390.png`
- `cocina-preparacion-burgers-mobile-390.png`
- `cocina-preparacion-multi-item-mobile-390.png`
- `cocina-sidequest-mobile-390.png`
- `cocina-resumen-k-mobile-390.png`
- `pedidos-detail-no-payment-mobile-390.png`
- `pedidos-ticket-fixed-mobile-390.png`
- `pedidos-copy-short-mobile-390.png`
- `pagos-modal-singleton-mobile-390.png`
- `bottom-sheet-mobile-320.png`
- `header-icons-mobile-390.png`
- `desktop-overview-hotfix.png`

## Checks Ejecutados

- `npm run typecheck`
- `APP_TARGET=internal npm run build:internal`
- `npx playwright test --config=playwright.internal-kitchen.config.ts`
- Browser integrado: `http://127.0.0.1:4176/`, titulo correcto, pantalla PIN visible, sin errores de consola.

## Riesgos

- El calculo de ganancia estimada depende de ventas visibles y costo estimado del endpoint; no sustituye un corte financiero definitivo.
- El preview real de Pages aun depende del deploy del PR para validar estos cambios contra URL publica con PIN `BOG_INTERNAL_PIN`.
- La extension de Side Quest para bebida incluida usa el mismo contrato de checklist existente, sin migracion de schema.

## Pendientes

- Validar el deploy del PR en Pages cuando GitHub/Cloudflare lo publique.
- Revisar si Resumen K debe recibir ganancia desde backend en una fase posterior para evitar calculo local.

## Recomendacion de Merge

Recomendado para merge despues de que el PR deploy publique y se confirme login con PIN `BOG_INTERNAL_PIN` en preview real. El cambio es enfocado, mantiene contratos principales y cubre los flujos criticos con Playwright.
