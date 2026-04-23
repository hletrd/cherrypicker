# Cycle 95 — code-reviewer

**Scope:** packages/core/src (calculator, optimizer, categorizer, models), packages/viz/src (report, terminal), packages/parser/src (detect, csv/, pdf/, xlsx), apps/web/src (lib, components), scripts/, tools/

**Focus:** Net-new code-quality / correctness / maintainability issues not covered by cycles 1-94.

---

## Files Inventoried

Full review-relevant inventory built from these roots:
- `packages/core/src/calculator/{reward,types,cashback,discount,points}.ts`
- `packages/core/src/optimizer/{greedy,ilp,constraints}.ts`
- `packages/core/src/categorizer/{matcher,taxonomy,keywords*}.ts`
- `packages/core/src/models/{card,transaction,result}.ts`, `packages/core/src/index.ts`
- `packages/viz/src/report/generator.ts`, `packages/viz/src/terminal/{summary,comparison}.ts`
- `packages/parser/src/detect.ts`, `packages/parser/src/csv/*.ts`, `packages/parser/src/pdf/*.ts`, `packages/parser/src/date-utils.ts`
- `apps/web/src/lib/{analyzer,cards,formatters,store.svelte,api,category-labels}.ts`
- `apps/web/src/components/dashboard/*.svelte`, `apps/web/src/components/upload/*.svelte`, `apps/web/src/components/ui/*.svelte`, `apps/web/src/components/report/*.svelte`, `apps/web/src/components/cards/*.svelte`

## Verification of Prior Fixes

All prior fixes verified still in place:

| Finding | Status | Evidence |
|---|---|---|
| C1-01 monthlySpending positive-only | CONFIRMED | `analyzer.ts:329`, `store.svelte.ts:531` |
| C1-12 findRule sort stability (indexOf tiebreaker) | CONFIRMED | `packages/core/src/calculator/reward.ts:90-94` |
| C7-01 generation init from storage | CONFIRMED | `store.svelte.ts:361` |
| C92-01 / C94-01 formatSavingsValue helper | CONFIRMED | `formatters.ts:224-227`, used in SavingsComparison / VisibilityToggle / ReportContent |
| C89-01 VisibilityToggle isConnected guard | CONFIRMED | `VisibilityToggle.svelte` |
| C89-02 rawPct rounded threshold for <2% | CONFIRMED | `CategoryBreakdown.svelte:124-128` |
| C2-01 / C5-01 buildCategoryTable skips tx.amount<=0 | CONFIRMED | `generator.ts:73`, `analyzer.ts:231` |
| C3-01 / C4-01 includedCount summary row | CONFIRMED | `generator.ts:121`, `terminal/summary.ts:69` |
| C44-01 previousMonthSpendingOption preserved across reoptimize | CONFIRMED | `store.svelte.ts:470-472, 551-566` |
| C81-01 snapshot in reoptimize to avoid concurrent-mutation | CONFIRMED | `store.svelte.ts:504-506, 578-583` |
| C82-01 atomic TransactionReview sync | CONFIRMED | `TransactionReview.svelte:123-139` |
| C82-02 / C82-03 animation hold target + ≥100 prefix threshold | CONFIRMED | `SavingsComparison.svelte:48-73`, `formatters.ts:226` |
| C83-02 / C83-04 plain lets for effect-local trackers | CONFIRMED | `SavingsComparison.svelte:47-49`, `SpendingSummary.svelte:15` |
| C40-04 buildCardResults requires pre-filtered positive transactions | CONFIRMED | `greedy.ts:239` comment + line 285 filter |
| C72-02 / C72-03 empty-array cache poison guards | CONFIRMED | `analyzer.ts:193-195` for coreRules, `store.svelte.ts:393-397` for category labels |
| C79-01 changeCategory clears rawCategory | CONFIRMED | `TransactionReview.svelte:182,185` |

## New Findings

No new actionable findings this cycle.

### Areas re-examined without new findings

1. **reward.ts:** `calculateRewards` correctly handles the rate-vs-fixedAmount exclusivity (warning + rate-only path), global-cap rollback of `ruleMonthUsed`, and dominant-type accumulation. Guard `normalizedRate > 0` prevents degenerate 0-rate paths. `findRule` secondary-sort is stable.

