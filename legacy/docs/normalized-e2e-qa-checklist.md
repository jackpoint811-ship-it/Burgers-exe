# Normalized end-to-end QA checklist (Phase 8B)

## Scope and safety rules

This checklist validates the normalized-first end-to-end flow after Phase 8A UI cleanup.

- Do **not** edit/delete rows manually while validating.
- Do **not** clear sheets.
- Do **not** use destructive script operations.
- Do **not** write to **Pedidos Master**.
- Keep focus on normalized sheets and Chekeo 2.0 normalized mode.

---

## Preconditions

- Public order endpoint is deployed and reachable.
- Chekeo 2.0 internal app is deployed and reachable.
- Spreadsheet has normalized sheets available:
  - `PEDIDOS`
  - `PEDIDO_ITEMS`
  - `PEDIDO_BURGERS`
  - `GUARNICIONES` (if applicable)
  - `EVENTOS_PEDIDO`
- Test data includes at least:
  - 1 burger-only order
  - 1 burger + guarnición order
  - 1 order that can progress to fully finalized

---

## A) Public order creation

1. Open `public-order` in mobile viewport.
2. Submit a new valid order.
3. Confirm response is accepted (success message / success payload).
4. In sheets, confirm new rows were appended for the same `pedido_id`:
   - `PEDIDOS`
   - `PEDIDO_ITEMS`
   - `PEDIDO_BURGERS`
   - `GUARNICIONES` (only when order includes guarniciones)
   - `EVENTOS_PEDIDO`
5. Confirm no legacy-only write path is required for this order.

Expected:
- Order is accepted.
- Normalized rows exist and are consistent by `pedido_id`.

---

## B) Chekeo 2.0 — Pedidos tab

1. Refresh Chekeo 2.0.
2. Confirm app is in normalized mode.
3. Locate the new order card.
4. Confirm card shows the normalized surface fields:
   - Producción
   - Pago
   - Entrega
   - Finalización
5. Confirm internal/legacy status appears only as secondary context text.
6. Confirm there are **no** general status buttons on normalized cards:
   - `Confirmar`
   - `Preparando`

Expected:
- Order appears in normalized list.
- Card reflects normalized state model and no removed general-status actions.

---

## C) Chekeo 2.0 — Cocina tab

1. Open Cocina.
2. For an order with burgers, confirm it appears in **Burgers**.
3. For an order with guarniciones, confirm it appears in **Guarniciones**.
4. Confirm Cocina UI does not depend on payment status visibility/logic.
5. Mark burgers as `Preparando`.
6. Mark burgers as `Lista(s)`.
7. If guarniciones exist, mark guarniciones `Preparando` and then `Hecha(s)`.
8. Confirm production auto-transitions to `Preparada` when production readiness is complete.

Expected:
- Kitchen flow updates only production-related dimensions.
- Production reaches `Preparada` automatically once all production parts are ready.

---

## D) Chekeo 2.0 — Detalle modal

1. Open order detail for a normalized order.
2. Confirm section order is exactly:
   1. Pedido
   2. Producción
   3. Pago
   4. Entrega
   5. Finalización
   6. Notas
   7. Ticket
   8. JSON técnico
3. Confirm `JSON técnico` is collapsed by default.
4. Update payment and save.
5. Update notes and save.
6. Send ticket.
7. Execute delivery action.

Expected:
- Section ordering matches normalized detail design.
- Payment, notes, ticket, and delivery actions work.

---

## E) Finalization rules

For a target order, verify finalization logic:

1. Confirm finalization remains `false` while any requirement is unmet.
2. Validate required states:
   - Producción = `Preparada`
   - Pago = `Pagado`
   - Entrega = `Entregada`
3. Once all 3 conditions are true, confirm finalization flips to `true`.

Expected:
- Finalization is derived strictly from the 3 normalized dimensions.

---

## F) Otros / Cierre Drive-first

1. Open Otros in normalized mode.
2. Validate preview buckets:
   - Finalized new order appears in **Finalizados nuevos**.
   - Blocked orders appear in **Bloqueados** with blockers.
   - Already archived orders appear in **Ya archivados**.
3. Confirm archive button is disabled when `finalizedCount = 0`.
4. Run archive for a valid cutoff.
5. Confirm Drive JSON files are created.
6. Confirm `ARCHIVO_CORTES` has a new appended row.
7. Confirm `EVENTOS_PEDIDO` includes `PEDIDO_ARCHIVADO_DRIVE` events.
8. Re-run archive and confirm no duplication occurs.

Expected:
- Drive-first closure behaves idempotently and records audit artifacts.

---

## G) Regression checks

1. Confirm `public-order` still creates valid orders.
2. Confirm Chekeo normalized mode loads without legacy sections in Otros.
3. Confirm legacy fallback path remains internally available.
4. Confirm no rows were deleted/cleared during QA.

Expected:
- Normalized-first UX is preserved.
- Legacy fallback remains intact.
- No destructive data operations performed.

---

## Evidence capture template

For each scenario, capture:

- Timestamp (UTC)
- `pedido_id`
- Action performed
- UI result
- Sheet/event evidence
- Pass/Fail
- Notes

Suggested table columns:

`timestamp_utc | area | pedido_id | step | expected | observed | result | notes`
