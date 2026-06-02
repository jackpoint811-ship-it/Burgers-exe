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
