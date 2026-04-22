# Tracer Review -- Cycle 1 (2026-04-22)

## Causal Tracing of Suspicious Flows

### TR-01: monthlySpending includes refunds, affecting performance tier
- **Trace**: `analyzer.ts:321` accumulates `tx.amount` (positive and negative) into `monthlySpending`. This value flows to `analyzer.ts:334` as `previousMonthSpending`, then to `analyzer.ts:559` via `optimizeFromTransactions`, then to `analyzer.ts:215-233` where it becomes `cardPreviousSpending`, then to `reward.ts:183` as `previousMonthSpending` for `selectTier`.
- **Hypothesis 1**: Korean card issuers calculate 전월실적 (previous month performance) as GROSS spending (purchases only), not net. Including refunds would understate the user's performance, placing them in a lower tier with worse rewards.
- **Hypothesis 2**: Korean card issuers calculate 전월실적 as NET spending (purchases minus refunds). Including refunds would be correct.
- **Evidence for H1**: Most Korean credit card terms define 전월실적 as "총 이용금액" (total usage amount), which typically refers to gross transaction amounts. Refunds are handled separately as "취소금액" (cancellation amount).
- **Evidence for H2**: Some card issuers define 전월실적 as the net balance.
- **Competing outcome**: If H1 is correct, the current code produces LOWER tier assignments than warranted, causing the optimizer to underestimate rewards.
- **Suggested fix**: Add a filter `tx.amount > 0` when accumulating monthlySpending, or make the behavior configurable.
- **Confidence**: Medium (cultural/domain knowledge required to confirm)

### TR-02: cachedCoreRules never invalidated across page navigations
- **Trace**: `analyzer.ts:48` declares `let cachedCoreRules: CoreCardRuleSet[] | null = null;` at module scope. It's set on line 194 when `transformed.length > 0` and read on line 201. `invalidateAnalyzerCaches()` on line 77 sets it to null, and this is called from `store.svelte.ts:595` during `reset()`.
- **Hypothesis**: If the card data (cards.json) is updated on the server (e.g., new card added), the cached core rules will never reflect the change until the user explicitly resets or the page is hard-refreshed.
- **Competing outcome**: User sees stale card data after a deployment, producing outdated optimization results.
- **Suggested fix**: Add a version/ETag check on cards.json fetch, or invalidate the cache on Astro View Transition.
- **Confidence**: Low (cards.json is static; redeployments are infrequent)

### TR-03: CategoryBreakdown percentage rounding may hide important categories
- **Trace**: `CategoryBreakdown.svelte:123-129` computes `rawPct` as `(a.spending / totalSpending) * 100`, then rounds to `pct = Math.round(rawPct * 10) / 10`. The threshold decision uses `rawPct < 2`, but the displayed value uses the rounded `pct`.
- **Hypothesis**: A category with `rawPct = 1.95` rounds to `pct = 2.0` visually, but is still hidden because `1.95 < 2`. This creates a visual inconsistency where the "other" category's sub-items show amounts that look like they should be visible.
- **Competing outcome**: User sees a category in the "other" tooltip with "2.0%" displayed but it's hidden from the main list.
- **Suggested fix**: Use the rounded value for the threshold decision as well, or use a consistent threshold (e.g., 1.95 or 2.0).
- **Confidence**: Low (edge case, minor visual inconsistency)

### TR-04: formatSavingsValue with animated intermediate value
- **Trace**: `SavingsComparison.svelte:242` calls `formatSavingsValue(displayedSavings, opt.savingsVsSingleCard)`. The `displayedSavings` is the animated intermediate value (line 83: `Math.round(startVal + (target - startVal) * eased)`), while `opt.savingsVsSingleCard` is the final target.
- **Hypothesis**: During animation, `displayedSavings` may briefly be negative (if animating from positive to negative target), but `formatSavingsValue` uses `Math.abs(value)` which always shows positive. The label already handles direction ("추가 절약" vs "추가 비용"), so this is consistent.
- **Competing outcome**: No issue. The animation correctly shows magnitude while the label shows direction.
- **Confidence**: High (no bug, confirming correct behavior)

### TR-05: scoreCardsForTransaction push/pop mutation and concurrent reads
- **Trace**: `greedy.ts:137-139` pushes a transaction onto `currentTransactions`, computes the reward, then pops it. The comment on line 136 says "the temporary mutation is safe as long as we pop before the next iteration."
- **Hypothesis**: If `calculateCardOutput` were ever to spawn an async operation or read from the array in a deferred callback, the pop could happen before the read, causing a missing transaction. Currently, `calculateCardOutput` is synchronous.
- **Competing outcome**: No issue with current synchronous code. But this pattern is fragile and would break silently if `calculateRewards` becomes async.
- **Suggested fix**: Add a comment explicitly warning that calculateCardOutput MUST remain synchronous.
- **Confidence**: Low (current code is safe, future-proofing concern)
