# Cycle 84 Comprehensive Review — 2026-04-22

**Reviewer:** Single deep-scan agent (all specialist perspectives merged)
**Scope:** Full repo re-read of all source files, fix verification, cross-file interaction analysis

---

## Verification of Prior Cycle Fixes

All prior cycle 1-83 findings are confirmed fixed except as noted in `_aggregate.md`. C83 findings verified this cycle:

| Finding | Status | Evidence |
|---|---|---|
| C83-01 | OPEN (MEDIUM) | `ReportContent.svelte:48` still uses `>= 100` for sign prefix — but this was the FIX from C83-01, matching SavingsComparison's `>= 100` threshold. Now CONSISTENT. |
| C83-02 | **FIXED** | `SavingsComparison.svelte:48-49` now uses plain `let` instead of `$state` for `lastTargetSavings`/`lastTargetAnnual`. |
| C83-03 | **FIXED** | `SavingsComparison.svelte:235` and `ReportContent.svelte:48` both use `Math.abs()` for negative values under "추가 비용" label. |
| C83-04 | **FIXED** | `SpendingSummary.svelte:15` now uses plain `let` instead of `$state` for `lastWarningGeneration`. |
| C83-05 | **FIXED** | `detect.ts:175` now slices to first 30 lines for delimiter detection. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C84-01 | MEDIUM | HIGH | `apps/web/src/components/ui/VisibilityToggle.svelte:93` | Sign-prefix inconsistency: VisibilityToggle uses `> 0` threshold for the "+" prefix on `stat-total-savings` element (`opt.savingsVsSingleCard > 0 ? '+' : ''`), while SavingsComparison and ReportContent use `>= 100` (C82-03/C83-01). For small savings (1-99 won), the results page shows "+1원" while the dashboard and report show "1원". The same 100-won threshold should apply here. |
| C84-02 | LOW | MEDIUM | `apps/web/src/components/ui/VisibilityToggle.svelte:93` | Negative savings display: VisibilityToggle shows `formatWon(opt.savingsVsSingleCard)` which includes a minus sign for negative values. Under the "예상 절약액" label that is dynamically changed to "추가 비용" (line 108), the minus sign is redundant, same issue as C83-03 but in a different component. SavingsComparison and ReportContent now use `Math.abs()` for this case. |
| C84-03 | LOW | LOW | `apps/web/src/lib/store.svelte.ts:206-209` | `isOptimizableTx` validates `obj.amount > 0` which correctly rejects zero/negative amounts, but does not validate `Number.isFinite(obj.amount)`. A restored transaction with `amount: NaN` would pass `typeof obj.amount === 'number'` but fail `obj.amount > 0` (NaN > 0 is false), so the check is effectively safe. However, `amount: Infinity` would pass all checks including `Infinity > 0`, which is technically a bug. This is extremely unlikely in practice since `JSON.parse` never produces Infinity. |

---

## Cross-File Interaction Analysis

### Sign-Prefix Consistency Across Three Components
Three components display the `savingsVsSingleCard` value with sign prefixes:

1. **SavingsComparison.svelte:235** — Uses `displayedSavings >= 100 ? '+' : ''` (C82-03 fix) and `Math.abs()` for negative (C83-03 fix)
2. **ReportContent.svelte:48** — Uses `opt.savingsVsSingleCard >= 100 ? '+' : ''` (C83-01 fix) and `Math.abs()` for negative (C83-03 fix)
3. **VisibilityToggle.svelte:93** — Uses `opt.savingsVsSingleCard > 0 ? '+' : ''` (NO 100-won threshold, NO Math.abs for negative)

The VisibilityToggle is the outlier and should be updated to match the other two.

### Data Flow Verified
- `analysisStore.analyze()` -> `analyzeMultipleFiles()` -> `parseAndCategorize()` -> `optimizeFromTransactions()` -> `setResult()` -> `persistToStorage()` — all data flows verified correct
- `reoptimize()` correctly snapshots result (C81-01), filters to latest month, recomputes monthlyBreakdown from editedTransactions
- `loadFromStorage()` validates structure, applies migrations, handles version mismatches

---

## Final Sweep — No Skipped Files

All source files in `apps/web/src/`, `packages/core/src/`, `packages/rules/src/`, `packages/parser/src/`, `packages/viz/src/`, `tools/cli/src/`, `tools/scraper/src/` were examined or verified as unchanged since last review.
