# Test Infrastructure (TEST_INFRA.md)

This document outlines the testing philosophy, feature inventory, and execution guidelines for the E2E and integration tests of Burgers.exe.

---

## 1. Test Philosophy

Our testing strategy follows a **genuine behavioral validation** approach. We aim to test features as a user or administrator would experience them, ensuring the system maintains correct state, rejects malformed data, and behaves reliably under corner cases.

We avoid cheating or hardcoding verification responses. All mock APIs represent stateful, logical backends that mutate state genuinely. We test:
- **Feature Completeness (Tier 1)**: Core functionality is verified under positive conditions.
- **Resilience and Boundaries (Tier 2)**: The system is checked against invalid tokens, malformed phone formats, extreme input values, and database errors.
- **Cross-Feature Integrations (Tier 3)**: Features are tested together to guarantee that data flow remains consistent from order to kitchen.
- **Real-World Scenarios (Tier 4)**: End-to-end user journeys (authentication -> catalog configuration -> order checkout -> kitchen preparation) are verified.

---

## 2. Feature Inventory

We focus on two sets of features under test:

### A. Catalog & Kitchen Fixes Features
#### Feature A: Kitchen Fallback Classification
- **Description**: The internal kitchen dashboard (`apps/internal-chekeo-v2`) receives order items. When items lack an explicit `itemKind` category, the frontend must apply a smart fallback classification based on the item name.
- **Classifications**:
  - `combo`: Triggered by keywords like "combo", case-insensitively.
  - `garnish`: Triggered by keywords like "fries", "papas", "aros", "onion", "dedos", etc.
  - `drink`: Triggered by keywords like "refresco", "soda", "drink", "agua", "coca", "jugo", etc.
  - `other`: Triggered by keywords like "extra", "queso", "tocino", "aderezo", "topping", etc.
  - `burger`: The default fallback class if no keywords match.

#### Feature B: Catalog Banners Management & Filters
- **Description**: The marketing banner system for the new Catalog Mode.
- **Components**:
  - **Public Menu API (`/api/menu-v2`)**: Must filter out inactive banners and only return banners where `is_active = 1`.
  - **Admin Banners API (`/api/menu-v2-admin/catalog-banners`)**: Handles GET requests to list all banners (active and inactive) for admin panel catalog management. Requires valid admin token checking.
  - **Admin Panel View (`CatalogAdminPanel.tsx`)**: Displays all banners fetched from the admin banners endpoint.

#### Feature C: Checkout Phone Normalization
- **Description**: The customer checkout flow accepts Mexican phone numbers. Because customers enter various prefix formats (e.g., `+52 55...`, `52 55...`, `+5255...`, `5255...`), the system must normalize them to exactly 10 digits before validation and submission.
- **Rule**: If the digit-only count is 12 and begins with `52`, the `52` prefix must be stripped, leaving a 10-digit number. Non-Mexican numbers or malformed numbers must fail validation.

### B. Frontend Redesign Features
#### Feature 1: Slate/Indigo Palette & Styling (No Neon)
- **Description**: Modern commercial dark theme aesthetic using slate, charcoal, and indigo tones.
- **Constraints**: Eliminates screaming cyberpunk glowing fonts, text-shadow properties, and glowing green/amber borders.

#### Feature 2: Compact Card Grid
- **Description**: Reduces scroll height fatigue by transitioning the catalog list from large single-column layouts.
- **Layout Grid**: Uses 2 columns on mobile viewports (320px, 390px, 430px) and scales to 3 columns on tablet (768px) and 4 columns on desktop (1280px). Minimal gaps, card padding, and smaller image aspect ratios are enforced.

#### Feature 3: WCAG 2.2 AA Drawer Accessibility
- **Description**: Robust focus management across drawers (Product customization, Cart, and Checkout).
- **Behavior**: Traps focus internally, closes on Escape key, restores focus to the triggering element on close, displays clear keyboard focus rings, and disables animations when `prefers-reduced-motion` is set.

#### Feature 4: Viewports & Touch Target Sizing
- **Description**: Layout compliance and tactile target validation for mobile ergonomics.
- **Rules**: Zero horizontal scroll overflow across viewports (320px to 1280px), minimum 44x44px touch target sizes for all interactive targets (links, quantity counters, category tabs, and close buttons), and margins to handle virtual keyboard overlay.

#### Feature 5: Checkout Form & Inline Validation
- **Description**: Interactive checkout form status feedback and keyboard guidance.
- **Rules**: Styled interactive states (default, hover, focus, disabled, loading). Displays inline errors associated via `aria-describedby` and `aria-invalid="true"`. Focus is redirected to the first invalid field upon validation failure, and keyboard focus shifts to the header on success.

---

## 3. Test Coverage Thresholds

### Catalog & Kitchen Fixes Suite (38 tests)
| Tier | Description | Minimum Tests | Focus Area |
|---|---|---|---|
| **Tier 1** | Feature Coverage | 15 | Positive test cases covering core behaviors for all 3 features. |
| **Tier 2** | Boundary & Corner Cases | 15 | SQL injection, empty values, invalid tokens, extreme phone formats. |
| **Tier 3** | Cross-Feature Combinations | 3 | Flow verification across multiple subsystems. |
| **Tier 4** | Real-World Scenarios | 5 | End-to-end customer and admin workflows. |

### Frontend Redesign Suite (60 tests)
| Tier | Description | Minimum Tests | Focus Area |
|---|---|---|---|
| **Tier 1** | Feature Coverage | 25 | Positive test cases covering core redesign behaviors (5 tests per feature). |
| **Tier 2** | Boundary & Corner Cases | 30 | Boundary and interactive states validation (6 tests per feature). |
| **Tier 4** | Real-World Scenarios / Journeys | 5 | End-to-end customer checkout and state recovery. |

---

## 4. Methodology & Command Reference

### Test Setup
Tests run in a Node environment leveraging Playwright. API mocks are registered via `page.route` to mock D1 database behavior dynamically during browser execution, ensuring clean state separation.

### Commands

To verify TypeScript compilation:
```bash
npm run typecheck
```

To execute the original E2E test suite under the Public Order configuration:
```bash
npx playwright test tests/e2e-catalog-kitchen.spec.ts --config=playwright.visual.config.ts
```

To execute the original E2E test suite under the Kitchen Board configuration:
```bash
npx playwright test tests/e2e-catalog-kitchen.spec.ts --config=playwright.internal-kitchen.config.ts
```

To execute the Frontend Redesign E2E test suite:
```bash
npx playwright test tests/redesign-e2e.spec.ts --config=playwright.e2e.config.ts
```
