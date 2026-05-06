# Cycle 25 — Performance Reviewer (2026-05-06)

## Finding 1: Greedy optimizer double reward calculation [C25-PERF01] — LOW

**File:** `packages/core/src/optimizer/greedy.ts:51-52`
**Function:** `scoreCardsForTransaction`

For every transaction and every card, `calculateCardOutput` is called twice:
1. Once with `currentTransactions` (to compute `before`)
2. Once with `[...currentTransactions, transaction]` (to compute `after`)

`calculateCardOutput` internally calls `calculateRewards` which iterates over all transactions, builds category keys, computes rates, evaluates caps, etc. This is not a cheap operation.

For typical inputs (10 cards, 500 transactions), that's 10 * 500 * 2 = 10,000 full reward calculations.

**Analysis:** `calculateRewards` does not support incremental updates. The marginal reward for adding one transaction depends on cap state changes that aren't externally observable. Caching marginal rewards per (card, category) would be complex due to cap interactions.

**Recommendation:** Defer. The complexity of incremental reward computation outweighs the benefit for typical statement sizes (< 1000 transactions). Revisit if users report slow optimization on large statements.

## No Change to C24-PERF01

The per-cell `isSummaryRow` checks in `apps/web/src/lib/parser/html.ts:182-227` remain as deferred from cycle 24. No new performance findings.
