# Chekeo 2.0 – Data Contract (Google Sheets)

## Objetivo
Definir la estructura objetivo de datos para la nueva arquitectura con dos superficies operativas:

- **Burgers.exe**: app pública de pedidos.
- **Chekeo 2.0**: app interna de operación.

Google Sheets permanece como backend/base de datos, y Apps Script puede existir solo como backend/bridge (no como superficie operativa visible).

## Regla histórica principal (largo plazo)
- La hoja principal de Burgers.exe debe mantenerse **ligera**.
- El detalle histórico de días cerrados (pedidos/itemización completa de cierre) vive en **Google Drive**.
- En Google Sheets quedan solo índices/resúmenes ligeros y enlaces a Drive (`ARCHIVO_CORTES` como índice principal).
- `HISTORICO_ITEMS` **no forma parte del esquema principal de largo plazo**.

## Reglas generales del contrato
- No modificar ni borrar hojas legacy durante Fase 0/1.
- No cambiar comportamiento productivo actual durante esta etapa documental.
- Los nombres de hojas nuevas **no** llevan números al inicio.
- La fuente de verdad de menú público será `MENU_LIVE`.
- `MENU_LIVE` debe cubrir: **Burgers, Guarniciones y Extras**.
- Imágenes de productos: se insertan directamente en la celda del producto correspondiente.
- `COSTOS_PRECIOS` calcula precio sugerido; el precio público final se aprueba manualmente en `MENU_LIVE`.

## Contrato Orders V2: Producción vs Preview interno

Para el flujo actual en Cloudflare/D1, Chekeo puede alternar entre dos ambientes operativos sin cambiar `BOG_ACTIVE_ENV` ni bindings:

- `production`: pedidos reales creados con `orders_v2.source = public-v2`.
- `preview`: pedidos de prueba creados con `orders_v2.source = public-v2-preview`.

Reglas:
- Producción es el ambiente por defecto si el cliente no manda `environment`.
- Public Preview activa preview con `?env=preview` y envía `environment: "preview"` al crear pedido.
- Chekeo filtra listados, cierre, CSV y Resumen K por el source correspondiente al ambiente activo.
- Las mutaciones internas de Chekeo envían `environment` y el backend rechaza la orden si el `source` no coincide.
- Los folios preview usan prefijo `PVW-`.
- Pedidos preview no descuentan stock y no escriben referidos/sorteos reales.
- Consultas de tickets/sorteos reales cuentan únicamente pedidos `source = public-v2`.

## Estados operativos estandarizados

### Estado de pedido (`PEDIDOS.estado`)
1. Nuevo
2. Confirmado
3. Preparando
4. Burgers listas
5. Entregado
6. Cancelado

### Estado de guarnición (`GUARNICIONES.estado_guarnicion`)
1. Sin guarnición
2. Pendiente
3. En preparación
4. Lista

---

## Estructura objetivo por hoja (main Sheet)

## 1) `HOME`
**Propósito:** tablero/portada operativa con accesos, KPIs rápidos y estado general.

**Columnas sugeridas (si se usa como tabla):**
- `clave`
- `valor`
- `actualizado_en`
- `actualizado_por`

**Lectura/Escritura por app:**
- Burgers.exe: lectura opcional (solo flags públicos seguros).
- Chekeo 2.0: lectura principal; escritura de indicadores operativos ligeros.

**Protección sugerida:**
- Alta protección para celdas de configuración/estado global.

## 2) `AJUSTES_APP`
**Propósito:** parámetros de operación y flags de comportamiento.

**Columnas mínimas:**
- `ajuste`
- `valor`
- `descripcion`
- `ambito` (publico/interno/sistema)
- `editable`
- `actualizado_en`
- `actualizado_por`

**Lectura/Escritura por app:**
- Burgers.exe: lectura de parámetros públicos.
- Chekeo 2.0: lectura amplia; escritura controlada por rol admin.

**Protección sugerida:**
- Hoja protegida; edición limitada a operadores autorizados.

## 3) `MENU_LIVE`
**Propósito:** catálogo público vigente para venta.

