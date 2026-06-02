# Burgers.exe V2 QA operativo final

Checklist final para validar el pulido operativo de Public V2 y Chekeo V2. Esta revisión es frontend/docs: no cambia reglas de negocio, backend, datos, pagos, WhatsApp ni Sheets.

## Public V2

- [ ] Menú carga correctamente.
- [ ] Hero comunica: elegir burger, personalizar y confirmar pedido.
- [ ] CTA flotante permanece visible sin tapar contenido.
- [ ] CTA flotante no tapa el banner de sorteo en Menú.
- [ ] Main Quest mantiene el label principal y se entiende la acción.
- [ ] El usuario puede crear una orden con 1 burger.
- [ ] Las opciones Hamburguesa/Combo se ven clickeables.
- [ ] La ruta Combo solo aparece cuando hay combos disponibles.
- [ ] Workbench mantiene el label principal y se entiende la personalización.
- [ ] MOD visible y claro como quitar ingredientes.
- [ ] UPGRADE visible y claro como agregar extras.
- [ ] Selector de cantidad `- x1 +` funciona.
- [ ] Nota por burger sigue visible y cómoda.
- [ ] CTA flotante no tapa MOD, UPGRADE ni nota por burger.
- [ ] Side Quest mantiene el label principal.
- [ ] Guarnición extra queda clara como opcional.
- [ ] Se puede continuar sin guarnición extra.
- [ ] CTA flotante no tapa cards de guarniciones ni el botón para continuar sin guarnición.
- [ ] Loadout final mantiene el label principal.
- [ ] Ticket, datos, nota, código de invitado, ubicación, pago, total y confirmar aparecen en orden operativo.
- [ ] CTA flotante no tapa items ni campos del Loadout final.
- [ ] Success mantiene el label principal y confirma pedido recibido.
- [ ] Success muestra tickets ganados por esta orden.
- [ ] Success muestra código referido propio cuando aplica.
- [ ] Código referido se puede copiar y no se parte raro en mobile.
- [ ] Campaña desactivada no muestra bloque de sorteo ni deja espacio vacío.
- [ ] Cards sin imagen se mantienen compactas y sin huecos gigantes.
- [ ] 320px sin overflow horizontal.
- [ ] 390px sin overflow horizontal.

## Chekeo V2

- [ ] Login PIN funciona sin cambios.
- [ ] Pedidos carga y permite operación básica.
- [ ] Cocina muestra pedidos y acciones claras.
- [ ] Pagos mantiene estados y edición operativa.
- [ ] Cierre carga rango, totales y exportación según permisos.
- [ ] Catálogo permite editar disponibilidad, precio e imágenes.
- [ ] Sorteos muestra campañas mensuales con copy operativo.
- [ ] Crear código de invitado funciona.
- [ ] Buscar participante funciona.
- [ ] Generar imagen para compartir funciona.
- [ ] Descargar PNG funciona.
- [ ] WhatsApp manual conserva la aclaración: descargar imagen y adjuntarla manualmente.
- [ ] Teléfonos enmascarados siguen visibles donde aplica.
- [ ] Tickets sujetos a validación final siguen aclarados.
- [ ] Logout funciona.
- [ ] Mobile y desktop no se sienten amontonados en Sorteos.

## Confirmación de alcance

- [ ] Sin migración nueva.
- [ ] Sin backend nuevo.
- [ ] Sin tokens nuevos.
- [ ] Sin cambios en WhatsApp API.
- [ ] Sin cambios en pagos reales.
- [ ] Sin cambios en Sheets sync.
- [ ] Sin cambios en auth PIN-only.
- [ ] Sin cambios en sorteos/referidos más allá de UX/copy frontend.

## Checks programáticos sugeridos

- [ ] `npm run typecheck`
- [ ] `npm run build:public`
- [ ] `npm run build:internal`
- [ ] `npm run build`
- [ ] `git diff --check`


## Official production smoke test

- [ ] Public official opens the correct V2 experience.
- [ ] Create a public order.
- [ ] Success shows the folio.
- [ ] Success shows tickets and referral code when an active campaign exists.
- [ ] Chekeo official PIN login works.
- [ ] The order appears in Chekeo.
- [ ] Kitchen MOD/UPGRADE handling works.
- [ ] Payment works.
- [ ] Delivered works.
- [ ] Closing works.
- [ ] Raffles work.
- [ ] Manual WhatsApp image works.
- [ ] Logout works.
- [ ] Preview backup is accessible.
- [ ] Legacy was not touched.
- [ ] Apps Script and Sheets are not used as the source of truth.
