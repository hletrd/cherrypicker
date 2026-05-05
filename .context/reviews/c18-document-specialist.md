# Document Specialist — cherrypicker (Cycle 18)

**Reviewer:** document-specialist
**Scope:** Documentation completeness, API contracts, env vars, code-comment accuracy
**Date:** 2026-05-06

---

## Summary

New parser formats (JSON, OFX, HTML) added in cycles 16-17 are still undocumented. No README updates, no format schema examples. The gap between code velocity and documentation velocity continues to widen.

---

## New Findings

### C18-DOC01 [MEDIUM] — JSON, OFX, HTML parsers remain undocumented

**Files:** `packages/parser/src/json/`, `packages/parser/src/ofx/`, `packages/parser/src/html/`
**Confidence:** High

No README section exists documenting:
- Expected input format for JSON (array of objects, wrapper objects)
- Supported field aliases (the extensive alias lists in `json/index.ts`)
- OFX SGML vs XML handling
- HTML table extraction with SheetJS

**Fix:** Add a `packages/parser/README.md` section with sample inputs/outputs for each format.

---

### C18-DOC02 [LOW] — `isOptimizableTx` comment contradicts implementation

**File:** `apps/web/src/lib/tx-validation.ts:4-7`
**Confidence:** High

The comment says "Negative amounts (refunds/credits) are preserved", but the function returns `false` for zero amounts and `true` for non-zero amounts (including negative). The implementation is correct (refunds are preserved in storage), but the comment could be clearer that this function filters *for display/optimization* and does not drop refunds from persistence.

Actually, re-reading: the comment IS correct. It says they are "preserved" which is true — they pass validation. The comment at line 6 says "they are displayable even if not optimizable." This is accurate.

**Status:** NOT A BUG. Comment is correct.

---

## Previously Reported — Status

| ID | Description | Status |
|----|-------------|--------|
| F-DOC-01 | No API contract between parser and optimizer | **OPEN** |
| F-DOC-02 | Card rule YAML schema undocumented | **OPEN** |
| F-DOC-03 | No architecture documentation | **OPEN** |
| F-DOC-04 | LLM fallback behavior undocumented | **OPEN** |
| F-DOC-05 | Environment variables undocumented | **OPEN** |

---

## Verdict

**DOCUMENTATION DEBT** — Add parser format documentation. This is a writing task that does not affect runtime behavior.
