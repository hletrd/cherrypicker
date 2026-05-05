# Cycle 23 Implementation Plan

## New Findings to Address

### C23-01 (MEDIUM): Greedy optimizer has no NaN guard on transaction amounts
- **File:** `packages/core/src/optimizer/greedy.ts`
- **Problem:** The greedy optimizer filters `tx.amount > 0` (line 266) but does not guard against `NaN` amounts. If a NaN amount somehow passes upstream validation, `NaN > 0` is `false` (filtered out), but the sort `b.amount - a.amount` on line 267 would produce `NaN` comparisons which sort inconsistently across JS engines.
- **Fix:** Add `Number.isFinite(tx.amount)` to the filter on line 266, changing from `.filter((tx) => tx.amount > 0)` to `.filter((tx) => tx.amount > 0 && Number.isFinite(tx.amount))`. This makes the optimizer defensive against upstream parser bugs without changing behavior for valid data.
- **Status:** DONE -- committed as `0000000abe6071bd5038dd0de612abb4b148135f`

### C23-03 (LOW): SpendingSummary monthDiff can display "NaN개월 전 실적"
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte`
- **Problem:** The monthly difference calculation at lines 131-138 can produce "NaN개월 전 실적" in the UI if `monthDiff` is `NaN` (e.g. from corrupted month strings). The `monthDiff === 1` check fails correctly, but the else-branch template interpolates `NaN` directly.
- **Fix:** Add a guard for `!Number.isFinite(monthDiff)` on line 138. Change from `{@const prevLabel = monthDiff === 1 ? '전월실적' : `${monthDiff}개월 전 실적`}` to `{@const prevLabel = !Number.isFinite(monthDiff) ? '이전 실적' : monthDiff === 1 ? '전월실적' : `${monthDiff}개월 전 실적`}`. This provides a safe fallback display instead of "NaN개월 전 실적".
- **Status:** DONE -- committed as `00000005621797fc88446b6113c25a77348b9a9c`

## Previously Open Findings Addressable This Cycle

None of the remaining open MEDIUM findings are easily fixable this cycle:
- C8-01 (AI categorizer dead code): The 40-line stub documents the disabled state. TransactionReview comment is already reduced to one line. Further reduction risks losing the feature-flag intent.
- C18-01/C21-01 (VisibilityToggle DOM manipulation): The pattern is functional and already improved. A proper fix requires refactoring to Svelte reactive bindings, which is a larger architectural change.

## Deferred Items

### C23-02 (LOW): toCoreCardRuleSets cache never invalidated
- **Reason for deferral:** Same class as C21-04 (cachedCategoryLabels). The underlying `cards.json` data is static and never changes within a session. The cache assumption is documented at lines 42-46. Adding invalidation would require a cache-busting mechanism that adds complexity for no practical benefit.
- **Exit criterion:** If the card data source becomes dynamic within a session, add a `clearAnalyzerCaches()` function and call it from `store.reset()`.

### C23-04 (LOW): Generic CSV header detection heuristic is imprecise
- **Reason for deferral:** The `hasNonNumeric` heuristic works for the common case. Bank-specific adapters avoid this by checking for specific header keywords. Improving the generic parser's heuristic would require either (a) a more sophisticated header detection algorithm (e.g., checking for date+merchant+amount column patterns), or (b) making the generic parser aware of all bank header keywords. Option (a) is a significant refactor; option (b) duplicates bank-specific adapter logic.
- **Exit criterion:** If users report incorrect parsing of CSV files from banks without dedicated adapters, implement a column-pattern-based header detection in the generic parser.

### C23-05 (LOW): parseCSV falls through to generic parser with no bank knowledge when no adapter matches
- **Reason for deferral:** This is expected behavior for unrecognized bank formats. The generic parser handles these cases with reduced reliability. Adding bank-specific column knowledge to the generic parser would duplicate adapter logic. The proper fix is adding dedicated adapters per C22-04/D-06.
- **Exit criterion:** When C22-04 is resolved (dedicated CSV adapters for remaining banks), this will be automatically improved.
