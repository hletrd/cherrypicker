# Cycle 81 Code Review

## Reviewer: code-reviewer

### Overview
After 80 cycles of refinement, the parser is highly mature. Server/web column-matcher parity is confirmed (zero diff on all exported symbols and patterns). 287 vitest tests pass. This cycle identifies format diversity gaps that remain in the PDF parsing path.

## Findings

### F81-01: PDF findDateCell / isValidDateCell missing YYYYMMDD (8-digit) date support [HIGH]
**Files**: `packages/parser/src/pdf/index.ts`, `packages/parser/src/pdf/table-parser.ts`, `apps/web/src/lib/parser/pdf.ts`
**Issue**: The shared `parseDateStringToISO()` in `date-utils.ts` handles YYYYMMDD format (e.g., "20240115"), and the CSV generic parser's `DATE_PATTERNS` array includes `/^\d{4}\d{2}\d{2}$/` for detection. However, the PDF parsers' `findDateCell()` and `isValidDateCell()` functions do NOT include YYYYMMDD detection.

The server-side PDF's `findDateCell()` checks: STRICT_DATE_PATTERN (YYYY.MM.DD), SHORT_YEAR_DATE_PATTERN (YY.MM.DD), KOREAN_FULL_DATE_PATTERN, KOREAN_SHORT_DATE_PATTERN, and isValidShortDate (MM.DD). No YYYYMMDD.

The fallback line scanner's `fallbackDatePattern` also does NOT match YYYYMMDD (8-digit without separators).

**Impact**: PDF transactions with YYYYMMDD dates (e.g., "20240115 Starbucks 15,000") will be silently dropped by both the structured table parser and the fallback line scanner. While uncommon, this is a format that the date parsing infrastructure already supports but the PDF detection path does not leverage.

**Fix**:
1. Add `/^\d{8}$/` check in `findDateCell()` (both server and web) with month/day range validation.
2. Add `/^\d{8}$/` check in `isValidDateCell()` (both server-side table-parser.ts and web-side pdf.ts).
3. Add 8-digit date alternative to `fallbackDatePattern` in both server and web PDF parsers.
4. Add tests for all three paths.

### F81-02: F80 findings confirmed as resolved [INFO]
**Status**: The F80-01 (fullwidth alphanumeric normalization), F80-02 (missing column pattern terms), and F80-03 (missing summary row patterns) findings from cycle 80 are all confirmed as correctly implemented in the current codebase.

## Server/Web Parity
CONFIRMED: Zero diff on all column-matcher exported symbols and patterns. Both sides share identical COLUMN_PATTERNS, SUMMARY_ROW_PATTERN, HEADER_KEYWORDS, and all keyword category Sets. The PDF findDateCell/isValidDateCell gap (F81-01) affects both sides symmetrically.

## Architecture Notes
- 8154 lines of tests across 9 test files
- 287 vitest tests passing
- All column-matcher constants in sync between server and web
- The `parseDateStringToISO()` shared function already handles YYYYMMDD, so the fix is only in the detection layer
