# Cycle 34 — Performance Reviewer Findings

**Date:** 2026-05-06
**Scope:** Performance, CPU/memory, scalability

---

## Still Not Fixed

### F2: Greedy Optimizer O(T*C) Complexity [HIGH]
- **File:** `packages/core/src/optimizer/greedy.ts:39-66`
- **Status:** Unchanged. `scoreCardsForTransaction` calls `calculateCardOutput` twice per card per transaction (before/after).
- **Code:**
  ```ts
  const before = calculateCardOutput(currentTransactions, previousMonthSpending, rule).totalReward;
  const after = calculateCardOutput([...currentTransactions, transaction], previousMonthSpending, rule).totalReward;
  ```
- **Impact:** For N transactions and C cards, full reward recalculation happens O(N*C) times. Each recalculation iterates all current transactions for that card, making overall complexity O(N*C*T) where T is average transactions per card.
- **Scenario:** 500 transactions across 10 cards = 5,000 full reward recalculations. Each recalculation touches progressively more transactions. Worst-case quadratic in total transaction count.
- **Fix:** Memoize incremental reward deltas. Track marginal reward per card per transaction instead of full recalculation.

---

## Verified Fixed

- **C33-F13** Blob→TextEncoder: `store.svelte.ts:177` now uses `new TextEncoder().encode(serialized).length`.

---

## No New Performance Issues

No new performance regressions detected. The LRU cache fix from C32 remains in place (`matcher.ts:45-50`).
