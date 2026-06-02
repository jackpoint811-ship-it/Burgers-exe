# Burgers.exe V2 QA Preview Checklist

Checklist para validar V2 en URL de preview (Cloudflare Pages o local preview), sin impacto a producción.

## Preconditions

- Build y typecheck en verde.
- URL de preview accesible.
- Confirmado que entorno es mock-only.

## Public Order V2 (`public-order-v2`)

- [ ] Carga inicial correcta (sin pantalla en blanco/errores críticos).
- [ ] Hero visible y consistente con diseño V2.
- [ ] Sección de promos renderiza correctamente.
- [ ] Menú muestra items esperados.
- [ ] Carrito abre/actualiza correctamente.
- [ ] Cantidades (+/-) actualizan subtotal y estado visual.
- [ ] Checkout mock completa flujo sin bloquear.
- [ ] Success mock aparece con mensaje esperado.
- [ ] `prefers-reduced-motion` respetado.
- [ ] Mobile 320px usable.
- [ ] Mobile 390px usable.
- [ ] Desktop usable.
- [ ] Sin llamadas productivas (`/api/order`, `/api/rpc`, dominios productivos).

## Internal Chekeo V2 (`internal-chekeo-v2`)

- [ ] Login PIN real permite entrar al shell.
- [ ] Tabs principales cambian correctamente.
- [ ] Dashboard mock renderiza KPIs/estado esperado.
- [ ] Vista de pedidos carga y permite interacción mock.
- [ ] Vista de cocina muestra estado esperado.
- [ ] Mover estado de pedido funciona en mock.
- [ ] Modal de detalle abre/cierra sin errores.
- [ ] Pagos/notas mock editables según flujo definido.
- [ ] Historial mock visible y consistente.
- [ ] Logout de sesión regresa al login.
- [ ] `prefers-reduced-motion` respetado.
- [ ] Mobile 320px usable.
- [ ] Mobile 390px usable.
- [ ] Sin llamadas productivas (`/api/order`, `/api/rpc`, dominios productivos).

## Evidencia mínima sugerida

- Capturas de pantalla mobile + desktop por app.
- Registro de consola sin errores críticos.
- Registro de red validando ausencia de endpoints productivos.

## Criterio de bloqueo

Si aparece conexión real a backend productivo o dependencia operativa (auth/sheets/rpc real), el preview se considera bloqueado para aprobación.

## V2-5 polish validation (2026-05-26)

- Hero/promos/menu/cart were refined to feel commercial and brand-forward on 320/390 widths.
- Internal console header/tabs/cards/kitchen/modal were compacted for higher operator density.
- Confirmed all actions remain local mock interactions.

## V2-5.2 final preview polish validation (2026-05-26)

- Header interno validado como barra operativa compacta (no hero) en mobile 320/390.
- Tabs internas validadas sin overflow horizontal a 320px y active state claro.
- Dashboard/KPIs internos validados en versión compacta de alta densidad.
- Kitchen queue/modal validados sin acciones operativas en estados terminales (`delivered`, `cancelled`).
- Public V2 validado con micro ajustes de legibilidad/spacing en iPhone SE sin cambiar flujo.
- Confirmación explícita: mock-only, sin tocar V1/backend/producción.
- Gate de avance: con screenshots QA aprobados, iniciar V2-6 datos reales.

## QA catálogo admin V2 (internal preview)

- Abrir internal preview.
- Entrar con PIN real.
- Ir a tab **Catálogo**.
- Confirmar carga de catálogo live (`source=d1`).
- Usar sesión interna activa para editar.
- Editar descripción/precio/disponibilidad de un item.
- Guardar y confirmar feedback "Producto actualizado".
- Confirmar que `GET /api/menu-v2` refleja cambios.
- Confirmar que public preview refleja cambios de catálogo.
- Confirmar que sin sesión interna no permite editar.
- Confirmar que sin cookie válida muestra error Unauthorized.

## QA R2 assets catálogo V2 (preview)

- [ ] Configurar binding R2 `BOG_ASSETS_BUCKET` en `burgers-exe-public-v2-preview`.
- [ ] Configurar binding R2 `BOG_ASSETS_BUCKET` en `burgers-exe-internal-v2-preview`.
- [ ] Redeploy después de configurar el binding.
- [ ] Subir imagen de prueba a R2, por ejemplo `menu/burger-og.webp`.
- [ ] En Internal Chekeo V2 > Catálogo, editar un producto y guardar `imageKey=menu/burger-og.webp`.
- [ ] Confirmar que `GET /api/menu-v2` devuelve `imageKey` para ese item.
- [ ] Confirmar que Public Order V2 carga la imagen real desde `/api/assets-v2/menu/burger-og.webp`.
- [ ] Confirmar fallback visual si `imageKey` apunta a una key inexistente.
- [ ] Confirmar `alt` correcto: nombre del item o `promo.asset.alt` en promos.
- [ ] Confirmar que el contenedor mantiene aspect ratio estable y no genera layout shift perceptible.
- [ ] Confirmar que `/api/assets-v2/<key>` responde 404 para `..`, backslash, doble slash y extensiones no permitidas.
- [ ] Confirmar que no hay llamadas productivas a `/api/order` ni `/api/rpc`.
- [ ] Confirmar que no existe upload público ni listado público del bucket.

## V2-8.2 Internal catalog image upload QA

- [ ] Entrar a Internal Chekeo V2 preview.
- [ ] Abrir tab Catálogo.
- [ ] Iniciar sesión con PIN interno; confirmar que no se guardan credenciales internas en storage.
- [ ] Editar un producto con `source: d1`.
- [ ] En “Imagen del producto”, subir una imagen válida `.jpg`, `.png`, `.webp` o `.avif` menor o igual a 5 MB.
- [ ] Confirmar estado “Subiendo…” y mensaje “Imagen actualizada”.
- [ ] Confirmar que la card/lista del catálogo muestra el nuevo `imageKey` bajo `menu/`.
- [ ] Confirmar que `GET /api/menu-v2` muestra `imageKey` actualizado e `imageUrl` vacío/nulo para ese SKU.
- [ ] Confirmar que Public Order V2 muestra la imagen subida desde `/api/assets-v2/<imageKey>` sin redeploy.
- [ ] Usar “Quitar imagen / usar placeholder”.
- [ ] Confirmar que `GET /api/menu-v2` limpia `imageKey` e `imageUrl` para ese SKU.
- [ ] Confirmar que Public Order V2 vuelve al placeholder visual.
- [ ] Probar archivo mayor a 5 MB y confirmar rechazo frontend/backend.
- [ ] Probar tipo no permitido (SVG, GIF, HTML o content-type vacío) y confirmar rechazo.
- [ ] Confirmar que sin sesión interna no sube ni quita imágenes.
- [ ] Confirmar que no existe upload en `public-order-v2` y que no se llama `/api/order` ni `/api/rpc`.

## V2-8.3 QA — Promos admin + imágenes R2

- Entrar a Internal Chekeo V2 preview.
- Abrir tab Catálogo.
- Usar sesión interna activa.
- Abrir la sección interna Promos.
- Confirmar Source: `Catálogo live` (`source: d1`). Si aparece `Fallback local` o `Catálogo local`, validar que edición/upload quedan bloqueados.
- Buscar y abrir la promo Combo OG.
- Editar título y descripción, guardar y confirmar mensaje “Promo actualizada”.
- Confirmar en `GET /api/menu-v2` que la promo refleja texto nuevo y `source: d1`.
- Subir una imagen de promo válida JPG/PNG/WebP/AVIF menor o igual a 5 MB.
- Confirmar que `GET /api/menu-v2` muestra `promo.asset.imageKey` con prefijo `promos/`.
- Abrir Public V2 y confirmar que muestra la imagen de promo sin redeploy.
- En Internal V2, usar “Quitar imagen / usar placeholder”.
- Confirmar que `GET /api/menu-v2` deja `promo.asset.imageKey` y `promo.asset.imageUrl` vacíos/ausentes.
- Confirmar que Public V2 vuelve al placeholder visual de promo.
- Probar archivo mayor a 5 MB y confirmar rechazo claro.
- Probar tipo no permitido (SVG/GIF u otro) y confirmar rechazo claro.
- Confirmar que sin sesión interna no edita, no sube y no quita imágenes.
- Confirmar que Public V2 no contiene upload ni llama endpoints admin de promos.
- Confirmar que no se agregaron llamadas a `/api/order` ni `/api/rpc`.

