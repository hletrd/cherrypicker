# Performance Review -- Cycle 1 (2026-04-22)

## Findings

### PR-01: Greedy optimizer O(N*M*K^2) reward recalculation
- **File**: `packages/core/src/optimizer/greedy.ts:120-151`
- **Problem**: `scoreCardsForTransaction` computes `calculateCardOutput(currentTransactions, ...)` twice per card per transaction. `calculateCardOutput` iterates all assigned transactions for that card. As assignments grow, each marginal computation becomes more expensive. Total: O(N * M * K^2) where K is average assignments per card.
- **Failure scenario**: 500 transactions, 10 cards, average 50 assignments per card = 500 * 10 * 2 * 50 = 500,000 transaction-level reward calculations, each iterating 50 transactions = 25M inner iterations.
- **Suggested fix**: Maintain running totals per card. Only compute the new transaction's rule match and adjust cap state incrementally.
- **Confidence**: High (measurable quadratic growth)

### PR-02: MerchantMatcher substring scan is O(n) per transaction
- **File**: `packages/core/src/categorizer/matcher.ts:59-74`
- **Problem**: `SUBSTRING_SAFE_ENTRIES` is iterated linearly for every transaction's `match()` call. With 500+ keyword entries, each `lower.includes(kw)` is an O(m) substring search, making the total O(entries * merchant_length) per transaction.
- **Failure scenario**: Processing 1000 transactions against 500 keywords = 500,000 substring checks, each O(m), where m is merchant name length.
- **Suggested fix**: Build a trie or Aho-Corasick automaton from keywords for O(m) matching per transaction regardless of keyword count.
- **Confidence**: Medium (known deferred item, 94+ cycles flagging)

### PR-03: CategoryTaxonomy keywordMap iteration in findCategory
- **File**: `packages/core/src/categorizer/taxonomy.ts:70-108`
- **Problem**: `findCategory` iterates the entire `keywordMap` for substring matching (lines 71-78) and fuzzy matching (lines 94-101). Each iteration calls `lower.includes(kw)` or `kw.includes(lower)`. With 100+ taxonomy keywords, this is O(keywords * name_length) per call.
- **Failure scenario**: Same as PR-02 but for taxonomy keywords. Combined with the MerchantMatcher scan, categorization does two full linear scans per transaction.
- **Suggested fix**: Pre-build a suffix/substring index or use a trie-based approach.
- **Confidence**: Medium (same class as PR-02)

### PR-04: SavingsComparison RAF animation runs during tab hidden
- **File**: `apps/web/src/components/dashboard/SavingsComparison.svelte:77-88`
- **Problem**: The `$effect` starts a `requestAnimationFrame` loop that runs even when the tab is backgrounded. RAF is throttled to ~1fps in background tabs, but the effect still runs and updates `$state` variables.
- **Failure scenario**: User opens another tab. The animation continues ticking (albeit slowly), causing unnecessary state updates and potential jank when returning.
- **Suggested fix**: Use `document.visibilityState` to skip animation when the tab is hidden, resuming from the correct position when it becomes visible again.
- **Confidence**: Low (minor waste, no user-visible impact)

### PR-05: sessionStorage JSON.stringify on every setResult
- **File**: `apps/web/src/lib/store.svelte.ts:146-191`
- **Problem**: `persistToStorage` serializes the entire AnalysisResult (including all transactions) to JSON on every `setResult()` call. For large datasets, `JSON.stringify` of thousands of transaction objects is expensive.
- **Failure scenario**: With 500 transactions, each with 8+ fields, `JSON.stringify` creates a ~200KB string. On rapid reoptimizations, this is called multiple times.
- **Suggested fix**: Debounce persistence, or only persist when the generation changes (which is already partially the case, but the stringification itself is the bottleneck).
- **Confidence**: Low (sessionStorage writes are already async-friendly; main cost is CPU)

### PR-06: buildAssignments creates per-category alternative maps
- **File**: `packages/core/src/optimizer/greedy.ts:154-218`
- **Problem**: `buildAssignments` creates a `Map<string, Map<string, ...>>` for alternatives, then iterates all assignments again to build the final alternative list. For A assignments with C alternatives each, this is O(A * C) map operations plus O(A) sort operations.
- **Failure scenario**: Not a bottleneck for typical dataset sizes (< 100 categories * 10 cards = 1000 map entries), but the double-pass pattern could be simplified.
- **Suggested fix**: Accumulate alternatives directly in the CardAssignment during the first pass.
- **Confidence**: Low (unlikely to be a bottleneck)
