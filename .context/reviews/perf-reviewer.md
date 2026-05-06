# Performance Review — CherryPicker Cycle 36

## Methodology
Reviewed for CPU hotspots, memory allocations, I/O inefficiency, algorithmic complexity, and responsiveness across packages/core, packages/parser, apps/web.

---

## VERIFIED FIXED (from Cycle 35)
None — PERF-01 through PERF-05 remain open or deferred.

---

## CARRYOVER (still open from Cycle 35)

### PERF-01: `keywords.ts` is ~9200 lines of inline data
**File**: `packages/core/src/categorizer/keywords.ts` | **Severity**: Low | **Confidence**: High
9200+ merchant keyword entries inflate bundle size and parse time. All keywords loaded into memory even if only a subset is used.
**Status**: Deferred. Requires measurement before action.
**Exit criterion**: Run bundle analysis and confirm >100KB impact.

### PERF-02: `scoreCardsForTransaction` recalculates full card output per card per transaction
**File**: `packages/core/src/optimizer/greedy.ts:39-66` | **Severity**: Medium | **Confidence**: High
```typescript
const before = calculateCardOutput(currentTransactions, previousMonthSpending, rule).totalReward;
const after = calculateCardOutput([...currentTransactions, transaction], previousMonthSpending, rule).totalReward;
```
O(N * M * T) complexity. For 1000 transactions and 50 cards, `calculateRewards` is called 100,000 times.
**Status**: Deferred. Algorithmic change with regression risk. Needs benchmarking.
**Exit criterion**: Benchmark current O(N*M*T) vs proposed O(N*M) with real datasets.

### PERF-03: `buildAssignments` creates intermediate Maps and arrays
**File**: `packages/core/src/optimizer/greedy.ts:68-132` | **Severity**: Low | **Confidence**: Medium
Multiple intermediate data structures allocated per transaction.
**Fix**: Pre-size arrays where possible, or use plain objects for small key counts.

### PERF-04: No debounce on file dropzone
**File**: `apps/web/src/components/upload/FileDropzone.svelte` | **Severity**: Low | **Confidence**: Medium
Multiple rapid file drops could trigger overlapping analysis calls.
**Fix**: Add `isAnalyzing` guard or debounce file drop events.

### PERF-05: SessionStorage persistence runs on every reoptimize
**File**: `apps/web/src/lib/store.svelte.ts` | **Severity**: Low | **Confidence**: Medium
Every category edit triggers `persistToStorage`, serializing the entire result to JSON. For large datasets (1000+ transactions), this could cause jank.
**Fix**: Debounce persistence or use `requestIdleCallback`.

---

## NEW FINDINGS

### PERF-06: `analyzeMultipleFiles` computes `cardPreviousSpending` as O(cards * transactions)
**File**: `apps/web/src/lib/analyzer.ts:224-250` | **Severity**: Medium | **Confidence**: High
For each card (potentially 100+), the code filters ALL transactions (potentially 1000+) to compute exclusion-filtered previous month spending:
```typescript
for (const rule of coreRules) {
  const qualifying = transactions
    .filter(tx => tx.amount > 0 && !exclusions.has(tx.category) && ...)
    .reduce((sum, tx) => sum + tx.amount, 0);
}
```
This is O(cards * transactions) with repeated Set lookups. For 100 cards and 1000 transactions, that's 100,000 filter+reduce operations.
**Fix**: Pre-compute a single pass over transactions to build per-category spending totals, then each card's previousMonthSpending is a simple sum of category totals minus excluded categories.

### PERF-07: MerchantMatcher substring scan is O(keyword_count) per transaction
**File**: `packages/core/src/categorizer/matcher.ts` | **Severity**: Low | **Confidence**: High
`SUBSTRING_SAFE_ENTRIES` is precomputed at module load (good), but the substring scan still iterates over ALL keywords (~9200 entries) for every transaction that doesn't get an exact match. For a statement with 1000 transactions, that's 9.2M substring checks.
**Fix**: Build a Trie or Aho-Corasick automaton from keywords for O(merchant_length + matches) matching instead of O(keyword_count * merchant_length).

### PERF-08: `detectFormat` reads entire file for sniffing
**File**: `packages/parser/src/detect.ts:255` | **Severity**: Low | **Confidence**: Medium
`sniffBuffer = await readFile(filePath);` reads the ENTIRE file into memory just to check the first 1-8 bytes. For a 50MB PDF, this allocates 50MB unnecessarily.
**Fix**: Use `fs.open` + `fs.read` to read only the first 4KB header for format sniffing.

---

## VERIFIED SAFE
- MerchantMatcher LRU cache bounded to 500 entries
- `SUBSTRING_SAFE_ENTRIES` precomputed at module level (no re-computation per call)
- Greedy optimizer filters to latest month before optimizing
- `analyzeMultipleFiles` uses shared MerchantMatcher across files
- No recursive calls without depth limits
- `calculateRewards` uses in-place mutation for Maps (no unnecessary re-allocation of categoryRewards)
