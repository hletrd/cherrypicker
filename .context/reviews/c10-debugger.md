# Cycle 10 — Debugger

Date: 2026-04-24

## Latent bug surface analysis

### `calculateRewards` — global cap over-count correction
- **File+line:** `packages/core/src/calculator/reward.ts:312-331`
- **Analysis:** The global cap clipping logic correctly rolls back `ruleMonthUsed` by the over-count amount. The comment at lines 324-328 explains this clearly. No latent bug — the behavior is correct.
- **Status:** ALREADY TRACKED (D-77, LOW)

### `savingsPct` NaN path
- **File+line:** `apps/web/src/components/dashboard/SavingsComparison.svelte:93-117`
- **Analysis:** The `Number.isFinite(raw)` guard at line 116 correctly handles NaN from `0/0`. The `Infinity` sentinel for the "cherry-pick only" badge is documented and properly checked in the template. No bug.
- **Status:** ALREADY TRACKED (D-63/D-70)

### `reoptimize` stale state after navigation
- **File+line:** `apps/web/src/lib/store.svelte.ts:477-588`
- **Analysis:** The `snapshot` pattern (line 497) correctly prevents race conditions during async gaps. The early null guard (line 485) prevents accessing properties on null result. No latent bug.
- **Status:** ALREADY TRACKED (D-30, resolved by snapshot pattern)

### `editedTxs` not cleared on store reset
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:129-145`
- **Analysis:** The `$effect` correctly checks `txs.length > 0` and clears `editedTxs = []` when the store is reset (generation changes but transactions are empty). The C61-01 fix is intact.
- **Status:** RESOLVED (C61-01)

### `scoreCardsForTransaction` push/pop mutation
- **File+line:** `packages/core/src/optimizer/greedy.ts:141-143`
- **Analysis:** The `currentTransactions.push(transaction)` followed by `calculateCardOutput` and then `currentTransactions.pop()` is safe in JavaScript's single-threaded execution model. No concurrent access risk. The comment at lines 138-140 explains this clearly.
- **Status:** No bug

## Failure mode analysis

1. **Empty merchant name matching:** Guarded by `lower.length < 2` check in matcher.ts (line 42). Correctly returns `{ category: 'uncategorized', confidence: 0.0 }`.
2. **Negative-amount transactions:** Filtered by `tx.amount > 0` in calculateRewards (line 225) and greedyOptimize (line 289). Correctly excluded.
3. **NaN amounts:** Guarded by `Number.isFinite(tx.amount)` in greedyOptimize (line 289) and `isOptimizableTx` (line 207). Correctly excluded.
4. **SessionStorage quota exceeded:** Handled with try/catch and `persistWarningKind` tracking. Correct recovery behavior.

## Conclusion

Zero net-new latent bugs found. All previously identified failure modes have appropriate guards. The codebase is defensively coded with proper null checks, type guards, and error recovery.