## V2-9A órdenes D1 backend base

### Migración

- [ ] Ejecutar local: `npm run db:v2:orders:migrate:local`.
- [ ] Ejecutar remoto preview cuando aplique: `npm run db:v2:orders:migrate:remote`.
- [ ] Confirmar que existen `orders_v2`, `order_items_v2`, `order_events_v2` en el D1 ligado a `BOG_MENU_DB`.

### POST /api/orders-v2

- [ ] Probar creación con curl y `Idempotency-Key`:

```bash
curl -i -X POST "$PUBLIC_V2_URL/api/orders-v2" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: qa-v2-9a-001' \
  --data '{"customer":{"name":"QA Tester","phone":"5512345678"},"orderMode":"pickup","paymentMethod":"cash","items":[{"sku":"BRG-OG","qty":1}],"notes":"QA V2-9A"}'
```

- [ ] Repetir el mismo curl y confirmar respuesta `idempotent: true` sin duplicar orden.
- [ ] Probar SKU inexistente/no disponible y confirmar `ITEM_UNAVAILABLE`.
- [ ] Confirmar que el total viene de D1 y no de valores enviados por cliente.

### GET /api/orders-v2-admin

- [ ] Probar listado después de login PIN desde la UI:

```bash
curl -i "$INTERNAL_V2_URL/api/orders-v2-admin?includeTerminal=true&limit=10" \
```

- [ ] Confirmar que responde órdenes con items y eventos.
- [ ] Confirmar que sin sesión interna responde 401 o 503 si no hay credencial configurado.

### PATCH /api/orders-v2-admin/:id/status

- [ ] Cambiar `new -> preparing`.
- [ ] Cambiar `preparing -> ready`.
- [ ] Cambiar `ready -> delivered`.
- [ ] Intentar cambiar una orden `delivered` y confirmar `INVALID_STATUS_TRANSITION`.
- [ ] Cancelar una orden no terminal y confirmar evento `ORDER_CANCELLED`.

### No-touch checks

- [ ] Confirmar que `/api/order` legacy no fue modificado.
- [ ] Confirmar que `/api/rpc` legacy no fue modificado.
- [ ] Confirmar que Apps Script y `.gs` no fueron modificados.
- [ ] Confirmar que Sheets contracts no fueron modificados.
- [ ] Confirmar que `BOG_ACTIVE_ENV` no fue modificado.
- [ ] Confirmar que Public V2 UI e Internal V2 UI siguen sin conectarse a órdenes reales en este PR.

## V2-9B Public V2 → POST /api/orders-v2

### Flujo público

- [ ] Abrir Public V2 preview.
- [ ] Confirmar que el catálogo carga desde `GET /api/menu-v2` o fallback visual sin romper layout mobile.
- [ ] Agregar Burger OG al ticket.
- [ ] Llenar nombre con al menos 2 caracteres.
- [ ] Llenar teléfono con al menos 10 dígitos.
- [ ] Elegir entrega: Pickup o Delivery.
- [ ] Elegir pago: Efectivo, Transferencia, Tarjeta o Por confirmar.
- [ ] Enviar pedido con “Confirmar pedido”.
- [ ] Confirmar estado visible “Enviando pedido...”.
- [ ] Confirmar que el botón queda deshabilitado mientras envía.
- [ ] Confirmar success “Pedido recibido” con folio `BX-...`, estado `Nuevo`, total confirmado `MXN`, entrega y método de pago.
- [ ] Confirmar que se informa “Pago pendiente de confirmación” y “No se realizó ningún cobro en línea”.

### Backend y administración

- [ ] Confirmar la orden creada en `GET /api/orders-v2-admin?includeTerminal=true&limit=10` desde Internal V2 con sesión activa.
- [ ] Confirmar que el total guardado viene del backend y no de valores del cliente.
- [ ] Confirmar que el payload público solo envía `{ sku, qty }` por item, sin precios ni total.

### Idempotencia y errores

- [ ] Hacer doble click en “Confirmar pedido” y confirmar que no duplica por UI disabled + `Idempotency-Key`.
- [ ] Simular error recuperable de backend/red y confirmar que el carrito, nombre, teléfono, entrega, pago y notas se mantienen para reintento.
- [ ] Reintentar el mismo draft después del error y confirmar que reutiliza la misma idempotency key.
- [ ] Cambiar el draft después de un error y confirmar que un intento nuevo puede usar otra idempotency key.
- [ ] Confirmar que un SKU no disponible no se puede agregar desde la UI y no debería enviarse desde Public V2.

### No-touch / seguridad

- [ ] Confirmar que Public V2 no llama `/api/order`.
- [ ] Confirmar que Public V2 no llama `/api/rpc`.
- [ ] Confirmar que Public V2 no llama `orders-v2-admin` ni endpoints admin.
- [ ] Confirmar que Public V2 no toca R2 upload y solo lee assets vía `/api/assets-v2/<key>` cuando aplica.
- [ ] Confirmar que Internal Chekeo V2 todavía no consume live orders en esta fase.
- [ ] Confirmar que Apps Script, Sheets, legacy, `cloudflare/public-order`, `cloudflare/internal-chekeo` y `BOG_ACTIVE_ENV` no fueron modificados.

## V2-9C Internal V2 → órdenes live D1

### Flujo Internal live

- [ ] Abrir Internal V2 preview.
- [ ] Iniciar sesión con `BOG_INTERNAL_PIN`.
- [ ] Confirmar que no se guardan credenciales internas en storage del navegador.
- [ ] Confirmar copy “Pedidos live D1”, “Source: Órdenes live” y “Backend V2”.
- [ ] Confirmar que aparece la orden `BX-20260529-4F1BEC` cuando está activa.
- [ ] Presionar “Recargar órdenes” y confirmar que vuelve a consultar `GET /api/orders-v2-admin`.

### Pedidos / Cocina / Historial

- [ ] En Pedidos, confirmar folio, cliente, teléfono, modo entrega, método de pago, `paymentStatus`, `status`, total, notas, items, fecha y `source: public-v2`.
- [ ] Cambiar `new -> preparing` desde Pedidos con “Marcar en preparación”.
- [ ] Confirmar que el botón queda deshabilitado mientras corre `PATCH /api/orders-v2-admin/:id/status`.
- [ ] Cambiar `preparing -> ready` desde Cocina.
- [ ] Cambiar `ready -> delivered` desde Cocina o Pedidos.
- [ ] Confirmar que una orden `delivered` desaparece de Pedidos/Cocina activas.
- [ ] Abrir Historial y confirmar que carga `includeTerminal=true&limit=50` y muestra la orden `delivered`.
- [ ] Confirmar que no aparecen acciones para `delivered` ni `cancelled`.

### Errores y fallback

- [ ] Confirmar error visible sin sesión interna: “Inicia sesión para cargar órdenes live”.
- [ ] Simular backend caído/sesión inválida y confirmar error claro más “Fallback mock”.
- [ ] Confirmar que `mockOrders` sigue disponible para QA visual cuando no hay live.
- [ ] Confirmar success message breve al cambiar estado.

### Seguridad / no-touch

- [ ] Confirmar que Internal V2 llama solo `GET /api/orders-v2-admin`, `PATCH /api/orders-v2-admin/:id/status`, `GET /api/menu-v2` y endpoints admin existentes de catálogo.
- [ ] Confirmar no llamadas nuevas a `/api/order` ni `/api/rpc`.
- [ ] Confirmar que Public V2 no usa credenciales internas ni endpoints admin.
- [ ] Confirmar que Apps Script, Sheets, legacy, `cloudflare/public-order`, `cloudflare/internal-chekeo`, pagos reales, WhatsApp real y `BOG_ACTIVE_ENV` no fueron modificados.

