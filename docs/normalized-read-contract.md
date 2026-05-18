# Normalized Read Contract (Phase 3B/3C)

## Scope
Phase 3B adds a **read-only** normalized backend service for Chekeo 2.0.

This phase introduces:
- `getNormalizedAppOrders(filters)`
- `getNormalizedOrderDetail(pedidoId)`
- `previewNormalizedOrdersRead()`

Phase 3C updates internal UI read path to consume this normalized model (`cloudflare/internal-chekeo/app.js`) with legacy fallback.
Operational writes/status transitions remain pending migration in Phase 3D.

## Source sheets
Read model composes data from:
- `PEDIDOS` (parent)
- `PEDIDO_ITEMS`
- `PEDIDO_BURGERS`
- `GUARNICIONES`
- `EVENTOS_PEDIDO` (detail endpoint events)

## getNormalizedAppOrders(filters)
Returns composed normalized orders.

### Default behavior
When `filters` is omitted:
- returns active/open orders only (`estado` not in `Cancelado`, `Completado`, `Archivado`)
- ordered by most recent `fecha_creacion`
- max `100` results

### Filters
Optional `filters` object:
- `estado` (exact status match, normalized)
- `fechaDesde` (inclusive date)
- `fechaHasta` (inclusive date)
- `includeArchived` (boolean)
- `limit` (default 100, max 500)

### Output shape (per order)
- Header fields from `PEDIDOS`:
  - `pedido_id`, `folio`, `canal`, `cliente_nombre`, `cliente_telefono`
  - `metodo_pago`, `total`, `estado`, `fecha_creacion`, `fecha_actualizacion`, `origen_app`
- Children:
  - `items[]` from `PEDIDO_ITEMS`
  - `burgers[]` from `PEDIDO_BURGERS`
  - `guarniciones[]` from `GUARNICIONES`
- Aggregates:
  - `counts.burgers_total`
  - `counts.guarniciones_total`
  - `counts.extras_total`
  - `counts.items_total`
- Kitchen summary:
  - `kitchen.status`
  - `kitchen.burger_summary`
  - `kitchen.guarnicion_summary`
  - `kitchen.has_guarniciones`
  - `kitchen.pending_guarniciones`
- Payment summary:
  - `payment.metodo_pago`
  - `payment.estado_pago`

## Child record mapping
### Item shape (`PEDIDO_ITEMS`)
- `pedido_item_id`, `pedido_id`, `producto_id`, `tipo`, `nombre`
- `cantidad`, `precio_unitario`, `subtotal`, `notas`

### Burger shape (`PEDIDO_BURGERS`)
- `pedido_burger_id`, `pedido_id`, `pedido_item_id`, `burger_base_id`
- `extras` (parsed from `extras_json`)
- `sin_ingredientes` (parsed from `sin_ingredientes_json`)
- `comentarios`

If JSON parse fails, service returns `[]` and appends a warning in response.

### Guarnición shape (`GUARNICIONES`)
- `guarnicion_id`, `pedido_id`, `pedido_item_id`, `producto_id`
- `cantidad`, `estado_guarnicion`, `responsable`, `actualizado_en`

## Kitchen behavior
- `burger_summary`: human-readable grouped count (example: `1x OG, 2x BBQ`)
- `guarnicion_summary`: human-readable line-item summary or `Sin guarniciones` (uses matching `PEDIDO_ITEMS.nombre` by `pedido_item_id` when available; falls back to `producto_id`)
- `pending_guarniciones`: count where `estado_guarnicion !== "Hecha"`
- `status` mapping:
  - `Nuevo -> Nuevo`
  - `Confirmado -> Confirmado`
  - `Preparando -> Preparando`
  - `Listo -> Listo`
  - fallback to raw `estado`

## Payment behavior (temporary)
Current normalized `PEDIDOS` does not include dedicated paid-state column.

Temporary behavior in Phase 3B:
- `payment.metodo_pago` comes from `PEDIDOS.metodo_pago`
- `payment.estado_pago` is hardcoded to `Pendiente`

This remains temporary until payment state migration phase.

## getNormalizedOrderDetail(pedidoId)
Returns a single composed order by `pedido_id`, including `eventos[]` from `EVENTOS_PEDIDO`.

If not found:
- `ok: false`
- `error.code: "NOT_FOUND"`

## previewNormalizedOrdersRead()
Read-only diagnostics endpoint returning:
- `ok`
- `pedidosCount`
- `itemsCount`
- `burgersCount`
- `guarnicionesCount`
- `eventosCount`
- `samplePedidoId`
- `warnings`
- `timestamp`

## Read-only guarantee
Phase 3B/3C read model:
- does not write/update statuses
- does not write to any sheet
- does not delete/clear/migrate sheets
- UI read integration in Chekeo 2.0 is enabled in Phase 3C (read-only mode for normalized orders/detail paths)
- write/status/payment/guarnición actions from normalized UI remain disabled until Phase 3D
