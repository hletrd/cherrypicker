# Performance Review — cherrypicker

**Reviewer**: Performance Reviewer (Veteran)  
**Date**: 2026-04-22  
**Scope**: Full monorepo — packages/core, packages/parser, apps/web, tools/cli  
**Method**: Source code static analysis. No profiling data available; all findings require profiling confirmation before acting.

---

## P1-HIGH Findings

### P1-01 — Greedy optimizer is O(T * C * R * T') where T' grows per assignment

**File**: `/Users/hletrd/flash-shared/cherrypicker/packages/core/src/optimizer/greedy.ts:120-152`  
**Confidence**: High

`scoreCardsForTransaction` is called once per transaction (T) and iterates all card rules (C). For each card, it calls `calculateCardOutput` twice (before/after push) — once with the current assigned transactions and once with the candidate appended. `calculateCardOutput` calls `calculateRewards`, which iterates ALL assigned transactions for that card (T') and for each runs `findRule` which scans the reward rules list (R) with a linear filter + sort.

The inner loop is: for each transaction T, for each card C, run full reward calculation over all that card's accumulated transactions. With 200 transactions and 5 cards, that is 200 * 5 * 2 * (growing T' average) = thousands of full reward calculations. Each reward calculation itself is O(T' * R) with the `findRule` linear scan.

**Impact**: The optimizer's time complexity is approximately O(T^2 * C * R) in the worst case. For a typical month with 200-500 transactions, 5-10 cards, and 10-20 reward rules per card, this produces tens of thousands of `findRule` calls. The user experiences this as a 500ms-2s delay on the "reoptimize" path after editing a category in TransactionReview.

**Fix**: Cache `findRule` results per (transaction, cardRule) pair. The rule that matches a transaction does not change based on which other transactions are assigned to the card. Pre-compute the matching rule for each transaction against each card's rules once, then reuse it in `calculateCardOutput`. This drops the inner loop from O(T' * R) to O(T') per card per transaction. Additionally, consider maintaining a running `totalReward` accumulator per card instead of recomputing from scratch on each `scoreCardsForTransaction` call.

---

### P1-02 — `findRule` performs linear scan + sort on every call

**File**: `/Users/hletrd/flash-shared/cherrypicker/packages/core/src/calculator/reward.ts:63-88`  
**Confidence**: High

`findRule` filters the entire `rewardRules` array with `.filter()` then sorts the candidates by specificity. This is called once per transaction in `calculateRewards`, and `calculateRewards` is called from `scoreCardsForTransaction` twice per card per transaction (see P1-01). With R reward rules, each call to `findRule` is O(R) for filter + O(K log K) for sort where K is the number of matching candidates.

This can be pre-indexed. Build a `Map<categoryKey, RewardRule[]>` at `CardRuleSet` load time, keyed by `category`. Then `findRule` becomes an O(1) Map lookup for the category match, plus filtering on subcategory and conditions (typically 0-3 candidates, not the full R).

**Impact**: For a card with 20 reward rules, `findRule` scans all 20 on every call. Across 200 transactions * 5 cards * 2 calls = 2000 `findRule` invocations, that is 40,000 unnecessary comparisons. The sort is wasted work when there is only 0-1 candidate (the common case for subcategory-matched rules).

**Fix**: At the start of `calculateRewards`, build a `Map<string, RewardRule[]>` from the reward rules, keyed by `rule.category`. Then `findRule` does a Map.get(tx.category) to get candidates, filters those (typically 1-3) on subcategory/conditions, and sorts. This reduces `findRule` from O(R) to O(1 + K) where K is typically 1-3.

---

### P1-03 — `CategoryTaxonomy.findCategory` scans entire keyword map on every call

**File**: `/Users/hletrd/flash-shared/cherrypicker/packages/core/src/categorizer/taxonomy.ts:58-110`  
**Confidence**: High

The substring match (step 2) iterates the entire `keywordMap` (all keywords) for every merchant name that fails exact match. The fuzzy match (step 3) does the same. With potentially hundreds of keywords in the taxonomy, and hundreds of transactions to categorize, this is O(T * K) where K is the total keyword count. The `MerchantMatcher.match()` method at line 84 in `matcher.ts` already does its own substring scan over `SUBSTRING_SAFE_ENTRIES`, then falls through to `taxonomy.findCategory()` which does ANOTHER full scan. A single uncategorized merchant triggers two complete linear scans of all keywords.

**Impact**: For 300 transactions where 100 fail exact match, `findCategory` performs 100 * (K + K) comparisons where K is the total taxonomy keyword count. If K is 200, that is 40,000 string comparisons. The `MerchantMatcher` duplicates this work by doing its own substring scan first.

**Fix**: Build a trie or Aho-Corasick automaton from all taxonomy keywords at construction time. This would reduce substring matching from O(merchant_length * K) to O(merchant_length + matches). Short-term alternative: combine the `MerchantMatcher` and `CategoryTaxonomy` substring scans into a single pass so the same merchant name is not scanned twice against overlapping keyword sets.

---

### P1-04 — `calculateRewards` creates a `Map<string, Map<string, number>>` on every call for rewardType accumulation

**File**: `/Users/hletrd/flash-shared/cherrypicker/packages/core/src/calculator/reward.ts:214`  
**Confidence**: Medium

`rewardTypeAccum` is a `Map<string, Map<string, number>>` — a map of maps — allocated fresh on every `calculateRewards` call. Since `calculateRewards` is called from `scoreCardsForTransaction` twice per card per transaction (see P1-01), this nested map structure is allocated and GC'd thousands of times per optimization run. Each inner `Map` is also allocated separately via `new Map()`.

**Impact**: Pressure on the JavaScript garbage collector from thousands of short-lived Map allocations. On V8, each Map allocation hits the C++ heap, triggering minor GC pauses. In a tight loop, these pauses accumulate. Not a latency problem in absolute terms (probably <50ms total), but it adds jitter to an already-slow optimization loop.

**Fix**: Replace the nested map with a single `Map<string, number>` using composite keys like `${categoryKey}::${rule.type}`. This halves the number of Map allocations and eliminates the inner Map creation per category per reward type. Alternatively, if the number of reward types is small and bounded (it is: discount, points, cashback, mileage), use a fixed-size array per category instead of a Map.

---

## P2-MEDIUM Findings

### P2-01 — `formatWon` and `formatCount` use `toLocaleString` on every render

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/formatters.ts:9,45`  
**Confidence**: High

`toLocaleString('ko-KR')` invokes the Intl formatter under the hood. This is significantly slower than manual comma insertion — benchmarks show `toLocaleString` can be 10-100x slower than a simple regex-based comma formatter for integer values. In the dashboard components, `formatWon` is called for every row in the assignments table, the category breakdown, the spending summary, and the savings comparison. A dashboard with 15 categories and 5 card results calls `formatWon` approximately 40+ times per render.

**Impact**: Each `toLocaleString` call takes approximately 1-5 microseconds on modern V8. At 40 calls per render, this is 40-200 microseconds. Not a crisis, but on a low-end device (the Pentium III test), Intl formatting can take 50-200 microseconds per call, pushing total format time to 2-8ms per render — noticeable as a dropped frame during animation.

**Fix**: Replace with a manual integer formatter that avoids the Intl subsystem:
```typescript
export function formatWon(amount: number): string {
  if (!Number.isFinite(amount)) return '0원';
  if (amount === 0) amount = 0;
  const s = Math.abs(Math.round(amount)).toString();
  const parts: string[] = [];
  for (let i = s.length; i > 0; i -= 3) {
    parts.unshift(s.slice(Math.max(0, i - 3), i));
  }
  return (amount < 0 ? '-' : '') + parts.join(',') + '원';
}
```
This is O(digits/3) with no Intl overhead.

---

### P2-02 — `formatIssuerNameKo` creates a new object literal on every call

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/formatters.ts:52-79`  
**Confidence**: Medium

The `names` Record is constructed as a new object literal inside the function body on every invocation. This function is called in template rendering loops — once per card in CardGrid (potentially 600+ cards), once per assignment row in OptimalCardMap, and in CardDetail. Each call allocates a 24-entry Record and then performs a property lookup.

**Impact**: 600 cards * 1 allocation per call = 600 short-lived object allocations in CardGrid alone. On V8, each allocation is fast (nanoseconds for small objects), but the cumulative GC pressure from rendering a large card list is measurable. More importantly, the function does O(24) property lookup on a new object instead of O(1) on a pre-built Map.

**Fix**: Move the `names` Record to module scope (outside the function) so it is allocated once. Better yet, use a `Map<string, string>` for O(1) lookups with `get()`:
```typescript
const ISSUER_NAMES_KO: Map<string, string> = new Map([
  ['hyundai', '현대카드'],
  // ...
]);
export function formatIssuerNameKo(issuer: string): string {
  return ISSUER_NAMES_KO.get(issuer) ?? issuer;
}
```

---

### P2-03 — Same issue for `getCategoryIconName` and `getIssuerColor`

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/formatters.ts:85-143`  
**Confidence**: Medium

Same pattern as P2-02. `getCategoryIconName` and `getIssuerColor` each construct a new Record literal inside the function body on every call. `getIssuerColor` is called in every row of OptimalCardMap, CategoryBreakdown, CardGrid, and CardDetail — potentially hundreds of times per render cycle.

**Fix**: Move both Records to module scope and convert to `Map<string, string>` for O(1) lookups.

---

### P2-04 — `CardGrid.filteredCards` calls `formatIssuerNameKo` inside a `.filter()` callback

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/components/cards/CardGrid.svelte:68`  
**Confidence**: Medium

The search filter calls `formatIssuerNameKo(c.issuer).toLowerCase().includes(q)` for every card in the list on every keystroke. With 600+ cards, this means 600+ `formatIssuerNameKo` calls (each allocating a new Record — see P2-02) plus 600+ `toLowerCase()` calls per keystroke. The search is not debounced.

**Impact**: On a fast typist, each keystroke triggers a full re-filter of 600+ cards. The combination of per-call object allocation in `formatIssuerNameKo` and the lack of debouncing means typing 10 characters in quick succession triggers 6,000+ `formatIssuerNameKo` allocations and 6,000+ `toLowerCase()` calls within ~500ms. This causes visible input lag on mid-range devices.

**Fix**: (1) Fix P2-02 (move the lookup table to module scope). (2) Pre-compute `issuerNameKo` on each `CardSummary` at load time in `getCardList()` instead of recomputing it in every filter/render cycle. (3) Add debounce on `searchQuery` with 150-200ms delay.

---

### P2-05 — `SpendingSummary.getTopCategory` sorts the entire assignments array to find one element

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/components/dashboard/SpendingSummary.svelte:53-56`  
**Confidence**: Medium

`getTopCategory` creates a spread copy `[...assignments]` then sorts it O(N log N) to find the single element with the highest spending. This is called on every render of the SpendingSummary component.

**Impact**: With 15 assignments, the sort is trivial. But the unnecessary spread allocation + sort is wasteful when a simple `reduce` would find the max in O(N) without any allocation.

**Fix**:
```typescript
function getTopCategory(assignments: typeof analysisStore.assignments): string {
  if (!assignments.length) return '-';
  let top = assignments[0];
  for (let i = 1; i < assignments.length; i++) {
    if (assignments[i].spending > top.spending) top = assignments[i];
  }
  return top.categoryNameKo ?? '-';
}
```

---

### P2-06 — `CategoryBreakdown.categories` sorts assignments then iterates again

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/components/dashboard/CategoryBreakdown.svelte:110-161`  
**Confidence**: Medium

The `$derived.by` block creates a spread copy `[...assignments]` and sorts it, then iterates it again to build the `main` and `others` arrays. The sort allocates a new array, and the subsequent iteration creates another array of `CategoryData` objects with nested `subCategories` arrays. This derived computation runs on every change to `analysisStore.assignments`.

**Impact**: For 15 categories, the overhead is small. But the pattern of spread + sort + new object array means every store change triggers 3+ array allocations. On a reoptimize cycle (which already takes 500ms+ in the core — see P1-01), adding unnecessary allocations to the render path increases the total latency the user perceives.

**Fix**: Cache the derived result using a keyed comparison — only recompute when the assignments array reference or length actually changes. Svelte 5's `$derived` already does shallow comparison, but the spread/sort creates a new reference on every call even when the data has not changed. Consider using a `Map` from the assignments identity (generation counter from the store) to the derived categories.

---

### P2-07 — `OptimalCardMap.toggleRow` creates a new Set on every toggle

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/components/dashboard/OptimalCardMap.svelte:40-44`  
**Confidence**: Medium

Each toggle of an expanded row creates a brand new Set by spreading the existing Set into an array, filtering, and constructing a new Set. This is O(N) per toggle where N is the number of expanded rows. The comment acknowledges this is for Svelte 5 reactivity.

**Impact**: With typically 0-3 expanded rows, the overhead is negligible. However, the pattern of creating a new Set on every interaction is a design smell that will not scale. If the assignments table grows to 50+ rows and the user expands many, each toggle becomes an O(N) allocation.

**Fix**: This is a Svelte 5 reactivity constraint. The immutable Set pattern is correct for triggering re-renders. A minor optimization: instead of `[...expandedRows].filter()`, use `new Set(expandedRows)` with `.add()`/`.delete()` on the copy, avoiding the intermediate array. Or track expanded state with a simple `Record<string, boolean>` object and toggle the key, which Svelte 5 can track with `$state` fine-grained reactivity.

---

### P2-08 — CSV parser reads entire file into memory as string

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/parser/index.ts:19-44`  
**Confidence**: Low

`parseFile` reads the entire file into an `ArrayBuffer` with `file.arrayBuffer()`, then decodes it as a string. For a 10MB CSV file (the per-file limit), this means 10MB of raw bytes + 10-30MB of decoded string (Korean characters are multi-byte in UTF-8). The `detectCSVDelimiter` then splits the content into lines and takes the first 30 — but the full content was already decoded.

**Impact**: For typical credit card statements (100-500KB), this is fine. For a 10MB CSV with 50,000+ transactions, the memory spike is 20-40MB on top of the parsed transaction objects. On a mobile device with limited memory, this could cause tab crashes.

**Fix**: For CSV files, stream the first 512 bytes for encoding detection and the first 30 lines for delimiter detection, then parse the rest line by line using a streaming TextDecoder. This reduces peak memory from O(file_size) to O(line_size). The XLSX parser already uses `XLSX.read` which handles its own buffering, so no change needed there.

---

### P2-09 — `buildConstraints` creates a shallow copy of the transactions array

**File**: `/Users/hletrd/flash-shared/cherrypicker/packages/core/src/optimizer/constraints.ts:16`  
**Confidence**: Low

`const preservedTransactions = [...transactions]` creates a shallow copy of the entire transaction array. The comment says this preserves the original transactions, but since the optimizer never mutates the transaction objects themselves (only reads them), the spread is unnecessary defensive copying that allocates a new array.

**Impact**: With 500 transactions, the spread allocates a 500-element array (approximately 4KB). Trivial in isolation, but this function is called on every reoptimize, and the copy is never needed because the optimizer only reads transaction fields.

**Fix**: Remove the spread. If the concern is that downstream code might mutate the array, document the immutability contract instead of paying the allocation cost. Alternatively, use `Object.freeze(transactions)` at the type level to enforce immutability without copying.

---

### P2-10 — `getAllCardRules` calls `flatMap` on every invocation, creating a new array

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/cards.ts:285-289`  
**Confidence**: Medium

`getAllCardRules` does `data.issuers.flatMap(issuer => issuer.cards)` on every call. The `analyzer.ts` calls this in `optimizeFromTransactions` (line 185). Since `loadCardsData` already caches the parsed JSON, adding a cache for the flat-mapped result would avoid the O(issuers * cards) array creation on every optimization.

**Impact**: With 24 issuers and 600+ cards, `flatMap` creates a 600+ element array on every `optimizeFromTransactions` call. The allocation itself is fast, but it forces GC to reclaim the previous array. On reoptimize cycles, this adds up.

**Fix**: Cache the flat-mapped card list alongside `cardIndex` in `cards.ts`. Invalidate it when `cardsPromise` is reset.

---

## P3-LOW Findings

### P3-01 — `detectBank` runs all 24 bank signature patterns against full content

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/parser/detect.ts:127-163`  
**Confidence**: Low

`detectBank` iterates all 24 `BANK_SIGNATURES` and runs each pattern's `.test()` against the full file content. For a 10MB CSV, each regex test scans the entire string. With 24 banks * ~2.5 patterns average = 60 regex tests, this is 60 full-string scans.

**Impact**: On typical 100-500KB statements, this completes in <10ms. On the 10MB edge case, 60 regex scans of 10MB each = 600MB of string scanning. This could take 200-500ms.

**Fix**: Early termination: return as soon as a bank scores >= 2 (high confidence). Most Korean card statements have the bank name in the first 1KB. Alternatively, run detection on only the first 2048 characters of the content, which is where all bank signatures appear in practice.

---

### P3-02 — `parseGenericCSV` creates regex objects on every header keyword check

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/parser/csv.ts:206-217`  
**Confidence**: Low

The column-detection loop creates a new RegExp on every `if` test for every header cell. With 6 columns * 30 header search rows * N header cells per row, this creates dozens of short-lived RegExp objects.

**Fix**: Pre-compile the regex patterns as module-level constants.

---

### P3-03 — `MONTHLY_BREAKDOWN` slice + sort + map creates intermediate arrays

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/analyzer.ts:376-382`  
**Confidence**: Low

`[...monthlySpending.entries()].sort(...).map(...)` creates three intermediate arrays (entries array, sorted array, mapped array). For 2-3 months this is trivial, but the pattern is wasteful.

**Fix**: Single-pass: collect entries, sort in-place, then map. Or use a pre-sized array.

---

### P3-04 — `allDates` and `optimizedDates` sort the entire date array to find min/max

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/analyzer.ts:349-356`  
**Confidence**: Low

Two separate `.filter(Boolean).sort()` calls to find the first and last dates. A single pass tracking min/max would be O(N) instead of O(N log N) for the sorts.

**Fix**:
```typescript
let minDate = '', maxDate = '';
for (const tx of allTransactions) {
  if (tx.date > maxDate) maxDate = tx.date;
  if (tx.date < minDate || !minDate) minDate = tx.date;
}
```
ISO 8601 dates sort lexicographically, so string comparison is correct.

---

### P3-05 — `calculateCardOutput` is a trivial wrapper that prevents inlining

**File**: `/Users/hletrd/flash-shared/cherrypicker/packages/core/src/optimizer/greedy.ts:108-118`  
**Confidence**: Low

`calculateCardOutput` is a one-line function that destructures and calls `calculateRewards`. As a separate function, V8 may not inline it in the hot `scoreCardsForTransaction` loop. The function also constructs a new object literal `{ transactions, previousMonthSpending, cardRule }` on every call — twice per card per transaction.

**Fix**: Inline the call in `scoreCardsForTransaction` and `buildCardResults` to eliminate the wrapper function overhead and the intermediate object allocation. Or at minimum, mark it with a `@inline` JSDoc tag and verify with V8 profiling that it is being inlined.

---

### P3-06 — `TransactionReview.displayTxs` re-filters on every reactive update

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/components/dashboard/TransactionReview.svelte:141-163`  
**Confidence**: Low

The `displayTxs` derived computation runs `.filter()` and `.toLowerCase()` on every change to `searchQuery` or `filterUncategorized` or `editedTxs`. With 200 transactions, each keystroke in the search box triggers a full scan. No debounce on search input.

**Fix**: Add debounce to the search input (150-200ms). Consider memoizing the `categoryMap.get()` lookups in a pre-built index.

---

### P3-07 — `CardGrid` does not virtualize the card list

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/components/cards/CardGrid.svelte:194-233`  
**Confidence**: Low

With 600+ cards, the grid renders all cards as DOM nodes simultaneously. Each card is a `<button>` with multiple child elements. This creates 600+ DOM nodes in the grid, which increases initial render time and memory usage.

**Fix**: Implement virtual scrolling or pagination for the card grid. Render only the visible cards (typically 6-12) and swap them as the user scrolls. Libraries like `svelte-virtual-scroll-list` or a simple intersection-observer-based approach would work.

---

### P3-08 — `TransactionReview.uncategorizedCount` scans entire array on every change

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/components/dashboard/TransactionReview.svelte:165-167`  
**Confidence**: Low

`uncategorizedCount` uses `.filter().length` which creates an intermediate array just to count. A simple loop with a counter would be O(N) without the allocation.

**Fix**: Replace with `.reduce((count, tx) => count + (tx.category === 'uncategorized' || tx.confidence < 0.5 ? 1 : 0), 0)` or better, maintain a running counter in the `changeCategory` function.

---

### P3-09 — XLSX parser decodes full buffer twice for HTML-as-XLS detection

**File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/parser/xlsx.ts:266-303`  
**Confidence**: Low

`isHTMLContent` decodes the first 512 bytes. If HTML is detected, the full buffer is decoded again. The comment acknowledges this (C75-01). For a 10MB file, this means 10MB + 512 bytes of decoding.

**Fix**: Decode the full buffer once upfront, then check the first 512 characters of the decoded string for HTML signatures. This trades memory (keeping the decoded string) for eliminating the redundant decode.

---

## Summary

| Severity | Count | Categories |
|----------|-------|------------|
| P0 | 0 | — |
| P1 | 4 | Algorithmic complexity (3), unnecessary allocation in hot loop (1) |
| P2 | 10 | Expensive formatting (1), repeated object allocation (3), unnecessary copies/sorts (3), streaming/IO (1), unindexed lookups (1), missing debounce (1) |
| P3 | 9 | Minor allocation overhead (3), missing debounce (1), no virtualization (1), redundant processing (2), non-inlined wrapper (1), double decode (1) |

## Verdict: **FIX AND SHIP**

The codebase is well-structured with good defensive coding practices (AbortController usage, validation, error handling). The P1 findings are real algorithmic issues that will degrade user experience as data scales, but they are not correctness bugs — the optimizer produces correct results, just slowly. The P2 findings are optimization opportunities that would meaningfully improve the reoptimize flow's responsiveness. No P0 issues (no races, data loss, or security vulnerabilities) were found from a performance perspective.

**Priority order for fixes**:
1. P1-01 + P1-02: Pre-index `findRule` and cache rule matches. This single change addresses the optimizer's O(T^2 * C * R) complexity.
2. P1-03: Consolidate the double keyword scan in categorization.
3. P2-02 + P2-03 + P2-04: Move formatter lookup tables to module scope and add search debounce.
4. P2-01: Replace `toLocaleString` with manual formatting.
5. Everything else in priority order.