## V2-9D Live orders polish smoke QA

### Public V2 success polish

- [ ] Public V2 crea orden real y muestra folio `BX-...` en “Pedido recibido”.
- [ ] El success state muestra “Pedido registrado en backend V2”.
- [ ] El success state muestra “Sin pago en línea todavía”, “Pago pendiente de confirmación” y “No se realizó ningún cobro en línea”.
- [ ] El botón “Crear otro pedido” funciona, limpia confirmación, deja carrito vacío y deja formulario limpio.
- [ ] Nueva orden posterior a “Crear otro pedido” usa una nueva idempotency key.
- [ ] El botón “Volver al menú” desplaza al menú y mantiene la confirmación visible para que el cliente conserve folio/contexto.

### Internal V2 empty states and actions

- [ ] Internal Pedidos muestra “No hay pedidos activos.” cuando source es D1 y no hay órdenes activas.
- [ ] Internal Pedidos muestra “Cuando Public V2 reciba un pedido nuevo, aparecerá aquí.” como ayuda secundaria.
- [ ] Internal Cocina muestra “Cocina limpia.” cuando source es D1 y no hay órdenes `new`, `preparing` ni `ready`.
- [ ] Internal Cocina muestra “No hay órdenes activas por preparar.” como ayuda secundaria.
- [ ] Historial muestra “Aún no hay historial de órdenes terminales.” cuando source es D1 y no hay `delivered`/`cancelled`.
- [ ] Historial muestra órdenes `delivered`/`cancelled` con `includeTerminal=true`.
- [ ] Botones muestran “Iniciar preparación”, “Marcar listo”, “Entregar” y “Cancelar” según estado.
- [ ] `delivered` y `cancelled` no muestran acciones.
- [ ] Si falla una acción de estado, se muestra error visible y la UI no cambia optimistamente a estado falso.

### Timeline and shared internal session

- [ ] Timeline muestra `ORDER_CREATED` como “Pedido creado”.
- [ ] Timeline muestra `STATUS_CHANGED` como “Estado: <label>”.
- [ ] Timeline muestra `ORDER_CANCELLED` como “Pedido cancelado”.
- [ ] Timeline conserva actor, fecha, previousStatus/nextStatus y `detail.reason` si existe.
- [ ] Token activado en Pedidos sirve en Catálogo.
- [ ] Cerrar sesión en Catálogo afecta Pedidos.
- [ ] Cerrar sesión en Pedidos afecta Catálogo.

### No-touch checks

- [ ] No llamadas a `/api/order` ni `/api/rpc` desde Public V2 o Internal V2.
- [ ] No se modifican `/api/order`, `/api/rpc`, `functions/api`, migrations, Apps Script, Sheets, legacy, `cloudflare/public-order`, `cloudflare/internal-chekeo`, pagos, WhatsApp ni `BOG_ACTIVE_ENV`.

## V2-10A.1 Orders V2 CSV export QA

### Endpoint/auth

