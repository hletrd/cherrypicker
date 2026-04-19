# Plan 40 — High Priority Fixes (Cycle 30)

**Source findings:** C30-01 (MEDIUM, High confidence)

---

## Task 1: Fix results.js double-sign bug on negative savingsVsSingleCard

**Finding:** C30-01
**Severity:** MEDIUM
**Confidence:** High
**File:** `apps/web/public/scripts/results.js:14`

### Problem

The results page's inline script unconditionally prepends "+" to `savingsVsSingleCard`:
```javascript
if (totalSavings) totalSavings.textContent = '+' + formatWon(opt.savingsVsSingleCard);
```

When `savingsVsSingleCard` is negative (cherry-picking is worse than single card), `formatWon()` produces "-50,000원" (with the minus sign from `toLocaleString`), so the display becomes "+-50,000원" — a double sign.

The dashboard's `SavingsComparison.svelte:202` handles this correctly:
```svelte
{displayedSavings >= 0 ? '+' : ''}{formatWon(displayedSavings)}
```

Additionally, SavingsComparison changes its label from "추가 절약" to "추가 비용" when savings are negative, but the results page always shows "예상 절약액" regardless of sign.

### Implementation

1. Open `apps/web/public/scripts/results.js`
2. Change line 14 from:
   ```javascript
   if (totalSavings) totalSavings.textContent = '+' + formatWon(opt.savingsVsSingleCard);
   ```
   to:
   ```javascript
   if (totalSavings) totalSavings.textContent = (opt.savingsVsSingleCard >= 0 ? '+' : '') + formatWon(opt.savingsVsSingleCard);
   ```
3. Also update the label in `apps/web/src/pages/results.astro:54` — change "예상 절약액" to be context-aware. Since results.astro is a static Astro template and cannot read sessionStorage at build time, add a small JS snippet in results.js to update the label when savings are negative:
   ```javascript
   const savingsLabel = document.getElementById('stat-savings-label');
   if (savingsLabel && opt.savingsVsSingleCard < 0) {
     savingsLabel.textContent = '추가 비용';
   }
   ```
4. Add `id="stat-savings-label"` to the `<p>` element wrapping "예상 절약액" in results.astro

### Exit Criterion

- Negative savingsVsSingleCard displays as "-50,000원" not "+-50,000원"
- The stat label changes from "예상 절약액" to "추가 비용" when savings are negative
- Consistent with SavingsComparison.svelte behavior

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | TODO |
