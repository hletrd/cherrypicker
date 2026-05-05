# Cycle 17 — Document Specialist Review

**Date:** 2026-05-05
**Scope:** Doc/code mismatches, comment accuracy, documentation gaps

## Findings

### C17-DOC01 [LOW] — Comment about `parseAmount` parity is misleading
- **File:** `packages/parser/src/pdf/index.ts:38-39`
- **Issue:** The comment says "parseAmount delegates to the shared parseAmountString from csv/shared.ts to eliminate duplication across CSV, XLSX, and PDF parsers (C97-02)." This is technically true for the structured parser path, but the fallback scanner does NOT use `parseAmount` — it extracts capture groups directly and passes them to `parseAmountString`. The comment doesn't mention the fallback path.
- **Impact:** Low — developers reading the code may assume fallback amounts are also handled by the shared function in the same way.
- **Fix:** Add a clarifying comment that the fallback scanner extracts capture groups directly and passes raw strings to `parseAmountString`.

### C17-DOC02 [LOW] — Web-side PDF `fallbackAmountPattern` comment is accurate but verbose
- **File:** `apps/web/src/lib/parser/pdf.ts:558-573`
- **Issue:** The 15-line comment explaining capture groups is helpful but duplicates information that could be inferred from the regex itself. The comment does correctly document the web-side behavior.
- **Impact:** None — informational only.

### C17-DOC03 [LOW] — Missing documentation for `normalizeHTML` scope
- **File:** `apps/web/src/lib/parser/html.ts:26-29`, `packages/parser/src/csv/shared.ts:177-182`
- **Issue:** The JSDoc says "Fix malformed closing tags" but doesn't document that only 6 specific tags are handled. A developer might assume all tags are covered.
- **Fix:** Update the JSDoc to list the handled tags or note the limited scope.

## Summary

No doc/code mismatches that would cause bugs. Minor documentation clarity issues.
