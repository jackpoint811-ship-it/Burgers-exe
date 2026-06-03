# Chekeo V2 catalog availability QA

Short QA for operating `menu_items.is_available` from Chekeo V2 without Cloudflare console or manual SQL.

## Scope

- Chekeo V2 > Catálogo > Productos can mark each menu item as **Disponible** or **Agotado**.
- The quick control writes to D1 through `/api/menu-v2-admin/items/:sku/availability`.
- `/api/menu-v2` reads the updated D1 value and returns `isAvailable` without redeploy.
- Public Order V2 disables sold-out products and rejects checkout if a cart item became unavailable after the menu loaded.

## Manual QA

1. Open Chekeo V2 and go to **Catálogo > Productos**.
2. Confirm products are grouped as `burgers`, `guarniciones`, `extras`, and `drinks` when those categories exist.
3. Find SKU `OG` and tap **Agotado**.
4. Validate the public API:
   ```sh
   curl -s https://burgers-exe.pages.dev/api/menu-v2 | jq '.items[] | select(.sku=="OG") | {sku,isAvailable}'
   ```
   Expected: `{ "sku": "OG", "isAvailable": false }`.
5. Open Public Order V2 and confirm `OG` appears as **Agotado** or cannot be selected for a new order.
6. If a user already had `OG` in cart before it was marked sold out, submitting checkout must fail with `ITEM_UNAVAILABLE` or the clear unavailable-product message.
7. Return to Chekeo V2, tap **Disponible** for `OG`.
8. Repeat the curl command. Expected: `{ "sku": "OG", "isAvailable": true }`.
9. Reload/open Public Order V2 and confirm `OG` can be ordered again.

## Regression checks

Run before merge:

```sh
npm run typecheck
npm run build:internal
npm run build:public
git diff --check
```
