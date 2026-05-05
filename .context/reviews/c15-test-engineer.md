# Cycle 15 — Test Engineering Review

**Date:** 2026-05-06
**Scope:** Test coverage analysis across packages/core/__tests__/, packages/parser/__tests__/, and apps/web/__tests__/

## Verified Coverage (from Cycle 14 fixes)
- isValidISODate invalid-date tests: present in both server and web test files
- Date boundary tests: month 99, day 99, month 00, day 00, Feb 30, Apr 31, year 0000

## Coverage Gaps

### C15-TEST01: No test for "both rate and fixedAmount" branch (LOW)
- **File:** `packages/core/src/calculator/reward.ts:261`
- **Gap:** When a tier has both `rate` and `fixedAmount`, the rate-based branch takes precedence and fixed reward is silently ignored. No test verifies this behavior.
- **Fix:** Add a test in `packages/core/__tests__/calculator.test.ts` that creates a mock rule with both rate and fixedAmount on the same tier, then asserts which reward is applied.
- **Confidence:** High

### C15-TEST02: No test for parseAmountString scientific notation rejection (LOW)
- **File:** `packages/parser/src/csv/shared.ts:160`
- **Gap:** If scientific notation ever reaches parseAmountString, parseFloat accepts it. No test covers this edge case.
- **Fix:** Add test cases: `"1e5"`, `"1.2e3"` should return null.
- **Confidence:** Medium

### C15-TEST03: No test for merchant quote unescaping (LOW)
- **File:** `packages/parser/src/csv/adapter-factory.ts:163`
- **Gap:** Merchant names with escaped quotes (RFC 4180 doubled quotes) are not tested.
- **Fix:** Add test in `packages/parser/__tests__/csv-adapters.test.ts` for merchant `""Quoted""` → `"Quoted"`.
- **Confidence:** Medium

### C15-TEST04: No test for build-stats.ts error paths (LOW)
- **File:** `apps/web/src/lib/build-stats.ts`
- **Gap:** The error paths that log console.warn are not tested.
- **Fix:** Add tests for malformed cards.json and missing stats scenarios.
- **Confidence:** Low

## Carry-over Test Gaps (from prior cycles)
- D-36: No unit tests for web-side XLSX parser
- D-37: E2E tests use waitForTimeout instead of condition-based waits
- C14-TEST-02: No test for parseAmountString multi-decimal (still deferred)
