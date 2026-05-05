# Cycle 14 Security Review

## Findings

### C14-SEC01: `console.warn` leaks internal data (LOW)
- **File:** `apps/web/src/lib/analyzer.ts:58, 64`
- **Description:** `console.warn` logs card IDs and unrecognized field values. In production, users with dev tools open can see this internal data.
- **Fix:** Remove console.warn calls.
- **Confidence:** Medium

### C14-SEC02: `parseAmountString` potential ReDoS from user-controlled input (LOW)
- **File:** `packages/parser/src/csv/shared.ts:140-163`
- **Description:** `parseAmountString` performs multiple regex replacements on user-controlled CSV cell content. While the regexes are simple and bounded, parsing extremely long strings (e.g., 10MB cells) could be slow.
- **Fix:** Add an early length guard (e.g., reject inputs > 1KB).
- **Confidence:** Low

### C14-SEC03: No findings of CRITICAL or HIGH severity (GOOD)
- No XSS, injection, path traversal, or CSRF issues found in changed code.
- The `normalizeHTML` function in `shared.ts` only fixes closing tag syntax, it does not sanitize content. However, HTML report generation in `packages/viz/src/report/generator.ts` uses template literals without explicit sanitization. This is a known carry-over from previous cycles.
