# Public Order V2 live menu QA

## Scope

Public Order V2 must read the production menu from Cloudflare D1 through `GET /api/menu-v2` using the `BOG_MENU_DB` binding. The emergency fallback catalog remains available only when D1 or the required `menu_items` query fails.

Optional D1 tables such as `promo_cards` and `site_config` are not required for the public catalog smoke test. If either optional table is missing, `/api/menu-v2` should still return `source: "d1"`, an empty `promos` array, and safe default `siteConfig` values.

## Curl smoke test

After deploy, run:

```bash
curl -s https://burgers-exe.pages.dev/api/menu-v2 | python3 -m json.tool
```

Expected minimum response:

- `source` is `"d1"`.
- `items` includes the live SKUs `OG`, `BBQ`, `PAPAS_OG`, `PAPAS_ESPECIALES`, `PAPAS_LEMON_PEPPER`, `AROS_CEBOLLA`, `EXTRA_PEPINILLOS`, `EXTRA_QUESO_AMERICANO`, `EXTRA_QUESO_MANCHEGO`, `EXTRA_TOCINO`, `EXTRA_CATSUP`, `EXTRA_MOSTAZA`, and `EXTRA_TOMATE`.
- Prices are returned in pesos: burgers at `85`, guarniciones at `20`, `25`, `25`, `30`, and extras at `5`.
- The active catalog no longer includes mock SKUs `BRG-OG`, `BRG-SPICY`, `EXT-BACON`, or `GUA-FRIES`.

Quick assertion command:

```bash
curl -s https://burgers-exe.pages.dev/api/menu-v2 | python3 -c 'import json,sys; data=json.load(sys.stdin); skus={item["sku"] for item in data["items"]}; required={"OG","BBQ","PAPAS_OG","PAPAS_ESPECIALES","PAPAS_LEMON_PEPPER","AROS_CEBOLLA","EXTRA_TOCINO"}; forbidden={"BRG-OG","BRG-SPICY","EXT-BACON","GUA-FRIES"}; assert data["source"]=="d1", data["source"]; assert required <= skus, required-skus; assert not (forbidden & skus), forbidden & skus; print("OK", data["source"], sorted(required))'
```

## Visual QA

1. Open `https://burgers-exe.pages.dev/` on a mobile viewport first.
2. Confirm the menu renders `OG` and `BBQ` in Hamburguesas.
3. Confirm Guarniciones renders `Papas a la francesa OG`, `Papas a la francesa Especiales`, `Papas a la francesa Lemon&Pepper`, and `Aros de Cebolla`.
4. Start a quest, choose a burger, and verify extras can be added more than once through the quantity controls.
5. Continue to Side Quest and verify the same guarnición can be added with quantity greater than one.
6. Continue to checkout only for UI validation. Do not enable real order writes unless a separate rollout explicitly changes the write flag.

## R2 image QA

After the R2 production bucket `burgers-exe-menu-assets` is populated and bound as `BOG_MENU_ASSETS`, validate catalog images without changing order-write flags:

1. Confirm `/api/menu-v2` returns `imageKey` for live D1 items:

   ```bash
   curl -s https://burgers-exe.pages.dev/api/menu-v2 | python3 -c 'import json,sys; data=json.load(sys.stdin); og=next(item for item in data["items"] if item["sku"]=="OG"); assert data["source"]=="d1", data["source"]; assert og.get("imageKey")=="menu/OG.png", og; print("OK", og["sku"], og["imageKey"])'
   ```

2. Confirm the UI tries to load the same-origin R2 proxy URL `/api/assets-v2/menu/OG.png` for `OG` in DevTools Network.
3. Confirm a missing but valid object key returns `404` and the product card keeps its neon placeholder instead of breaking layout.
4. Confirm a `320px` mobile viewport has no horizontal overflow in the product grid, promo rail, product detail dialog, or sticky CTA.
5. Do not change `BOG_ACTIVE_ENV`, do not enable real order writes, and do not delete legacy data during image QA.

## Order write gate QA

`POST /api/orders-v2` is fail-closed for real order writes. Keep `BOG_MENU_DB` bound so the endpoint can return `503 MISSING_DB` only when the database binding itself is missing. With the D1 binding present:

- `ORDERS_V2_WRITE_ENABLED=false` must return `403 ORDERING_DISABLED`.
- `ORDERS_V2_WRITE_ENABLED` absent must return `403 ORDERING_DISABLED`.
- Only `ORDERS_V2_WRITE_ENABLED=true` can create a real order after payload, catalog, pricing, and insert validation pass.

Disabled smoke test:

```bash
curl -i -X POST "$PUBLIC_ORDER_ORIGIN/api/orders-v2" \
  -H 'content-type: application/json' \
  -H 'idempotency-key: qa-orders-v2-disabled' \
  --data '{"customer":{"name":"QA Disabled","phone":"5512345678"},"orderMode":"pickup","paymentMethod":"cash","items":[{"sku":"OG","qty":1}]}'
```

Expected response: HTTP `403` with error code `ORDERING_DISABLED` when `ORDERS_V2_WRITE_ENABLED=false` or when the variable is not configured.

Enabled smoke test for controlled cutover only:

```bash
curl -i -X POST "$PUBLIC_ORDER_ORIGIN/api/orders-v2" \
  -H 'content-type: application/json' \
  -H 'idempotency-key: qa-orders-v2-enabled' \
  --data '{"customer":{"name":"QA Enabled","phone":"5512345678"},"orderMode":"pickup","paymentMethod":"cash","items":[{"sku":"OG","qty":1}]}'
```

Expected response: HTTP `201` and an order summary only when `ORDERS_V2_WRITE_ENABLED=true`. Do not enable this flag in Cloudflare during routine live-menu, R2, or visual QA.
