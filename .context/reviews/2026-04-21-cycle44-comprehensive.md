# Comprehensive Code Review -- Cycle 44

**Date:** 2026-04-21
**Reviewer:** Single-agent comprehensive review (cycle 44 of review-plan-fix loop)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-43+ reviews and the aggregate. Ran `bun test` (266 pass, 0 fail), `vitest` (189 pass, 0 fail), `eslint` (0 errors via workspace lint = tsc --noEmit), `tsc --noEmit` (0 errors on all packages and apps). Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior Cycle Fixes

| Finding | Status | Evidence |
|---|---|---|
| C43-01 | **FIXED** | `store.svelte.ts:168` now uses `obj.amount > 0` instead of `obj.amount !== 0`. Consistent with parser-level `amount <= 0` filter. |
| C43-02 | **FIXED** | `analyzer.ts:210` now uses `tx.amount` directly (not `Math.abs(tx.amount)`). Consistent with C42-02 fix. |
| C43-03 | OPEN (LOW) | CategoryBreakdown `maxPercentage` initial value still 1 -- theoretical edge case carried forward from C41-04/C42-03. |
| C42-01 | **FIXED** | All parsers confirmed using `amount <= 0`: web PDF, CSV, XLSX, all 10 server-side CSV adapters, server-side generic. |
| C42-02 | **FIXED** | `analyzer.ts:290` and `store.svelte.ts:425` use `tx.amount` instead of `Math.abs(tx.amount)`. |

---

## Verification of Prior Deferred Fixes (Still Relevant)

All deferred findings from the aggregate (`.context/reviews/_aggregate.md`) are confirmed still present. No new deferred items have been resolved since cycle 43.

---

## New Findings

### C44-01: `SpendingSummary.svelte` `previousMonthSpending` can show stale value after reoptimize

- **Severity:** LOW (UX clarity)
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte`
- **Description:** The `SpendingSummary` component reads `previousMonthSpending` from the analysis result's `monthlyBreakdown` to display the previous month's spending. After `reoptimize()` is called, the store updates `result.monthlyBreakdown` with the fresh calculation from edited transactions. However, if the user manually entered `previousMonthSpending` in `FileDropzone`, the `reoptimize()` method passes `options?.previousMonthSpending` which is `undefined` (no options are forwarded from the UI), so the optimizer recomputes per-card exclusion-filtered spending instead of using the manually-entered value. This means the user's explicit `previousMonthSpending` input is respected during the initial analysis but silently dropped during reoptimize.

  In practice, the `reoptimize()` method in `store.svelte.ts:400` does not forward the original `previousMonthSpending` option from the initial analysis. The `editedTransactions` passed to `reoptimize()` are the edited category list, and no `AnalyzeOptions` are provided by `TransactionReview.svelte`'s `applyEdits()` function.

- **Failure scenario:** A user uploads a single file and manually enters 500,000 for previousMonthSpending. The optimization uses 500,000 for all cards. The user then edits a transaction category and clicks "apply edits". The `reoptimize()` call has no `previousMonthSpending` option, so it recomputes per-card exclusion-filtered spending. The displayed optimization results now use a different spending baseline than what the user originally entered.

- **Fix:** Store the original `AnalyzeOptions` (or at least `previousMonthSpending`) in the analysis result and forward it during `reoptimize()`. This is a UX consistency issue, not a correctness bug -- the per-card exclusion-filtered spending is often a better approximation than the user's manual input.

---

### C44-02: `SavingsComparison.svelte` `displayedAnnualSavings` can go negative when `savingsVsSingleCard` is negative

- **Severity:** LOW (UX)
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:72,77`
- **Description:** When `savingsVsSingleCard` is negative (cherry-picking is suboptimal), the `annualTarget` at line 77 computes `(target >= 0 ? target : Math.abs(target)) * 12`, which produces a positive annual amount. However, during the count-up animation, `startAnnual` is `displayedAnnualSavings`, which is always >= 0. The animation interpolates from `startAnnual` to `annualTarget`, which are both positive, so the annual display always shows a positive number. This is consistent with the displayed text which says "추가 비용" (additional cost) when savings are negative.

  The issue is that `displayedAnnualSavings` represents the magnitude of the annual cost, but `displayedSavings` represents the signed value (which can be negative). During the animation, `displayedSavings` might be negative while `displayedAnnualSavings` is positive, which is consistent. No actual bug here -- the values are internally consistent.

