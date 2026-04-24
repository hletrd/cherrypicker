# Test Engineer — Cycle 2 Deep Review (2026-04-24)

Reviewed test coverage, test quality, flaky tests, and TDD opportunities.

## New Findings

### C2-T01: No test for `buildCategoryNamesKo` function added in cycle 1
- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/rules/src/category-names.ts` (no corresponding test file)
- **Description:** The `buildCategoryNamesKo()` function was added in cycle 1 as part of A1-01, but no unit test was created for it. The function converts a `CategoryNode[]` tree into a flat `Record<string, string>`. It should be tested to ensure: (1) parent categories are included, (2) subcategories use dot-notation keys, (3) empty input returns `{}`, (4) deeply nested structures are handled.
- **Fix:** Add `packages/rules/__tests__/category-names.test.ts` with the above test cases.

### C2-T02: `FALLBACK_CATEGORY_LABELS` has no coverage — no test verifying it matches taxonomy
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/category-labels.ts:32-111`
- **Description:** The 77-entry fallback map has no automated test ensuring it stays in sync with `categories.yaml`. A test should verify that every category ID in the taxonomy has a corresponding entry in the fallback map.
- **Fix:** Add a test in `apps/web/__tests__/` that loads `categories.json` and verifies all IDs are present in `FALLBACK_CATEGORY_LABELS`.

## Previously Known

D-36 (no unit tests for web-side XLSX parser), D-37 (E2E uses waitForTimeout), T1-01/T1-02 (cycle 1 test tasks) — all acknowledged and deferred.
