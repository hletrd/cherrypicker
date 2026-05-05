# Cycle 40 Fixes Plan

## Findings Addressed

| ID | Severity | Description | Status |
|---|---|---|---|
| C40-01 | MEDIUM | SavingsComparison annual projection uses animated `displayedSavings` instead of actual value — shows 0원 on mount | DONE |
| C40-02 | LOW | TransactionReview changeCategory index mutation lacks explanatory comment | DONE |
| C40-04 | LOW | buildCardResults totalSpending raw tx.amount needs positive-amount documentation | DONE |

### Deferred (no action this cycle)

| ID | Severity | Reason |
|---|---|---|
| C40-03 | LOW | formatDateKo/formatDateShort redundant parseInt — defensive code is appropriate for a public API function; no functional issue |

---

## Task 1: Fix SavingsComparison annual projection to use actual value, not animated value

**Finding:** C40-01 (MEDIUM)
**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:218`

**Problem:** The annual projection line uses `displayedSavings * 12` where `displayedSavings` is the animated count-up value. On component mount with restored data, this briefly shows "연간 약 0원" during the 600ms animation. The annual value should always reflect the actual computed savings.

**Fix:** Change the annual projection to derive from `opt.savingsVsSingleCard` (the actual computed value) instead of `displayedSavings` (the animated value). The monthly display should keep using `displayedSavings` for the smooth animation, but the annual projection should be accurate immediately.

Change line 218 from:
```
연간 약 {formatWon((displayedSavings >= 0 ? displayedSavings : Math.abs(displayedSavings)) * 12)}
```
to:
```
연간 약 {formatWon((opt.savingsVsSingleCard >= 0 ? opt.savingsVsSingleCard : Math.abs(opt.savingsVsSingleCard)) * 12)}
```

This reverts the C39-06 "fix" which introduced the regression. The original C39-06 concern (annual number jumps while monthly animates) is a minor visual inconsistency that is preferable to showing an incorrect annual value.

**Verification:** After the fix, the annual projection should immediately show the correct value on page load with restored session data, and should update immediately on reoptimize.

---

## Task 2: Add explanatory comment to TransactionReview changeCategory

**Finding:** C40-02 (LOW)
**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:128`

**Fix:** Add a comment explaining that Svelte 5 `$state` tracks array index mutations, making `editedTxs[idx] = updated` both correct and more performant than the previous `editedTxs = editedTxs.map(...)` pattern.

---

## Task 3: Add positive-amount documentation to buildCardResults

**Finding:** C40-04 (LOW)
**File:** `packages/core/src/optimizer/greedy.ts:226`

**Fix:** Expand the existing comment to explicitly state that `buildCardResults` requires pre-filtered positive-amount transactions as input.
