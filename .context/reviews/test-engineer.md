# Test Engineer — Cycle 1 (Fresh Review 2026-04-24)

## Inventory of Reviewed Files

- `packages/core/__tests__/calculator.test.ts`
- `packages/core/__tests__/optimizer.test.ts`
- `packages/core/__tests__/categorizer.test.ts`
- `packages/core/__tests__/reward-cap-rollback.test.ts`
- `packages/parser/__tests__/csv.test.ts`
- `packages/parser/__tests__/detect.test.ts`
- `packages/parser/__tests__/xlsx-parity.test.ts`
- `packages/viz/__tests__/report.test.ts`
- `packages/rules/__tests__/schema.test.ts`
- `apps/web/__tests__/parser-encoding.test.ts`
- `apps/web/__tests__/parser-date.test.ts`
- `apps/web/__tests__/analyzer-adapter.test.ts`
- `e2e/` — Playwright E2E tests

## New Findings

### T1-01: No unit tests for CardDetail's abort-then-labels scenario
- **File:** `apps/web/src/components/cards/CardDetail.svelte:28-38`
- **Severity:** LOW
- **Confidence:** High
- **Description:** C1-01 identifies that CardDetail shows raw category IDs when `loadCategories` is aborted. There is no unit or E2E test for this scenario. The existing E2E tests test the happy path only.
- **Fix:** Add a test simulating `loadCategories` returning `[]` and verify labels degrade gracefully.

### T1-02: Server-side `detectCSVDelimiter` unbounded scan not tested
- **File:** `packages/parser/__tests__/detect.test.ts`
- **Severity:** LOW
- **Confidence:** Medium
- **Description:** After fixing C1-02/P1-02 (30-line limit), a test should verify the limit works.
- **Fix:** Add a test case with a 1000-line CSV input verifying correct delimiter detection without scanning all lines.

## Previously Deferred (Acknowledged)

D-36 (no unit tests for web XLSX parser), D-37 (E2E uses waitForTimeout), D7-M14 (test-selector polish).
