# Cycle 95 — perf-reviewer

**Scope:** Hot paths in core/optimizer/greedy, core/categorizer, core/calculator/reward, store.svelte, analyzer, parser adapters, UI animation loops.

## Verified Hot-Path Invariants

- `scoreCardsForTransaction`: push/pop pattern avoids O(m*n) temporary array allocation (C68-02).
- `greedyOptimize`: single sorted-transactions array reused; map-reference mutation avoids redundant `.set()` (C31-02). Filter guards `tx.amount > 0 && Number.isFinite(tx.amount)` (C23-01).
- `MerchantMatcher`: `SUBSTRING_SAFE_ENTRIES` precomputed at module level (C33-01).
- `store.svelte`: `cachedCategoryLabels` cached per store instance; empty-map poison guard (C72-03). `cachedCoreRules` poison guard (C72-02). `reoptimize` snapshot captured pre-await (C81-01).
- `SavingsComparison`: monotonic animation tracker avoids re-start dips (C82-02). `prefers-reduced-motion` skipped-animation path.
- `CategoryBreakdown`: single-pass categorize+bucketize.

## Known Performance Deferred Items (unchanged)

- D-09 / D-51 / D-86 `scoreCardsForTransaction` calls `calculateCardOutput` twice per card per transaction.
- D-79 `bestSingleCard` O(n*m).
- D-100 taxonomy findCategory O(n*k) scan.
- D-90 PDF `detectColumnBoundaries` iteration.
- D-111 getCardById O(n) scan of issuers/cards.

All remain below actionable thresholds at current scale (683 cards, typical <1000 transactions).

## New Findings

None. No new hot-path regressions introduced since cycle 94.

## Summary

0 new findings. Hot-paths remain well within acceptable budgets. No new caches, allocations, or sync bottlenecks introduced.
