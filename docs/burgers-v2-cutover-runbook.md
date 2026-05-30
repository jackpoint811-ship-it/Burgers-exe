# Burgers.exe V2 cutover readiness runbook (V2-13)

## A. Executive summary

Burgers.exe V2 is ready for a controlled pilot / pre-production phase, but this document does **not** authorize an automatic final cutover. The goal is to prepare operational readiness, smoke testing, rollback, and reconciliation steps before moving real traffic beyond preview/pilot usage.

Key operating principles:

- D1 is the source of truth for V2 catalog, orders, status, payment status, close reporting, and CSV export.
- Sheets remains a manual/export destination only. It is not the source of truth for V2.
- Payments remain manual/operator-declared. V2 does not perform real payment capture.
- WhatsApp remains manual via operator-opened `wa.me` links. V2 does not use WhatsApp API or automatic sending.
- No cutover should change `BOG_ACTIVE_ENV` without explicit approval from the release owner.

## B. Current validated capabilities

The following V2 capabilities have been validated before this cutover-readiness phase:

- D1 catalog served by `GET /api/menu-v2`.
- R2 catalog assets served through same-origin asset endpoints backed by `BOG_ASSETS_BUCKET`.
- Public V2 creates real orders in D1 through `POST /api/orders-v2`.
- Internal V2 operates live orders from D1 through admin endpoints.
- Status flow supports `new -> preparing -> ready -> delivered` and terminal cancellation.
- Cancellation requires and records an operator reason.
- Manual payment operations update declared `payment_status` without real payment capture.
- Manual WhatsApp actions open/copy operator messages without automatic delivery.
- Close dashboard reads operational metrics from D1.
- CSV export reads V2 orders from D1 for manual reconciliation/import workflows.
- Error boundary / hardening work prevents blank-screen failure during Internal V2 UI errors.

## C. Environments

Current preview environment references:

- Public preview project: `burgers-exe-public-v2-preview`.
- Internal preview project: `burgers-exe-internal-v2-preview`.
- D1 binding: `BOG_MENU_DB`.
- R2 binding: `BOG_ASSETS_BUCKET`.
- Admin secrets/tokens:
  - `BOG_MENU_ADMIN_TOKEN`.
  - `BOG_ORDERS_ADMIN_TOKEN`.

Release rule: do not change `BOG_ACTIVE_ENV` without explicit approval from the designated release owner. This runbook prepares cutover; it does not execute cutover or mutate Cloudflare configuration.

## D. Required Cloudflare bindings/secrets checklist

Before any pilot/pre-production cutover window, confirm all of the following:

- [ ] `BOG_MENU_DB` is bound to the correct D1 database for the target preview/pre-production environment.
- [ ] `BOG_ASSETS_BUCKET` is bound to the correct R2 bucket for catalog assets.
- [ ] `BOG_MENU_ADMIN_TOKEN` is configured as a secret where menu/admin operations require it.
- [ ] `BOG_ORDERS_ADMIN_TOKEN` is configured as a secret where order/admin operations require it.
- [ ] Public and internal routes/projects remain separated.
- [ ] Public V2 preview URL is validated before sharing.
- [ ] Internal V2 preview URL is validated before staff use.
- [ ] No legacy route is overwritten accidentally.
- [ ] `BOG_ACTIVE_ENV` remains unchanged unless explicitly approved.

## E. Pre-cutover smoke test

Use placeholders only. Do not paste real tokens into documentation, tickets, screenshots, or chat logs.

Set local shell placeholders for the smoke window:

```bash
export PUBLIC_V2_URL="<PUBLIC_V2_URL>"
export INTERNAL_V2_URL="<INTERNAL_V2_URL>"
# BOG_ORDERS_ADMIN_TOKEN must already exist in the operator shell/session.
```

### 1. GET /api/menu-v2

```bash
curl -i "$PUBLIC_V2_URL/api/menu-v2"
```

Expected result:

- HTTP 200.
- Response includes catalog data from D1 or an explicit safe source marker expected for the environment.
- No legacy `/api/menu`, `/api/order`, or `/api/rpc` dependency is introduced by this test.

### 2. POST /api/orders-v2

```bash
curl -i -X POST "$PUBLIC_V2_URL/api/orders-v2" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: cutover-smoke-001' \
  --data '{"customer":{"name":"Cutover Smoke","phone":"5512345678"},"orderMode":"pickup","paymentMethod":"cash","items":[{"sku":"BRG-OG","qty":1}],"notes":"V2-13 smoke test"}'
```

Expected result:

- HTTP 200/201 according to current endpoint behavior.
- Response includes order id, folio, status, and backend-confirmed total.
- Save the returned order id as `<ORDER_ID>` for the next checks.

### 3. GET /api/orders-v2-admin

