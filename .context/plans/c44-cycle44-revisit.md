# Cycle 44 (Revisit) Implementation Plan

**Date:** 2026-04-21
**Source:** `.context/reviews/2026-04-21-cycle44-comprehensive.md`

---

## Task 1: Forward previousMonthSpending option through reoptimize

- **Finding:** C44-01
- **Severity:** LOW
- **Confidence:** Medium
- **Files:** `apps/web/src/lib/store.svelte.ts:400`, `apps/web/src/components/dashboard/TransactionReview.svelte:140`
- **Description:** When the user manually enters `previousMonthSpending` in FileDropzone, the initial `analyze()` call uses this value. However, when `reoptimize()` is called after a category edit, the method receives no `AnalyzeOptions`, so it recomputes per-card exclusion-filtered spending instead of using the user's manually-entered value. The fix is to store the original `previousMonthSpending` option in the analysis result and forward it during reoptimize.
- **Fix:**
  1. Add `previousMonthSpendingOption?: number` field to `AnalysisResult` to store the user's original input.
  2. In `analyze()`, store `options?.previousMonthSpending` in the result.
  3. In `reoptimize()`, forward `result.previousMonthSpendingOption` as the `previousMonthSpending` option.
- **Status:** TODO

---

## Task 2: Add ARIA live region to CardGrid filter count

- **Finding:** C44-03
- **Severity:** LOW
- **Confidence:** Medium
- **Files:** `apps/web/src/components/cards/CardGrid.svelte:124-128`
- **Description:** When the user filters cards by issuer or type, the displayed card count changes dynamically. Screen reader users are not notified of the result count change because there is no `aria-live` region announcing the updated count.
- **Fix:** Add `aria-live="polite"` attribute to the card count badge span at line 125 so screen readers announce the updated count when filters change.
- **Status:** TODO

---

## Task 3: Record C43-03 (carried forward) as deferred

- **Finding:** C43-03 / C41-04 / C42-03
- **Severity:** LOW
- **Confidence:** Medium
- **Description:** CategoryBreakdown `maxPercentage` initial value of 1 causes edge case when all categories are sub-1%. Already carried forward across multiple cycles. No fix needed -- the behavior is mathematically correct for the use case (credit card data always has categories exceeding 1%).
- **Status:** N/A (carried forward, no action needed)
