# Cycle 45 Implementation Plan

**Date:** 2026-04-21
**Source:** `.context/reviews/2026-04-21-cycle45-comprehensive.md`

---

## Task 1: Fix TypeScript compilation error in reoptimize() -- null access before null check

- **Finding:** C45-01
- **Severity:** HIGH (build breakage -- `tsc --noEmit` reports 2 errors)
- **Confidence:** High
- **Files:** `apps/web/src/lib/store.svelte.ts:458,460`
- **Description:** The C44-01 fix added `result.previousMonthSpendingOption` access in `reoptimize()` at lines 458/460, but these are before the null guard at line 476. Since `result` is typed `AnalysisResult | null`, TypeScript reports `TS18047: 'result' is possibly 'null'`. This is a CI gate failure.
- **Fix:**
  1. Add an early null check for `result` at the top of the `reoptimize()` try block, before any property access.
  2. When `result` is null, set error message, clear storage, set loading=false, and return.
  3. Remove the redundant null check at line 476 (it will never be reached after the early return).
  4. This also fixes C45-02 (wasted monthly breakdown computation when result is null).
- **Status:** DONE

---

## Task 2: Add ARIA live region to CardGrid filter count (carried forward from C44-03)

- **Finding:** C44-03 (carried forward from cycle 44)
- **Severity:** LOW (accessibility)
- **Confidence:** Medium
- **Files:** `apps/web/src/components/cards/CardGrid.svelte:125`
- **Description:** The card count badge already has `aria-live="polite"` at line 125 in the current code. Re-verify that this is correctly present. If already fixed, mark as done.
- **Fix:** Verify `aria-live="polite"` is on the count span. If missing, add it.
- **Status:** DONE (aria-live="polite" already present at line 125)

---

## Task 3: Record C45-02 as resolved by Task 1

- **Finding:** C45-02
- **Severity:** MEDIUM
- **Confidence:** High
- **Description:** Wasted monthly breakdown computation when `result` is null. Same root cause as C45-01 -- the early null check will eliminate this wasted computation.
- **Status:** DONE (resolved by Task 1 -- early null guard eliminates wasted computation)