- **Update:** On closer inspection, this is NOT a new finding. The behavior is correct: `displayedSavings` shows the signed value (with +/- prefix), and `displayedAnnualSavings` shows the absolute annual projection. The label switches between "절약" and "추가 비용" based on the sign. Withdrawing this finding.

---

### C44-03: `CardGrid.svelte` filter controls lack ARIA live region for dynamic result count

- **Severity:** LOW (accessibility)
- **Confidence:** Medium
- **File:** `apps/web/src/components/cards/CardGrid.svelte`
- **Description:** When the user filters cards by issuer or type, the displayed card count changes dynamically. Screen reader users are not notified of the result count change because there is no `aria-live` region announcing the updated count. This is a WCAG 2.2 accessibility concern (4.1.3 Status Messages).

  The card grid shows "검색 결과가 없어요" (no search results) when filters produce an empty set, but the transition from results to empty state (and vice versa) is not announced by screen readers.

- **Failure scenario:** A screen reader user selects a card type filter. The card count changes from 683 to 245, but the screen reader does not announce this change. The user must navigate to the card count text to discover how many cards match their filter.

- **Fix:** Add an `aria-live="polite"` region around the card count display that announces the number of matching cards when filters change.

---

## Final Sweep -- Cross-File Interactions

1. **Negative-amount handling consistency (COMPLETE INVENTORY):**
   - Server-side PDF: `amount <= 0` at `pdf/index.ts:104` -- CORRECT
   - Web-side PDF structured parse: `amount <= 0` at `pdf.ts:248` -- CORRECT
   - Web-side PDF fallback scan: `amount > 0` at `pdf.ts:360` -- CORRECT
   - Web-side CSV: `amount <= 0` at `csv.ts:72` -- CORRECT
   - Web-side XLSX: `amount <= 0` at `xlsx.ts:399` -- CORRECT
   - All 10 server-side CSV adapters: `amount <= 0` -- CORRECT
   - Server-side CSV generic: `amount <= 0` at `generic.ts:122` -- CORRECT
   - Downstream filters: `reward.ts:218` (`amount <= 0`), `greedy.ts:275` (`amount > 0`) -- CORRECT
   - `isOptimizableTx` at `store.svelte.ts:168` now uses `amount > 0` -- CORRECT (C43-01 fixed)

2. **`Math.abs(tx.amount)` inventory (after C42-02/C43-02 fix):**
   - `analyzer.ts:210` (performanceExclusions): Now uses `tx.amount` directly -- CORRECT (C43-02 fixed)
   - `analyzer.ts:290` (monthlyBreakdown): Uses `tx.amount` -- CORRECT
   - `store.svelte.ts:425` (reoptimize): Uses `tx.amount` -- CORRECT
   - `SavingsComparison.svelte:72,77` (annual target): Uses `Math.abs(target)` for negative savings -- CORRECT (different context)

3. **All `formatWon` implementations:** All have `Number.isFinite` guard + negative-zero normalization. Consistent.

4. **All `formatRate` implementations:** All have `Number.isFinite` guard. Consistent.

5. **Bare `catch {}` patterns:** D-106 still deferred (web-side PDF `tryStructuredParse` now logs warning). No new bare catches introduced.

6. **TransactionReview `changeCategory` mutation:** Uses `editedTxs[idx] = updated` with spread copy. Consistent with Svelte 5 reactivity (C53-01 fixed).

7. **`reoptimize` missing `previousMonthSpending` option:** C44-01 above. The `reoptimize()` method does not forward the original `AnalyzeOptions`.

8. **Full-page navigation (deferred):** `FileDropzone.svelte:238` and `CardDetail.svelte:267` still use `window.location.href`. Deferred per D-45/D-60.

---

## Summary of Active Findings (New in Cycle 44)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C44-01 | LOW | Medium | `apps/web/src/lib/store.svelte.ts:400` | `reoptimize` does not forward original `previousMonthSpending` option -- manual input silently dropped after category edit |
| C44-03 | LOW | Medium | `apps/web/src/components/cards/CardGrid.svelte` | Card filter result count changes lack ARIA live region for screen reader announcement |
