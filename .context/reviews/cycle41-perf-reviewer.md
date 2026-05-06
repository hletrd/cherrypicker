# Performance Review — CherryPicker Cycle 41

**Date:** 2026-05-06
**Reviewer:** perf-reviewer
**Cycle:** 41 / 100

---

## New Findings

### PERF-41-01: JSON `findField` allocates Map per transaction object (Low)

**File:** `packages/parser/src/json/index.ts:67-83` and `apps/web/src/lib/parser/json.ts:67-83`
**Confidence:** High

For each transaction object, a new `Map<string, unknown>()` is created for lowercase key lookup. For a 10,000-transaction JSON file, this is 10,000 Map allocations and population passes. The GC pressure is the dominant cost for large JSON parsing.

**Measurement:** Each `findField` call does `Object.keys(obj)` (allocates array) + `new Map()` + N `set()` calls. For 5 fields per object (date, amount, merchant, installments, category), that's 5 Maps per transaction.

**Fix:** Pre-build a lowercase alias Set, or restructure to do exact match first (no allocation) and only fall back to case-insensitive when needed.

---

### PERF-41-02: `scoreCardsForTransaction` calls `calculateCardOutput` twice per card (Medium)

**File:** `packages/core/src/optimizer/greedy.ts:39-71`
**Confidence:** High

This is the known PERF-02 carryover. Each transaction evaluation calls `calculateCardOutput` twice (before/after) per card. `calculateCardOutput` is O(T) in the worst case. Total complexity: O(C * T^2 * calc).

For 100 cards and 1000 transactions, this is ~100M inner loop iterations. The function could be memoized or the marginal reward could be computed incrementally.

---

### PERF-41-03: `normalizeHTML` while-loop scans entire content repeatedly (Low)

**File:** `apps/web/src/lib/parser/html.ts:32-35`
**Confidence:** Medium

The while-loop re-scans the entire HTML content with a regex after each replacement. For HTML with many script blocks, each iteration re-scans the remaining content from the start.

**Fix:** Use a single `.replace()` with global flag, matching the server-side implementation.

---

## Carryover

| ID | Description | File | Severity |
|----|-------------|------|----------|
| PERF-02 | Optimizer O(C*T^2) | `greedy.ts:39-71` | Medium |
| PERF-06 | `cardPreviousSpending` O(cards*tx) | `analyzer.ts:224` | Medium |
| PERF-01 | keywords.ts bundle size | Requires measurement | Low |
