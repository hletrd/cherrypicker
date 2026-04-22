# Verifier Review -- Cycle 1 (2026-04-22)

## Evidence-Based Correctness Checks

### VR-01: calculateRewards global cap rollback is correct
- **File**: `packages/core/src/calculator/reward.ts:299-320`
- **Claim**: When the global cap clips a reward, the rule-level tracker is rolled back by the overcount amount.
- **Evidence**: Line 317: `ruleMonthUsed.set(rewardKey, ruleResult.newMonthUsed - overcount)` where `overcount = rewardAfterMonthlyCap - appliedReward`. This correctly rolls back the rule-level usage to reflect only what was actually applied.
- **Verdict**: CORRECT. The rollback ensures subsequent transactions see the correct remaining rule-level cap.

### VR-02: greedyOptimize filters NaN/Infinity amounts
- **File**: `packages/core/src/optimizer/greedy.ts:284-286`
- **Claim**: NaN and Infinity amounts are filtered before optimization.
- **Evidence**: Line 285: `.filter((tx) => tx.amount > 0 && Number.isFinite(tx.amount))`. `NaN > 0` is `false`, and `Number.isFinite(NaN)` is `false`, so both are excluded. `Infinity > 0` is `true` but `Number.isFinite(Infinity)` is `false`, so Infinity is also excluded.
- **Verdict**: CORRECT. Both NaN and Infinity are properly filtered.

### VR-03: buildCardResults totalSpending uses tx.amount directly
- **File**: `packages/core/src/optimizer/greedy.ts:239`
- **Claim**: totalSpending is computed from pre-filtered positive-amount transactions.
- **Evidence**: Line 239: `assignedTransactions.reduce((sum, tx) => sum + tx.amount, 0)`. The `assignedTransactions` come from `assignedTransactionsByCard` which only receives transactions added at line 308, which are the filtered positive-amount ones from line 285.
- **Verdict**: CORRECT. The data flow guarantees positive-only amounts reach this code.

### VR-04: SavingsComparison animation starts from lastTargetSavings
- **File**: `apps/web/src/components/dashboard/SavingsComparison.svelte:69-73`
- **Claim**: Animation starts from the last target value, not the current displayed value, to prevent dips during rapid reoptimize clicks.
- **Evidence**: Line 69: `const startVal = lastTargetSavings;` and line 72: `lastTargetSavings = target;`. The animation always starts from the previous target and ends at the new target.
- **Verdict**: CORRECT. The "dip" prevention mechanism works as described.

### VR-05: formatSavingsValue centralizes sign-prefix logic
- **File**: `apps/web/src/lib/formatters.ts:215-218`
- **Claim**: `formatSavingsValue` uses unconditional Math.abs() and a threshold-based '+' prefix.
- **Evidence**: Line 217: `(effectivePrefixValue >= 100 ? '+' : '') + formatWon(Math.abs(value))`. This correctly shows magnitude (abs) and adds '+' only when the prefix-decision value is >= 100 won.
- **Verdict**: CORRECT. The centralization eliminates the prior triplication.

### VR-06: detectBank confidence capping for single-pattern banks
- **File**: `packages/parser/src/detect.ts:141-143`
- **Claim**: Single-pattern banks have confidence capped at 0.5 to prevent false positives.
- **Evidence**: Line 141-143: `if (bestBank && bestBank.patterns.length < 2 && bestScore < 2) { confidence = Math.min(confidence, 0.5); }`. This correctly limits confidence for banks like `cu` (신협) which has only one pattern.
- **Verdict**: CORRECT. The capping logic is sound.

### VR-07: reoptimize uses snapshot to prevent race condition
- **File**: `apps/web/src/lib/store.svelte.ts:501`
- **Claim**: `reoptimize` snapshots the result at function entry to prevent mixing data from concurrent analysis runs.
- **Evidence**: Line 501: `const snapshot = result;` and line 569: `result = { ...snapshot, ... }`. The spread uses the snapshot, not the reactive `result` variable.
- **Verdict**: CORRECT. The snapshot prevents the race condition.

### VR-08: potential issue -- monthlySpending includes negative amounts
- **File**: `apps/web/src/lib/analyzer.ts:321`
- **Claim**: `monthlySpending` accumulation adds `tx.amount` for all transactions.
- **Evidence**: Line 321: `monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + tx.amount)`. Unlike the optimizer which filters `tx.amount > 0`, this accumulation includes ALL transactions including refunds (negative amounts). This means the "previousMonthSpending" used for performance tier calculation could be reduced by refunds, potentially placing the user in a lower tier.
- **Failure scenario**: A user has 500,000 won in purchases and 200,000 in refunds. monthlySpending shows 300,000. But the card's performance tier is based on gross spending (purchases only), not net. The user qualifies for a higher tier but is placed in a lower one.
- **Verdict**: POTENTIAL BUG. The monthlySpending accumulation should likely exclude negative amounts to match how Korean card issuers calculate "전월실적" (previous month performance).
- **Confidence**: Medium (depends on how Korean card issuers define 전월실적 -- most use gross spending, not net)

### VR-09: buildConstraints preserves original transactions
- **File**: `packages/core/src/optimizer/constraints.ts:16`
- **Claim**: Transactions are preserved intact for the optimizer.
- **Evidence**: Line 16: `const preservedTransactions = [...transactions];` creates a shallow copy of the array. The individual transaction objects are shared references, so mutations to a transaction object would propagate.
- **Verdict**: ACCEPTABLE. The optimizer does not mutate transaction objects (it only reads `.amount`, `.category`, etc.), so shallow copy is sufficient.

### VR-10: reoptimize filters to latest month
- **File**: `apps/web/src/lib/store.svelte.ts:507-509`
- **Claim**: Reoptimize filters transactions to the latest month to match initial optimization behavior.
- **Evidence**: Line 508-509: `const latestTransactions = latestMonth ? editedTransactions.filter(tx => tx.date.startsWith(latestMonth)) : editedTransactions;`. This correctly mirrors the `analyzeMultipleFiles` behavior at analyzer.ts:338.
- **Verdict**: CORRECT. The filter is consistent with initial optimization.
