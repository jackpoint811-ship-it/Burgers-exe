# Controlled production launch - 2026-07-06

## Status

Completed after retry.

The first production D1 read-only preflight attempt was blocked by Cloudflare `Authentication error [code: 10000]`. A later retry of the same read-only gate succeeded, so deploy proceeded only after D1 live schema/counts, builds and production HTTP smoke passed.

## User authorization

Literal authorization received:

```text
Autorizo lanzamiento controlado a produccion de Burgers.exe.
Autorizo deploy a los proyectos production: burgers-exe y chekeo2-0.
No autorizo D1/R2 writes, secrets, bindings, migrations ni seeds sin pedir nueva confirmacion.
```

Authorized:

- Local preflight.
- Production read-only preflight.
- Builds for Public V2 and Internal Chekeo V2.
- Production Pages deploy only to `burgers-exe` and `chekeo2-0`, if preflight passed.
- Production read-only smoke.
- Documentation, commit, push and PR.

This authorization was consumed only for the production launch documented here. It must not be reused for future production deploys, failed deploy retries, or any later production operation.

Not authorized and not executed:

- D1 writes.
- R2 writes.
- Migrations.
- Seeds.
- Secret puts.
- Binding changes.
- Pages settings changes.
- PIN usage.
- Real orders.
- Live data modification.

## Local preflight

| Check | Result |
| --- | --- |
| `verify-local-tooling.ps1` | OK |
| `verify-skills.ps1` | OK |
| `npm run typecheck` | OK |
| `npm run build:public` | OK |
| `npm run build:internal` | OK, with existing Vite chunk-size warning |

## Production read-only preflight

| Command | Result |
| --- | --- |
| `npx wrangler whoami` | OK; session exists, token has broad permissions |
| `npx wrangler d1 list` | First attempt failed with Cloudflare `Authentication error [code: 10000]`; retry OK |
| `npx wrangler d1 execute burgers-exe-menu-live --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"` | First attempt failed with Cloudflare `Authentication error [code: 10000]`; retry OK |
| `SELECT COUNT(*) AS menu_items FROM menu_items;` | `15`, `changed_db=false`, `rows_written=0` |
| `SELECT COUNT(*) AS menu_categories FROM menu_categories;` | `4`, `changed_db=false`, `rows_written=0` |
| `SELECT COUNT(*) AS promo_cards FROM promo_cards;` | `0`, `changed_db=false`, `rows_written=0` |
| `SELECT COUNT(*) AS raffle_campaigns FROM raffle_campaigns_v2;` | `2`, `changed_db=false`, `rows_written=0` |

Live D1 schema and required counts were verified read-only before deploy.

## Production HTTP smoke before deploy

These checks were read-only and did not use PINs or submit forms.

| Target | Result |
| --- | --- |
| `https://burgers-exe.pages.dev` | `200 OK` |
| `https://burgers-exe.pages.dev/api/menu-v2` | `200 OK`, `source=d1`, `items=15`, `categories=4` |
| `https://chekeo2-0.pages.dev` | `200 OK` |
| `https://chekeo2-0.pages.dev/api/internal-v2-auth/status` | `200 OK`, `authenticated=false` |

## Deploy

Executed after the retry gate passed.

Commands executed:

```powershell
npx wrangler pages deploy dist/public-order-v2 --project-name burgers-exe
npx wrangler pages deploy dist/internal-chekeo-v2 --project-name chekeo2-0
```

Results:

- Public production project `burgers-exe`: deployment complete, deployment URL `https://92ebc252.burgers-exe.pages.dev`, alias `https://ops-controlled-production-la.burgers-exe.pages.dev`.
- Internal production project `chekeo2-0`: deployment complete, deployment URL `https://05f5003a.chekeo2-0.pages.dev`, alias `https://ops-controlled-production-la.chekeo2-0.pages.dev`.
- No `--branch` flag was used.
- Wrangler warned that local `wrangler.toml` lacks `pages_build_output_dir`; Wrangler ignored that config and proceeded with the explicit project deploy.

## Post-deploy smoke

| Target | Result |
| --- | --- |
| `https://burgers-exe.pages.dev` | `200 OK` |
| `https://burgers-exe.pages.dev/api/menu-v2` | `200 OK`, `source=d1`, `items=15`, `categories=4` |
| `https://chekeo2-0.pages.dev` | `200 OK` |
| `https://chekeo2-0.pages.dev/api/internal-v2-auth/status` | `200 OK`, `authenticated=false` |

Playwright production read-only:

- Command: `npx playwright test tests/production/controlled-production-smoke.spec.ts --workers=1 --reporter=list`
- Result: `2 passed`.
- Guard read-only: no `POST`, `PUT`, `PATCH` or `DELETE` requests were sent.
- No PIN was used.
- No forms were submitted.

Evidence:

- `docs/operations/production-launch-2026-07-06/public-production-desktop-1440.png`
- `docs/operations/production-launch-2026-07-06/public-production-mobile-390.png`
- `docs/operations/production-launch-2026-07-06/public-production-result.json`
- `docs/operations/production-launch-2026-07-06/internal-production-desktop-1440.png`
- `docs/operations/production-launch-2026-07-06/internal-production-mobile-390.png`
- `docs/operations/production-launch-2026-07-06/internal-production-result.json`

## Assets

Preview Fase 9A had already detected 404s for three preview assets:

- `api/assets-v2/raffles/details/raffle-peimer-gran-sorte-202606-20260603T153634Z.png`
- `api/assets-v2/raffles/banners/raffle-peimer-gran-sorte-202606-20260603T071818Z.png`
- `api/assets-v2/menu/combo-bbq-20260611T214022Z.png`

Production Playwright smoke did not detect asset 404s or other response issues. Preview asset follow-up remains a separate preview-environment risk if the team wants to clean preview parity.

## Rollback

No rollback was required because post-deploy smoke passed.

Recommended rollback if a later issue appears:

- Identify the last known-good Cloudflare Pages deployment for `burgers-exe` and `chekeo2-0`.
- Roll back only through Cloudflare Pages deployment controls.
- Do not mutate D1/R2, secrets, bindings, migrations or seeds without new explicit authorization.
- Run read-only smoke after rollback.

## Safety confirmations

- Production Pages deploy: executed only for `burgers-exe` and `chekeo2-0`.
- D1/R2 writes: none.
- Secrets/bindings: none changed.
- Migrations/seeds: none executed.
- PIN: not used.
- Real orders: none created.
- Forms: none submitted.
- The 2026-07-06 production deploy authorization was consumed by this launch and cannot be reused.

## Required next action

No immediate rollback or production fix is required by this launch evidence.

Remaining follow-up:

1. Decide whether to clean the preview-only asset 404s from Fase 9A.
2. Keep production D1/R2 writes, secrets, bindings, migrations and seeds gated behind new explicit authorization.
3. Keep all future production Pages deploys to `burgers-exe` or `chekeo2-0`, including retries after preflight/auth failures, gated behind new explicit authorization.
