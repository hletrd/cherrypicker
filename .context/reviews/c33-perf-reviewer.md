# Cycle 33 Performance Review — CherryPicker

**Agent:** c33-perf-reviewer  
**Date:** 2026-05-06  
**Status:** Agent spawn failed; review performed by orchestrator

---

## Finding 1: Greedy optimizer retains O(T²·C) complexity [HIGH / High confidence]

**File:** `packages/core/src/optimizer/greedy.ts:39-66`

**Problem:** `scoreCardsForTransaction` recalculates the full card output (`calculateCardOutput`) for every card, for every transaction. For T transactions and C cards, this is O(T × C × T') where T' is the average number of transactions already assigned to a card. In practice this approaches O(T² × C).

```typescript
const before = calculateCardOutput(currentTransactions, previousMonthSpending, rule).totalReward;
const after = calculateCardOutput([...currentTransactions, transaction], previousMonthSpending, rule).totalReward;
```

The comment at line 54 notes `transaction.amount is guaranteed positive here`, but doesn't address the algorithmic complexity.

**Concrete impact:** With 1000 transactions and 100 cards, each transaction triggers 100 full reward calculations. Each calculation iterates all transactions already on that card. Total operations: ~50M reward calculations. This scales poorly for users with large statements.

**Suggested fix:** Memoize incremental reward deltas. Instead of recomputing from scratch, track per-card running totals and only compute the marginal reward for the new transaction. This reduces complexity to O(T × C).

**Confidence:** High

---

## Finding 2: `Blob` used for string size calculation instead of `TextEncoder` [LOW / Medium confidence]

**File:** `apps/web/src/lib/store.svelte.ts:170`

**Problem:** `new Blob([serialized]).size` creates a Blob object just to measure byte size. `Blob` construction has overhead and may trigger garbage collection pressure for large payloads.

**Concrete impact:** For a 4MB serialized payload, Blob creation adds ~1-2ms per persist operation. With frequent reoptimizations (e.g., after each category edit), this adds up.

**Suggested fix:** Use `new TextEncoder().encode(serialized).length` which is faster and avoids Blob allocation.

**Confidence:** Medium

---

## Finding 3: `buildAssignments` iterates entire `txAssignments` array redundantly [LOW / Medium confidence]

**File:** `packages/core/src/optimizer/greedy.ts:68-131`

**Problem:** The function iterates all `txAssignments` to build `assignmentMap`, then iterates again to build `alternativeRewardMap`, then iterates `assignmentMap` to attach alternatives. This is O(N) three times for the same data.

**Suggested fix:** Combine the first two passes into a single iteration.

**Confidence:** Medium

---

## Final Sweep

- No DOM thrashing detected in Svelte components.
- No unnecessary re-renders in store.svelte.ts (reactive $state is used correctly).
- Parser buffering is reasonable — files are processed streaming where possible.
- No event loop blocking operations found.
