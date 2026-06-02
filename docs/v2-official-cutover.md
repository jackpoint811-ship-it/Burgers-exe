# Burgers.exe V2 official cutover

This document is the operational record for the official Burgers.exe V2 cutover. It defines the production URLs, source-of-truth systems, current official flows, deprecated legacy flows, rollback policy, and future cleanup policy.

## 1. Official status

Cutover is complete. Burgers.exe V2 is the official production flow for real orders.

### Official production URLs

- Public official: <https://burgers-exe.pages.dev>
- Chekeo official: <https://chekeo2-0.pages.dev>

### Backup

- Public V2 preview remains available as backup.
- Internal V2 preview remains available as backup.

The preview environments are retained for contingency and validation, not as the primary operational flow.

## 2. Source of truth

V2 production operations use Cloudflare D1 and R2 as the authoritative systems.

- Orders: D1 tables `orders_v2`, `order_items_v2`, and `order_events_v2`.
- Catalog: D1 menu tables.
- Raffles: D1 tables `raffle_campaigns_v2`, `raffle_referral_codes_v2`, and `raffle_referrals_v2`.
- Assets: R2 bucket binding `BOG_MENU_ASSETS`.
- Internal auth: `BOG_INTERNAL_PIN` with the HttpOnly session cookie `bog_internal_session`.

Google Sheets and Apps Script are no longer the operational source of truth for V2 production.

## 3. Official flow

### Public

The official public V2 flow is:

- Menu.
- Main Quest.
- Workbench.
- Side Quest.
- Final Loadout.
- Success.
- Tickets and referral code when an active raffle campaign exists.

### Chekeo

The official Internal Chekeo V2 flow is:

- PIN login.
- Orders.
- Kitchen.
- Payments and notes.
- Closing.
- Catalog.
- Raffles.
- Manual WhatsApp image generation.
- Logout.

## 4. Deprecated and non-official flows

The following flows are deprecated and are no longer official production flows:

- `legacy/**`.
- `cloudflare/public-order/**`.
- `cloudflare/internal-chekeo/**`.
- Apps Script.
- Google Sheets as the operational source of truth.
- Legacy `/api/order`.
- Legacy `/api/rpc`.
- Old admin tokens if they appear in historical documentation.

These flows and files are not deleted yet. They are preserved for rollback and historical reference until V2 completes 3–7 real operating shifts without incidents.

## 5. Rollback policy

If V2 fails during production operations:

- Do not delete D1 data.
- Do not modify `BOG_ACTIVE_ENV` without explicit authorization.
- Use preview or legacy only as a manual contingency.
- Document the incident before changing domains, bindings, or project configuration.
- Do not mix rollback work with code cleanup.

Rollback must be treated as an operational incident response, not as an opportunity to remove legacy code or rewrite the system.

## 6. Future cleanup policy

After 3–7 real operating shifts complete successfully without incidents:

- Review old Cloudflare variables.
- Review remaining Apps Script and Sheets dependencies.
- Mark legacy folders as archived/deprecated.
- Only then consider deleting code, in a separate PR with backup and explicit approval.

Cleanup must remain separate from the official cutover documentation and from any rollback action.
