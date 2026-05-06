# Documentation Review — CherryPicker Cycle 41

**Date:** 2026-05-06
**Reviewer:** document-specialist
**Cycle:** 41 / 100

---

## New Findings

### DOC-41-01: `parseOFXDate` JSDoc misrepresents timezone handling (Medium)

**File:** `packages/parser/src/ofx/index.ts:80-87` and `apps/web/src/lib/parser/ofx.ts:49-56`
**Confidence:** High

The JSDoc states: "If a timezone offset is present, convert to KST (UTC+9) before extracting the date." But the code also applies the +9h conversion when NO timezone is present (tzOffset defaults to 0). The JSDoc is misleading.

**Fix:** Document that the function treats input as UTC when no timezone is present, then converts to KST. Or better, fix the behavior and document the corrected logic.

---

### DOC-41-02: `parseAmountString` JSDoc omits MAX_SAFE_INTEGER limitation (Low)

**File:** `packages/parser/src/csv/shared.ts:134-147`
**Confidence:** Medium

The extensive JSDoc lists many format variations but does not mention the JavaScript integer precision limit. Users might reasonably expect arbitrary-precision parsing.

**Fix:** Add a note about the `Number.MAX_SAFE_INTEGER` boundary.

---

### DOC-41-03: Cycle reference comments bloat files without adding value (Low)

**Confidence:** High

Cycle reference comments like `(C40-BUG02)`, `(C39-PERF01)` appear on nearly every function and significant line. They are not machine-readable, not linked to git history, and make the code harder to read.

**Fix:** Remove cycle references older than Cycle 20. Use git blame for provenance.

---

## Carryover

| ID | Description | File | Severity |
|----|-------------|------|----------|
| DOC-37-01 | Misleading `parseOFXDate` JSDoc on timezone math | `ofx/index.ts:85` | Medium |
| DOC-37-02 | Missing `@throws` / error behavior docs on entry functions | New parsers | Low |
| DOC-40-01 | JSDoc omits parenthesized negative format detail | `csv/shared.ts:134-147` | Low |
