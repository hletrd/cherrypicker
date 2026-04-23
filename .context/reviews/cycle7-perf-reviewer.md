# Cycle 7 — perf-reviewer

Focus: performance hotspots, unnecessary work, memoization opportunities.

## Findings

### P7-01 — `loadCategories` + `getAllCardRules` fetched twice on upload [LOW / High]

- File: `apps/web/src/lib/analyzer.ts:274, :244`.
- Evidence: `analyzeMultipleFiles` calls `loadCategories()` at line 274 to build MerchantMatcher, then `optimizeFromTransactions` at line 361 potentially calls `loadCategories()` again at line 244 (unless prebuiltCategoryLabels is passed — which it IS in this flow, good). Similarly `getAllCardRules` is fetched inside optimizeFromTransactions each call. The `cachedCoreRules` gate at line 187 avoids re-transforming but still awaits the fetch.
- Concrete impact: one extra `/data/cards.json` fetch per reoptimize call. ~10-50ms each.
- Fix sketch: cache the raw `getAllCardRules()` promise alongside the transformed `cachedCoreRules`.

### P7-02 — `$effect` in TransactionReview runs reactive getter calls repeatedly [LOW / Medium]

- File: `apps/web/src/components/dashboard/TransactionReview.svelte:123-139`.
- Evidence: the effect reads `analysisStore.result`, `analysisStore.generation`. Each getter call creates a new reactive dependency. If the store uses Svelte's built-in reactivity properly, this is fine — but the effect will re-run on EVERY generation bump and result-reference swap. After the cycle 6 fix, this should be idempotent.
- Fix: none needed — monitor only.

### P7-03 — `sortedAssignments` sort creates a new array on every render [LOW / Medium]

- File: `apps/web/src/components/dashboard/OptimalCardMap.svelte:28-35`.
- Evidence: `[...assignments].sort(...)` copies the array. For typical dashboard sizes (~20-30 categories) this is trivial. For large statements (100+ categories) still negligible.
- Fix: none.

### P7-04 — `SavingsComparison` count-up animation uses `requestAnimationFrame` loop [LOW / Low]

- File: `apps/web/src/components/dashboard/SavingsComparison.svelte:79-87`.
- Evidence: 600ms animation at 60fps = 36 frames. Cheap.
- Fix: none.

### P7-05 — `displayTxs` re-runs filter+search on every keystroke [LOW / Low]

- File: `apps/web/src/components/dashboard/TransactionReview.svelte:141-163`.
- Evidence: each keystroke triggers `$derived.by` recomputation. Filter is O(n). Search does a nested `categoryMap.get` per tx. Acceptable for typical statement size (< 1000 txs). Debounce would be polish.
- Fix: optional debounce; defer.

### P7-06 — Svelte keyed each `{#each displayTxs as tx (tx.id)}` [OK]

- File: TransactionReview.svelte:277.
- Evidence: keyed by tx.id. Good — minimises DOM churn on re-render.

### P7-07 — Module-level caches not cleared between test runs [LOW / Low]

- File: `apps/web/src/lib/analyzer.ts:48` (cachedCoreRules).
- Evidence: `invalidateAnalyzerCaches()` is called from `analysisStore.reset()`. Tests that reset the store between runs should be fine.

### P7-08 — Startup: Svelte hydration on dashboard runs 5 `client:load` islands simultaneously [LOW / Medium]

- File: `apps/web/src/pages/dashboard.astro:60, 74, 88, 93, 107`.
- Evidence: 5 islands hydrate on page load. Each calls `loadCategories()` or reads the store. The MerchantMatcher is already populated (the store caches it indirectly via sessionStorage with transactions), but each island re-reads categoryLabels from its own `loadCategories()` fetch. Network cache dedupes but not the JSON parse.
- Fix: share the categoryLabels via a derived store or pass via prop. Probably not worth the complexity.

## Summary

No HIGH-severity perf findings. Cycle 6 already addressed several perf optimisations (C22-05/C39-02 keyed each, C44-01 previousMonthSpending preservation, C50-05 cardBreakdown derived). No cycle-7 perf work scheduled.
