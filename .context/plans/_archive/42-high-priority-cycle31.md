# Plan 42 — High Priority Fixes (Cycle 31)

**Source findings:** C31-01 (MEDIUM, High confidence)

---

## Task 1: Sync test's local parseDateToISO with production code and add range validation test cases

**Finding:** C31-01
**Severity:** MEDIUM
**Confidence:** High
**File:** `apps/web/__tests__/parser-date.test.ts:46-68`

### Problem

The test file `parser-date.test.ts` reproduces `parseDateToISO` locally (since it's a private function) but the local copy was never updated when C29-03/C29-04 and C30-02 added range validation to the production code. Specifically:

1. The MM/DD handler (lines 46-52) has no range validation
2. The koreanFull handler (lines 55-56) has no range validation
3. The koreanShort handler (lines 59-65) has no range validation

This means zero test coverage exists for the range validation logic that was the subject of three separate fixes.

### Implementation

1. Open `apps/web/__tests__/parser-date.test.ts`
2. Update the local `parseDateToISO` function to include range validation for all three formats:
   - MM/DD: add `if (month >= 1 && month <= 12 && day >= 1 && day <= 31)` check
   - koreanFull: add `if (month >= 1 && month <= 12 && day >= 1 && day <= 31)` check
   - koreanShort: add `if (month >= 1 && month <= 12 && day >= 1 && day <= 31)` check
3. Add new test describe blocks:
   - "parseDateToISO — invalid date range validation" with test cases:
     - "13/45 is rejected (month > 12)" — expect "13/45" passthrough
     - "01/32 is rejected (day > 31)" — expect "01/32" passthrough
     - "2026년 99월 99일 is rejected" — expect "2026년 99월 99일" passthrough
     - "99월 99일 is rejected" — expect "99월 99일" passthrough
     - "0월 15일 is rejected (month < 1)" — expect "0월 15일" passthrough
     - "1월 0일 is rejected (day < 1)" — expect "1월 0일" passthrough
4. Run the test suite to verify all tests pass

### Exit Criterion

- Local `parseDateToISO` in test file matches production code's validation logic
- New test cases verify invalid dates are rejected for all three format types
- All existing tests continue to pass

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | DONE — commit 00000000a5 |
