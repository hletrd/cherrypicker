# Cycle 26 — Architect Findings

**Date:** 2026-05-06
**Scope:** Architectural/design risks, coupling, layering
**Method:** Cross-package dependency analysis, duplication inventory

---

## C26-ARCH01 — Parser duplication continues to grow with new format additions (MEDIUM)

**File:** `apps/web/src/lib/parser/*` vs `packages/parser/src/*`
**Confidence:** High

New parser formats (OFX in C98, JSON in C97, HTML in C98) have been added to both the server-side (`packages/parser/src/`) and web-side (`apps/web/src/lib/parser/`). Each new format doubles the maintenance burden:

| Format | Server | Web | Parity Test |
|--------|--------|-----|-------------|
| CSV    | Yes    | Yes | Partial     |
| XLSX   | Yes    | Yes | Yes         |
| PDF    | Yes    | Yes | Yes         |
| HTML   | Yes    | Yes | Yes         |
| OFX    | Yes    | Yes | No          |
| JSON   | Yes    | Yes | No          |

The OFX and JSON parsers are substantial files (~200+ lines each) with duplicated logic across server and web. Recent fixes (C25-COR01, C25-SEC01) required applying the same fix to both sides. Without parity tests for OFX/JSON, drift is inevitable.

**Impact:** Every parser bug fix requires manual verification on both sides. New formats increase duplication linearly.

**Exit criterion:** Same as A-ARCH-01 deferred item — implement shared module with Buffer/TextEncoder abstraction.

---

## C26-ARCH02 — Calculator branch redundancy indicates schema evolution risk (LOW)

**File:** `packages/core/src/calculator/reward.ts:260-272`
**Confidence:** Medium

The reward calculator's `if/else if` chain for rate vs fixed vs both is structured as if combined rewards are expected, but the implementation doesn't actually combine them. This suggests the YAML schema may evolve to support combined rate+fixed rewards in the future, but the calculator isn't ready.

If the schema does evolve, the current code will silently under-count by ignoring the fixed portion when both are present.

**Impact:** Future schema evolution requires calculator changes that should have been made when the branch was added.

**Fix:** Either remove the unreachable differentiation (simplifying the code) or implement proper combined reward calculation.

---

## Summary

| Severity | Count | Categories |
|----------|-------|------------|
| MEDIUM | 1 | architectural debt |
| LOW | 1 | schema evolution |

**Verdict:** FIX AND SHIP — The duplication issue is the dominant architectural concern.
