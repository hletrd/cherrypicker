# Debugger Review -- Cycle 1 (2026-04-22)

## Latent Bug Surface and Failure Modes

### DB-01: monthlySpending includes negative amounts, distorting performance tier
- **File**: `apps/web/src/lib/analyzer.ts:321`
- **Problem**: `monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + tx.amount)` adds ALL transaction amounts, including negative ones (refunds). This value is used as `previousMonthSpending` which determines the user's performance tier.
- **Failure mode**: User has 500,000 won in purchases and 200,000 in refunds in the previous month. monthlySpending = 300,000. But the card's tier threshold is 400,000. The user qualifies for the higher tier (based on gross spending of 500,000) but is placed in the lower tier (based on net spending of 300,000). All rewards for that card are calculated at the lower rate.
- **Severity**: Medium (incorrect financial calculations affecting real money decisions)
- **Suggested fix**: Filter to `tx.amount > 0` when accumulating monthlySpending.
- **Confidence**: Medium (depends on Korean card issuer 전월실적 definition)

### DB-02: findRule sort instability produces non-deterministic rule selection
- **File**: `packages/core/src/calculator/reward.ts:87`
- **Problem**: `candidates.sort((a, b) => ruleSpecificity(b) - ruleSpecificity(a))` is not guaranteed to be stable. Two rules with the same specificity score but different rates could be matched in different order across browsers.
- **Failure mode**: In Chrome, rule A (5% rate) is selected. In Firefox, rule B (3% rate) is selected for the same transaction. The user sees different optimization results depending on their browser.
- **Severity**: Low (rare edge case, requires two rules with identical specificity)
- **Suggested fix**: Add a secondary sort key (e.g., original rule index or rate value) to break ties deterministically.
- **Confidence**: Medium

### DB-03: loadCategories returns empty array on AbortError, silently degrading categorization
- **File**: `apps/web/src/lib/cards.ts:261-283`
- **Problem**: When the categories fetch is aborted (e.g., component unmount during Astro View Transition), `loadCategories` returns `[]`. Callers that don't check for empty arrays proceed with no categories, causing all transactions to be categorized as "uncategorized".
- **Failure mode**: During a rapid page navigation, the categories fetch is aborted. The analyzer proceeds with an empty category list. All 50 transactions are categorized as "uncategorized" with 0 confidence. The optimizer assigns all to whichever card has a wildcard rule, producing meaningless results.
- **Severity**: Medium (the analyzer.ts:114 guard throws an error in this case, but the guard was added recently and may not cover all call paths)
- **Suggested fix**: Ensure all call paths that use `loadCategories` check for empty results and throw or retry.
- **Confidence**: Medium (partially mitigated by C71-02 guard)

### DB-04: cachedCoreRules poisoning on empty loadCardsData
- **File**: `apps/web/src/lib/analyzer.ts:187-196`
- **Problem**: If `loadCardsData()` returns an empty array (e.g., due to a transient network error that returns a valid but empty JSON), `cachedCoreRules` would be set to `[]` (because `transformed.length > 0` is false, so the cache stays null). The next call retries correctly. But if `loadCardsData()` returns a valid JSON with issuers but empty card arrays, `toCoreCardRuleSets` returns `[]` and the cache stays null, allowing retries.
- **Failure mode**: A network error returns `{ issuers: [], meta: {...} }` (valid JSON but no issuers). `getAllCardRules()` returns `[]`. `toCoreCardRuleSets([])` returns `[]`. The cache is not set (correct). The next call retries.
- **Severity**: Low (the cache-not-set-on-empty behavior is correct)
- **Confidence**: Low (this is a confirmation that the existing guard works correctly)

### DB-05: persistToStorage truncation loses transactions, reoptimize uses stale data
- **File**: `apps/web/src/lib/store.svelte.ts:164-170`
- **Problem**: When sessionStorage persistence truncates transactions (due to size limits), the persisted data has `transactions: undefined`. On page reload, `loadFromStorage` recovers the optimization result but not the transactions. The store's `transactions` getter returns `[]`.
- **Failure mode**: User uploads a large file, triggers truncation. They edit a transaction category and click "reoptimize". `editedTxs` was synced from the empty `store.transactions` array (via the generation sync effect). The reoptimize runs with zero transactions, producing zero rewards.
- **Severity**: Medium (data loss on reoptimize after truncation)
- **Suggested fix**: When transactions are truncated, disable the reoptimize button in TransactionReview and show a message that edits cannot be applied.
- **Confidence**: High (the truncation path is well-documented, and the data flow is traceable)

### DB-06: SavingsComparison animation RAF not cleaned up on component destroy
- **File**: `apps/web/src/components/dashboard/SavingsComparison.svelte:76-88`
- **Problem**: The `$effect` returns a cleanup function that cancels the RAF. However, Svelte 5 `$effect` cleanup runs before the next effect execution, not on component destroy. If the component is destroyed without a new effect trigger, the cleanup may not run.
- **Failure mode**: The component is destroyed during an Astro View Transition while the animation is running. The RAF continues ticking, updating a `displayedSavings` variable that is no longer rendered. This is a memory leak, not a crash.
- **Severity**: Low (minor memory leak during page transitions)
- **Suggested fix**: Use `onDestroy` to cancel any in-flight RAF as a supplementary cleanup.
- **Confidence**: Low (Svelte 5 $effect cleanup is generally reliable, and the variable is GC'd with the component)
