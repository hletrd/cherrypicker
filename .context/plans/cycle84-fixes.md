# Cycle 84 Implementation Plan

## Overview
Address the 3 new findings from the C84 review. All findings are in the VisibilityToggle component (sign-prefix and negative display inconsistencies) and the store (Infinity guard).

---

## Task 1: Fix VisibilityToggle sign-prefix threshold (C84-01)

**Severity:** MEDIUM | **Confidence:** HIGH
**File:** `apps/web/src/components/ui/VisibilityToggle.svelte:93`

**Problem:** VisibilityToggle uses `> 0` threshold for the "+" prefix on the `stat-total-savings` element, while SavingsComparison and ReportContent use `>= 100`. For small savings (1-99 won), the results page stat shows "+1원" while the dashboard shows "1원".

**Fix:** Change line 93 from:
```
cachedStatTotalSavings.textContent = (opt.savingsVsSingleCard > 0 ? '+' : '') + formatWon(opt.savingsVsSingleCard);
```
to:
```
cachedStatTotalSavings.textContent = (opt.savingsVsSingleCard >= 100 ? '+' : '') + formatWon(opt.savingsVsSingleCard < 0 ? Math.abs(opt.savingsVsSingleCard) : opt.savingsVsSingleCard);
```

This also fixes C84-02 (redundant minus under "추가 비용") in the same change.

---

## Task 2: Fix VisibilityToggle negative savings redundant minus (C84-02)

**Severity:** LOW | **Confidence:** MEDIUM
**File:** `apps/web/src/components/ui/VisibilityToggle.svelte:93`

**Problem:** When savings is negative and the label changes to "추가 비용" (line 108), the minus sign in front of the amount is redundant. SavingsComparison and ReportContent already use `Math.abs()` for this case.

**Fix:** Included in Task 1 above -- the `Math.abs()` call handles both the threshold fix and the negative display fix.

---

## Task 3: Add Infinity guard to isOptimizableTx (C84-03)

**Severity:** LOW | **Confidence:** LOW
**File:** `apps/web/src/lib/store.svelte.ts:206-209`

**Problem:** `isOptimizableTx` does not guard against `Infinity` amount. `typeof Infinity === 'number'` and `Infinity > 0` are both true, so an Infinity amount would pass validation. JSON.parse never produces Infinity, making this theoretical, but the guard is cheap and improves robustness.

**Fix:** Add `Number.isFinite(obj.amount)` to the existing check. Change:
```
typeof obj.amount === 'number' &&
Number.isFinite(obj.amount) &&
obj.amount > 0 &&
```
Wait -- `Number.isFinite` is already there at line 206! Let me re-check.

Actually, re-reading the code at store.svelte.ts:198-209:
```
function isOptimizableTx(tx: unknown): tx is CategorizedTx {
  if (!tx || typeof tx !== 'object') return false;
  const obj = tx as Record<string, unknown>;
  return (
    typeof obj.id === 'string' && obj.id.length > 0 &&
    typeof obj.date === 'string' && obj.date.length > 0 &&
    typeof obj.merchant === 'string' &&
    typeof obj.amount === 'number' &&
    Number.isFinite(obj.amount) &&
    obj.amount > 0 &&
    typeof obj.category === 'string' && obj.category.length > 0
  );
}
```

`Number.isFinite(obj.amount)` already rejects `NaN` and `Infinity`! So C84-03 is a FALSE POSITIVE. No fix needed.

---

## Summary

| Task | Finding | Action |
|---|---|---|
| 1 | C84-01 (MEDIUM) | Fix sign-prefix threshold to >= 100 in VisibilityToggle | DONE |
| 2 | C84-02 (LOW) | Fix negative savings display with Math.abs() in VisibilityToggle (merged into Task 1) | DONE |
| 3 | C84-03 (LOW) | FALSE POSITIVE -- `Number.isFinite` already guards against Infinity | N/A |

**Net tasks implemented: 1** (Tasks 1+2 combined into a single code change)
