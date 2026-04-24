# Cycle 10 — Test Engineer

Date: 2026-04-24

## Inventory of test files reviewed

- `apps/web/__tests__/` — formatter and analyzer adapter tests
- `packages/core/__tests__/` — core optimizer and categorizer tests
- `packages/rules/__tests__/` — schema validation tests
- `packages/parser/__tests__/` — parser tests (Bun)
- `e2e/` — Playwright E2E tests

## Test coverage assessment

### Existing coverage
- Core optimizer: Well-tested with multiple test cases covering caps, tiers, and edge cases.
- Categorizer: Tested with keyword matching, substring matching, and fuzzy matching.
- Rules schema: Thorough Zod schema validation tests including invalid inputs.
- Parsers: Covered by both unit tests and E2E upload flow tests.
- Web formatters: `formatWon`, `formatRate`, `buildPageUrl` tested.

### Coverage gaps (already tracked)
- C9-08: `buildCategoryLabelMap` edge cases (D-97 equivalent)
- C9-09: sessionStorage persistence/recovery (D-97 equivalent)
- D-36: No unit tests for web-side XLSX parser
- D-37: E2E tests use `waitForTimeout` instead of condition-based waits

## Findings

### C10-TE01: No test for `formatSavingsValue` helper
- **File+line:** `apps/web/src/lib/formatters.ts:224-227`
- **Description:** The `formatSavingsValue` helper was extracted to centralize sign-prefix logic across SavingsComparison, VisibilityToggle, and ReportContent (C92-01/C94-01). However, it lacks a dedicated unit test. The function's behavior (prefix '+' when value >= 100, use `formatWon(Math.abs(value))`) is straightforward but has edge cases: negative values, zero, values at the 99/100 boundary, and the `prefixValue` parameter override.
- **Confidence:** High
- **Severity:** LOW
- **Recommendation:** Add unit tests for `formatSavingsValue` covering: positive >= 100, positive < 100, zero, negative, and `prefixValue` override.

## Sweep for commonly missed issues

1. **Test flakiness:** No new flaky test patterns detected. The E2E tests use `waitForTimeout` (D-37) but pass reliably.
2. **Mock coverage:** Parser tests use mock data appropriately. No tests rely on external services.
3. **Assertion quality:** Test assertions are specific (checking exact values, not just truthiness).

## Conclusion

One new LOW finding (C10-TE01: no test for `formatSavingsValue`). All other coverage gaps are already tracked.
