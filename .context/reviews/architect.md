# Architecture Review — CherryPicker Cycle 37

**Reviewer:** architect
**Scope:** Package boundaries, coupling, layering, design decisions, technical debt
**Date:** 2026-05-06

---

## Summary

Cycle 37 did not introduce structural changes. The new parsers (HTML, OFX, JSON) follow the established pattern of dual implementation (server + web), compounding the parser duplication debt. No progress on the core architectural issues identified in cycles 32-35. The deferral culture for structural refactoring remains a concern.

| Category | Count | Severity |
|---|---|---|
| New Findings | 1 | Low |
| Carryover (still open) | 5 | — |
| Structural Debt Status | Worsened | — |

---

## NEW FINDINGS (Cycle 37)

### ARCH-37-01: New Parser Formats Exacerbate Duplication Debt
**File:** `packages/parser/src/` vs `apps/web/src/lib/parser/`
**Severity:** Low | **Confidence:** High

The addition of HTML, OFX, and JSON parsers in C98/C99 added ~600 lines of new server-side parser code and ~550 lines of new web-side parser code. Both implementations are manually maintained with parity comments (C98-02, C99-01, C100-01, C100-03) but no automated parity verification for the new formats. The total duplication footprint is now:

| Format | Server Lines | Web Lines | Duplication |
|--------|-------------|-----------|-------------|
| CSV | ~200 | ~180 | High |
| XLSX | ~400 | ~570 | High |
| PDF | ~431 | ~622 | High |
| HTML | ~279 | ~284 | Very High (nearly identical) |
| JSON | ~90 | ~85 | Very High (nearly identical) |
| OFX | ~130 | ~125 | Very High (nearly identical) |
| **Total** | **~1530** | **~1866** | **~3396 lines duplicated** |

The HTML, JSON, and OFX parsers are particularly wasteful because they are pure string-processing functions with no Node-specific or browser-specific APIs. They could be unified into a single runtime-agnostic implementation.

**Fix:** Extract HTML, JSON, and OFX parsers into `packages/parser/src/` as pure functions, then import them into the web app via a build step. These three formats require no platform-specific APIs (unlike PDF which needs pdfjs-dist vs unpdf).

---

## CARRYOVER (still open from prior cycles)

| ID | Severity | File | Description |
|----|----------|------|-------------|
| ARCH-01 | Medium | `analyzer.ts` | Type leakage between web and core packages |
| ARCH-02 | Low | `store.svelte.ts` | Duplicate optimization result types |
| ARCH-03 | Medium | `packages/parser/src/` vs `apps/web/src/lib/parser/` | Parser web/server duplication |
| ARCH-04 | Low | `store.svelte.ts` | God Object (666 lines) |
| ARCH-05 | Low | `analyzer.ts` / `store.svelte.ts` | Circular dependency risk |

---

## Cross-Cycle Status: Structural Debt Accumulation

| Issue | First Reported | Current Status | Lines Added Since |
|-------|---------------|----------------|-------------------|
| Server/web parser duplication | Cycle 2 | **Worsened** | +~1235 lines (HTML/JSON/OFX) |
| CATEGORY_NAMES_KO hardcoding | Cycle 3 | **Still open** | — |
| No parity tests for new parsers | Cycle 37 (new) | **New gap** | — |
| Optimizer O(T^2 x C) | Cycle 12 | **Still open** | — |
| Bank adapter configs hardcoded | Cycle 15 | **Still open** | — |
| Type adapter tax | Cycle 35 | **Still open** | — |

---

## Recommendation

Schedule a dedicated refactoring sprint for parser unification. The HTML, JSON, and OFX parsers are low-risk candidates for extraction because they use no platform-specific APIs. Start with these three to prove the pattern, then tackle CSV and XLSX (which need SheetJS bundling for web). PDF unification may require adopting pdfjs-dist for both environments.
