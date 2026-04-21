# Test Engineer — Cycle 88

## Summary
Full test coverage review focusing on gaps, flaky tests, and TDD opportunity.

## Findings

### C88-09: No integration test for multi-file upload (MEDIUM, HIGH)
**File:** N/A (missing test)
**Problem:** Confirmed carry-forward from C86-16. No integration test exists for uploading multiple files with different bank formats. The `analyzeMultipleFiles` function in analyzer.ts is the core logic but has no integration test.
**Fix:** Add vitest integration test that creates mock File objects for different bank formats and verifies the merged transaction list, monthly breakdown, and optimization.

### C88-10: No test for SavingsComparison sign-prefix behavior (LOW, MEDIUM)
**File:** N/A (missing test)
**Problem:** The SavingsComparison component's sign-prefix logic (Math.abs for negative, `+` prefix threshold) has no unit test. The bug C88-01 exists partly because there is no test that validates the annual projection sign behavior.
**Fix:** Add component test or logic-extraction test that verifies sign-prefix for monthly and annual projections at boundary values (0, 99, 100, -1, -5000).

### Existing Test Coverage
- `packages/core/__tests__/`: optimizer.test.ts, categorizer.test.ts, calculator.test.ts, reward-cap-rollback.test.ts
- `packages/parser/__tests__/`: detect.test.ts, csv.test.ts, xlsx-parity.test.ts
- `packages/viz/__tests__/`: report.test.ts
- `packages/rules/__tests__/`: schema.test.ts
- `apps/web/__tests__/`: analyzer-adapter.test.ts, parser-encoding.test.ts, parser-date.test.ts
- `e2e/`: Playwright E2E tests exist but depend on `dist/` (C4-10)

### Carried-Forward Test Gaps
- E2E test stale dist/ dependency (C4-10, MEDIUM)
- No regression test for findCategory fuzzy match (C4-11, MEDIUM)
