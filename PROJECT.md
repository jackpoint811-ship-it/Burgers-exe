# Project: Burgers.exe Frontend Redesign

## Architecture
- **apps/public-order-v2**: Main frontend application built in React/TypeScript.
  - `styles.css`: Stylesheet containing all color tokens, tailwind configurations, utility overrides.
  - `components/PublicOrderApp.tsx`: Top-level app component managing layout wrapper, routes, and overall context.
  - `components/CatalogModeApp.tsx`: Grid-based product catalog display and category navigation.
  - `components/CatalogBannerRail.tsx`: Banners carousel.
  - `components/CatalogProductDrawer.tsx`: Detail drawer for item customization and ordering.
  - `components/CatalogCartDrawer.tsx`: Side cart summary drawer.
  - `components/CatalogCheckoutDrawer.tsx`: Side checkout drawer containing fields, address, WhatsApp opt-in, same-day logic, and deposit calculator.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | E2E Testing Track | Design and build E2E test suite (Tiers 1-4) checking styling, grid layouts, accessibility, interactive states, and inline validation. Publish `TEST_READY.md`. | None | DONE |
| 2 | Style Setup & Palette Migration | Replace cyberpunk neon/glow design with a slate/charcoal/indigo minimalist color scheme in `styles.css` and custom components. | M1 | DONE |
| 3 | Compact Multi-Column Catalog Layout | Implement mobile 2-col, desktop 3-4-col grid, and reduce card padding/margins. Touch target >= 44x44px. | M2 | IN_PROGRESS |
| 4 | WCAG 2.2 AA Drawer Accessibility | Implement focus trap, visible focus rings, Esc close, return focus on exit in drawers. | M3 | PLANNED |
| 5 | Interactive States & Checkout Validation | Implement full state styles and inline validation with aria descriptors in Checkout. | M4 | PLANNED |
| 6 | E2E Verification & Adversarial Hardening | E2E test suite pass, Forensic Audit, Tier 5 white-box adversarial coverage testing. | M5 | PLANNED |

## Interface Contracts
### Focus Return Contract
- Any button or element triggering a drawer MUST pass or have a stable selector/id.
- Upon drawer closing, the drawer MUST programmatically focus the triggering element back to restore tab flow.

### Form Validation Contract
- Checkout form inputs MUST render errors inline using `<span id="[input-name]-error" role="alert">...</span>`
- Inputs MUST link to their error messages via `aria-describedby="[input-name]-error"` and set `aria-invalid="true"` when errors are present.
