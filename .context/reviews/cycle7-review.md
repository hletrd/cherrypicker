# Cycle 7 Review (2026-04-22)

**Scope:** packages/core/src, apps/web/src, packages/viz/src, packages/parser/src
**Focus:** Bugs, edge cases, security issues (excluding refund-filtering — already thoroughly fixed)

---

## Files Reviewed

| Package | Files |
|---|---|
| core | calculator/{cashback,discount,points,reward,types}.ts, optimizer/{greedy,ilp,constraints}.ts, categorizer/{matcher,taxonomy,index}.ts, models/{transaction,result,card}.ts |
| web | lib/{analyzer,cards,formatters,store.svelte,api,category-labels}.ts, components/{dashboard/*,upload/*,ui/*,report/*,cards/*}.svelte |
| viz | report/generator.ts, terminal/{comparison,summary}.ts |
| parser | csv/{shared,kb,samsung,hana,shinhan,woori}.ts, detect.ts, date-utils.ts |

---

## Verification of Prior Cycle Fixes

All prior fixes confirmed still in place:

| Finding | Status | Evidence |
|---|---|---|
| C1-01 monthlySpending positive-only | CONFIRMED | analyzer.ts:329, store.svelte.ts:526 |
| C1-12 findRule sort stability | CONFIRMED | reward.ts:90-93 indexOf tiebreak |
| C1-21 Truncation + reoptimize | CONFIRMED | store.svelte.ts recalc monthlyBreakdown |
| C92-01/C94-01 formatSavingsValue | CONFIRMED | formatters.ts:224-227 |
| C89-02 rawPct threshold rounding | CONFIRMED | CategoryBreakdown.svelte:128 |
| C89-01 classList.toggle isConnected guard | CONFIRMED | VisibilityToggle.svelte:31 |
| C2-01 buildCategoryTable skips tx.amount<=0 | CONFIRMED | generator.ts:73 |
| C3-01/C4-01 includedCount for summary row | CONFIRMED | generator.ts:119, summary.ts:69 |
| C5-01 performanceExclusions tx.amount > 0 | CONFIRMED | analyzer.ts:231 |

---

## New Findings

### C7-01: TransactionReview fails to sync transactions after page refresh

**Severity:** MEDIUM
**Location:** `apps/web/src/lib/store.svelte.ts:353` (generation initialization)
**Impact:** After a page refresh where analysis data is restored from sessionStorage, the TransactionReview component shows an empty state with the message "거래 상세 내역은 현재 브라우저 세션 메모리에만 보관되고..." even when the transactions ARE present in the store. Other dashboard components (SpendingSummary, CategoryBreakdown, SavingsComparison, OptimalCardMap) work correctly because they read directly from the store's reactive getters.

**Root cause:** `createAnalysisStore()` initializes `generation` to `$state(0)` regardless of whether `loadFromStorage()` returns data. TransactionReview's sync `$effect` (line 123-138) only populates `editedTxs` when `gen !== lastSyncedGeneration`. After a refresh, both are 0, so the condition `0 !== 0` is false and `editedTxs` stays empty.

**Reproduction:**
1. Upload a statement and navigate to the dashboard
2. Refresh the page (F5)
3. Observe: SpendingSummary, CategoryBreakdown etc. show data correctly, but TransactionReview shows the "data not persisted" message instead of the transaction list

**Fix:** Initialize `generation` to 1 when `loadFromStorage()` returns non-null data, so TransactionReview's sync effect triggers on mount with `1 !== 0`.

---

## Areas Reviewed Without New Findings

1. **Reward calculation (reward.ts):** `calculateRewards` correctly skips `tx.amount <= 0` and non-KRW transactions. Global cap rollback correctly adjusts `ruleMonthUsed`. `rewardTypeAccum` correctly tracks dominant type. `applyMonthlyCap` and `calculatePercentageReward` are consistent.

2. **Greedy optimizer (greedy.ts):** Transaction filter correctly uses `tx.amount > 0 && Number.isFinite(tx.amount)`. `scoreCardsForTransaction` push/pop is safe. `buildCardResults` sums `tx.amount` directly (optimizer only assigns positive transactions).

3. **Categorizer (matcher.ts, taxonomy.ts):** `MerchantMatcher.match()` correctly short-circuits on short merchant names (< 2 chars). Substring matching uses precomputed `SUBSTRING_SAFE_ENTRIES`. `rawCategory` validation checks `knownCategories` set.

4. **Analyzer (analyzer.ts):** `performanceExclusions` filter correctly checks all three key forms. Multi-file merge uses `localeCompare` for date sorting. `getLatestMonth` returns `null` for empty arrays.

5. **Session storage persistence (store.svelte.ts):** Version migration runs before validation. `isOptimizableTx` type guard checks all required fields. Persist warnings are correctly tracked.

6. **Formatters (formatters.ts):** `formatWon` normalizes negative zero. `formatSavingsValue` uses `Math.abs(value)` unconditionally. `buildPageUrl` handles BASE_URL with/without trailing slash.

7. **Card data loading (cards.ts):** `chainAbortSignal` correctly chains signals. Retry on undefined result handles AbortError race. `cardIndex` provides O(1) lookups.

8. **CSV parsing (shared.ts):** `splitCSVLine` handles RFC 4180 quoted fields. `parseCSVAmount` handles parenthesized negatives and Korean Won suffix. `isValidCSVAmount` is a correct type guard.

9. **Date parsing (date-utils.ts):** All branches validate month/day ranges. `inferYear` look-back heuristic handles year rollover.

10. **HTML report (generator.ts):** `esc()` properly HTML-escapes all user-provided strings. `buildCategoryTable` correctly skips `tx.amount <= 0`.

11. **Svelte components:** All dashboard components correctly read from `analysisStore` reactive state. `CategoryBreakdown` uses rounded pct for < 2% threshold. `SavingsComparison` animation handles reduced motion. `TransactionReview` category changes use fully-qualified IDs. `FileDropzone` validates file types and sizes.

---

## Still-Open Actionable Items (LOW, carried forward)

| Priority | ID | Finding | Effort | Impact |
|---|---|---|---|---|
| 1 | C1-N01 | formatIssuerNameKo 24-entry hardcoded map drifts from YAML | Medium | Correctness |
| 2 | C1-N02 | CATEGORY_COLORS 84-entry hardcoded map drifts from YAML | Medium | Correctness |
| 3 | C1-N04 | Web parser CSV helpers duplicated from server shared.ts | Large | Maintenance |
| 4 | C89-03 | formatters.ts m! non-null assertion after length check | Small | Type safety |

---

## Summary

Cycle 7 found 1 new actionable finding (C7-01): TransactionReview fails to sync transactions after a page refresh because the store's `generation` counter stays at 0 when data is loaded from sessionStorage. The fix is to initialize `generation` to 1 when the store has data from storage, so TransactionReview's sync effect triggers correctly.
