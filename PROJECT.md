# Project: Catalog and Kitchen Weaknesses Fixes

## Architecture
- **apps/internal-chekeo-v2**: Internal restaurant system. Displays incoming kitchen orders and uses `getKitchenItemKind` to classify items when they don't have a kind.
- **functions/api**: Cloudflare Worker Pages functions.
  - `/api/menu-v2`: Public menu API. Fetches active banners.
  - `/api/menu-v2-admin/catalog-banners`: Admin endpoint. Handles GET to list all banners (active and inactive) for admin panel catalog management.
- **apps/public-order-v2**: Public customer ordering app. Includes checkout drawer with phone validation/normalization.

## Code Layout
- `apps/internal-chekeo-v2/src/components/kitchen/kitchen-helpers.ts` (Kitchen Helper functions)
- `apps/internal-chekeo-v2/src/components/CatalogAdminPanel.tsx` (Admin panel view for Catalog)
- `functions/api/menu-v2.ts` (Public menu API handler)
- `functions/api/menu-v2-admin/catalog-banners.ts` (Admin banners API handler)
- `apps/public-order-v2/src/components/CatalogCheckoutDrawer.tsx` (Customer Checkout drawer UI)
- `apps/public-order-v2/src/components/PublicOrderApp.tsx` (Customer ordering main app / context)

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | E2E Testing Track | Create opaque-box E2E test cases covering all 3 requirements, write `TEST_INFRA.md` and publish `TEST_READY.md`. | None | DONE |
| 2 | Kitchen Item Kind Fallback | Fix fallback classification in `kitchen-helpers.ts` for items without `itemKind`. | M1 | DONE |
| 3 | Catalog Banners API & Panel | Add SQL filter to public API, create Admin GET endpoint, and update Admin Panel to fetch all banners. | M1 | DONE |
| 4 | Phone Normalization | Enhance `normalizePhoneDigits` in Checkout and PublicOrderApp to strip "+52" prefix when digit count is 12. | M1 | DONE |
| 5 | E2E Verification & Hardening | Verify all tests pass, run Forensic Audit, and perform adversarial coverage hardening. | M2, M3, M4 | IN_PROGRESS |

## Interface Contracts
### Catalog Banners Admin API
- **Endpoint**: GET `/api/menu-v2-admin/catalog-banners`
- **Headers**: Admin credentials (authorization token checked by `requireAdminToken(request, env)`)
- **Success Response**: `200 OK`
  ```json
  {
    "ok": true,
    "banners": [
      {
        "id": number,
        "title": string,
        "subtitle": string,
        "cta_label": string,
        "image_key": string,
        "image_url": string,
        "is_active": number (0 or 1),
        "sort_order": number,
        "updated_at": string
      }
    ]
  }
  ```
- **Error Responses**:
  - `401 Unauthorized` / `403 Forbidden` (invalid admin token)
  - `503 Service Unavailable` (database disabled/not configured)
  - `500 Internal Server Error` (database query failed)
