# Performance Review — CherryPicker Cycle 37

**Reviewer:** perf-reviewer
**Scope:** CPU hotspots, memory allocations, I/O inefficiency, algorithmic complexity
**Date:** 2026-05-06

---

## Summary

No new performance regressions introduced in Cycle 37. The recently added HTML/JSON/OFX parsers have acceptable complexity (O(n) per file). One minor note on JSON wrapper key scanning. All prior performance findings remain open or deferred.

| Category | Count | Severity |
|---|---|---|
| New Findings | 1 | Low |
| Carryover (still open) | 8 | — |
| Deferred | 2 | — |

---

## NEW FINDINGS (Cycle 37)

### PERF-37-01: JSON Wrapper Key Scanning Is O(keys^2) for Wrapped Objects
**File:** `packages/parser/src/json/index.ts:200-220`, `apps/web/src/lib/parser/json.ts:186-200`
**Severity:** Low | **Confidence:** Medium

For wrapped JSON objects, the parser iterates over `wrapperKeys` (11 keys) and for each key iterates over `Object.keys(obj)`. For a JSON object with many keys (e.g., 100+ from a complex banking API response), this is 1,100 key comparisons. In practice, objects have < 20 keys and the fast path (exact match) catches most cases. Still, this could be optimized by building a lowercased key Set first.

**Fix:** Pre-compute `lowerKeys = new Map(Object.keys(obj).map(k => [k.toLowerCase(), k]))` once, then do O(1) lookups.

---

## CARRYOVER (still open from prior cycles)

| ID | Severity | File | Description |
|----|----------|------|-------------|
| PERF-01 | Low | `keywords.ts` | 9200-line static keyword blob inflates bundle |
| PERF-02 | Medium | `greedy.ts:39-66` | O(N*M*T) reward recalculation per card/tx |
| PERF-03 | Low | `greedy.ts:68-132` | Intermediate Maps/arrays allocated per transaction |
| PERF-04 | Low | `FileDropzone.svelte` | No debounce on file drop |
| PERF-05 | Low | `store.svelte.ts` | SessionStorage persistence on every reoptimize |
| PERF-06 | Medium | `analyzer.ts:224-250` | cardPreviousSpending O(cards * transactions) |
| PERF-07 | Low | `matcher.ts` | Substring scan O(keyword_count) per transaction |
| PERF-08 | Low | `detect.ts:255` | detectFormat reads entire file for sniffing |

---

## DEFERRED

| ID | Severity | Reason |
|----|----------|--------|
| PERF-02 | Medium | Algorithmic change with regression risk; needs benchmarking |
| PERF-01 | Low | Bundle impact requires measurement before action |

---

## Verification: New Parser Complexity

| Parser | Time | Memory | Notes |
|--------|------|--------|-------|
| HTML | O(rows * cols) | O(rows * cols) for SheetJS workbook | Acceptable; limited by SheetJS |
| OFX | O(blocks * tags) | O(blocks) for extracted strings | Acceptable; typically < 1K blocks |
| JSON | O(items * aliases) | O(items) for transaction array | Acceptable; wrapper scan is minor |

---

## Recommendation

The `cardPreviousSpending` calculation (PERF-06) is the highest-impact remaining performance issue. A single-pass pre-computation would reduce O(cards * transactions) to O(transactions + cards), providing measurable improvement for users with many cards.
