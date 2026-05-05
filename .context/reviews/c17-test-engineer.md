# Cycle 17 — Test Engineer Review

**Date:** 2026-05-05
**Scope:** Test coverage gaps, flaky tests, TDD opportunities

## Findings

### C17-TEST01 [MEDIUM] — No test for server-side PDF fallback trailing-minus amounts
- **File:** `packages/parser/__tests__/pdf.test.ts` (inferred)
- **Issue:** The server-side PDF fallback scanner's trailing-minus capture group bug (C17-CR01) would have been caught by a test that feeds a line like `"2024.01.15 가맹점 1,234-"` through the fallback parser and asserts the amount is negative. No such test exists.
- **Impact:** Medium — parity bugs between server and web parsers are a recurring issue class that tests should catch.
- **Fix:** Add a test case for trailing-minus amounts in the server-side PDF parser tests. Also add tests for parenthesized negatives, 마이너스 prefix, and full-width minus in the fallback scanner.
- **Confidence:** High

### C17-TEST02 [LOW] — No test for `findField` prototype chain behavior
- **File:** `packages/parser/__tests__/json.test.ts`, `apps/web/__tests__/parser-json.test.ts`
- **Issue:** The `findField` function's use of `in` operator vs `hasOwn` is not tested. A test that creates an object with a polluted prototype would verify the correct behavior.
- **Fix:** Add a test that sets `Object.prototype.fakeField = 'bad'` and asserts that `findField` does NOT return the prototype value.
- **Confidence:** Medium

### C17-TEST03 [LOW] — No test for full-width plus sign `＋` in amount parsing
- **File:** `packages/parser/__tests__/csv-shared.test.ts`
- **Issue:** Neither the shared `parseAmountString` nor the web-side `parseAmount` have tests for full-width plus sign `＋` (U+FF0B).
- **Fix:** Add test case: `parseAmountString('＋1,234원')` should return `1234`.
- **Confidence:** Low

### C17-TEST04 [LOW] — No test for `normalizeHTML` with `div`, `span`, `p` malformed tags
- **File:** `packages/parser/__tests__/html.test.ts`, `apps/web/__tests__/parser-html.test.ts`
- **Issue:** The HTML parser's `normalizeHTML` function is only tested (if at all) with `td/th/tr/table/thead/tbody` tags. Malformed `</div   >` tags are not covered.
- **Fix:** Add test cases for additional malformed tag types.
- **Confidence:** Low

## Summary

| Severity | Count |
|----------|-------|
| MEDIUM | 1 |
| LOW | 3 |

Key gap: parity tests between server and web PDF fallback scanners would prevent regressions like C17-CR01.
