# Normalized Operations Contract (Phase 3D-A)

## Scope
Phase 3D-A added backend Apps Script methods for Chekeo 2.0 operational writes against the normalized sheets. Phase 3D-B connects Chekeo 2.0 UI controls to those normalized methods while preserving legacy fallback routing.

## Sheets written
Operational writes use header-based access only and write to:
- `PEDIDOS` for order state, payment state, notes, ticket flags, and `fecha_actualizacion`.
- `GUARNICIONES` for side-dish completion state.
- `EVENTOS_PEDIDO` for audit events.

The new methods do not write to `Pedidos Master`, do not delete/clear sheets, and do not migrate existing data destructively.

## PEDIDOS operational fields
Phase 3D-A extends `PEDIDOS` by appending these optional columns at the end:
- `estado_pago`
- `nota_interna`
- `nota_cliente`
- `ticket_enviado`
- `ticket_enviado_en`

Run `ensureNormalizedOperationalHeaders()` manually after deploying Apps Script to append missing trailing headers safely.

## Allowed statuses
### Order status (`estado`)
- `Nuevo`
- `Confirmado`
- `Preparando`
- `Listo`
- `Cancelado`
- `Completado`

### Payment status (`estado_pago`)
- `Pendiente`
- `Pagado`
- `Parcial`
- `Cancelado`

## Methods
### `ensureNormalizedOperationalHeaders()`
Safe manual setup helper.

Returns:
```json
{
  "ok": true,
  "updatedSheets": [],
  "addedHeaders": {},
  "conflicts": [],
  "timestamp": "..."
}
```

Behavior:
- Appends only missing trailing operational headers to `PEDIDOS`.
- Never deletes, renames, clears, or overwrites non-empty header cells.
- Returns conflicts instead of modifying when a middle header mismatch is detected.
- Verifies all other normalized sheet header contracts.

### `previewNormalizedOperationsReadiness()`
Read-only diagnostic.

Returns:
```json
{
  "ok": true,
  "missingHeadersBySheet": {},
  "pedidosCount": 0,
  "openOrdersCount": 0,
  "pendingGuarnicionesCount": 0,
  "timestamp": "..."
}
```

### `updateNormalizedOrderStatus(pedidoId, nextStatus, user)`
Updates `PEDIDOS.estado` and `PEDIDOS.fecha_actualizacion`.

Appends one `EVENTOS_PEDIDO` row:
- `tipo_evento`: `ESTADO_PEDIDO_CAMBIADO`
- `estado_anterior`: previous order state
- `estado_nuevo`: requested state
- `detalle`: `Estado actualizado desde Chekeo 2.0`
- `usuario`: `user || "chekeo-2"`
- `origen_app`: `chekeo-2`

### `updateNormalizedPaymentStatus(pedidoId, estadoPago, metodoPago, user)`
Updates `PEDIDOS.estado_pago`; updates `PEDIDOS.metodo_pago` only when `metodoPago` is provided; updates `PEDIDOS.fecha_actualizacion`.

Appends one `EVENTOS_PEDIDO` row:
- `tipo_evento`: `PAGO_ACTUALIZADO`
- `estado_anterior`: previous `estado_pago` or `Pendiente`
- `estado_nuevo`: requested payment status
- `detalle`: includes changed `metodo_pago` when applicable
- `origen_app`: `chekeo-2`

### `markNormalizedOrderPaid(pedidoId, user)`
Convenience wrapper for:
```js
updateNormalizedPaymentStatus(pedidoId, 'Pagado', '', user)
```

### `markNormalizedGuarnicionDone(guarnicionIdOrPedidoId, user)`
Marks normalized guarniciones as done.

Behavior:
- If the input matches a `guarnicion_id`, updates only that guarnición.
- Otherwise, if the input matches a `pedido_id`, updates all guarniciones for that pedido.
- Sets `estado_guarnicion = "Hecha"`, `responsable = user || "chekeo-2"`, and `actualizado_en = now`.
- Appends one `GUARNICION_HECHA` event per affected pedido, including previous state summary and affected guarnición ids/count.

### `updateNormalizedOrderNotes(pedidoId, notaInterna, notaCliente, user)`
Updates `PEDIDOS.nota_interna`, `PEDIDOS.nota_cliente`, and `PEDIDOS.fecha_actualizacion`.

Appends one `EVENTOS_PEDIDO` row:
- `tipo_evento`: `NOTAS_ACTUALIZADAS`
- `origen_app`: `chekeo-2`

### `markNormalizedTicketSent(pedidoId, user)`
Sets `PEDIDOS.ticket_enviado = true`, `PEDIDOS.ticket_enviado_en = now`, and updates `PEDIDOS.fecha_actualizacion`.

Appends one `EVENTOS_PEDIDO` row:
- `tipo_evento`: `TICKET_ENVIADO`
- `origen_app`: `chekeo-2`

## Event writing guarantee
Every operational mutation method appends an audit row to `EVENTOS_PEDIDO` using the normalized event contract:
`evento_id`, `pedido_id`, `tipo_evento`, `estado_anterior`, `estado_nuevo`, `detalle`, `usuario`, `timestamp`, `origen_app`.

## Deployment/manual steps
1. Deploy the updated Apps Script files.
2. Run `ensureNormalizedOperationalHeaders()` manually.
3. Run `previewNormalizedOperationsReadiness()` and confirm `ok: true`.
4. Validate Chekeo 2.0 UI write flows after Phase 3D-B deployment; normalized UI controls now call these methods.

## Phase 3D-B UI consumption
Chekeo 2.0 now consumes the normalized operation methods when `state.ordersSource === "normalized"`. The UI keeps legacy fallback routing intact for `state.ordersSource === "legacy-fallback"` and does not call legacy order write methods from normalized mode. Cierre/resumen/archivo/histórico actions are not part of this normalized UI activation.

### UI button to RPC mapping
- Orders panel `Confirmar`, detail modal `Guardar estado`, and kitchen `Preparando`/`Pedido listo` status controls call `updateNormalizedOrderStatus(pedidoId, nextStatus, "chekeo-2-ui")`.
- Orders panel `Pagado` and detail modal `Marcar pagado` call `markNormalizedOrderPaid(pedidoId, "chekeo-2-ui")`.
- Orders and kitchen `Guarnición hecha` controls call `markNormalizedGuarnicionDone(pedidoIdOrGuarnicionId, "chekeo-2-ui")`.
- Detail modal `Guardar notas` calls `updateNormalizedOrderNotes(pedidoId, notaInterna, notaCliente, "chekeo-2-ui")`.
- Detail modal `Guardar pago` calls `updateNormalizedPaymentStatus(pedidoId, estadoPago, metodoPago, "chekeo-2-ui")`.
- Detail modal `Marcar ticket enviado` calls `markNormalizedTicketSent(pedidoId, "chekeo-2-ui")`.

### Still pending
- Normalized WhatsApp send remains disabled in the UI pending a dedicated normalized ticket/phone send path.
- Cierre/resumen/archivo/histórico migration remains outside this phase; normalized mode disables those legacy controls until a later normalized close/history path exists.
