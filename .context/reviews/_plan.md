# Cycle 11 Implementation Plan

## Fix 1: PDF DATE_PATTERN — add short date (MM.DD) support (HIGH)
- **Files**: `packages/parser/src/pdf/table-parser.ts:3`, `apps/web/src/lib/parser/pdf.ts:21`
- **Change**: Extend `DATE_PATTERN` to include short month/day dates. Add the `MM.DD` pattern with a negative lookahead to avoid matching decimal numbers (e.g., "3.14159"). Use `(?<!\d)\d{1,2}[.\-\/]\d{1,2}(?!\d)` to match short dates while rejecting longer number sequences.
- **Impact**: Structured PDF parsing now works for PDFs using short date formats like "1.15" or "01/15".

## Fix 2: Web XLSX — report invalid serial date errors (MEDIUM)
- **File**: `apps/web/src/lib/parser/xlsx.ts:216-218`
- **Change**: Add error reporting for out-of-range serial dates, matching server-side behavior in `packages/parser/src/xlsx/index.ts:60-63`.
- **Impact**: Web users get error feedback for corrupted date cells.

## Fix 3: normalizeHeader — strip zero-width Unicode characters (MEDIUM)
- **Files**: `packages/parser/src/csv/column-matcher.ts:10`, `apps/web/src/lib/parser/column-matcher.ts:13`
- **Change**: Add removal of U+200B (zero-width space), U+200C (zero-width non-joiner), U+200D (zero-width joiner), U+FEFF (BOM/zero-width no-break space), U+00AD (soft hyphen) to `normalizeHeader`.
- **Impact**: Headers with invisible Unicode characters from Korean bank exports are matched correctly.

## Fix 4: Tests for all fixes (HIGH)
- **Files**: `packages/parser/__tests__/table-parser.test.ts`, `packages/parser/__tests__/csv-shared.test.ts`, `packages/parser/__tests__/xlsx.test.ts`
- **Tests**:
  - PDF table-parser: short date rows detected in parseTable, filterTransactionRows
  - CSV column-matcher: normalizeHeader with zero-width spaces
  - XLSX: formula error cells, out-of-range serial dates
- **Impact**: Regression protection for new fixes.

## Deferred (explicitly not this cycle)
- D-01: Server/web shared module refactoring (build system limitation)
- D-02: Web CSV adapter factory pattern (600+ line refactor)
- D-03: PDF parser deduplication
- D-04: PDF multi-line transaction support
- D-05: Historical amount display format
- D-06: Card name suffixes
- D-07: Global config integration
- D-08: Generic parser fallback behavior
- D-09: CSS dark mode complete migration