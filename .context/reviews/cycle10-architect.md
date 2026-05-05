# Cycle 10 Architect Review — Design Risks, Coupling, Layering

**Reviewer:** architect  
**Cycle:** 10  
**Date:** 2026-05-05

---

## Findings

### [P1-HIGH] Server/web parser code duplication and parity drift risk
**Description:** There are two parallel parser implementations: `packages/parser/src/` (server/Bun) and `apps/web/src/lib/parser/` (browser). Recent fixes (C9, C99) had to be applied to both sides, and parity gaps exist (e.g., Infinity bug present on both sides, but JSON MEMO_ALIASES differs).
**Impact:** Every parser fix must be duplicated. Risk of drift increases with each cycle. The C70-04 comment in csv.ts explicitly calls for a D-01 refactor to share code.
**Fix:** Implement the D-01 shared module refactor. Create a pure-TS parser package that works in both Bun and browser environments. The existing `packages/parser/` could be refactored to export browser-compatible ESM builds.
**Confidence:** High

### [P2-MEDIUM] HTML report generator tightly coupled to filesystem
**Description:** `packages/viz/src/report/generator.ts` reads `report.html` template from disk using `readFileSync` and `__dirname`.
**Impact:** Cannot be used in browser contexts. The web app must generate reports differently.
**Fix:** Accept template as a parameter or use inline template string.
**Confidence:** Medium

### [P2-MEDIUM] Greedy optimizer mutates arrays in-place
**Description:** `greedy.ts:56` pushes transactions into `currentTransactions` in-place, then pops. The comment claims this is safe because `calculateCardOutput` only reads.
**Impact:** If `calculateCardOutput` or any downstream function ever gains a side effect (e.g., caching, mutation), this will cause subtle bugs. The temporary mutation pattern is fragile.
**Fix:** Use immutable operations (spread) or clone the array. Performance impact is negligible for typical transaction counts (<10K).
**Confidence:** Medium

### [P3-LOW] Missing README in packages/
**Description:** No `README.md` in `packages/core/`, `packages/parser/`, `packages/rules/`, `packages/viz/`.
**Impact:** New contributors cannot understand package boundaries or APIs.
**Fix:** Add minimal READMEs with package purpose and public API overview.
**Confidence:** Low

---

## Summary Table

| Severity | Count |
|----------|-------|
| P1-HIGH | 1 |
| P2-MEDIUM | 2 |
| P3-LOW | 1 |

**Verdict:** FIX AND SHIP
