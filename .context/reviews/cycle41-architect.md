# Architecture Review — CherryPicker Cycle 41

**Date:** 2026-05-06
**Reviewer:** architect
**Cycle:** 41 / 100

---

## New Findings

### ARCH-41-01: `analyzeMultipleFiles` lacks per-file error isolation (Medium)

**File:** `apps/web/src/lib/analyzer.ts:315-317`
**Confidence:** High

Using `Promise.all` with unwrapped `parseAndCategorize` calls means any single file failure aborts the entire batch. This is a design-level decision that affects UX but is not documented or tested.

**Recommendation:** Wrap individual file parsing in Result/Either types (success | error) instead of throwing, allowing partial success. This is a structural change that affects the `AnalysisResult` shape.

---

### ARCH-41-02: Parser duplication between server and web continues to grow (Low)

**File:** `packages/parser/src/` vs `apps/web/src/lib/parser/`
**Confidence:** High

The HTML, OFX, and JSON parsers add ~1235 lines of near-identical code (server + web). The cycle 40 aggregate noted this (ARCH-37-01). After cycle 40 fixes, the duplication remains. Each bug fix (e.g., double-negative, NaN guard) must be applied in two places.

**Recommendation:** Move pure string-processing parsers (HTML, JSON, OFX) to a shared package that works in both Node and browser environments. These parsers use no Node-specific APIs.

---

### ARCH-41-03: `scoreCardsForTransaction` O(C*T^2) remains unaddressed (Medium)

**File:** `packages/core/src/optimizer/greedy.ts:39-71`
**Confidence:** High

This is a carryover from PERF-02. The greedy optimizer recalculates the entire card reward from scratch for each transaction addition. With 100 cards and 1000 transactions, this is ~100M inner operations.

**Recommendation:** Memoize `calculateCardOutput` results or compute marginal rewards incrementally. This is a significant architectural change requiring careful testing.

---

## Carryover

| ID | Description | File | Severity |
|----|-------------|------|----------|
| ARCH-37-01 | New parsers add ~1235 lines of duplication | `packages/parser/` vs `apps/web/` | Low |
| CR-07/CR-17 | Type unification + parser dedup | Large refactoring | Medium |
