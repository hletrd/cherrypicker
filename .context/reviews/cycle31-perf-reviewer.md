# Cycle 31 Performance Review

**Scope:** Parser efficiency, store reactivity, optimization algorithms, and memory usage.

---

## New Findings

### C31-PERF01 | LOW | Medium | `apps/web/src/lib/parser/json.ts:66-75` and `packages/parser/src/json/index.ts:67-76`

**`findField` is O(n * m) for every JSON transaction**

For each transaction object, `findField` iterates all aliases (n ≈ 20-25 per field type) and for each alias potentially iterates all object keys (m ≈ 10-50). With 1000 transactions, this is ~1M key comparisons per field type. While still fast in practice (< 10ms), it's unnecessarily expensive for the common case where field names match exactly.

**Fix:** Build a reverse lookup map once per object: `{ lowerCaseKey: actualKey }`, then alias lookup becomes O(n) instead of O(n*m).

### C31-PERF02 | LOW | Medium | `apps/web/src/lib/parser/html.ts:97-275` and `packages/parser/src/html/index.ts:82-269`

**HTML parser forward-fill allocates many intermediate strings**

Each data row calls `String(rawValue)` multiple times, `isSummaryRow(rowText)` which joins all cells, and `parseAmountString` which performs multiple regex replacements. For a 1000-row HTML table, this creates ~10,000+ temporary string objects.

**Impact:** Acceptable for typical HTML exports (< 500 rows), but could cause GC pressure for very large tables.

**Fix:** No action needed at current scale. If large HTML exports become common, consider streaming processing or reducing intermediate allocations.

### C31-PERF03 | LOW | High | `apps/web/src/lib/store.svelte.ts:58-89`

**`cachedCoreRules` not invalidated on `cardIds` alternation**

The cache is intentionally not keyed by `cardIds` because the calling pattern is assumed to be "analyze all first, then reoptimize with subset". If a future change breaks this assumption (e.g., user can switch between different card subsets), the cache would return stale rules.

**Fix:** Document this invariant more prominently in the code, or add a debug-mode assertion that warns if the calling pattern changes.

---

## Prior Open Findings Verified

| Finding | Status | Evidence |
|---|---|---|
| D-09 | OPEN (LOW) | `greedy.ts:84-110` still O(n*m) per transaction, acceptable at current scale |
| C30-01 | OPEN (MEDIUM) | `OptimalCardMap.svelte:18-19` derived values still recompute on every store change |
| C22-PERF01 | FIXED | sessionStorage size check now uses byte count |

---

## Final Sweep

1. No polling loops or busy-waits found
2. No memory leaks in event listeners (all use AbortController or generation counters)
3. ` prefers-reduced-motion` handled globally
4. `parseAmountString` regexes are linear-time (no catastrophic backtracking)
