# MENU_LIVE Contract (Phase 2A)

## Objetivo
`MENU_LIVE` es la fuente preparada para convertirse en el menú público de Burgers.exe en fases posteriores, pero **este cambio aún no conecta el frontend público**.

## Headers esperados (fila 1)
La fila 1 debe incluir estos encabezados (el orden de columnas puede variar, pero los nombres deben coincidir exactamente):

1. `producto_id`
2. `tipo`
3. `nombre`
4. `descripcion`
5. `precio_publico`
6. `activo`
7. `orden_visual`
8. `imagen`
9. `origen_costo_ref`
10. `actualizado_en`
11. `actualizado_por`

## Reglas de llenado
- `producto_id`: requerido, texto único y estable por producto.
- `tipo`: requerido. Valores aceptados:
  - `Burger`
  - `Guarnicion`
  - `Extra`
- `nombre`: requerido.
- `descripcion`: opcional.
- `precio_publico`: requerido, número >= 0. Este es el **precio público aprobado**. Puede venir como número o celda con formato moneda; el servicio prioriza el valor numérico crudo y usa fallback seguro para strings monetarios.
- `activo`: requerido, acepta `TRUE/FALSE`, `true/false`, `Si/Sí/No`, `1/0`.
- `orden_visual`: opcional; si está vacío, se usa `999` para ordenamiento.
- `imagen`: se inserta en la celda del producto (imagen o texto URL).
- `origen_costo_ref`: opcional.
- `actualizado_en` / `actualizado_por`: opcionales.

## Nota sobre imágenes en Phase 2A
En esta fase la extracción de imágenes es **best-effort**:
- Si la celda de `imagen` se puede leer como URL/string usable, se expone como `image_url`.
- Si no se puede extraer (por ejemplo, imagen embebida en celda no accesible como string), se devuelve:
  - `image_url: ""`
  - `image_status: "cell_image_or_blank"`

Esto **no debe romper** la lectura del menú.

## Relación con COSTOS_PRECIOS
`COSTOS_PRECIOS` puede sugerir precios, pero **no publica automáticamente** al menú público. La publicación efectiva depende del valor aprobado en `MENU_LIVE.precio_publico`.

## Alcance de esta PR
- Se agrega servicio Apps Script read-only para validar y leer `MENU_LIVE`.
- Se agrega previsualización de conteos para revisión operativa.
- **No** se conecta todavía la app pública (`cloudflare/public-order`) a `MENU_LIVE`.


## Phase 2C – Cloudflare `GET /api/menu`
Se agrega endpoint read-only en `cloudflare/public-order/functions/api/menu.js` para exponer menú normalizado a la app pública sin cambiar `app.js` todavía.

### Variable de entorno
- `APPS_SCRIPT_MENU_ENDPOINT`: URL del bridge Apps Script para menú público.

### Flujo
1. Cloudflare intenta consultar Apps Script con `action: "getPublicMenuLive"` (timeout ~3000ms).
2. Si Apps Script responde `ok: true`, Cloudflare normaliza y responde con `source: "apps-script"`.
3. Si falta `APPS_SCRIPT_MENU_ENDPOINT`, hay timeout/error de red, o Apps Script responde inválido, Cloudflare responde `source: "fallback"` con menú estático seguro.

### Contrato de respuesta Cloudflare
```json
{
  "ok": true,
  "source": "apps-script | fallback",
  "data": {
    "burgers": [],
    "guarniciones": [],
    "extras": [],
    "all": []
  },
  "warnings": [],
  "timestamp": "ISO string"
}
```

### Forma normalizada de item
Cada item en `data.*` contiene:
- `sku` (= `producto_id`)
- `producto_id`
- `tipo`
- `name` y `nombre`
- `description` y `descripcion`
- `price` y `precio_publico`
- `active` y `activo`
- `orden_visual`
- `image_url`
- `image_status`

### Nota de rollout
- Esta fase **no** reemplaza el menú estático del frontend (`cloudflare/public-order/app.js`).
- Esta fase **no** reemplaza `PRICE_TABLE` de órdenes.
