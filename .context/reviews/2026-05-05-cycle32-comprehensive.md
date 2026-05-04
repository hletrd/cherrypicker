# Cycle 32 Comprehensive Review

## Status
- 574 bun tests passing, 243 vitest tests passing (817 total)
- All parser modules functional across CSV, XLSX, PDF

## Findings

### F-01: PDF AMOUNT_PATTERN missing Won sign prefix (MEDIUM)
**Files**: `packages/parser/src/pdf/table-parser.ts` (line 12), `apps/web/src/lib/parser/pdf.ts` (line 40)

The AMOUNT_PATTERN regex for PDF table row detection does NOT include the ₩/￦ prefix for amounts without commas. Amounts like "₩500" (no comma, < 5 digits) would fail to match as amount-containing rows, causing valid transaction lines to be skipped.

Current: `(?<![a-zA-Z\d-])(?:[\d,]*,|\d{5,})[\d,]*원?(?![a-zA-Z\d-])`
Should also match: `₩500`, `₩123`, `₩1000원`

### F-02: Date format YYMMDD not supported (LOW)
**File**: `packages/parser/src/date-utils.ts`, `apps/web/src/lib/parser/date-utils.ts`

The `parseDateStringToISO` function handles YYYYMMDD (8 digits) and YY-MM-DD (with delimiters) but NOT YYMMDD (6 digits without delimiters). Some bank exports may use this compact format.

### F-03: Web CSV parser full duplication of 10 bank adapters (DEFERRED)
**File**: `apps/web/src/lib/parser/csv.ts` (1099 lines)

The web-side CSV parser still maintains 10 hand-written bank-specific adapters (~700 lines) instead of using the factory pattern from the server-side. This is a known architecture issue (D-01) that cannot be fixed without a shared module between Bun and browser environments.

### F-04: normalizeHeader missing directional formatting characters (LOW)
**Files**: `packages/parser/src/csv/column-matcher.ts` (line 12), `apps/web/src/lib/parser/column-matcher.ts` (line 16)

The normalizeHeader regex strips common invisible Unicode characters (U+200B-U+200D, U+00AD, U+00A0, U+3000) but does not include:
- U+200E (LEFT-TO-RIGHT MARK)
- U+200F (RIGHT-TO-LEFT MARK)
- U+202A-U+202E (directional embedding/override)
- U+FEFF (BOM) — may appear mid-string in concatenated exports

These could appear in edge-case bank exports and cause header matching to fail.

### F-05: CSV amount parsing: "마이너스" prefix not handled (LOW)
**Files**: All parseAmount/parseCSVAmount functions

Some Korean bank statements prefix amounts with "마이너스" (minus) instead of using a negative sign or parentheses. Example: "마이너스 1,234" should parse as -1234. Currently this would return NaN/null.

### F-06: Test coverage gaps for format diversity (MEDIUM)
Missing test cases:
- YYMMDD date format (6 digits without delimiters)
- Won sign amounts in PDF context ("₩500", "₩1,234원")
- Amount with "마이너스" prefix
- PDF AMOUNT_PATTERN with ₩ prefix for small amounts
- Header normalization with directional Unicode characters

## Severity Summary
- MEDIUM: 2 (F-01 PDF amount pattern, F-06 test coverage)
- LOW: 3 (F-02 YYMMDD, F-04 normalizeHeader, F-05 마이너스)
- DEFERRED: 1 (F-03 web CSV architecture)