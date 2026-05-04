# Cycle 81 Aggregate Review

## Review Summary

After 80 cycles, the parser is highly mature with 287 vitest tests passing. Server/web column-matcher patterns confirmed zero diff. Cycle 80 findings (F80-01, F80-02, F80-03) all confirmed resolved. This cycle identifies 1 actionable finding focused on a date format detection gap in the PDF parsing path.

## Findings

### F81-01: PDF findDateCell / isValidDateCell / fallbackDatePattern missing YYYYMMDD (8-digit) date support [HIGH]
**Files**: `packages/parser/src/pdf/index.ts`, `packages/parser/src/pdf/table-parser.ts`, `apps/web/src/lib/parser/pdf.ts`
**Issue**: The shared `parseDateStringToISO()` in `date-utils.ts` correctly handles YYYYMMDD format (e.g., "20240115"), and the CSV generic parser's `DATE_PATTERNS` array includes `/^\d{4}\d{2}\d{2}$/` for detection. However, the PDF parsers' detection functions do NOT include YYYYMMDD:
- `findDateCell()` in both server and web PDF parsers: missing 8-digit check
- `isValidDateCell()` in server-side table-parser.ts and web-side pdf.ts: missing 8-digit check
- `fallbackDatePattern` in both server and web PDF parsers: missing 8-digit alternative

**Impact**: PDF transactions with YYYYMMDD dates (e.g., "20240115 Starbucks 15,000") are silently dropped by both the structured table parser and the fallback line scanner.

**Fix**:
1. Add `YYYYMMDD` check with month/day validation in `findDateCell()` (server: `packages/parser/src/pdf/index.ts`, web: `apps/web/src/lib/parser/pdf.ts`)
2. Add `YYYYMMDD` check in `isValidDateCell()` (server: `packages/parser/src/pdf/table-parser.ts`, web: `apps/web/src/lib/parser/pdf.ts`)
3. Add 8-digit date alternative to `fallbackDatePattern` (server: `packages/parser/src/pdf/index.ts`, web: `apps/web/src/lib/parser/pdf.ts`)
4. Add tests for all three paths in `packages/parser/__tests__/table-parser.test.ts`

### F81-02: F80 findings confirmed resolved [INFO]
**Status**: F80-01 (fullwidth alphanumeric normalization), F80-02 (missing column pattern terms), F80-03 (missing summary row patterns) all confirmed correctly implemented.

## Server/Web Parity
CONFIRMED: Zero diff on all column-matcher exported symbols and patterns. Both sides share identical COLUMN_PATTERNS, SUMMARY_ROW_PATTERN, HEADER_KEYWORDS, and all keyword category Sets. The YYYYMMDD gap (F81-01) affects both sides symmetrically.

## Deferred Items (unchanged)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode
- D-01 shared module refactor
