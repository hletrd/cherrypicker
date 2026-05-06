# Performance Review — CherryPicker Cycle 40

**Reviewer:** perf-reviewer
**Scope:** CPU hotspots, memory allocations, algorithmic complexity
**Date:** 2026-05-06

---

## Summary

No new performance regressions. One minor note on `cardPreviousSpending` calculation which remains O(cards * transactions). All prior performance findings remain open.

| Category | Count | Severity |
|---|---|---|
| New Findings | 0 | — |
| Carryover | 7 | — |
| Deferred | 2 | — |

---

## CARRYOVER

| ID | Severity | File | Description |
|----|----------|------|-------------|
| PERF-02 | Medium | `greedy.ts:39-71` | O(C*T^2) optimizer complexity |
| PERF-06 | Medium | `analyzer.ts:224-263` | cardPreviousSpending O(cards*tx) |
| PERF-01 | Low | `keywords.ts` | 9200-line static keyword blob |
| PERF-03 | Low | `greedy.ts:68-132` | Intermediate Maps/arrays per tx |
| PERF-04 | Low | `FileDropzone.svelte` | No debounce on file drop |
| PERF-05 | Low | `store.svelte.ts` | SessionStorage persistence on every reoptimize |
| PERF-07 | Low | `matcher.ts` | Substring scan O(keywords) per tx |

---

## DEFERRED

| ID | Reason |
|----|--------|
| PERF-02 | Algorithmic change with regression risk; needs benchmarking |
| PERF-01 | Bundle impact requires measurement before action |
