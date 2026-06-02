# Burgers.exe V2 deprecated cleanup plan

This document is a future cleanup plan only. It does not authorize immediate deletion, variable removal, migration, schema change, binding change, secret change, or code change.

Official production is already cut over to V2:

* Public: https://burgers-exe.pages.dev
* Chekeo: https://chekeo2-0.pages.dev
* Source of truth: Cloudflare D1 for orders, catalog, and raffles
* Assets: Cloudflare R2
* Internal auth: PIN-only with an HttpOnly session cookie

Legacy, Apps Script, Google Sheets sync, and old Cloudflare folders remain preserved for rollback and historical reference until explicitly approved for removal.

## 1. Variables and secrets to review in Cloudflare

Review the following Cloudflare Pages variables/secrets manually before any future cleanup:

* Apps Script / Google Sheets related secrets.
* Old admin token variables.
* `BOG_ORDERS_ADMIN_TOKEN`.
* `BOG_MENU_ADMIN_TOKEN`.
* Old `INTERNAL_PANEL_PIN`, if present.

Do not remove these just because they appear deprecated in the repository. Confirm actual Cloudflare project usage, recent production traffic, audit logs, and rollback requirements first.

## 2. Minimum real-operation hold period

Do not remove deprecated Apps Script, Google Sheets, or old admin-token variables until the V2 production flow has completed at least 3–7 real operating turns without needing legacy rollback.

The hold period should include real public ordering, Chekeo order handling, catalog/image operation when relevant, raffles when active, and closing workflows.

## 3. Public official variable expectations

The official Public V2 deployment does not require:

* `BOG_INTERNAL_PIN`.
* Admin tokens.
* Apps Script secrets.

Public V2 should rely on the V2 Cloudflare data path and must not depend on Apps Script or Google Sheets as the source of truth.

## 4. Chekeo official variable expectations

The official Chekeo V2 deployment requires:

* `BOG_INTERNAL_PIN`.
* `BOG_MENU_DB`.
* `BOG_ASSETS_BUCKET`.

These are part of the active V2 operational path and should not be removed during deprecated legacy cleanup.

## 5. Chekeo official variables no longer expected

The official Chekeo V2 deployment does not require:

* `BOG_ORDERS_ADMIN_TOKEN`.
* `BOG_MENU_ADMIN_TOKEN`.
* Authorization Bearer.
* Apps Script secrets.

If any of these remain configured, treat them as candidates for review, not automatic removal.

## 6. Controlled manual cleanup procedure

Future cleanup must be manual and performed in a controlled maintenance window.

Before cleanup:

* Confirm `docs/v2-official-cutover.md` still reflects the current production state.
* Confirm Public official and Chekeo official are healthy.
* Export or document current Cloudflare variables/secrets metadata according to the team's secret-handling policy.
* Confirm the preview V2 backup remains accessible.
* Confirm the rollback owner and rollback steps.

During cleanup:

* Remove only one variable group at a time.
* Avoid changing bindings, `BOG_ACTIVE_ENV`, D1 schema, R2 schema, or application code.
* Smoke test Public official and Chekeo official after each variable group.

Rollback:

* Restore the removed variable/secrets group from the approved backup record.
* Re-run the production smoke test.
* Document the failure, timestamp, affected project, and restored values metadata without exposing secret values.

## 7. Explicit non-goals

This cleanup plan does not include:

* Deleting legacy code.
* Editing Apps Script `.gs` files.
* Editing Google Sheets sync code.
* Changing frontend or backend V2 behavior.
* Changing bindings, secrets, migrations, D1 schema, R2 schema, payments, WhatsApp API, auth, or business rules.