- [ ] `GET /api/orders-v2-admin/export.csv` without session cookie responds `401 UNAUTHORIZED` JSON envelope.
- [ ] `GET /api/orders-v2-admin/export.csv` with valid internal session cookie responds `text/csv; charset=utf-8`.
- [ ] Response includes `Content-Disposition: attachment; filename="orders-v2-export.csv"`.
- [ ] Response includes `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

### Filters

- [ ] `includeTerminal=false` excludes `delivered` and `cancelled` orders.
- [ ] `includeTerminal=true` includes `delivered` and `cancelled` orders.
- [ ] `status=delivered` filters to delivered orders.
- [ ] Invalid `status` responds `400 INVALID_STATUS`.
- [ ] Invalid `limit` responds `400 INVALID_LIMIT`.
- [ ] Invalid `from` or `to` responds `400 INVALID_DATE`.

### CSV contract and safety

- [ ] CSV contains exact headers: `folio,order_id,created_at,updated_at,status,customer_name,customer_phone,order_mode,payment_method,payment_status,notes,subtotal,total,items_summary,item_skus,item_qtys,event_count,source`.
- [ ] CSV exports one row per order.
- [ ] `subtotal` and `total` are pesos with two decimals.
- [ ] `items_summary` contains related order items.
- [ ] `event_count` contains the related event count.
- [ ] CSV opens/imports in Sheets as a manual export.
- [ ] Fields with commas, quotes, or newlines are escaped correctly.
- [ ] Values that start with `=`, `+`, `-`, `@`, tab, or carriage return do not execute as formulas after export/import.

### No-touch checks

- [ ] Confirm no changes to `/api/order` legacy.
- [ ] Confirm no changes to `/api/rpc` legacy.
- [ ] Confirm no changes to Apps Script or `.gs` files.
- [ ] Confirm no changes to Sheets contracts or automatic Sheets sync.
- [ ] Confirm no changes to Public V2 UI or Internal V2 UI.
- [ ] Confirm no changes to `cloudflare/public-order`, `cloudflare/internal-chekeo`, `legacy`, migrations, payments, WhatsApp, or `BOG_ACTIVE_ENV`.

## V2-10A.2 Internal CSV export UI QA

### Internal UI behavior

- [ ] Botón “Exportar CSV” visible en Internal Chekeo V2 junto a los controles de órdenes/source.
- [ ] Sin sesión interna, el botón queda deshabilitado y se muestra “Activa modo admin para exportar CSV”.
- [ ] La sesión interna habilita exportación.
- [ ] Export default descarga un archivo `.csv` desde `GET /api/orders-v2-admin/export.csv`.
- [ ] La descarga usa `download="orders-v2-export.csv"` cuando el navegador lo permite.
- [ ] Errores JSON del backend se muestran en la UI sin imprimir secretos.

### Export options/query params

- [ ] En Pedidos/Cocina, `includeTerminal` default es `false`.
- [ ] En Historial, `includeTerminal` default es `true`.
- [ ] Marcar “Incluir entregados/cancelados” envía `includeTerminal=true` y descarga terminales.
- [ ] Seleccionar `Entregado` envía `status=delivered` y descarga entregadas.
- [ ] `from` y `to` se envían correctamente como fechas `YYYY-MM-DD`.
- [ ] `limit` default es `500`.
- [ ] `limit` inválido o mayor a `1000` se bloquea o muestra error antes de exportar.
- [ ] El CSV descargado es importable en Sheets como export manual.

### No-touch checks

- [ ] Confirmar que este PR no toca backend (`functions/api/**`).
- [ ] Confirmar que este PR no toca Public V2 (`apps/public-order-v2/**`).
- [ ] Confirmar que este PR no toca `/api/order` legacy ni `/api/rpc` legacy.
- [ ] Confirmar que este PR no toca Apps Script, `.gs`, Sheets API ni sync automático a Sheets.
- [ ] Confirmar que este PR no toca `cloudflare/public-order`, `cloudflare/internal-chekeo`, `legacy`, migrations, pagos, WhatsApp ni `BOG_ACTIVE_ENV`.

## V2-10B Operational close dashboard QA

### Summary endpoint

- [ ] `GET /api/orders-v2-admin/summary` without session cookie returns `401 UNAUTHORIZED` or `503 ADMIN_DISABLED` when admin is not configured.
- [ ] `GET /api/orders-v2-admin/summary` with valid internal session cookie returns `ok: true` and `source: "d1"`.
- [ ] Missing D1 binding returns `503 D1_NOT_CONFIGURED`.
- [ ] Non-GET methods return `405 METHOD_NOT_ALLOWED`.
- [ ] Invalid `from` or `to` returns `400 INVALID_DATE`.
- [ ] `from > to` returns `400 INVALID_DATE_RANGE`.
- [ ] Invalid `limit` returns `400 INVALID_LIMIT`.
- [ ] Invalid `topLimit` returns `400 INVALID_TOP_LIMIT`.
- [ ] Unexpected backend/query failure returns `500 SUMMARY_FAILED`.

### Metrics validation

- [ ] `grossSales` equals the sum of non-cancelled order totals in pesos.
- [ ] `deliveredSales` equals the sum of delivered order totals in pesos.
- [ ] `averageTicket` equals `grossSales / non-cancelled orders`.
- [ ] `activeOrders` equals `new + preparing + ready`.
- [ ] `byPaymentMethod` is labeled/understood as declared payment method, not real payment capture.
- [ ] `byOrderMode` separates pickup and delivery.
- [ ] `topItems` excludes cancelled orders.
- [ ] `recentOrders` is sorted by `created_at desc`, respects `limit`, and does not include `customerPhone`.
- [ ] `durations.newToReadyAvgSeconds` and `durations.newToDeliveredAvgSeconds` are populated when matching events exist.

### Internal Cierre tab

- [ ] Internal Chekeo V2 shows a new `Cierre` tab.
- [ ] The tab shows “Cierre operativo preview”, “D1 source of truth”, and “Pagos declarados, no pagos reales”.
- [ ] Without internal session, it shows “Activa modo admin para cargar cierre”.
- [ ] Backend errors are visible and Cierre does not fall back to mock data.
- [ ] Filters `Desde`, `Hasta`, and `Incluir terminales` call the summary endpoint with matching query params.
- [ ] Cards show Venta bruta, Venta entregada, Órdenes totales, Entregadas, Canceladas, and Ticket promedio.
- [ ] Sections show Por status, Por método de pago declarado, Pickup vs delivery, Top items, Órdenes recientes, and Tiempos promedio.
- [ ] The layout is usable at 320px width without horizontal page overflow.
- [ ] `Exportar CSV del rango` calls the existing protected CSV export with the same `from`, `to`, and `includeTerminal` filters.

### Data policy / no-touch checks

- [ ] D1 remains source of truth for reporting.
- [ ] Sheets remains manual/export only; there is no automatic Sheets sync.
- [ ] No timezone conversion is performed yet; `YYYY-MM-DD` maps to UTC day boundaries.
- [ ] Confirm no changes to Public V2 (`apps/public-order-v2/**`).
- [ ] Confirm no changes to `/api/order` legacy.
- [ ] Confirm no changes to `/api/rpc` legacy.
- [ ] Confirm no Apps Script or `.gs` changes.
- [ ] Confirm no changes to `cloudflare/public-order`, `cloudflare/internal-chekeo`, `legacy`, migrations, payments, WhatsApp, or `BOG_ACTIVE_ENV`.

## V2-11A Manual WhatsApp order actions QA

### Internal Chekeo V2 UI

- [ ] Abrir Internal V2 preview en mobile width (320px+) y desktop.
- [ ] Iniciar sesión y cargar órdenes live D1.
- [ ] Confirmar que cada tarjeta de Pedido muestra botones compactos “WhatsApp” y “Copiar mensaje”.
- [ ] Abrir el modal de detalle y confirmar el copy “Acción manual: abre WhatsApp con mensaje prellenado.”
- [ ] Confirmar que el modal muestra selector de template con Recibido, En preparación, Listo y Entregado.
- [ ] Confirmar default por status: `new -> Recibido`, `preparing -> En preparación`, `ready -> Listo`, `delivered/cancelled -> Entregado`.
- [ ] Confirmar que no existe template de cancelación.

### WhatsApp manual behavior

- [ ] Con teléfono válido de 10 dígitos, confirmar que “WhatsApp” abre una nueva pestaña con URL `https://wa.me/52...?...` y mensaje prellenado.
- [ ] Con teléfono válido de 12 dígitos que empieza con `52`, confirmar que no duplica el prefijo.
- [ ] Con teléfono inválido, confirmar texto “Teléfono inválido para WhatsApp” y botón “WhatsApp” deshabilitado.
- [ ] Confirmar que abrir WhatsApp no cambia status, no escribe D1 y no inserta eventos.
- [ ] Confirmar que la UI no usa `alert()`.

### Clipboard behavior

- [ ] Presionar “Copiar mensaje” y confirmar estado inline “Mensaje copiado”.
- [ ] Simular navegador/contexto sin clipboard seguro y confirmar error inline claro.
- [ ] Confirmar que el mensaje copiado corresponde al template seleccionado en el modal.

### Privacy/security/no-touch checks

- [ ] Confirmar que no hay envío automático de WhatsApp.
- [ ] Confirmar que no hay WhatsApp Business/API ni proveedor externo.
- [ ] Confirmar que no se guardan mensajes en D1 y no se insertan eventos.
- [ ] Confirmar que no se loguea teléfono ni mensaje.
- [ ] Confirmar que no hay pagos reales.
- [ ] Confirmar que no se tocó backend (`functions/api/**`).
- [ ] Confirmar que no se tocó Public V2 (`apps/public-order-v2/**`).
- [ ] Confirmar que no se tocó `/api/order` legacy ni `/api/rpc` legacy.
- [ ] Confirmar que no se tocó Apps Script, `.gs`, Sheets, legacy, migrations, Cloudflare legacy apps ni `BOG_ACTIVE_ENV`.

## V2-11B Pagos/Notas operativo manual QA

### Endpoint admin payment/notes

- [ ] `PATCH /api/orders-v2-admin/:id/payment` without session cookie returns `401 UNAUTHORIZED`.
- [ ] `PATCH /api/orders-v2-admin/:id/payment` with missing/invalid `paymentStatus` returns `400 INVALID_PAYMENT_STATUS`.
- [ ] `PATCH /api/orders-v2-admin/:id/payment` with `notes` longer than 500 chars is rejected.
- [ ] `PATCH /api/orders-v2-admin/:id/payment` with `reason` longer than 200 chars is rejected.
- [ ] `PATCH /api/orders-v2-admin/:id/payment` for an unknown order id returns `404 ORDER_NOT_FOUND`.
- [ ] Non-`PATCH` methods return `405 METHOD_NOT_ALLOWED`.
- [ ] Valid request updates only `orders_v2.payment_status` and optionally existing `orders_v2.notes`.
- [ ] Valid request inserts one `PAYMENT_UPDATED` event with `actor: internal-v2` and detail fields for previous/next payment status, notes update, reason, and source.
- [ ] Confirm order `status`, totals, and items do not change.

### Internal Pagos UX

- [ ] Sign in with the internal PIN and open `Pagos`.
- [ ] Confirm copy is visible: “Pago operativo manual”, “No se realiza ningún cobro en línea”, and “Payment status declarado por operador”.
- [ ] Press “Recargar órdenes” and confirm orders load from D1.
- [ ] Confirm each order shows folio, customer, total, paymentMethod, paymentStatus, order status, notes, and items summary.
- [ ] Confirm filters work for Todos, Pendientes, Pagados, and Cancelados.
- [ ] Confirm “Marcar pagado”, “Marcar pendiente”, and “Marcar pago cancelado” call `PATCH /api/orders-v2-admin/:id/payment` and disable buttons while updating.
- [ ] Confirm “Guardar nota” updates the existing `notes` field and shows the note replacement warning.
- [ ] Confirm errors render inline and no `alert()` is used.
- [ ] Confirm mobile layout remains usable at 320px width.

### Compatibility and non-goals

- [ ] Cierre reflects the updated `payment_status` because it reads `orders_v2`.
- [ ] CSV export reflects the updated `payment_status` because it reads `orders_v2`.
- [ ] Confirm no real payments, payment gateway, payment provider, terminal integration, WhatsApp API, automatic Sheets sync, Apps Script, migrations, legacy app changes, Public V2 changes, `/api/order`, `/api/rpc`, cloudflare legacy app changes, or `BOG_ACTIVE_ENV` changes were introduced.

## V2-11C Cancelación manual con razón QA

### Internal cancel UX

- [ ] Iniciar sesión y abrir Internal Chekeo V2 en mobile width (320px+) y desktop.
- [ ] En Pedidos, presionar “Cancelar” y confirmar que no cancela directo: abre modal con folio y cliente.
- [ ] En el modal de detalle, presionar “Cancelar” y confirmar que abre el mismo flujo de razón.
- [ ] Confirmar presets: Cliente canceló, Sin stock, Pago no confirmado, Pedido duplicado, Error de captura y Otro.
- [ ] Confirmar que la razón es editable.
- [ ] Confirmar validación requerida, mínimo 3 caracteres y máximo 200 caracteres.
- [ ] Elegir “Otro” y confirmar que exige texto manual útil.
- [ ] Confirmar que la UI no usa `alert()` y muestra errores inline.
- [ ] Confirmar que al enviar muestra “Cancelando…” y deshabilita botones.
- [ ] Sin sesión interna, confirmar error claro: “Activa modo admin para cancelar órdenes live”.

### Audit behavior

- [ ] Confirmar que el submit llama `updateOrderV2Status(order.id, "cancelled", reason)` y por tanto `PATCH /api/orders-v2-admin/:id/status` con `reason`.
- [ ] Confirmar que una cancelación live exitosa cierra el modal y actualiza la orden desde D1.
- [ ] Confirmar que el timeline/detalle muestra `Razón: <razón>`.
- [ ] Confirmar que el evento `STATUS_CHANGED` conserva `previousStatus` y `nextStatus`.
- [ ] Confirmar que fallback mock simula la cancelación solo en UI y muestra “Cancelación actualizada en fallback mock”.

### Historial / Cierre / CSV

- [ ] Confirmar que órdenes `cancelled` ya no aparecen en Pedidos/Cocina.
- [ ] Confirmar que órdenes `cancelled` aparecen en Historial.
- [ ] Confirmar que Historial muestra “Cancelado por operador” y `Razón: <razón>` cuando existe en timeline.
- [ ] Confirmar que Historial no muestra teléfono.
- [ ] Confirmar que Cierre cuenta canceladas porque lee `status=cancelled` desde D1.
- [ ] Confirmar que CSV exporta órdenes canceladas/status `cancelled` con los filtros existentes.

### No-touch checks

- [ ] Confirmar que no se agregó endpoint nuevo y no se tocó backend.
- [ ] Confirmar que no se tocó Public V2 (`apps/public-order-v2/**`).
- [ ] Confirmar que no se tocó `/api/order` legacy ni `/api/rpc` legacy.
- [ ] Confirmar que no se tocó Apps Script, `.gs`, Sheets, sync automático, legacy, migrations, Cloudflare legacy apps ni `BOG_ACTIVE_ENV`.
- [ ] Confirmar que no se agregaron pagos reales ni WhatsApp API/envío automático.

## V2-12 Hardening pre-producción QA

### Smoke operativo V2

- [ ] Public V2 crea una orden real en D1 con folio visible.
- [ ] Internal V2 ve la orden creada desde Public V2 al iniciar sesión interna y recargar.
- [ ] Pedido avanza `new → preparing → ready → delivered` sin errores visuales.
- [ ] Cancelar exige razón obligatoria antes de enviar.
- [ ] Pagos permite marcar `paid`/`pending` como estado declarado por operador.
- [ ] WhatsApp abre link manual con mensaje prellenado y no envía automático.
- [ ] Cierre carga datos desde D1 y muestra pagos declarados.
- [ ] CSV exporta desde D1 con los filtros existentes.
- [ ] Sin sesión interna muestra errores claros y recuperables.
- [ ] Un error de UI en Internal V2 no deja pantalla blanca; muestra “Algo falló en Internal V2” y botón “Recargar”.

### Hardening y no-touch

- [ ] Confirmar que no hay `alert()` en Internal/Public V2.
- [ ] Confirmar que botones críticos quedan deshabilitados mientras hay loading/submitting/updating.
- [ ] Confirmar que no se imprimen secretos en consola y no viajan en query params.
- [ ] Confirmar que logout limpia la cookie de sesión y vuelve al login.
- [ ] Confirmar que Public V2 mantiene error inline recuperable después de error de red/backend.
- [ ] Confirmar que Public V2 limpia idempotency key después de success y no deja pegado el draft anterior.
- [ ] Confirmar que Public V2 no envía precios ni total; el backend confirma total desde D1.
- [ ] Confirmar copy visible: “No se realiza ningún cobro en línea”, WhatsApp como acción manual y Cierre con pagos declarados.
- [ ] Confirmar que no cambió API/schema.
- [ ] Confirmar que no se tocó `/api/order`, `/api/rpc`, Apps Script, Sheets sync, legacy, migrations, Cloudflare legacy apps, pagos reales, WhatsApp API ni `BOG_ACTIVE_ENV`.

## V2-13 cutover readiness

- [ ] Review the [Burgers.exe V2 cutover readiness runbook](./burgers-v2-cutover-runbook.md) before any pilot/pre-production traffic movement.
- [ ] Confirm smoke API, manual UI QA, cutover option, rollback owner, data reconciliation owner, and go/no-go checklist are complete.
- [ ] Confirm this readiness step does not change runtime, API, schema, apps, functions, migrations, legacy, Apps Script, Sheets, payments, WhatsApp API, Cloudflare legacy apps, or `BOG_ACTIVE_ENV`.

## Fase 1 QA — Public official order flow

- [ ] Public V2 abre con loading inicial brandeado Burgers.exe y no reutiliza el logo como loader repetitivo.
- [ ] La primera ventana visible después de carga es Menú.
- [ ] Menú muestra Combos, Hamburguesas, Guarniciones y Bebidas; extras no aparecen como sección de productos principales.
- [ ] Seleccionar burger abre el drawer/modal accesible de Ordenar sobre el Menú.
- [ ] Seleccionar `2 hamburguesas` o `3 hamburguesas` genera unidades separadas con `lineKey` distinto sin usar copy de tamaño/carne.
- [ ] Cada unidad permite quitar ingredientes reales derivados del producto, mantiene pan no editable, extras por burger, guarnición según regla y nota opcional.
- [ ] Extra en Burger #1 no modifica Burger #2; nota o ingrediente removido en Burger #3 no modifica las demás.
- [ ] Si no hay extras reales disponibles, se muestra “Sin extras configurados” sin inventar extras.
- [ ] Combo obliga guarnición y muestra error inline si se intenta confirmar sin guarnición.
- [ ] Guarniciones sueltas se agregan desde sección Guarniciones del Menú.
- [ ] Ticket muestra cada unidad personalizada por separado y permite editar, duplicar y eliminar.
- [ ] Duplicar crea una unidad independiente editable.
- [ ] Checkout queda en ventana separada con pasos Ticket, Datos, Ubicación/Pago y Confirmar.
- [ ] No se puede confirmar sin ticket, nombre/teléfono, ubicación y método de pago.
- [ ] Ubicación visible solo ofrece Torre GGA y Torre Valcob; no se muestra pickup/delivery al cliente.
- [ ] Nota general del pedido permanece separada de la nota por burger.
- [ ] Payload nuevo guarda `lineKey`, `itemDisplayIndex`, `itemKind`, `removedIngredients`, `extras`, `burgerNote` y `garnish` en snapshot JSON; `garnish` aplica para combos y las guarniciones sueltas viajan como línea propia.
- [ ] Payload legado `{ sku, qty }` sigue creando orden.
- [ ] Backend recalcula precios base desde D1 y no confía en precios finales del frontend.
- [ ] Confirmar no productos/extras/guarniciones/ubicaciones inventadas.
- [ ] Confirmar no cambios a Internal V2 salvo tipos compartidos, legacy, `/api/order`, `/api/rpc`, Apps Script, Sheets sync, pagos reales, WhatsApp API ni `BOG_ACTIVE_ENV`.

## V2-14 QA — Public gamer order UX refinement

### Visual / flujo público

- [ ] Public V2 se siente dark premium profesional con acento gamer/neón sutil, sin exceso de estética terminal.
- [ ] La primera experiencia después del loading es Menú.
- [ ] El flujo visible es Menú → Ordenar → Checkout.
- [ ] No aparecen tres ventanas visibles tipo Menú / Ordenar / Checkout.
- [ ] Ordenar aparece como drawer/modal accesible sobre el Menú al seleccionar burger o combo.
- [ ] Checkout permanece como sección separada.
- [ ] Menú muestra cards limpias por categorías y CTA “Ordenar”/“Agregar”.
- [ ] Extras no aparecen como sección principal del menú.

### Ordenar / customizaciones

- [ ] Al seleccionar una burger o combo, se puede elegir cantidad `1 hamburguesa`/`2 hamburguesas`/`3 hamburguesas` con estados visuales distintos.
- [ ] `2 hamburguesas`/`3 hamburguesas` crean unidades separadas e independientes.
- [ ] Cada unidad permite quitar ingredientes, agregar extras por burger y nota por burger opcional.
- [ ] Extra/ingrediente/nota en una unidad no modifica las demás unidades.
- [ ] Combo obliga elegir guarnición antes de confirmar al ticket.
- [ ] Burger normal no muestra selector interno de guarnición dentro del panel y dirige a agregar guarniciones como producto aparte.
- [ ] Las guarniciones para combos provienen solo del catálogo real; no se inventan productos.
- [ ] Confirmar al ticket preserva `removedIngredients`, `extras` y `burgerNote` por burger; `garnish` solo se guarda dentro de combos.
- [ ] Ticket permite editar, duplicar y eliminar cada unidad.

### Checkout / no-touch

- [ ] Checkout mantiene Ticket, Datos cliente, Ubicación, Pago y Confirmar.
- [ ] Ubicación solo ofrece Torre GGA y Torre Valcob.
- [ ] No se muestra pickup/delivery al usuario.
- [ ] Nota general opcional permanece separada de la nota por burger.
- [ ] No se tocó Internal V2, legacy, `/api/order`, `/api/rpc`, Apps Script, Sheets sync, pagos reales, WhatsApp API ni `BOG_ACTIVE_ENV`.

## Public Order V2 navigation UX QA after PR #180

### Menu → order drawer

- [ ] Open Public Order V2 preview/local and confirm the builder is not embedded inline in the menu.
- [ ] Press “Ordenar” on Burger OG and confirm a modal/drawer/bottom sheet opens with `role="dialog"` semantics, visible product name, and a visible “Cerrar” control.
- [ ] Confirm the drawer/bottom sheet respects reduced motion settings and does not create horizontal overflow at 390px width.
- [ ] Confirm Escape closes the drawer on desktop/keyboard testing and returns to the menu without losing the current ticket.
- [ ] Confirm the sticky footer remains accessible while scrolling long customization content and includes “Confirmar al ticket”.

### Claridad de cantidad por unidad

- [ ] Select `1 hamburguesa` and confirm the green state is used plus copy “Vas a pedir 1 hamburguesa editable.”
- [ ] Select `2 hamburguesas` and confirm the yellow state is used plus copy like “Vas a pedir 2 hamburguesas. Cada una se puede editar por separado.”
- [ ] Select `3 hamburguesas` and confirm the orange/red state is used plus copy like “Vas a pedir 3 hamburguesas. Cada una se puede editar por separado.”
- [ ] Confirm quantity help says “No cambia el tamaño ni la carne; solo la cantidad.”
- [ ] Confirm each unit editor is labeled `Burger OG #1`, `Burger OG #2`, `Burger OG #3` as applicable.
- [ ] Edit Burger OG #1 differently from Burger OG #2 and confirm extras/removals/notes do not bleed between units.
- [ ] Confirm the ticket shows the units as separate lines with unit price copy.
- [ ] Select extras and confirm the drawer total still matches ticket/checkout catalog pricing, with copy explaining extras are saved for cocina and total confirmado comes from catálogo.

### Guarniciones

- [ ] For a normal burger, confirm the editor does not show an internal garnish block or redundant garnish microcopy.
- [ ] In the guided flow, confirm the guarniciones step remains separate after editing a normal burger.
- [ ] Add a guarnición from the menu with “Agregar” and confirm it becomes a separate ticket line with its own SKU/price and `itemKind="garnish"`.
- [ ] Confirm a normal burger never saves a free internal garnish.
- [ ] For combos, confirm “Guarnición obligatoria” remains inside the combo builder.
- [ ] Try confirming a combo without garnish and confirm inline validation blocks submission.
- [ ] Confirm “Regresar” remains visible while scrolling in type, product, edit, and guarniciones steps, respects mobile safe-area spacing, and does not cover the bottom CTA.

### Persistent ticket and action hierarchy

- [ ] Confirm burger/combo cards use “Ordenar” with the primary neon style.
- [ ] Confirm guarniciones/bebidas/otros use “Agregar” with the distinct amber/outline style.
- [ ] Add at least one product and confirm the floating ticket/cart shows item count, total, and a Checkout CTA.
- [ ] Confirm the floating ticket respects mobile safe-area spacing and does not hide focusable fields or create horizontal overflow.
- [ ] Confirm checkout can be reached from the floating cart.

### Compact checkout

- [ ] Confirm checkout still has four steps: 1 Ticket, 2 Datos, 3 Ubicación y pago, 4 Confirmar.
- [ ] Confirm fields keep persistent labels and inline validation appears near the confirm action.
- [ ] Fill name and phone, choose Torre GGA, choose payment, and confirm the total remains near “Confirmar pedido”.
- [ ] Confirm only Torre GGA and Torre Valcob are visible as location options.
- [ ] Confirm pickup/delivery options are not shown to the user.
- [ ] Confirm optional general note remains available.

### No-touch verification

- [ ] Confirm no backend, Functions API, `/api/order`, `/api/rpc`, Apps Script, Sheets sync, real payments, WhatsApp API, Internal V2, legacy, `packages/config`, or `BOG_ACTIVE_ENV` changes were made for this UX update.

## V2-10 Public Order kiosko McDonald's-style QA

### Menú visual

- [ ] Abrir Public Order V2 y confirmar que la pantalla inicial es un menú visual limpio, no un constructor técnico.
- [ ] Confirmar categorías visibles: Hamburguesas, Combos, Guarniciones y Bebidas.
- [ ] Tocar una card del menú y confirmar que solo abre modal informativo con nombre, imagen si existe, descripción, precio y disponibilidad.
- [ ] Confirmar que tocar una card no inicia builder y no agrega productos al ticket.
- [ ] Cerrar el modal con “Cerrar”.
- [ ] Confirmar que el modal usa `role="dialog"`, `aria-modal`, foco razonable y Escape para cerrar.

### Flujo guiado Ordenar

- [ ] Confirmar que el CTA grande “Ordenar” está siempre visible en menú y respeta safe-area móvil.
- [ ] Presionar “Ordenar”.
- [ ] Confirmar pregunta inicial “¿Qué quieres ordenar?” con Hamburguesa si hay burgers reales disponibles y Combo solo si hay combos reales disponibles en `menuData.items`.
- [ ] Elegir Hamburguesa y continuar a productos disponibles.
- [ ] Elegir Burger OG.
- [ ] Elegir `2 hamburguesas` y confirmar copy “Vas a pedir 2 hamburguesas. Cada una se puede editar por separado.”
- [ ] Confirmar que los botones de cantidad dicen `1 hamburguesa`, `2 hamburguesas` y `3 hamburguesas`, sin términos que parezcan receta, tamaño o cantidad de carne.
- [ ] Editar Burger #1 distinto a Burger #2: quitar ingredientes, elegir extras por burger y agregar nota opcional.
- [ ] Confirmar que pan sigue no editable.
- [ ] Continuar a guarniciones.

### Guarniciones y combos

- [ ] En guarniciones, confirmar botón claro “No quiero guarnición · Saltar guarniciones”.
- [ ] Saltar guarniciones e ir a checkout.
- [ ] Volver al menú/flujo y agregar una guarnición extra; confirmar que aparece como línea separada `itemKind="garnish"` con precio propio.
- [ ] Probar Combo solo si existe como `menu_item` real disponible; una promo/concurso visible no habilita esta ruta.
- [ ] Confirmar que cada combo exige guarnición incluida antes de continuar y muestra error inline si falta.
- [ ] Confirmar que la guarnición incluida del combo se guarda como `garnish` dentro del combo.
- [ ] Confirmar que cualquier guarnición extra adicional se agrega como línea separada con precio propio.
- [ ] Confirmar que solo se muestran guarniciones reales del catálogo y no se inventan opciones.

### Checkout, ticket y no-touch

- [ ] Confirmar ticket con editar, duplicar, eliminar, unidades separadas y precio unitario.
- [ ] Confirmar combos con guarnición incluida visible.
- [ ] Confirmar checkout con ticket, datos, ubicación Torre GGA/Torre Valcob, pago y “Confirmar pedido”.
- [ ] Confirmar que checkout no muestra pickup/delivery al usuario.
- [ ] Confirmar que no se tocó backend: sin cambios en `functions/api/**`, `/api/order`, `/api/rpc`, Apps Script, Sheets sync, pagos reales, WhatsApp API, `BOG_ACTIVE_ENV`, Internal V2 ni legacy.

## Pendiente futuro de copy

- [ ] Fase futura: reducir microcopy/texto innecesario una vez validado el flujo operativo.

## V2 Public quest kiosk QA (2026-06-01)

- [ ] Abrir Public V2 y confirmar boot: `INITIALIZING BURGERS.EXE...`, `LOADING MENU_ASSETS...`, `MOUNTING WORKBENCH...`, `SYNCING QUEST_FLOW...`, `SYSTEM READY.`
- [ ] Confirmar que inicia en `Menu`, sin tabs Menú/Checkout, sin estilo visual Cloudflare y sin checkout vacío.
- [ ] Confirmar que el header solo muestra `Burgers.exe` y `Ticket: X items · $total`.
- [ ] Confirmar que banners de promos/concursos aparecen en primera pantalla solo si `/api/menu-v2.promos` tiene registros reales disponibles.
- [ ] Confirmar categorías visibles: Hamburguesas, Combos, Guarniciones y Bebidas; el menú no muestra extras.
- [ ] Tocar una card del menú y validar modal informativo accesible; no debe agregar producto ni iniciar builder.
- [ ] Presionar `INICIAR QUEST`, elegir `Hamburguesa`, seleccionar producto real y avanzar a `Workbench`.
- [ ] Validar cantidad `[-] x1 [+]`, mínimo x1, máximo x3, y que x2/x3 crea unidades separadas editables.
- [ ] Probar `MOD · Sin cebolla` u otro ingrediente inferido; confirmar que pan no es editable.
- [ ] Probar `UPGRADE` con extra real; confirmar que aparece solo en Workbench y el total coincide con el backend confirmado.
- [ ] Probar combo: debe permitir MOD/UPGRADE y bloquear continuar hasta elegir guarnición incluida.
- [ ] Pasar a `Side Quest`; saltar o agregar guarnición extra y confirmar que entra como línea separada `itemKind="garnish"`.
- [ ] Confirmar que `Checkout` solo aparece con ticket, muestra loadout, MOD, UPGRADE, nota por burger, combo con guarnición incluida, ubicación Torre GGA/Torre Valcob, pago, total y CTA `EJECUTAR PEDIDO`.
- [ ] Confirmar pedido y validar `Success` separado con `Pedido recibido`, folio `BX-...`, estado `Nuevo`, total confirmado, ubicación y pago; no debe aparecer CTA persistente con `0 items · $0`.
- [ ] Presionar `NUEVA QUEST`; debe limpiar confirmación, cart, customer, idempotency y volver a `Menu` con scroll arriba.
- [ ] Confirmar no llamadas ni cambios a `/api/order`, `/api/rpc`, Apps Script, Sheets sync, `BOG_ACTIVE_ENV`, WhatsApp ni pasarelas externas.
- [ ] Confirmar que `Combo` en `Main Quest` solo aparece si existe al menos un combo real disponible en `menuData.items`; si solo hay promo/concurso en `promoCards`, no debe mostrarse como opción ordenable.
- [ ] Confirmar que una promo/concurso visible en `Menu` permanece como banner informativo y no inventa SKUs ni combos ordenables.

## Fase 2 Internal Cocina y Side Quest QA (2026-06-01)

### Creación de orden real desde Public V2

- [ ] Crear orden desde Public con Burger OG, MOD `Sin cebolla`, UPGRADE `Extra Bacon`, nota por burger y Side Quest `Fries OG`.
- [ ] Confirmar que la orden queda en D1 con `snapshot_json` por item y `lineKey` único por unidad.

### Vista Cocina Internal V2

- [ ] Abrir Internal V2 / Cocina con sesión interna real.
- [ ] Confirmar que la vista no muestra teléfono, payment status, WhatsApp, source, export CSV ni acciones de pago.
- [ ] Confirmar que cada orden muestra folio grande, cliente grande y ubicación extraída de `notes` (`Ubicación: Torre GGA` o `Ubicación: Torre Valcob`).
- [ ] Confirmar que cada burger/combo aparece como unidad separada y muestra MOD desde `removedIngredients`, UPGRADE desde `extras`, nota por burger desde `burgerNote` y nota general si existe.
- [ ] Confirmar que si no hay modificaciones se muestra `Sin MOD` y `Sin UPGRADE` como texto pequeño.
- [ ] Confirmar que un combo muestra `Guarnición incluida: ...` dentro del combo y que esa guarnición incluida no aparece en Side Quest pendiente.

### Acordeones y checklist independiente

- [ ] Crear o ubicar orden con más de una burger/combo y confirmar que la primera burger pendiente abre por default.
- [ ] Marcar una burger hecha y confirmar que queda verde, se repliega y abre automáticamente la siguiente pendiente.
- [ ] Confirmar que cuando no quedan burgers pendientes se muestra `Burgers listas`.
- [ ] Confirmar que Side Quest sigue pendiente después de marcar burger hecha.
- [ ] Entrar a Side Quest, marcar la guarnición hecha y confirmar que no cambia el estado de la burger.
- [ ] Recargar órdenes y confirmar que los estados hechos se restauran desde eventos D1 `KITCHEN_ITEM_DONE` / `KITCHEN_ITEM_REOPENED`.
- [ ] Reabrir una burger o guarnición y confirmar que se inserta evento `KITCHEN_ITEM_REOPENED` y el item vuelve a pendiente.
- [ ] Marcar la orden como lista con la acción manual existente y confirmar que no hubo auto-ready al completar el checklist.

### Fallback y no-touch

- [ ] Sin sesión interna o con error D1, confirmar que Cocina muestra fallback visual y el aviso `Fallback visual: estados de cocina no se guardan en D1.` sin usar `alert()`.
- [ ] Confirmar que no se crearon migraciones ni tablas nuevas.
- [ ] Confirmar que no se tocaron legacy, `/api/order`, `/api/rpc`, Apps Script, Sheets sync, `BOG_ACTIVE_ENV`, pagos reales, WhatsApp API ni Public V2.

## QA Fase 3 — Internal PIN session sin credenciales visibles

- [ ] Abrir Internal V2 sin cookie de sesión y confirmar login con wordmark Burgers.exe, título Chekeo, campo PIN / contraseña y botón Entrar.
- [ ] Escribir PIN incorrecto y confirmar error inline sin `alert()`.
- [ ] Escribir PIN correcto y presionar Enter; confirmar entrada a la consola.
- [ ] Confirmar que no aparece copy visible de credenciales ni acciones de modo admin por credencial.
- [ ] Confirmar que SourcePanel muestra “Sesión admin activa”, “Órdenes live desde D1” y botón Recargar órdenes.
- [ ] Confirmar que Pedidos carga órdenes live D1 con sesión cookie.
- [ ] Confirmar que Cocina permite marcar burger/Side Quest con sesión cookie.
- [ ] Confirmar que Pagos y Cierre cargan con sesión cookie.
- [ ] Recargar la página y confirmar que mantiene sesión mientras `bog_internal_session` siga vigente.
- [ ] Logout y confirmar regreso al login.
- [ ] Confirmar que el frontend no guarda credenciales internas en storage del navegador.
- [ ] Confirmar que endpoints admin sin cookie válida responden `401 UNAUTHORIZED` y no aceptan credenciales por header.
- [ ] Confirmar que no se tocaron legacy, `/api/order`, `/api/rpc`, Apps Script, Sheets sync ni `BOG_ACTIVE_ENV`.

## QA Preview — Fase 4A Sorteos

1. Aplicar `migrations/0004_v2_raffles_schema.sql` en D1 preview.
2. Redeploy Public V2 e Internal/Chekeo V2.
3. Entrar a Chekeo con PIN; confirmar que `BOG_INTERNAL_PIN` + cookie HttpOnly `bog_internal_session` siguen siendo el único flujo admin.
4. Abrir la tab **Sorteos**.
5. Crear sorteo mensual sin inventar premios/datos no operativos.
6. Activarlo y confirmar que cualquier otra campaña queda inactiva.
7. Confirmar que `GET /api/raffles-v2/active` devuelve solo la campaña activa.
8. Confirmar que el banner/reglas aparecen en el Menu público si hay campaña activa.
9. Confirmar que Public no muestra sección si no hay campaña activa y no bloquea pedidos si falla el endpoint de sorteo.
10. Crear orden con 1 burger y confirmar summary = 1 ticket.
11. Crear orden con 2 burgers o líneas `qty > 1` y confirmar que suma por unidad.
12. Crear orden con combo y confirmar que suma 1 ticket por unidad.
13. Crear orden con guarnición/bebida solamente y confirmar que no suma.
14. Cancelar orden y confirmar que no cuenta.
15. Confirmar que órdenes `delivered` sí cuentan.
16. Confirmar top usuarios por tickets.
17. Buscar participante por nombre.
18. Buscar participante por teléfono normalizado o últimos 4 dígitos.
19. Confirmar estado vacío: “Sin participantes encontrados”.
20. Confirmar que UI/API solo muestran `customerPhoneMasked`, nunca teléfono completo.
21. Confirmar que `referralTickets` es 0 en Fase 4A y que referidos quedan para Fase 4B.
22. Confirmar que imagen brandeada/WhatsApp quedan para Fase 4C.
23. Confirmar que no aparece ningún token, bearer auth headers, WhatsApp API, pagos reales nuevos ni Sheets sync.

## QA Fase 4B — Referidos para sorteos

1. Aplicar `migrations/0005_v2_raffles_referrals_schema.sql` en D1 preview/producción según ambiente.
2. Redeploy Public V2 e Internal/Chekeo V2.
3. Entrar a Chekeo con PIN y confirmar cookie HttpOnly `bog_internal_session`.
4. En Chekeo > Sorteos, crear código para participante A con palabra burger permitida y número 1–100.
5. Copiar el código generado y confirmar que la UI solo muestra teléfonos enmascarados.
6. Crear orden en Public para participante B usando ese código en “Código de invitado”.
7. Confirmar que el pedido se crea normalmente y Success muestra “Código de invitado aplicado.”
8. En Summary, confirmar que A recibe 2 referral tickets y B recibe sus tickets por burger/combo.
9. Buscar A por nombre y por últimos 4 dígitos.
10. Ver el pedido referido en la lista de “Pedidos referidos”.
11. Invalidar referido con razón inline; confirmar que los 2 tickets de A se restan.
12. Marcar válido de nuevo; confirmar que los tickets vuelven.
13. Probar self-referral: usar un código con el mismo teléfono del dueño y confirmar que no suma referido ni bloquea pedido.
14. Probar código inválido: confirmar que el pedido no se bloquea y Success muestra “Pedido recibido. El código de invitado no aplicó.”
15. Confirmar que Public nunca muestra dueño del código ni teléfonos.
16. Confirmar que no se introducen Authorization Bearer, tokens admin, WhatsApp API, pagos reales ni imagen brandeada; eso último queda para Fase 4C.

## QA Fase 4C — Imagen brandeada para WhatsApp manual

1. Entrar a Chekeo con PIN y confirmar que la sesión sigue usando cookie HttpOnly `bog_internal_session`.
2. Ir a **Sorteos**.
3. Buscar un participante con tickets o usar **Top usuarios por tickets**.
4. Presionar **Imagen**.
5. Confirmar que abre el modal **Imagen para WhatsApp** y muestra estado “Generando imagen…” mientras crea el PNG.
6. Confirmar preview visual con nombre, total tickets, burger tickets, referral tickets, teléfono enmascarado, campaña, código solo si hay match seguro por nombre normalizado + teléfono enmascarado, o fallback de código, fecha de generación y aviso de validación final.
7. Descargar PNG y abrirlo localmente para validar legibilidad en formato vertical móvil.
8. Copiar texto y confirmar que contiene nombre, total tickets, burger tickets, referidos, código y aviso “Tickets sujetos a validación final.”
9. Abrir WhatsApp y confirmar que `wa.me` lleva texto encoded; no intenta adjuntar imagen automáticamente ni enviar el mensaje.
10. Si Web Share API soporta archivos, usar **Compartir imagen** y confirmar que abre el selector nativo con el PNG.
11. Si Web Share API no soporta archivos, confirmar que la acción se oculta y aparece fallback claro para descargar y compartir manualmente.
12. Confirmar que no aparece teléfono completo en UI, canvas, texto o mensajes de error.
13. Confirmar que no aparece token, Authorization Bearer, WhatsApp API, R2 upload, D1 image table, `localStorage` ni `sessionStorage` para la imagen.
14. Confirmar que la imagen no bloquea operación si no hay código de invitado con match seguro y único por nombre normalizado + teléfono enmascarado: debe mostrar “solicita tu código en Burgers.exe”.
15. Confirmar con datos ambiguos que coincidir solo por `ownerPhoneMasked === customerPhoneMasked` nunca muestra código de invitado.

## QA Fase 4D — Success público con tickets y código propio

1. Tener una campaña de sorteo activa.
2. Crear pedido público con 1 burger sin usar código de invitado.
3. Confirmar que Success muestra “Tickets ganados por esta orden” y `+1 tickets` cuando `ticket_per_burger=1`.
4. Confirmar que Success muestra “Tu código para invitar”.
5. Presionar “Copiar código” y confirmar “Código copiado.”; si Clipboard falla, confirmar fallback inline sin `alert()`.
6. Crear pedido público con 2 burgers o combos y confirmar que Success muestra los tickets de burger/combo correspondientes a `ticket_per_burger * qty`.
7. Crear otro pedido con el mismo teléfono y confirmar que reutiliza el mismo `customerReferralCode`.
8. Crear pedido con otro teléfono usando ese código en Checkout.
9. Confirmar que Success del comprador muestra sus burger tickets y no promete +2 tickets al comprador por usar código.
10. Confirmar que Success dice “Código aplicado. Los tickets de referido se asignan a quien te invitó.” cuando el código de invitado aplicó y `referralUsedTickets` es 0.
11. Confirmar en Chekeo que el dueño del código recibe los referral tickets (`ticket_per_referral`, normalmente +2).
12. Desactivar campaña, crear pedido y confirmar que Success no muestra `earnedTickets` ni `customerReferralCode`.
13. Confirmar que guarniciones, bebidas y otros no suman tickets.
14. Confirmar que el pedido no se bloquea si falla generación de `customerReferralCode` o cálculo de `earnedTickets`.
15. Confirmar que no aparece teléfono completo, dueño del código usado, WhatsApp API, envío automático, tokens, `Authorization Bearer`, `BOG_ORDERS_ADMIN_TOKEN` ni `BOG_MENU_ADMIN_TOKEN`.
16. Confirmar que no se llama `/api/order` ni `/api/rpc` y que no se tocaron legacy, Apps Script, Sheets sync, pagos reales, auth PIN-only flow ni migraciones.
