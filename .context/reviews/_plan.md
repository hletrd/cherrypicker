# Cycle 26 Implementation Plan

**Source:** `_aggregate.md` (2 findings)

## Fixes

### Fix 1: PDF merchant extraction for reversed column order (F1 -- MEDIUM)
**Files:** `packages/parser/src/pdf/index.ts`, `apps/web/src/lib/parser/pdf.ts`
**Action:** Add a fallback merchant extraction block for when dateIdx >= amountIdx.
When dateIdx > amountIdx, scan the longest text cell between amountIdx and dateIdx.
When dateIdx === amountIdx (same column), skip (degenerate case).

### Fix 2: Test coverage for summary rows with date context (F2 -- LOW)
**File:** `packages/parser/__tests__/column-matcher.test.ts`
**Action:** Add test case for isValidHeaderRow rejecting a row that has a date-format string
combined with a summary keyword like '합계'.