# Cycle 87 — High-Priority Fixes

## Status: COMPLETE

---

### Fix 1: SavingsComparison annual projection sign-prefix uses animated value (C87-01/C85-01/C86-01)

**Severity:** MEDIUM | **Confidence:** HIGH | **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:240`

**Problem:**
The annual projection line (line 240) uses `displayedAnnualSavings` (the animated intermediate value) for both:
1. The `Math.abs()` decision: `formatWon(displayedAnnualSavings < 0 ? Math.abs(displayedAnnualSavings) : displayedAnnualSavings)`
2. The `+` prefix threshold: `displayedAnnualSavings >= 100`

During the count-up animation from a positive to a negative value, `displayedAnnualSavings` passes through zero and then into negative territory. The sign decisions should be based on the FINAL target value (`opt.savingsVsSingleCard * 12`), not the animated intermediate. The monthly line (238) already correctly uses `opt.savingsVsSingleCard` for sign decisions; the annual line should use the same pattern.

**Concrete failure scenario:**
1. User uploads a statement where cherry-picking saves 50,000 won/month
2. User re-optimizes and cherry-picking now costs 5,000 won/month (suboptimal)
3. During the 600ms animation, `displayedAnnualSavings` transitions from 600,000 to -60,000
4. At the moment the animated value crosses zero, `displayedAnnualSavings` is e.g. -500
5. The label says "추가 비용" (correct, from `opt.savingsVsSingleCard >= 0`)
6. But `displayedAnnualSavings < 0` triggers `Math.abs()`, showing "500원" briefly
7. Meanwhile the label says "추가 비용" and the monthly line already shows the correct sign

**Fix:**
Replace the sign decisions on line 240 to use `opt.savingsVsSingleCard` (the final target) instead of `displayedAnnualSavings` (the animated value), matching the pattern on line 238.

Change line 240 from:
```
연간 약 {opt.savingsVsSingleCard >= 0 && displayedAnnualSavings >= 100 ? '+' : ''}{formatWon(displayedAnnualSavings < 0 ? Math.abs(displayedAnnualSavings) : displayedAnnualSavings)} {opt.savingsVsSingleCard >= 0 ? '절약' : '추가 비용'} (최근 월 기준 단순 연환산)
```
To:
```
연간 약 {opt.savingsVsSingleCard >= 0 && opt.savingsVsSingleCard * 12 >= 100 ? '+' : ''}{formatWon(opt.savingsVsSingleCard < 0 ? Math.abs(displayedAnnualSavings) : displayedAnnualSavings)} {opt.savingsVsSingleCard >= 0 ? '절약' : '추가 비용'} (최근 월 기준 단순 연환산)
```

Key changes:
- `+` prefix threshold: `displayedAnnualSavings >= 100` -> `opt.savingsVsSingleCard * 12 >= 100` (use final target)
- `Math.abs()` decision: `displayedAnnualSavings < 0` -> `opt.savingsVsSingleCard < 0` (use final target sign)
- Displayed value: still uses `displayedAnnualSavings` (animated value is correct for the number display itself)

This also fixes C85-02 (annual projection missing `+` prefix) since the threshold is now based on the final target.

---

## Deferred Items

| Finding | Reason for Deferral | Exit Criterion |
|---|---|---|
| C85-03 CardDetail categoryLabelsReady blocks rewards table | Minor UX delay, not a correctness bug. Categories load fast in practice. | If user reports visible flash delay, add skeleton for rewards table. |
| C86-02 CategoryBreakdown getCategoryColor gray fallback | All current YAML subcategories have CATEGORY_COLORS entries. Gray fallback only triggers for future additions. | When new subcategories are added to YAML, add corresponding color entries. |
| C86-03/C86-05 CSV/XLSX header detection residual risk | Current 2-category check is sufficient for all known bank formats. Requiring a date keyword would break legitimate edge cases (e.g., CSV where date column header uses an unknown keyword). | If a misidentification is reported, add date-keyword requirement. |
| C86-04 VisibilityToggle DOM mutation | Known deferred for 18+ cycles. Requires architectural change to use Svelte reactivity. | When VisibilityToggle is refactored to eliminate DOM mutation. |
| C86-13 Mobile menu focus trap | Low-severity accessibility issue. | When accessibility sprint is scheduled. |
| C86-16 No integration test for multi-file upload | Medium severity but requires test infrastructure setup. | When test infrastructure is added. |