**Columnas mínimas:**
- `producto_id`
- `tipo` (Burger/Guarnicion/Extra)
- `nombre`
- `descripcion`
- `precio_publico`
- `activo`
- `orden_visual`
- `imagen` (imagen en celda)
- `origen_costo_ref` (opcional hacia `COSTOS_PRECIOS`)
- `actualizado_en`
- `actualizado_por`

**Lectura/Escritura por app:**
- Burgers.exe: lectura principal del menú disponible.
- Chekeo 2.0: escritura de disponibilidad/activación y mantenimiento de catálogo.

**Protección sugerida:**
- Protección media/alta para evitar cambios accidentales de precio.

## 4) `INVENTARIO`
**Propósito:** control de stock base para operación interna.

**Columnas mínimas:**
- `insumo_id`
- `insumo`
- `categoria`
- `unidad`
- `stock_actual`
- `stock_minimo`
- `costo_unitario_ref`
- `activo`
- `actualizado_en`
- `actualizado_por`

**Lectura/Escritura por app:**
- Burgers.exe: sin acceso directo.
- Chekeo 2.0: lectura/escritura operativa.

**Protección sugerida:**
- Protegida para evitar alteraciones por usuarios no operativos.

## 5) `COSTOS_PRECIOS`
**Propósito:** cálculo interno de costo y precio sugerido.

**Columnas mínimas:**
- `producto_id`
- `nombre_producto`
- `costo_total`
- `margen_objetivo`
- `precio_sugerido`
- `precio_vigente_menu_live`
- `diferencia`
- `actualizado_en`
- `actualizado_por`

**Lectura/Escritura por app:**
- Burgers.exe: sin lectura directa obligatoria.
- Chekeo 2.0: lectura/escritura interna de costos.

**Nota clave:**
- `precio_sugerido` no publica automáticamente; `precio_publico` se confirma manualmente en `MENU_LIVE`.

**Protección sugerida:**
- Alta protección (finanzas/costos).

## 6) `PEDIDOS`
**Propósito:** maestro de pedidos (reemplaza “Pedidos Master”).

**Columnas mínimas:**
- `pedido_id`
- `folio`
- `canal` (Burgers.exe)
- `cliente_nombre`
- `cliente_telefono`
- `metodo_pago`
- `total`
- `estado`
- `fecha_creacion`
- `fecha_actualizacion`
- `origen_app`

**Lectura/Escritura por app:**
- Burgers.exe: escritura de nuevos pedidos + lectura de estado propio.
- Chekeo 2.0: lectura global + escritura de transición de estado.

**Protección sugerida:**
- Estructura protegida; solo filas nuevas/actualizaciones controladas por procesos.

## 7) `PEDIDO_ITEMS`
**Propósito:** detalle por ítem del pedido (líneas comprables del flujo activo).

**Columnas mínimas:**
- `pedido_item_id`
- `pedido_id`
- `producto_id`
- `tipo`
- `nombre`
- `cantidad`
- `precio_unitario`
- `subtotal`
- `notas`

**Lectura/Escritura por app:**
- Burgers.exe: escritura al crear pedido.
- Chekeo 2.0: lectura operativa; ajustes solo según política.

**Protección sugerida:**
- Estructura fija protegida.

## 8) `PEDIDO_BURGERS`
**Propósito:** detalle estructurado de configuración de burgers por pedido.

**Columnas mínimas:**
- `pedido_burger_id`
- `pedido_id`
- `pedido_item_id`
- `burger_base_id`
- `extras_json` (o estructura equivalente)
- `sin_ingredientes_json` (opcional)
- `comentarios`

**Lectura/Escritura por app:**
- Burgers.exe: escritura al crear pedido.
- Chekeo 2.0: lectura para preparación/cocina.

**Protección sugerida:**
- Estructura protegida.

## 9) `GUARNICIONES`
**Propósito:** flujo separado para preparación/seguimiento de guarniciones.

**Columnas mínimas:**
- `guarnicion_id`
- `pedido_id`
- `pedido_item_id`
- `producto_id`
- `cantidad`
- `estado_guarnicion`
- `responsable`
- `actualizado_en`

