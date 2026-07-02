# Legacy quarantine

This folder contains historical Burgers.exe material preserved for audit, rollback reference, or future cleanup phases.

It is not part of the official V2 runtime.

Official active surfaces:

- Public V2: `apps/public-order-v2`
- Internal Chekeo V2: `apps/internal-chekeo-v2`
- Active backend: `functions/api/*`
- Active data source: Cloudflare D1
- Active asset source: Cloudflare R2

## Quarantine rules

- Do not build new features here.
- Do not deploy from here without explicit approval.
- Do not run legacy Cloudflare configs against live resources without explicit approval.
- Do not copy secrets, `.dev.vars`, `.wrangler/`, or local config into this folder.
- Do not delete legacy files without a separate approved cleanup phase.

## Current structure

- `legacy/apps-script/`: root Google Apps Script and Sheets-era HTML files moved in Fase 5.
- `legacy/cloudflare/`: deprecated Cloudflare public order, internal Chekeo, and ticket surfaces moved in Fase 5.
- `legacy/docs/`: selected historical docs moved in Fase 5.
- `legacy/planning/`: historical planning docs moved in Fase 5.
- `legacy/skills/`: incomplete local skill mirrors moved in Fase 5.

For the move ledger, see `legacy/MOVED.md`.
