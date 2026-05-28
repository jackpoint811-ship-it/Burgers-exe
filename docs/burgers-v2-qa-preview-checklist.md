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
