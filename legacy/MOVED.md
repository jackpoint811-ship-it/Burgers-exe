# Fase 5 move ledger

Date: 2026-07-02

Fase 5 moved clear legacy material into quarantine with `git mv`. No runtime app, active Function, package, migration, seed, secret, D1, R2, or deploy artifact was intentionally changed.

## Moved

| From | To | Reason |
| --- | --- | --- |
| `cloudflare/public-order/` | `legacy/cloudflare/public-order/` | Deprecated public order Cloudflare surface with legacy `/api/order`, assets, and live-risk Wrangler config. |
| `cloudflare/internal-chekeo/` | `legacy/cloudflare/internal-chekeo/` | Deprecated internal Chekeo Cloudflare surface with legacy `/api/rpc`/Apps Script RPC flow. |
| `cloudflare/tickets/` | `legacy/cloudflare/tickets/` | Historical tickets surface, outside official V2 apps. |
| Root `Code.gs`, `appsscript.json`, `backend_*.gs`, `menu_live_service.gs`, `setup_chekeo_2_sheets.gs`, `Index.html`, `scripts.html`, `styles.html` | `legacy/apps-script/` | Google Apps Script / Sheets-era runtime files, not official V2 source of truth. |
| `planning/` | `legacy/planning/` | Historical planning docs outside active repo docs. |
| Selected historical docs | `legacy/docs/` | Sheets, Apps Script, Cloudflare legacy, normalized API, mobile-first legacy, and research docs. |
| `skills/ui-ux-pro-max/` | `legacy/skills/ui-ux-pro-max/` | Incomplete skill mirror without `SKILL.md`; valid skill remains under `.agents/skills/ui-ux-pro-max`. |

## Not moved

| Path | Reason |
| --- | --- |
| `apps/` | Official V2 apps. |
| `functions/api/` | Active V2 backend. |
| `functions/api/referral-tickets.ts` | Active Function location; requires separate review before any move/delete. |
| `packages/` | Active shared code. |
| `migrations/` | Active D1 migration history. |
| `tests/` | Active QA. |
| `tools/` | Active Codex/local tooling. |
| `docs/assets/chekeo-phase-*` | Still referenced by active test `tests/internal-chekeo/kitchen-screenshots.spec.ts`; requires separate reference cleanup before moving. |
| `package.json` | Left unchanged; legacy `public-order:*` scripts remain prohibited/risk and should be removed or rewritten only in a separate approved phase. |
