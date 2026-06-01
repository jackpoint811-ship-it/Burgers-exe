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

- [ ] PIN mock permite entrar al shell.
- [ ] Tabs principales cambian correctamente.
- [ ] Dashboard mock renderiza KPIs/estado esperado.
- [ ] Vista de pedidos carga y permite interacción mock.
- [ ] Vista de cocina muestra estado esperado.
- [ ] Mover estado de pedido funciona en mock.
- [ ] Modal de detalle abre/cierra sin errores.
- [ ] Pagos/notas mock editables según flujo definido.
- [ ] Historial mock visible y consistente.
- [ ] Logout mock regresa al estado inicial.
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
- Entrar con PIN mock.
- Ir a tab **Catálogo**.
- Confirmar carga de catálogo live (`source=d1`).
- Ingresar token admin preview y activar edición.
- Editar descripción/precio/disponibilidad de un item.
- Guardar y confirmar feedback "Producto actualizado".
- Confirmar que `GET /api/menu-v2` refleja cambios.
- Confirmar que public preview refleja cambios de catálogo.
- Confirmar que sin token no permite editar.
- Confirmar que con token incorrecto muestra error Unauthorized.

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
- [ ] Activar modo admin con `BOG_MENU_ADMIN_TOKEN`; confirmar que el token se guarda solo en `sessionStorage`.
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
- [ ] Confirmar que sin token admin no sube ni quita imágenes.
- [ ] Confirmar que no existe upload en `public-order-v2` y que no se llama `/api/order` ni `/api/rpc`.

## V2-8.3 QA — Promos admin + imágenes R2

- Entrar a Internal Chekeo V2 preview.
- Abrir tab Catálogo.
- Activar token admin preview.
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
- Confirmar que sin token admin no edita, no sube y no quita imágenes.
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

- [ ] Probar listado con token:

```bash
curl -i "$INTERNAL_V2_URL/api/orders-v2-admin?includeTerminal=true&limit=10" \
  -H "Authorization: Bearer $BOG_ORDERS_ADMIN_TOKEN"
```

- [ ] Confirmar que responde órdenes con items y eventos.
- [ ] Confirmar que sin token responde 401 o 503 si no hay token configurado.

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

- [ ] Confirmar la orden creada en `GET /api/orders-v2-admin?includeTerminal=true&limit=10` con token admin.
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
- [ ] Confirmar que Public V2 no usa ni expone `BOG_ORDERS_ADMIN_TOKEN` o `BOG_MENU_ADMIN_TOKEN`.
- [ ] Confirmar que Public V2 no toca R2 upload y solo lee assets vía `/api/assets-v2/<key>` cuando aplica.
- [ ] Confirmar que Internal Chekeo V2 todavía no consume live orders en esta fase.
- [ ] Confirmar que Apps Script, Sheets, legacy, `cloudflare/public-order`, `cloudflare/internal-chekeo` y `BOG_ACTIVE_ENV` no fueron modificados.

## V2-9C Internal V2 → órdenes live D1

### Flujo Internal live

- [ ] Abrir Internal V2 preview.
- [ ] Activar token admin con `BOG_ORDERS_ADMIN_TOKEN` o fallback `BOG_MENU_ADMIN_TOKEN`.
- [ ] Confirmar que el token se guarda solo en `sessionStorage` y no en `localStorage`.
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

- [ ] Confirmar error visible sin token: “Activa modo admin para cargar órdenes live”.
- [ ] Simular backend caído/token inválido y confirmar error claro más “Fallback mock”.
- [ ] Confirmar que `mockOrders` sigue disponible para QA visual cuando no hay live.
- [ ] Confirmar success message breve al cambiar estado.

### Seguridad / no-touch

- [ ] Confirmar que Internal V2 llama solo `GET /api/orders-v2-admin`, `PATCH /api/orders-v2-admin/:id/status`, `GET /api/menu-v2` y endpoints admin existentes de catálogo.
- [ ] Confirmar no llamadas nuevas a `/api/order` ni `/api/rpc`.
- [ ] Confirmar que Public V2 no usa tokens ni endpoints admin.
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

### Timeline and token sharing

- [ ] Timeline muestra `ORDER_CREATED` como “Pedido creado”.
- [ ] Timeline muestra `STATUS_CHANGED` como “Estado: <label>”.
- [ ] Timeline muestra `ORDER_CANCELLED` como “Pedido cancelado”.
- [ ] Timeline conserva actor, fecha, previousStatus/nextStatus y `detail.reason` si existe.
- [ ] Token activado en Pedidos sirve en Catálogo.
- [ ] Cerrar token en Catálogo afecta Pedidos.
- [ ] Cerrar token en Pedidos afecta Catálogo.

### No-touch checks

- [ ] No llamadas a `/api/order` ni `/api/rpc` desde Public V2 o Internal V2.
- [ ] No se modifican `/api/order`, `/api/rpc`, `functions/api`, migrations, Apps Script, Sheets, legacy, `cloudflare/public-order`, `cloudflare/internal-chekeo`, pagos, WhatsApp ni `BOG_ACTIVE_ENV`.

## V2-10A.1 Orders V2 CSV export QA

### Endpoint/auth

