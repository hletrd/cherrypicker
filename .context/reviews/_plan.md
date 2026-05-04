# Cycle 19 Implementation Plan

## Fixes (ordered by priority)

### 1. F19-01: PDF category/memo column extraction (P2)
**Files:** packages/parser/src/pdf/table-parser.ts, packages/parser/src/pdf/index.ts, apps/web/src/lib/parser/pdf.ts
**What:** Add `categoryCol` and `memoCol` to `PDFColumnLayout` interface and `getHeaderColumns()`. Use `CATEGORY_COLUMN_PATTERN` and `MEMO_COLUMN_PATTERN` (already imported in server-side). Add imports in web-side. Extract category/memo values in `tryStructuredParse()` loop.
**Tests:** Add test in packages/parser/__tests__/table-parser.test.ts for PDF header with category/memo columns.

### 2. F19-02: Extract shared summary row pattern constant (P2)
**Files:** packages/parser/src/csv/column-matcher.ts, apps/web/src/lib/parser/column-matcher.ts, then update 7 consumer files
**What:** Add `SUMMARY_ROW_PATTERN` constant to both column-matcher modules. Replace inline regex in all 7 files.
**Tests:** Add test in column-matcher.test.ts verifying pattern matches all Korean summary variants.

### 3. F19-03: CSV generic parsers use findColumn() (P2)
**Files:** packages/parser/src/csv/generic.ts, apps/web/src/lib/parser/csv.ts
**What:** Replace manual `if (PATTERN.test(h))` loops with `findColumn(headers, undefined, PATTERN)`. Import findColumn in server generic.
**Tests:** Existing tests should pass unchanged (behavioral equivalence).

### 4. F19-04: Server PDF tryStructuredParse error handling parity (P2)
**Files:** packages/parser/src/pdf/index.ts
**What:** Change `tryStructuredParse` to catch all errors (not just SyntaxError/TypeError/RangeError) and return null, matching web-side behavior.
**Tests:** Existing tests should pass.

### 5. F19-05: XLSX test coverage for edge cases (P3)
**Files:** packages/parser/__tests__/xlsx.test.ts
**What:** Add tests for:
- Parenthesized negative amounts `(1,234)` -> skipped (amount <= 0)
- Spaced amounts `"1 234"` -> 1234
- Won sign with spaces `"₩ 1,234"` -> 1234
- Excel formula error cells `#VALUE!` -> error message

## Deferred
- D-01: Web-side CSV/XLSX factory refactor (shared module)
- D-02: Duplicate BANK_COLUMN_CONFIGS
- D-03: PDF multi-line header support
- D-04: XLSX forward-fill code duplication