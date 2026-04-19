# Cycle 45 Implementation Plan

**Date:** 2026-04-19
**Source:** `.context/reviews/2026-04-19-cycle45-comprehensive.md`

---

## Task 1: Fix `formatWon` negative zero output

- **Finding:** C45-L01
- **Severity:** LOW
- **Confidence:** Medium
- **Files:** `apps/web/src/lib/formatters.ts:5-8`
- **Description:** `formatWon(-0)` produces `"-0원"` via `toLocaleString('ko-KR')` which preserves the signed zero. This could appear in the SavingsComparison component when `displayedSavings` animates through 0 from a negative starting value. The SavingsComparison component uses `displayedSavings >= 0 ? '+' : ''` prefix which would show `"+-0원"` (double prefix) if `displayedSavings` is exactly `-0`.
- **Fix:** Add `amount = amount === 0 ? 0 : amount` or use `Math.abs(amount)` normalization at the start of `formatWon` to normalize negative zero. Since `formatWon` is used for both positive and negative amounts (e.g., showing cost differences), we should normalize only signed zero: `if (amount === 0) amount = 0;` which converts `-0` to `0`. Also add a guard in `SavingsComparison.svelte` to use `Math.abs(displayedSavings)` when checking the sign prefix.
- **Status:** DONE

---

## Task 2: Fix SpendingSummary non-consecutive month "전월실적" label

- **Finding:** C45-L02
- **Severity:** LOW
- **Confidence:** Medium
- **Files:** `apps/web/src/components/dashboard/SpendingSummary.svelte:118`
- **Description:** When `monthlyBreakdown` has exactly 2 months that are not consecutive (e.g., January and March), the "전월실적" label shows January's spending which is misleading since January is not the "previous month" of March.
- **Fix:** Add a check whether the two months are consecutive (within 1 month of each other) before displaying "전월실적". If not consecutive, change the label to "이전 달 실적" or simply show the month name.
- **Status:** DONE

---

## Task 3: Fix OptimalCardMap maxRate minimum for very low rate scenarios

- **Finding:** C45-L04
- **Severity:** LOW
- **Confidence:** Medium
- **Files:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:19`
- **Description:** `maxRate` uses `0.001` as the reduce initial value, which is the minimum denominator for the bar width calculation. If all assignment rates are smaller than 0.001, the bars appear wider than they should.
- **Fix:** Use `0` as the reduce initial value and guard the division: `const effectiveMax = maxRate > 0 ? maxRate : 0.0001`. This ensures the bars are proportional to the actual maximum rate while still preventing division by zero.
- **Status:** DONE

---

## Task 4: Record C45-L03 as deferred item (carry-over from D-42)

- **Finding:** C45-L03 (same as D-42/D-46/D-64/D-78)
- **Severity:** LOW
- **Description:** `getCategoryColor` falls through to `uncategorized` gray for missing categories. Already tracked in deferred items as D-42/D-46/D-64/D-78. No new action needed.
- **Status:** DONE (already tracked)

---

## Task 5: Update deferred items with C45-L02 deferral if not fixed this cycle

- **Finding:** C45-L02 fallback
- **Severity:** LOW
- **Description:** If Task 2 is not completed this cycle, record C45-L02 as a deferred item.
- **Status:** PENDING (conditional)
