# Cycle 16 — Test Engineer Review

**Date:** 2026-05-06
**Scope:** Test coverage gaps, flaky tests, TDD opportunities

## Findings

### C16-TEST01 [MEDIUM] — No tests for `isOptimizableTx` with negative amounts
- **File:** `apps/web/src/lib/store.svelte.ts:200-212`
- **Issue:** The `isOptimizableTx` function is critical for data integrity during sessionStorage restore, but there are no unit tests for it. Specifically, there is no test verifying that negative-amount transactions pass or fail validation.
- **Impact:** The C16-01 bug (refunds vanishing on refresh) would have been caught by a simple unit test.
- **Fix:** Add tests in `apps/web/__tests__/store.test.ts` (or create one) that verify:
  - Positive amounts pass
  - Zero amounts fail
  - Negative amounts should pass (if fix applied) or fail (documenting current behavior)
  - NaN/Infinity fail
  - Missing fields fail
- **Confidence:** High

### C16-TEST02 [LOW] — No tests for sessionStorage persistence round-trip with refunds
- **File:** `apps/web/src/lib/store.svelte.ts:150-193` and `:224-326`
- **Issue:** `persistToStorage` and `loadFromStorage` form a round-trip that is not tested. There are no tests verifying that transactions saved to sessionStorage are correctly restored, especially edge cases like negative amounts, truncation, and version mismatches.
- **Fix:** Add tests using a mock sessionStorage that verify the round-trip preserves all transaction types.
- **Confidence:** Medium

### C16-TEST03 [LOW] — No tests for `reoptimize` monthlySpending calculation with refunds
- **File:** `apps/web/src/lib/store.svelte.ts:510-523`
- **Issue:** The `reoptimize` function's monthly spending calculation logic is not directly tested. The `tx.amount > 0` filter at line 519 affects previous-month spending computation but has no test coverage.
- **Fix:** Add tests that verify `reoptimize` computes correct `previousMonthSpending` when refunds are present.
- **Confidence:** Medium

## Summary
One MEDIUM and two LOW test coverage gaps. The highest priority is adding tests for `isOptimizableTx` to prevent regression of the refund data loss issue.
