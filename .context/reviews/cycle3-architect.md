# Cycle 3 Architectural Review — Web Parser Parity

**Reviewer:** architect
**Date:** 2026-05-05
**Scope:** apps/web/src/lib/parser/* (web-side parsers)

---

## Findings

### F1: normalizeHTML duplication between html.ts and xlsx.ts (High Confidence)

**Files:**
- `apps/web/src/lib/parser/html.ts:26-28`
- `apps/web/src/lib/parser/xlsx.ts:377-379`

**Problem:** The `normalizeHTML` function is duplicated verbatim in two parser modules. This creates a maintenance burden — any change to HTML normalization must be applied in two places. The function is used by both the HTML parser (for direct HTML input) and the XLSX parser (for HTML-as-XLS detection).

**Architectural suggestion:** Extract to a shared utility. Since `html.ts` is the natural owner (it parses HTML directly), export `normalizeHTML` from there and import it in `xlsx.ts`. Alternatively, create a `utils.ts` or `normalize.ts` shared module.

**Confidence:** High

---

### F2: Import organization in pdf.ts violates module conventions (Medium Confidence)

**File:** `apps/web/src/lib/parser/pdf.ts`

**Problem:** There are two `import` blocks in the file — one at the top (lines 1-16) and another in the middle (lines 241) for `date-utils`. The mid-file import is preceded by a large comment block explaining why it's there. While functional, this is unconventional and makes dependency scanning harder.

**Fix:** Move all imports to the top of the file. The explanatory comment can remain above the import line.

**Confidence:** Medium

---

### F3: Web-side parser parity tracking is good (Positive)

The web-side parsers (csv.ts, xlsx.ts, pdf.ts, html.ts, json.ts, ofx.ts) all include parity comments referencing server-side implementations (e.g., "parity with server-side packages/parser/src/..."). This is excellent practice for maintaining consistency across the Bun/Node and browser environments.

---

## Final Sweep

All web parser files were examined. The architecture is sound with clear separation of concerns. The only maintenance risk is the duplicated `normalizeHTML` function.
