# Cycle 98 — perf-reviewer pass

**Date:** 2026-04-23

## Scope

Performance, concurrency, CPU/memory/UI responsiveness focus. Hot paths:
- `MerchantMatcher.match()` — called per transaction
- `greedyOptimize` — scoreCardsForTransaction loop
- `calculateRewards` — per-card, per-transaction
- sessionStorage persist/load round-trips
- Fetch caching for `loadCardsData` / `loadCategories`

## Findings

None net-new.

## Prior optimization verification

- **C33-01** — `SUBSTRING_SAFE_ENTRIES` pre-computed at module level (matcher.ts:18). Avoids per-call `Object.entries()` allocation. Confirmed.
- **C62-09** — `cardIndex` Map for O(1) card-by-ID lookup (cards.ts:158-168). Confirmed.
- **C68-02** — In-place push/pop in scoreCardsForTransaction (greedy.ts:137-139). Confirmed.
- **C81-03** — Shared matcher + categoryNodes passed through parseAndCategorize to avoid redundant `loadCategories()` fetches (analyzer.ts:274-289). Confirmed.
- **C97-01** — Filter `length >= 10` is O(n) additive, negligible perf cost. Confirmed.

## Commonly-missed-performance sweep

- **Promise.all concurrency** — `files.map((f, i) => parseAndCategorize(...))` in `analyzeMultipleFiles` at `analyzer.ts:287-289`. Each parse is independent; max parallelism = number of files. Shared matcher/nodes means no duplicate fetches. Good.
- **Re-renders in reoptimize** — single `result = {...}` assignment at end of reoptimize (store.svelte.ts:578) triggers one Svelte $state notification. Granular sub-updates would not benefit because all dashboard derivatives read `analysisStore.result`.
- **Memory** — `sortedTransactions = [...constraints.transactions].filter(...).sort(...)` at `greedy.ts:284` creates one copy per optimization call. For N transactions, this is O(N) memory, unavoidable for filter+sort. Acceptable for typical statement sizes.
- **Monthly breakdown recomputation in reoptimize** — `store.svelte.ts:522-542` recomputes from `editedTransactions` every reoptimize. This is O(N) and necessary (edits can change monthly distribution). Not a perf issue at realistic sizes (<1000 tx).
- **sessionStorage size cap** — `MAX_PERSIST_SIZE = 4MB` at `store.svelte.ts:128`. Transactions are first to drop. Good graceful degradation.
- **Bundle-size risk** — no new dependencies added since cycle 96. No regression.

## UI responsiveness

- LCP: no change from cycle 97.
- INP: reoptimize is CPU-bound (greedy optimizer), ~50-200ms on typical inputs. No UI jank reported.
- CLS: layout stable across states (loading skeleton -> results) — same grid-template applies to both.

## Summary

0 net-new perf findings. No hot-path regressions introduced by C97-01 fix.