2. **greedy.ts:** `scoreCardsForTransaction` push/pop pattern preserves the array-reference invariant. `buildCardResults` includes the pre-filtered-input comment (C40-04). `bestSingleCard` uses `sortedTransactions` which is already positive-filtered. `buildAssignments` recalculates `current.rate` from accumulated spending/reward (C50-05).

3. **store.svelte.ts:** `loadFromStorage` applies migrations before validation, treats undefined `_v` as version 0 for legacy data, shallow-validates `cardResults`, and silently drops invalid transactions (with a `persistWarningKind = 'corrupted'` flag when all entries fail validation). `reoptimize` uses snapshot pattern (C81-01) to prevent mid-animation mutation mixing.

4. **analyzer.ts:** Empty-category guards (`C71-02`) prevent silent mis-categorization. `cachedCoreRules` has empty-array poison guard (`C72-02`). `cardPreviousSpending` builds per-card `performanceExclusions` using three key-forms (parent, leaf, dot).

5. **formatters.ts:** `formatSavingsValue` uses `Math.abs()` on the display value and decides the `+` prefix from a separate `prefixValue` (defaulting to value), preventing animated-intermediate sign flicker. `formatWon` normalizes negative-zero. `formatYearMonthKo` guards `parseInt` NaN.

6. **SavingsComparison.svelte:** Count-up animation respects `prefers-reduced-motion`, uses monotonic target tracking (`lastTargetSavings`/`lastTargetAnnual`), and both `displayedSavings` and `displayedAnnualSavings` animate in lockstep (C41-01). `savingsPct === Infinity` is a well-labelled sentinel (C50-02). Suboptimal branch correctly inverts bar widths.

7. **CategoryBreakdown.svelte:** Dot-notation subcategory colors added (C81-04) prevent "uncategorized gray" fallback for sub-categorized assignments. Rounded percentage threshold matches displayed value (C89-02).

8. **OptimalCardMap.svelte:** `maxRate` guards zero-rate case with 0.001 floor (C12-01). Sort pattern uses `as const` type narrowing. `toggleRow` uses immutable Set pattern (C54-03). `rateBarWidth` bounded by clamping via `maxRate`.

9. **TransactionReview.svelte:** Atomic store-read pattern (C82-01). `changeCategory` uses in-place `editedTxs[idx] = updated` for array-mutation tracking (C22-05 / C39-02). `displayTxs` search matches merchant/category/subcategory labels with null-safe access. `onMount` AbortController aborts loadCategories on unmount (C73-02).

10. **SpendingSummary.svelte:** Monthly comparison uses regex-validated month strings with parseInt/NaN guards. `totalAllSpending` derived. `dismissed` resets on new generation (C78-01). Persist-warning rendering distinguishes truncated / corrupted / error kinds.

11. **viz/report/generator.ts:** Template uses `replaceAll` (safe), `esc()` escapes `&<>"`. `buildCategoryTable` skips non-positive amounts. Summary row uses `includedCount`.

12. **parser/detect.ts:** `detectBank` regex patterns have `lastIndex = 0` defensive reset (C10-11 / D-83). Single-pattern banks capped at 0.5 confidence (C70-01).

13. **parser/date-utils.ts (server-side):** All parseInt branches validate year/month/day ranges. `inferYear` look-back heuristic handles year rollover.

14. **categorizer/matcher.ts:** `lower.length < 2` early guard. Precomputed `SUBSTRING_SAFE_ENTRIES` eliminates per-call `Object.entries()` allocation (C33-01). Reverse-fuzzy only applies when `lower.length >= 3`.

15. **categorizer/taxonomy.ts:** Same `lower.length >= 3` guard for reverse-fuzzy. Substring match skips single-char keywords.

## Still-Open Deferred Items (carried forward unchanged)

See `./plans/00-deferred-items.md` — D-01 through D-111 remain deferred with severity preserved and per-item exit criteria.

## Summary

Cycle 95 found 0 new actionable findings. Prior fixes confirmed in place. Baseline gates (verify, build) are green (turbo cache hit). Convergence continues.
