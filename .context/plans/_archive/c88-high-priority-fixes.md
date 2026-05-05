# Cycle 88 — High-Priority Fixes

## Status: COMPLETE

---

### Fix 1: SavingsComparison annual projection sign-prefix uses animated value (C88-01/C87-01/C85-01/C86-01)

**Severity:** MEDIUM | **Confidence:** HIGH | **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:240`

**Status: ALREADY FIXED** — Verified that commit `00000006d3` (fix(web): use final target for savings sign-prefix instead of animated value) already applied this fix. The C87 review was written before that commit landed. Current code on both lines 238 and 240 correctly uses `opt.savingsVsSingleCard` for all sign-related decisions.

**Evidence of fix in current code (line 240):**
```
연간 약 {opt.savingsVsSingleCard >= 0 && opt.savingsVsSingleCard * 12 >= 100 ? '+' : ''}{formatWon(opt.savingsVsSingleCard < 0 ? Math.abs(displayedAnnualSavings) : displayedAnnualSavings)} ...
```

- `+` prefix threshold: `opt.savingsVsSingleCard * 12 >= 100` (uses final target) -- CORRECT
- `Math.abs()` decision: `opt.savingsVsSingleCard < 0` (uses final target sign) -- CORRECT
- Displayed value: `displayedAnnualSavings` (animated value for number display) -- CORRECT

---

## Deferred Items

| Finding | Reason for Deferral | Exit Criterion |
|---|---|---|
| C85-03 CardDetail categoryLabelsReady blocks rewards table | Minor UX delay, not a correctness bug. Categories load fast in practice. | If user reports visible flash delay, add skeleton for rewards table. |
| C86-02/C87-03/C88-03 CategoryBreakdown getCategoryColor gray fallback | All current YAML subcategories have CATEGORY_COLORS entries. Gray fallback only triggers for future additions. | When new subcategories are added to YAML, add corresponding color entries. |
| C86-03/C86-05 CSV/XLSX header detection residual risk | Current 2-category check is sufficient for all known bank formats. Requiring a date keyword would break legitimate edge cases. | If a misidentification is reported, add date-keyword requirement. |
| C86-04 VisibilityToggle DOM mutation | Known deferred for 18+ cycles. Requires architectural change to use Svelte reactivity. | When VisibilityToggle is refactored to eliminate DOM mutation. |
| C86-13/C88-11 Mobile menu focus trap | Low-severity accessibility issue. | When accessibility sprint is scheduled. |
| C86-16/C88-09 No integration test for multi-file upload | Medium severity but requires test infrastructure setup. | When test infrastructure is added. |
| C88-04 ALL_BANKS 5th copy | Same as C74-05. Requires D-01 architectural refactor. | When shared bank data module is created. |
| C88-05/C88-06 formatIssuerNameKo/getIssuerColor hardcoded maps | Same as C64-03/C66-05. Will drift from data. | When build-time code generation from cards.json is implemented. |
| C88-07 isHTMLContent EUC-KR limitation | Known limitation documented in code. Very rare for .xls exports. | If EUC-KR HTML-as-XLS file is reported, add encoding detection. |
| C88-08 pdf.ts fallbackAmountPattern g flag fragility | Correct current usage. Fragile if refactored. | If someone moves regex to module scope and tests fail, add a comment warning. |
| C88-10 No test for SavingsComparison sign-prefix | LOW severity. Requires component test infrastructure. | When component test infrastructure is added. |
| C88-13 CATEGORY_COLORS dark mode contrast | Known issue from C4-10/C8-05. Requires design work. | When accessibility/dark-mode sprint is scheduled. |
| C88-14 Loading skeleton light-mode-only colors | Brief visual state. LOW severity. | If dark-mode loading looks jarring, add dark: variants. |
| C88-15 Step indicator role="progressbar" | Semantic HTML issue. Not a functional bug. | If accessibility audit is performed. |