- [ ] `GET /api/orders-v2-admin/export.csv` without token responds `401 UNAUTHORIZED` JSON envelope.
- [ ] `GET /api/orders-v2-admin/export.csv` with valid admin token responds `text/csv; charset=utf-8`.
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
- [ ] Sin token admin, el botón queda deshabilitado y se muestra “Activa modo admin para exportar CSV”.
- [ ] Activar token admin desde el flujo compartido habilita exportación.
- [ ] Export default descarga un archivo `.csv` desde `GET /api/orders-v2-admin/export.csv`.
- [ ] La descarga usa `download="orders-v2-export.csv"` cuando el navegador lo permite.
- [ ] Errores JSON del backend se muestran en la UI sin imprimir el token.

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

- [ ] `GET /api/orders-v2-admin/summary` without token returns `401 UNAUTHORIZED` or `503 ADMIN_DISABLED` when admin is not configured.
- [ ] `GET /api/orders-v2-admin/summary` with valid admin token returns `ok: true` and `source: "d1"`.
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
- [ ] Without admin token, it shows “Activa modo admin para cargar cierre”.
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
- [ ] Activar token admin y cargar órdenes live D1.
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

- [ ] `PATCH /api/orders-v2-admin/:id/payment` without token returns `401 UNAUTHORIZED`.
- [ ] `PATCH /api/orders-v2-admin/:id/payment` with missing/invalid `paymentStatus` returns `400 INVALID_PAYMENT_STATUS`.
- [ ] `PATCH /api/orders-v2-admin/:id/payment` with `notes` longer than 500 chars is rejected.
- [ ] `PATCH /api/orders-v2-admin/:id/payment` with `reason` longer than 200 chars is rejected.
- [ ] `PATCH /api/orders-v2-admin/:id/payment` for an unknown order id returns `404 ORDER_NOT_FOUND`.
- [ ] Non-`PATCH` methods return `405 METHOD_NOT_ALLOWED`.
- [ ] Valid request updates only `orders_v2.payment_status` and optionally existing `orders_v2.notes`.
- [ ] Valid request inserts one `PAYMENT_UPDATED` event with `actor: internal-v2` and detail fields for previous/next payment status, notes update, reason, and source.
- [ ] Confirm order `status`, totals, and items do not change.

### Internal Pagos UX

- [ ] Activate admin token and open `Pagos`.
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

- [ ] Activar token admin y abrir Internal Chekeo V2 en mobile width (320px+) y desktop.
- [ ] En Pedidos, presionar “Cancelar” y confirmar que no cancela directo: abre modal con folio y cliente.
- [ ] En el modal de detalle, presionar “Cancelar” y confirmar que abre el mismo flujo de razón.
- [ ] Confirmar presets: Cliente canceló, Sin stock, Pago no confirmado, Pedido duplicado, Error de captura y Otro.
- [ ] Confirmar que la razón es editable.
- [ ] Confirmar validación requerida, mínimo 3 caracteres y máximo 200 caracteres.
- [ ] Elegir “Otro” y confirmar que exige texto manual útil.
- [ ] Confirmar que la UI no usa `alert()` y muestra errores inline.
- [ ] Confirmar que al enviar muestra “Cancelando…” y deshabilita botones.
- [ ] Sin token admin, confirmar error claro: “Activa modo admin para cancelar órdenes live”.

### Audit behavior

- [ ] Confirmar que el submit llama `updateOrderV2Status(token, order.id, "cancelled", reason)` y por tanto `PATCH /api/orders-v2-admin/:id/status` con `reason`.
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
- [ ] Internal V2 ve la orden creada desde Public V2 al activar token admin y recargar.
- [ ] Pedido avanza `new → preparing → ready → delivered` sin errores visuales.
- [ ] Cancelar exige razón obligatoria antes de enviar.
- [ ] Pagos permite marcar `paid`/`pending` como estado declarado por operador.
- [ ] WhatsApp abre link manual con mensaje prellenado y no envía automático.
- [ ] Cierre carga datos desde D1 y muestra pagos declarados.
- [ ] CSV exporta desde D1 con los filtros existentes.
- [ ] Sin token admin muestra errores claros y recuperables.
- [ ] Un error de UI en Internal V2 no deja pantalla blanca; muestra “Algo falló en Internal V2” y botón “Recargar”.

### Hardening y no-touch

- [ ] Confirmar que no hay `alert()` en Internal/Public V2.
- [ ] Confirmar que botones críticos quedan deshabilitados mientras hay loading/submitting/updating.
- [ ] Confirmar que el token admin no se imprime en consola y no viaja en query params.
- [ ] Confirmar que clear token sigue limpiando `sessionStorage` y vuelve a estado mock/sin admin.
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
- [ ] Seleccionar burger abre Builder / Ordenar.
- [ ] Seleccionar x2 DOUBLE LOAD o x3 TRIPLE STACK genera unidades separadas con `lineKey` distinto.
- [ ] Cada unidad permite quitar ingredientes reales derivados del producto, mantiene pan bloqueado, extras por burger y nota opcional.
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
- [ ] Payload nuevo guarda `lineKey`, `itemDisplayIndex`, `itemKind`, `removedIngredients`, `extras`, `burgerNote` y `garnish` en snapshot JSON.
- [ ] Payload legado `{ sku, qty }` sigue creando orden.
- [ ] Backend recalcula precios base desde D1 y no confía en precios finales del frontend.
- [ ] Confirmar no productos/extras/guarniciones/ubicaciones inventadas.
- [ ] Confirmar no cambios a Internal V2 salvo tipos compartidos, legacy, `/api/order`, `/api/rpc`, Apps Script, Sheets sync, pagos reales, WhatsApp API ni `BOG_ACTIVE_ENV`.
