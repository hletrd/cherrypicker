# Cycle 15 — Performance Review

**Date:** 2026-05-06
**Scope:** Performance analysis of optimization engine, parser pipelines, and web runtime.

## Findings

### C15-PERF01: Greedy optimizer push/pop mutation is fragile (MEDIUM)
- **File:** `packages/core/src/optimizer/greedy.ts:56-58`
- **Issue:** `scoreCardsForTransaction` mutates `currentTransactions` in-place (push, calculate, pop). This relies on `calculateCardOutput` not modifying the array. While currently safe (calculateCardOutput only reads), any future change to calculateRewards that mutates the transactions array would corrupt optimizer state silently.
- **Fix:** Replace the mutation pattern with a spread: `const after = calculateCardOutput([...currentTransactions, transaction], ...)` or add an explicit defensive copy. The comment at line 54 acknowledges the fragility.
- **Confidence:** Medium

### C15-PERF02: Monthly spending map rebuilds on every reoptimize (LOW)
- **File:** `apps/web/src/lib/store.svelte.ts:531-551`
- **Issue:** `reoptimize` rebuilds `monthlySpending` and `monthlyTxCount` Maps from scratch for every category edit. For large statement sets (10k+ transactions), this is O(n) per edit.
- **Mitigation:** Acceptable for typical usage (< 1000 transactions). The Svelte reactive system already debounces rapid edits.
- **Confidence:** Low

## Carry-over Performance Items
- D-09: scoreCardsForTransaction is O(n*m) per transaction — still acceptable for typical usage
- D-33: loadCategories fetches data already in cards.json — single small HTTP request, acceptable
