# Performance Review — CherryPicker Cycle 35

## Methodology
Reviewed for CPU hotspots, memory leaks, unnecessary allocations, N+1 queries, large data structure handling, and responsiveness across packages/core, packages/parser, apps/web.

---

## CONFIRMED ISSUES

### PERF-01: `keywords.ts` is ~9200 lines of inline data
**File**: `packages/core/src/categorizer/keywords.ts`
**Severity**: Low | **Confidence**: High
The merchant keywords file is extremely large (9200+ entries). While this is static data and Tree-shaking handles it, it inflates bundle size and parse time. The file is imported by `matcher.ts` which means ALL keywords are loaded into memory even if only a subset is used.
**Fix**: Consider splitting by category or loading lazily. Since this is compile-time static data, the impact is limited to initial parse. Mark as deferred — requires careful measurement.

### PERF-02: `scoreCardsForTransaction` recalculates full card output per card per transaction
**File**: `packages/core/src/optimizer/greedy.ts:39-66`
**Severity**: Medium | **Confidence**: High
```typescript
const before = calculateCardOutput(currentTransactions, previousMonthSpending, rule).totalReward;
const after = calculateCardOutput([...currentTransactions, transaction], previousMonthSpending, rule).totalReward;
```
For each transaction and each card, `calculateRewards` is called twice. With N transactions and M cards, this is O(N * M * T) where T is the number of rules per card. For large statements (1000+ transactions) and many cards (50+), this is expensive.
**Fix**: Incrementally update card reward state instead of recomputing from scratch. Cache tier selection results per card.

### PERF-03: `buildAssignments` creates intermediate Maps and arrays
**File**: `packages/core/src/optimizer/greedy.ts:68-132`
**Severity**: Low | **Confidence**: Medium
`buildAssignments` builds `assignmentMap`, `alternativeRewardMap`, and multiple intermediate arrays. For large transaction sets, these allocations add up.
**Fix**: Pre-size arrays where possible, or use plain objects instead of Maps for small key counts.

---

## LIKELY ISSUES / RISKS

### PERF-04: No debounce on file dropzone
**File**: `apps/web/src/components/upload/FileDropzone.svelte`
**Severity**: Low | **Confidence**: Medium
Multiple rapid file drops could trigger overlapping analysis calls. No explicit debounce or loading-state guard prevents concurrent analyzes.
**Fix**: Add an `isAnalyzing` guard or debounce file drop events.

### PERF-05: SessionStorage persistence runs on every reoptimize
**File**: `apps/web/src/lib/store.svelte.ts:638`
**Severity**: Low | **Confidence**: Medium
Every category edit triggers `persistToStorage`, which serializes the entire result to JSON. For large datasets (1000+ transactions), this could cause jank.
**Fix**: Debounce persistence or use a requestIdleCallback.

---

## VERIFIED SAFE
- MerchantMatcher uses LRU cache with bounded size (500 entries)
- `SUBSTRING_SAFE_ENTRIES` precomputed at module level
- Greedy optimizer filters to latest month before optimizing
- `analyzeMultipleFiles` uses shared MerchantMatcher across files
- No recursive calls without depth limits
