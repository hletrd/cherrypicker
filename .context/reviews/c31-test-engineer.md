# Cycle 31 Test Engineer Review

**Reviewer:** test-engineer
**Date:** 2026-05-05
**Focus:** Test coverage gaps for format diversity improvements

## Test Coverage Analysis

**Current state:** 554 bun tests, 243 vitest tests, all passing.

## Gaps Identified

### T1: No test for AMOUNT_COLUMN_PATTERN matching additional keywords (HIGH)

After F1 from code-reviewer adds new keywords to AMOUNT_COLUMN_PATTERN, tests must verify:
- `취소금액` header is detected as amount column
- `환불금액` header is detected as amount column
- `결제액` header is detected as amount column

**File:** `packages/parser/__tests__/column-matcher.test.ts`

### T2: No test for CATEGORY_COLUMN_PATTERN with expanded keywords (MEDIUM)

After F2 from code-reviewer adds new keywords, tests must verify:
- `거래유형` header is detected as category column
- `결제유형` header is detected as category column
- `이용구분` header is detected as category column
- `가맹점유형` header is detected as category column

**File:** `packages/parser/__tests__/column-matcher.test.ts`

### T3: No test for mixed date/amount formats in a single CSV (MEDIUM)

No test verifies that a CSV with:
- Full date (YYYY-MM-DD) in one row
- Short date (MM/DD) in another row
- Korean date (1월 15일) in another row
...can all be parsed correctly in the same file.

**File:** `packages/parser/__tests__/csv.test.ts`

### T4: No test for CSV with reversed column order (date after amount) (LOW)

The server-side generic parser uses `findColumn` which handles any order, but there's no explicit test verifying reversed column order works.

### T5: No test for SUMMARY_ROW_PATTERN with "총사용", "총이용", "결제합계" (LOW)

These patterns exist in the regex but have no dedicated test assertions.

## Summary

3 HIGH/MEDIUM test gaps that should be addressed with the implementation.