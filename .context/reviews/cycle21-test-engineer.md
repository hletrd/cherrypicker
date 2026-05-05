# Cycle 21 — Test Engineer Review

## C21-TEST01: Missing full-width plus sign (＋) tests for amount parsing (LOW)

**File:** `packages/parser/__tests__/csv-shared.test.ts`
**Confidence:** High

The server-side `parseAmountString` handles full-width plus sign (`＋`) via `.replace(/＋/g, '+')` (line 145 of `packages/parser/src/csv/shared.ts`). However, there is no test verifying this behavior. The existing tests in `csv-shared.test.ts` cover full-width digits, full-width comma, Won sign, `마이너스` prefix, trailing minus, and parenthesized negatives — but not full-width plus.

**Fix:** Add a test case: `expect(parseAmountString('＋1,234')).toBe(1234)`.

---

## C21-TEST02: No tests for web-side XLSX parser (LOW)

**File:** `apps/web/src/lib/parser/xlsx.ts`
**Confidence:** High

The web-side XLSX parser has zero test coverage. Key untested paths:
- HTML-as-XLS detection (`isHTMLContent`)
- Excel serial date parsing (`parseDateToISO` with numeric input)
- Forward-fill for merged cells
- Formula error string detection (`#VALUE!`, `#REF!`, etc.)
- YYMMDD numeric date parsing (C91-02)

**Fix:** Create `apps/web/__tests__/parser-xlsx.test.ts` with basic coverage. If web-side test infrastructure is not available, add tests to `packages/parser/__tests__/xlsx.test.ts` that exercise parity paths.

---

## C21-TEST03: No tests for web-side PDF parser (LOW)

**File:** `apps/web/src/lib/parser/pdf.ts`
**Confidence:** High

The web-side PDF parser (using pdfjs-dist) has zero dedicated tests. Key untested paths:
- Structured table parsing (`tryStructuredParse`)
- Fallback line scanner with regex patterns
- Date validation (`isValidDateCell`)
- Amount parsing with full-width characters

**Fix:** Since pdfjs-dist requires browser environment, tests may need Playwright or jsdom. At minimum, extract the pure string-processing functions (`parseAmount`, `parseDateToISO`, `isValidDateCell`, `parseTable`) and unit-test them without pdfjs-dist.

---

## C21-TEST04: No tests for web-side format detection (LOW)

**File:** `apps/web/src/lib/parser/detect.ts`
**Confidence:** High

`detectFormatFromFile` and `detectBank` have no tests. After C21-02 adds content sniffing, these will need tests for:
- Extension-based detection (all supported extensions)
- Content sniffing for mismatched extensions
- Bank signature matching with confidence scoring
- Single-pattern bank confidence capping (C70-01)

**Fix:** Create `apps/web/__tests__/parser-detect.test.ts`.
