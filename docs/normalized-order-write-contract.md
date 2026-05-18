# Normalized Public Order Write Contract (Phase 3A)

## Scope
`createPublicOrder` (Apps Script action called by Cloudflare `/api/order`) now writes public orders into normalized sheets instead of `Pedidos Master`.

## Payload assumptions
Apps Script expects the same public payload shape already sent by Cloudflare:
- `customerName` (required)
- `phone` (required)
- `location` (required, allowed: `Torre GGA`, `Torre Valcob`)
- `paymentMethod` (required, allowed: `Pago mismo dia`, `Pagar Antes`)
- `items` (required non-empty array)
  - each item requires `sku` and positive integer `qty`
- `total` (required numeric, `>= 0`)
- `personalizations` optional, but when present `personalizations.burgers` must be an array with valid burger references

## Normalized target sheets
The writer appends by header contract (never fixed index):
- `PEDIDOS`
- `PEDIDO_ITEMS`
- `PEDIDO_BURGERS`
- `GUARNICIONES`
- `EVENTOS_PEDIDO`

All required headers must exist; otherwise write fails.

## Defaults and status
- PEDIDOS
  - `canal = "Burgers.exe"`
  - `estado = "Nuevo"`
  - `origen_app = "public-order-cloudflare"`
- GUARNICIONES
  - one row per guarnición item with qty > 0
  - `estado_guarnicion = "Pendiente"`
- PEDIDO_BURGERS
  - one row per burger unit (`OG`/`BBQ`)
  - if personalization is absent for a unit, default values are:
    - `extras_json = []`
    - `sin_ingredientes_json = []`
    - `comentarios = ""`

## Price allocation behavior
- Cloudflare `payload.total` is accepted as order-level source of truth.
- Item unit/subtotal values are enriched from `MENU_LIVE` when available.
- Missing `MENU_LIVE` metadata does not block writes; fallback uses `precio_unitario = 0` with warning events.
- If sum of item subtotals differs from `payload.total`, order is still accepted and mismatch is logged as event.

## Events written
Always writes:
- `PEDIDO_CREADO` with detail containing source, total, item count, and warnings.

Conditionally writes:
- `TOTAL_METADATA_MISMATCH` when metadata subtotal sum != payload total.
