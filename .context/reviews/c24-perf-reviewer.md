# Performance Review — cherrypicker (Cycle 24)

**Reviewer:** perf-reviewer (opus)
**Scope:** Hot paths, allocations, algorithmic complexity
**Date:** 2026-05-06

---

## Summary

No new performance changes in cycle 23. Cycle 24 verifies the greedy optimizer is still the dominant hotspot.

---

## New Findings

### [C24-PERF01-LOW] HTML forward-fill allocates strings per cell per row

**Files:** `apps/web/src/lib/parser/html.ts:141-244`
**Confidence:** High

Same finding as C20-PERF02, now confirmed still present. Each row iteration creates:
- 6× `String(rawValue)` conversions
- 6× `isSummaryRow(String(rawValue))` calls (each recompiles a regex)
- 6× `isNonEmpty(rawValue)` checks

For a 1000-row table, this is ~6000 regex compilations and ~12000 string allocations.

**Fix:** Pre-compute `isSummaryRow` once per row (already done at line 163 for row skipping). Remove per-cell `isSummaryRow` guards if the row-level check already handles the concern.

---

## Carry-overs

| Finding | Cycle | Status |
|---------|-------|--------|
| Greedy optimizer marginal reward caching | 5 | **OPEN** — still O(n*m*r*t) |
| MerchantMatcher O(n*m) scan | 4 | **OPEN** — LRU cache only helps cache hits |
| PDF text extraction materializes entire document | 4 | **OPEN** |
