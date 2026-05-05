# Cycle 11 — Architect Findings

**Date:** 2026-05-05
**Reviewer:** architect (simulated)
**Scope:** Architectural risks, coupling, layering, and design patterns

## Summary

No new HIGH or MEDIUM architectural issues. Parser duplication (D-01) remains the primary structural concern. Hardcoded data duplication is reducing but still present.

---

## Findings

### C11-AR01 — [P1-HIGH] Parser duplication D-01 still deferred

**File:** `apps/web/src/lib/parser/*` vs `packages/parser/src/*`

The web-side parsers duplicate server-side logic with browser-compatible imports. Recent commits (C99, C100) extracted shared utilities (`parseAmountString`, `normalizeHTML`, `splitCSVLine`) into `packages/parser/src/csv/shared.ts`, reducing duplication.

However, significant duplication remains in:
- OFX parser (~95% identical)
- JSON parser (~95% identical)
- PDF parser (~80% identical, web-side is simplified)
- HTML parser (~90% identical)
- XLSX parser (~85% identical)

**Impact:** Every parser bug fix requires dual-path verification. Cycle history shows 10+ parity bugs (C9-01, C9-02, C9-03, C57-01, C68-01, C71-01, C72-01, C73, C74-01, C75-01, C76-01, C87-01, C91-02, C94, C95, C97, C98, C99, C100).

**Fix:** Continue extracting shared utilities. For parsers that are purely string-processing (JSON, OFX, HTML), consider a single isomorphic implementation that works in both Bun and browser.

**Confidence:** High
**Status:** DEFERRED per D-01 (major refactor requiring design doc)

---

### C11-AR02 — [LOW] Hardcoded data duplication reducing

**File:** `apps/web/src/components/upload/FileDropzone.svelte:108-133`
**File:** `apps/web/src/lib/formatters.ts:52-78`
**File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:94-98`

`ALL_BANKS` in FileDropzone duplicates bank signatures from `packages/parser/src/detect.ts`.
`formatIssuerNameKo` duplicates issuer name data.
`getCategoryColor` duplicates category color mapping.

**Impact:** Maintenance burden when adding/removing banks or categories.

**Fix:** Build-time generation from canonical source (categories.yaml, detect.ts).

**Confidence:** High
**Status:** KNOWN — same class as C9-02, C9-03, C9-04, C9-05

---

### C11-AR03 — [LOW] In-place array mutation in optimizer

**File:** `packages/core/src/optimizer/greedy.ts:56-58`

`scoreCardsForTransaction` pushes/pops transactions in-place to avoid array allocation. This is safe because `calculateCardOutput` only reads the array, but the mutation is implicit and could break if `calculateCardOutput` gains side effects.

**Impact:** Fragile contract. Future refactor of `calculateCardOutput` could introduce subtle bugs.

**Fix:** Document the invariant in a comment or switch to immutable slice (with performance cost).

**Confidence:** Medium

---

### C11-AR04 — [LOW] Module-level mutable state for persist warning

**File:** `apps/web/src/lib/store.svelte.ts:221`

`_loadPersistWarningKind` is module-level mutable state. While the store is a singleton, this pattern makes testing harder.

**Impact:** Test isolation concern, not production risk.

**Fix:** Encapsulate in the store closure or make it part of the persisted state.

**Confidence:** Low

---

## Verdict

**COMMENT** — Structural issues are well-understood and tracked. No new architectural debt introduced in cycle 10.