```bash
curl -i "$PUBLIC_V2_URL/api/orders-v2-admin?includeTerminal=true&limit=10" \
  -H "Authorization: Bearer $BOG_ORDERS_ADMIN_TOKEN"
```

Expected result:

- HTTP 200.
- The smoke order appears in the returned list.
- Items and status/event context are present according to current admin response shape.

### 4. PATCH /api/orders-v2-admin/:id/status

```bash
curl -i -X PATCH "$PUBLIC_V2_URL/api/orders-v2-admin/<ORDER_ID>/status" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $BOG_ORDERS_ADMIN_TOKEN" \
  --data '{"status":"preparing"}'
```

Optional continuation if the smoke window allows changing the test order through the full flow:

```bash
curl -i -X PATCH "$PUBLIC_V2_URL/api/orders-v2-admin/<ORDER_ID>/status" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $BOG_ORDERS_ADMIN_TOKEN" \
  --data '{"status":"ready"}'

curl -i -X PATCH "$PUBLIC_V2_URL/api/orders-v2-admin/<ORDER_ID>/status" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $BOG_ORDERS_ADMIN_TOKEN" \
  --data '{"status":"delivered"}'
```

Expected result:

- Each valid transition returns success.
- Invalid transitions remain rejected by the API.

### 5. PATCH /api/orders-v2-admin/:id/payment

```bash
curl -i -X PATCH "$PUBLIC_V2_URL/api/orders-v2-admin/<ORDER_ID>/payment" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $BOG_ORDERS_ADMIN_TOKEN" \
  --data '{"paymentStatus":"paid","notes":"Smoke payment marked manually; no real payment captured."}'
```

Expected result:

- HTTP 200.
- Order payment status changes to `paid` as an operator-declared value.
- No real payment provider is contacted.

### 6. GET /api/orders-v2-admin/summary

```bash
curl -i "$PUBLIC_V2_URL/api/orders-v2-admin/summary" \
  -H "Authorization: Bearer $BOG_ORDERS_ADMIN_TOKEN"
```

Expected result:

- HTTP 200.
- Summary loads from D1 and includes the smoke order according to date/status filters.

### 7. GET /api/orders-v2-admin/export.csv

```bash
curl -i "$PUBLIC_V2_URL/api/orders-v2-admin/export.csv" \
  -H "Authorization: Bearer $BOG_ORDERS_ADMIN_TOKEN"
```

Expected result:

- HTTP 200.
- CSV includes V2 order fields needed for manual reconciliation.
- This CSV is a manual export; it is not automatic Sheets sync.

## F. Manual UI QA checklist

Run these checks on the actual Public V2 and Internal V2 preview URLs for the target pilot/pre-production window:

- [ ] Public V2 loads the menu.
- [ ] Public V2 creates a real order.
- [ ] Internal V2 sees the created order after admin token activation/refresh.
- [ ] Status advances `new -> preparing -> ready -> delivered`.
- [ ] Cancellation asks for a reason before submitting.
- [ ] History shows the cancellation reason for cancelled orders.
- [ ] Payments can mark declared status as `paid`, `pending`, and `cancelled`.
- [ ] WhatsApp action opens `wa.me` manually with a prefilled operator message.
- [ ] Close dashboard loads from D1.
- [ ] CSV downloads from D1 export endpoint.
- [ ] ErrorBoundary prevents blank screen and shows a recoverable error state.

## G. Cutover options

### Option A — Keep V2 as preview/pilot URL only

Pros:

- Lowest risk.
- No route replacement.
- Staff can validate operations with controlled orders.
- Fast rollback: stop using/sharing preview links.

Cons:

- Requires manual link management.
- Customers may still use legacy links unless staff directs them otherwise.
- Operational team may need to monitor both V1 and V2 during pilot.

Risk:

- Low. Main risk is confusion about which link is active for a given order.

Rollback:

- Stop sharing V2 preview URLs.
- Continue using V1/legacy URLs.
- Export any V2 D1 orders for reconciliation before ending the pilot.

### Option B — Move real traffic manually by sharing the V2 URL

Pros:

- Tests V2 with real demand without changing primary routes.
- Enables gradual exposure by staff/time window/customer group.
- No Cloudflare route replacement required.

Cons:

- Manual coordination required.
- Customers can receive mixed V1/V2 links.
- Staff must reconcile two operational channels during the window.

Risk:

- Medium. Real orders can land in both systems if communication is unclear.

Rollback:

- Stop sharing V2 URL.
- Re-share/restore V1 link as the only active customer link.
- Export V2 CSV and reconcile D1 orders created during the window.

### Option C — Replace primary public route with Public V2

Pros:

- Simplifies customer entry point.
- Real traffic goes through the validated V2 public flow.
- Reduces customer-facing link ambiguity.

