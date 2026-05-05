# Performance Review — cherrypicker (Cycle 18)

**Reviewer:** perf-reviewer
**Scope:** Performance, CPU/memory, algorithmic complexity, UI responsiveness
**Date:** 2026-05-06

---

## Summary

Cycle 6's critical performance fix (LRU cache for MerchantMatcher) is in place. The two algorithmic debts from Cycle 5 — merchant matcher linear scan and greedy optimizer recalculation — remain but are now partially mitigated. No new critical performance regressions found.

---

## New Findings

### C18-PERF01 [LOW] — `buildAssignments` rate recalculation on every accumulation

**File:** `packages/core/src/optimizer/greedy.ts:86`
**Confidence:** Low

```ts
current.rate = current.spending > 0 ? current.reward / current.spending : 0;
```

For every transaction added to a category-card pair, the effective rate is recalculated from accumulated totals. With N transactions in a category, this is O(N) extra floating-point divisions. Compared to the dominant O(m*n*r) optimizer cost, this is negligible.

**Fix:** Not necessary unless profiling identifies this as a hotspot. Documented for awareness.

---

## Verified Fixed / Mitigated

| Finding | Status | Evidence |
|---------|--------|----------|
| MerchantMatcher O(n*m) scan | **MITIGATED** | LRU cache added (500-entry cap) in `matcher.ts` |
| Greedy optimizer sort O(n^2 log n) | **FIXED** | `rules.indexOf` removed; pure specificity comparison |
| PDF text extraction materializes entire doc | **OPEN** | No streaming implemented |
| Taxonomy keywordMap full iteration | **OPEN** | Same pattern as MerchantMatcher, no trie/cache |

---

## Still Open from Prior Cycles

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| P1-HIGH (cycle 5) | Greedy optimizer recalculates from scratch per transaction | HIGH | **OPEN** — No incremental delta caching |
| P2-MEDIUM (cycle 5) | PDF text extraction materializes entire document | MEDIUM | **OPEN** |
| P2-MEDIUM (cycle 5) | Taxonomy keywordMap iterates all entries | MEDIUM | **OPEN** |

---

## Verdict

**ACCEPTABLE** — No new regressions. The HIGH-severity optimizer recalculation remains the most impactful algorithmic debt but requires significant refactoring. C18-PERF01 is negligible.
