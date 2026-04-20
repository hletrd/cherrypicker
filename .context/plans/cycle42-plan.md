# Cycle 42 Implementation Plan

**Date:** 2026-04-21
**Source:** `.context/reviews/2026-04-21-cycle42-comprehensive.md`

---

## Task 1: Change all parser amount filters from `amount === 0` to `amount <= 0` to block refund transactions

- **Finding:** C42-01
- **Severity:** MEDIUM (correctness -- refund/zero transactions inflate transaction counts and monthly spending totals)
- **Confidence:** High
- **Description:** All parsers except the server-side PDF allow negative-amount (refund) transactions to pass through. The server-side PDF correctly uses `amount <= 0` but the other 13+ filter locations use `amount === 0` or `amount !== 0`. Downstream reward calculator and optimizer correctly filter `amount <= 0`, so rewards aren't corrupted, but transaction counts are inflated and `Math.abs(tx.amount)` in monthlyBreakdown double-counts refunds as positive spending (C42-02).
- **Files to modify:**
  1. `apps/web/src/lib/parser/pdf.ts:246` -- change `if (amount === 0) continue;` to `if (amount <= 0) continue;`
  2. `apps/web/src/lib/parser/pdf.ts:359` -- change `else if (amount !== 0)` to `else if (amount > 0)`
  3. `apps/web/src/lib/parser/pdf.ts:247` -- remove the "Allow negative amounts" comment
  4. `apps/web/src/lib/parser/csv.ts:72` -- change `if (amount === 0) return false;` to `if (amount <= 0) return false;`
  5. `apps/web/src/lib/parser/csv.ts:69-72` -- update the zero-amount comment to mention negative amounts too
  6. `apps/web/src/lib/parser/xlsx.ts:400` -- change `if (amount === 0) continue;` to `if (amount <= 0) continue;`
  7. `apps/web/src/lib/parser/xlsx.ts:396-400` -- update the zero-amount comment to mention negative amounts too
  8. `packages/parser/src/csv/hyundai.ts:61` -- change `if (amount === 0) continue;` to `if (amount <= 0) continue;`
  9. `packages/parser/src/csv/kb.ts:60` -- same
  10. `packages/parser/src/csv/samsung.ts:63` -- same
  11. `packages/parser/src/csv/shinhan.ts:60` -- same
  12. `packages/parser/src/csv/lotte.ts:60` -- same
  13. `packages/parser/src/csv/hana.ts:60` -- same
  14. `packages/parser/src/csv/woori.ts:60` -- same
  15. `packages/parser/src/csv/nh.ts:60` -- same
  16. `packages/parser/src/csv/ibk.ts:60` -- same
  17. `packages/parser/src/csv/bc.ts:60` -- same
  18. `packages/parser/src/csv/generic.ts:121` -- same
- **Verification:** Run `bun test` and `vitest` to ensure no regressions. The existing tests should still pass because no test cases rely on negative-amount transactions being included in results.
- **Status:** PENDING

---

## Task 2: Fix Math.abs(tx.amount) double-counting in monthlyBreakdown

- **Finding:** C42-02
- **Severity:** MEDIUM (correctness -- inflated monthly spending totals)
- **Confidence:** High
- **Description:** `analyzer.ts:290` and `store.svelte.ts:425` use `Math.abs(tx.amount)` when computing monthly spending totals. This means a -50,000 refund becomes +50,000 in the monthly total, inflating it. After C42-01 is fixed (negative amounts filtered at parser level), this issue is automatically resolved because no negative amounts will reach the analyzer. However, as a defense-in-depth measure, the `Math.abs()` should be replaced with a guard that only adds positive amounts.
- **Files to modify:**
  1. `apps/web/src/lib/analyzer.ts:290` -- change `Math.abs(tx.amount)` to `tx.amount` (since negative amounts are now pre-filtered)
  2. `apps/web/src/lib/store.svelte.ts:425` -- same
- **Note:** After C42-01 is implemented, `Math.abs()` is no longer needed since all amounts reaching the analyzer will be positive. Using `tx.amount` directly is more correct and matches the intent.
- **Verification:** Run `bun test` and `vitest`. Also verify that the monthly spending total in the UI matches the sum of displayed transaction amounts.
- **Status:** PENDING

---

## Deferred Items

### C42-03: CategoryBreakdown maxPercentage initial value 1

- **Severity:** LOW
- **Confidence:** Medium
- **Reason for deferral:** Theoretical edge case with no real-world impact for credit card spending data. The current behavior is mathematically correct -- `reduce` with initial value 1 means bar widths are proportional to the maximum percentage. A dataset where all categories are sub-1% is extremely unlikely.
- **Exit criterion:** If a future UI redesign changes the bar chart semantics, revisit this.

### C42-04: loadCategories returns empty array on AbortError

- **Severity:** LOW
- **Confidence:** High
- **Reason for deferral:** Reasonable fallback behavior for an abort scenario (component is being torn down). The TransactionReview component has a hardcoded FALLBACK_CATEGORIES list as backup. Minimal real-world impact.
- **Exit criterion:** If categories become critical for more features, add a retry mechanism for non-abort failures.

---

## Prior Plan Status

| Plan | Status |
|---|---|
| All prior cycle plans (1-41) | DONE or archived |
| `cycle51-review.md` | DONE -- no implementation tasks |
| `cycle50-fixes.md` | DONE -- both tasks implemented |
