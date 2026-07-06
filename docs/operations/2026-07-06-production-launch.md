# Controlled production launch - 2026-07-06

## Status

Blocked before deploy. No production deploy was executed.

Reason: production D1 read-only preflight could not verify `burgers-exe-menu-live` because Wrangler D1 API calls failed with Cloudflare `Authentication error [code: 10000]`.

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
| `npx wrangler d1 list` | Failed: Cloudflare `Authentication error [code: 10000]` |
| `npx wrangler d1 execute burgers-exe-menu-live --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"` | Failed: Cloudflare `Authentication error [code: 10000]` |

Because D1 live could not be verified directly, the launch gate did not pass.

## Production HTTP smoke before deploy

These checks were read-only and did not use PINs or submit forms.

| Target | Result |
| --- | --- |
| `https://burgers-exe.pages.dev` | `200 OK` |
| `https://burgers-exe.pages.dev/api/menu-v2` | `200 OK`, `source=d1`, `items=15`, `categories=4` |
| `https://chekeo2-0.pages.dev` | `200 OK` |
| `https://chekeo2-0.pages.dev/api/internal-v2-auth/status` | `200 OK`, `authenticated=false` |

## Deploy

Not executed.

The following authorized deploy commands were intentionally skipped because production D1 read-only preflight failed:

```powershell
npx wrangler pages deploy dist/public-order-v2 --project-name burgers-exe
npx wrangler pages deploy dist/internal-chekeo-v2 --project-name chekeo2-0
```

## Post-deploy smoke

Not executed because no deploy was executed.

## Assets

Preview Fase 9A had already detected 404s for three preview assets:

- `api/assets-v2/raffles/details/raffle-peimer-gran-sorte-202606-20260603T153634Z.png`
- `api/assets-v2/raffles/banners/raffle-peimer-gran-sorte-202606-20260603T071818Z.png`
- `api/assets-v2/menu/combo-bbq-20260611T214022Z.png`

Production HTTP smoke did not inspect asset URLs in this blocked attempt. Asset follow-up remains a risk before a future go/no-go if the team classifies these as visual blockers.

## Rollback

No rollback was required because no production deploy was executed.

For a future successful deploy, recommended rollback remains:

- Identify the last known-good Cloudflare Pages deployment for `burgers-exe` and `chekeo2-0`.
- Roll back only through Cloudflare Pages deployment controls.
- Do not mutate D1/R2, secrets, bindings, migrations or seeds without new explicit authorization.
- Run read-only smoke after rollback.

## Safety confirmations

- Production Pages deploy: not executed.
- D1/R2 writes: none.
- Secrets/bindings: none changed.
- Migrations/seeds: none executed.
- PIN: not used.
- Real orders: none created.
- Forms: none submitted.

## Required next action

Before retrying production deploy:

1. Resolve Wrangler D1 API authentication for read-only commands.
2. Re-run `npx wrangler d1 list`.
3. Re-run D1 live schema and count checks against `burgers-exe-menu-live`.
4. Only if D1 read-only preflight passes, re-enter the deploy gate for `burgers-exe` and `chekeo2-0`.
