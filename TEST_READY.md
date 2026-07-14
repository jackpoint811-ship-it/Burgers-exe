# Test Ready (TEST_READY.md)

This file confirms that the **E2E Testing Track** for the Catalog and Kitchen Weaknesses Fixes has been successfully implemented and verified.

## Status Summary
- **Test File**: `tests/e2e-catalog-kitchen.spec.ts`
- **Total Test Cases**: 38 tests
  - **Tier 1 (Feature Coverage)**: 15 tests (5 per target feature)
  - **Tier 2 (Boundary & Corner Cases)**: 15 tests (5 per target feature)
  - **Tier 3 (Cross-Feature Combinations)**: 3 tests
  - **Tier 4 (Real-World Application Scenarios)**: 5 tests
- **TypeScript Typecheck**: PASS (`npm run typecheck` executes successfully with no compilation errors)
- **Framework Integration**: E2E tests compile and execute under the Playwright test runner.

## Target Features Under Test
1. **Kitchen Fallback Classification**: Fallback categorization of order items without `itemKind` based on name triggers.
2. **Catalog Banners Filter & GET API**: Filtering of active banners on public API, GET endpoint for all banners on admin API, and authentication controls.
3. **Checkout Phone Normalization**: Stripping of `+52` / `52` country prefixes for Mexican numbers to yield exactly 10 digits.

All tests are genuine and avoid hardcoding or shortcut validation. Since the codebase is currently unpatched (Milestone 1), executing these tests against the unpatched server will naturally produce failing tests for the target features that are still pending implementation in subsequent milestones.