Cons:

- Higher blast radius than preview sharing.
- Requires Cloudflare route/project/domain change outside this documentation PR.
- Any Public V2 issue affects the primary ordering channel.

Risk:

- High unless preceded by successful pilots and parallel operation.

Rollback:

- Repoint the primary public route back to V1/legacy.
- Pause Public V2 sharing.
- Keep D1 data intact and export CSV for reconciliation.

### Option D — Replace current Internal/Chekeo with Internal V2

Pros:

- Staff operates from the V2 console and D1 source of truth.
- Enables consistent V2 status/payment/close workflows.
- Removes duplicated staff attention after successful parallel run.

Cons:

- Highest operational dependency on Internal V2 readiness.
- Requires staff training and clear token/session handling.
- Any Internal V2 issue can affect kitchen/order operations.

Risk:

- High unless Public V2 and Internal V2 have both completed multiple successful shifts.

Rollback:

- Return staff to current Internal/Chekeo legacy URL.
- Stop using Internal V2 for new operational changes.
- Export and reconcile V2 D1 orders before fully ending the V2 window.

## H. Recommended phased cutover

Recommended sequence:

1. Run an internal pilot with staff only; no customer-facing link changes.
2. Run a pilot with 1–3 controlled real orders.
3. Operate V1 + V2 in parallel for a defined shift/window with explicit responsibility assignment.
4. Promote Public V2 as the main customer link only after pilot/parallel success.
5. Promote Internal V2 as the main operator console only after staff completes multiple successful V2 operations.
6. Gradually retire V1/legacy only after several successful shifts and completed reconciliation.

Do not skip directly to primary route replacement without completing smoke testing, UI QA, rollback preparation, and owner approval.

## I. Rollback plan

If any go/no-go criterion fails or operations become unclear:

- Return customers/staff to V1/legacy URLs.
- Pause use and sharing of V2 links.
- Do not delete or truncate D1.
- If any V2 orders were created, export CSV from D1 before rollback communication is closed.
- Review `orders_v2` and related order/item/event data for reconciliation.
- Do not modify historical Sheets data as part of rollback.
- Do not change `BOG_ACTIVE_ENV` without explicit approval.
- Record the rollback reason, affected time window, order ids/folios, and reconciliation owner.

Rollback success criteria:

- Staff confirms V1/legacy URLs are active and known.
- No new V2 links are being distributed.
- V2 D1 orders from the window are exported and assigned for reconciliation.
- Customers with in-flight V2 orders are handled manually by staff.

## J. Data reconciliation

V2 data reconciliation rules:

- D1 is the source of truth for V2 orders.
- CSV export is the manual reconciliation artifact.
- Sheets is not the source of truth for V2; it is a manual export/import destination.

Recommended comparison fields:

- `folio` for human-facing order lookup.
- `order_id` for stable system lookup.
- `status` for operational state.
- `payment_status` for declared payment state.
- `total` for financial/manual close comparison.
- `items_summary` for item-level sanity checks.

Manual reconciliation workflow:

1. Export V2 CSV from `GET /api/orders-v2-admin/export.csv` for the relevant window.
2. Filter by shift/date/order window.
3. Compare `folio`, `order_id`, `status`, `payment_status`, `total`, and `items_summary` against staff notes, manual payment records, and any manual Sheets import.
4. Resolve discrepancies in an operations log before declaring the window closed.
5. Keep D1 data intact even if the active customer/staff link rolls back to V1.

## K. Known limitations

- Payments are operator-declared only; no real charge/capture/refund is performed.
- WhatsApp is manual only; no WhatsApp API, provider integration, or automatic send exists.
- There is no automatic Sheets sync.
- Export/summary timezone behavior is still UTC/simple and not a full local timezone reporting layer.
- There is no multi-tenant or multi-branch/sucursal model yet.
- Internal auth is preview-oriented admin token/sessionStorage handling.
- There is no automatic inventory decrement or stock management.

## L. Go/no-go checklist

Do not proceed beyond the selected cutover option unless all applicable items are complete:

- [ ] Builds pass.
- [ ] Deploys are successful for the target preview/pre-production projects.
- [ ] Smoke API checks pass.
- [ ] Manual UI QA passes.
- [ ] Rollback owner, timing, and URLs are ready.
- [ ] Operational responsible parties are defined for public orders, kitchen/internal ops, payments, WhatsApp, close, and reconciliation.
- [ ] Public and internal links are confirmed.
- [ ] Required tokens/secrets are confirmed without exposing real values.
- [ ] D1 backup/export is taken before higher-risk traffic movement.
- [ ] Legacy routes/apps remain untouched.
- [ ] `BOG_ACTIVE_ENV` remains unchanged unless an explicit approval record exists.
