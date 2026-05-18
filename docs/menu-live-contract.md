# MENU_LIVE Contract (Phase 2A)

## Objetivo
`MENU_LIVE` es la fuente preparada para convertirse en el menú público de Burgers.exe en fases posteriores, pero **este cambio aún no conecta el frontend público**.

## Headers esperados (fila 1)
La fila 1 debe incluir estos encabezados:

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
- `precio_publico`: requerido, número >= 0. Este es el **precio público aprobado**.
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
