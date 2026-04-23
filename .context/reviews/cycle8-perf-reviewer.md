# Cycle 8 — perf-reviewer

## Inventory

Hot paths:
- `analyzer.ts::analyzeMultipleFiles` — calls `parseAndCategorize` in parallel; shares MerchantMatcher.
- `analyzer.ts::optimizeFromTransactions` — builds `cardPreviousSpending` per card (O(cards × transactions)).
- `store.svelte.ts::reoptimize` — runs `getLatestMonth`, filters, rebuilds monthlyBreakdown (O(n)), calls `optimizeFromTransactions` (O(cards × n)).
- `cards.ts::loadCardsData` — fetches JSON once, cached.

## Re-audit of D7-M12 (`getAllCardRules` refetched per reoptimize)

Confirmed: `analyzer.ts:185` calls `getAllCardRules()` every `optimizeFromTransactions` call. However:
- `getAllCardRules()` is a thin wrapper around `loadCardsData()` which is cached via `cachedCardRules` at the module level (confirmed from cards.ts).
- The expensive step is `toCoreCardRuleSets(allCardRules)` which IS cached at `analyzer.ts:193-195` via `cachedCoreRules`.
- So the real cost is: a Map lookup + an Array length check per reoptimize. Sub-millisecond.

Severity: LOW / High, but impact is negligible. **Keep deferred** unless profiling shows a bottleneck.

## New findings

### P8-01 — `reoptimize` recomputes monthlyBreakdown every call (LOW / Medium)

- File: `store.svelte.ts:517-542`
- Observation: `reoptimize` iterates all `editedTransactions` to build `updatedMonthlyBreakdown`. This is O(n). For 10k transactions this is ~1-5ms.
- Optimization: if user edits a single transaction, only that month's entry needs updating. But editing is low-frequency and n is small.
- Recommendation: defer. Not worth the complexity for current scale.

### P8-02 — Persist on every reoptimize writes 4MB max to sessionStorage (LOW / High)

- File: `store.svelte.ts:585`
- Observation: each reoptimize calls `persistToStorage(result)` which serializes up to 4MB. `JSON.stringify` on 10k transactions ≈ 5-20ms.
- Optimization: debounce persist to 200ms. But edit flow is already user-paced (slower than 200ms between edits), so benefit is negligible.
- Recommendation: defer. Already measured negligible.

## No new HIGH perf issues this cycle.
