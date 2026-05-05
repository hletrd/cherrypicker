# Cycle 16 — Performance Review

**Date:** 2026-05-06
**Scope:** Performance, CPU/memory, UI responsiveness

## Findings

### C16-PERF01 [LOW] — `availableIssuers` recomputes with multiple filter passes
- **File:** `apps/web/src/components/cards/CardGrid.svelte:29-35`
- **Issue:** The `$derived.by` for `availableIssuers` creates a new sliced array and filters it on every `cards` change. The filtering logic is duplicated from `filteredCards`.
- **Impact:** For the current card count (~683), this is negligible. If the card database grows significantly or the component is used in a high-frequency rerender context, the duplicated work could matter.
- **Fix:** Derive `availableIssuers` from the already-filtered `filteredCards` or memoize the computation. Alternatively, precompute issuer lists from the raw data.
- **Confidence:** Low

### C16-PERF02 [LOW] — `reoptimize` rebuilds monthly maps from scratch
- **File:** `apps/web/src/lib/store.svelte.ts:510-530`
- **Issue:** On every category edit, `reoptimize` iterates all `editedTransactions` to rebuild `monthlySpending` and `monthlyTxCount` Maps.
- **Impact:** O(n) per edit. For typical usage (<1000 transactions) this is acceptable. The comment at line 512-513 mentions the rationale.
- **Fix:** If this becomes a bottleneck for large datasets, incrementally update the maps instead of rebuilding.
- **Confidence:** Low

## Carry-over Performance Items
- D-09: scoreCardsForTransaction O(n*m) per transaction — acceptable at current scale
- D-33: loadCategories fetches data already in cards.json — single small HTTP request, acceptable

## Summary
No new MEDIUM or HIGH performance findings. Two LOW items that are informational only at current scale.