**Lectura/Escritura por app:**
- Burgers.exe: escritura inicial al generar pedido.
- Chekeo 2.0: lectura/escritura de estados de preparación.

**Protección sugerida:**
- Protección parcial (columnas de control de estado).

## 10) `EVENTOS_PEDIDO`
**Propósito:** bitácora auditable de cambios de estado/eventos.

**Columnas mínimas:**
- `evento_id`
- `pedido_id`
- `tipo_evento`
- `estado_anterior`
- `estado_nuevo`
- `detalle`
- `usuario`
- `timestamp`
- `origen_app`

**Lectura/Escritura por app:**
- Burgers.exe: escritura de eventos públicos relevantes (creación/envío).
- Chekeo 2.0: escritura de transiciones internas y eventos operativos.

**Protección sugerida:**
- Append-only ideal; sin edición retroactiva.

## 11) `RESUMEN_DIARIO`
**Propósito:** agregados diarios para operación y cierre.

**Columnas mínimas:**
- `fecha`
- `pedidos_total`
- `ventas_total`
- `cancelados_total`
- `ticket_promedio`
- `ultimo_calculo_en`

**Lectura/Escritura por app:**
- Burgers.exe: sin dependencia directa.
- Chekeo 2.0: lectura para Home/Opciones; escritura por proceso de cierre.

**Protección sugerida:**
- Protección media; edición manual restringida.

## 12) `HISTORICO_PEDIDOS`
**Propósito:** resumen histórico liviano por pedido (no almacén detallado de largo plazo).

**Columnas mínimas:**
- `pedido_id`
- `folio`
- `fecha_cierre`
- `total`
- `estado_final`
- `cliente_hash_o_ref` (según política de datos)
- `drive_corte_ref` (ID o URL de referencia al corte en Drive)

**Lectura/Escritura por app:**
- Burgers.exe: no requerido.
- Chekeo 2.0: lectura para consultas históricas rápidas; escritura de resumen en cierre/archivado.

**Nota clave:**
- El detalle completo de pedidos/items cerrados se mantiene en documentos/archivos de Drive.

**Protección sugerida:**
- Alta protección; escritura solo por proceso controlado.

## 13) `ARCHIVO_CORTES`
**Propósito:** índice liviano principal de cierres archivados en Google Drive.

**Columnas mínimas:**
- `corte_id`
- `fecha_corte`
- `total_pedidos`
- `total_vendido`
- `total_burgers`
- `total_guarniciones`
- `drive_folder_url`
- `drive_summary_file_url`
- `creado_en`
- `creado_por`

**Lectura/Escritura por app:**
- Burgers.exe: no requerido.
- Chekeo 2.0: lectura para navegación de historial; escritura al cerrar/archivar día.

**Nota clave:**
- Aquí solo se guarda índice/metadatos y enlaces. El detalle completo del cierre vive en Google Drive.

**Protección sugerida:**
- Estructura protegida; append-only recomendado.

---

## Hojas fuera de esquema principal de largo plazo
- `HISTORICO_ITEMS`: **no es parte del main Sheet a largo plazo**. Si existe temporalmente en transición, debe tratarse como artefacto intermedio y no como almacenamiento detallado permanente.

## Hojas con protección recomendada (resumen)
Protección **alta** recomendada para:
- `AJUSTES_APP`
- `COSTOS_PRECIOS`
- `HISTORICO_PEDIDOS`
- `ARCHIVO_CORTES`

Protección de estructura (encabezados/columnas) para:
- `MENU_LIVE`
- `PEDIDOS`
- `PEDIDO_ITEMS`
- `PEDIDO_BURGERS`
- `GUARNICIONES`
- `EVENTOS_PEDIDO`
- `RESUMEN_DIARIO`

## Superficies de app (UI) confirmadas
- **Burgers.exe**: app pública de pedidos (mobile-first).
- **Chekeo 2.0**: app interna con 4 pantallas:
  - Home
  - Pedidos
  - Cocina
  - Opciones

Apps Script no debe tratarse como Web App operativa visible; solo backend/bridge si aplica.
