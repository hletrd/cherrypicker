# Test Engineer — Cycle 12

**Date:** 2026-05-05
**Reviewer:** test-engineer

## Test Coverage Gaps

### T12-01: No dedicated tests for column-matcher module (HIGH)
**File**: `packages/parser/src/csv/column-matcher.ts`
The entire column-matcher module (normalizeHeader, findColumn, isValidHeaderRow, all pattern constants) has ZERO dedicated test coverage. It is only tested indirectly through CSV adapter tests and XLSX tests. Missing test cases:
- `normalizeHeader()` with zero-width spaces (U+200B, U+200C, U+200D)
- `normalizeHeader()` with soft hyphens (U+00AD)
- `normalizeHeader()` with parenthetical suffixes like "이용금액(원)"
- `normalizeHeader()` with internal whitespace "이용 금액"
- `findColumn()` exact match vs regex fallback precedence
- `findColumn()` returning -1 for no match
- `isValidHeaderRow()` requiring 2+ categories
- `isValidHeaderRow()` rejecting single-category rows (summary rows)
- `isValidHeaderRow()` with English case-insensitive keywords
- All `*_COLUMN_PATTERN` regexes against expected column names

### T12-02: No tests for CSV isDateLike/isAmountLike heuristics (MEDIUM)
**File**: `packages/parser/src/csv/generic.ts:19-44`
The data-inference path in the generic CSV parser uses `isDateLike()` and `isAmountLike()` to detect columns when headers don't match. These heuristics are untested:
- Compact dates: "20240115"
- Korean dates: "2024년 1월 15일"
- Won-prefixed amounts: "₩1,234"
- Fullwidth Won: "￦1,234"
- Parenthesized negatives: "(1,234)"
- Date-like amounts that should NOT match: "1.5" (could be date or amount)

### T12-03: No tests for XLSX formula error cells (LOW)
Both XLSX parsers handle numeric and string amounts, but there's no test for SheetJS returning formula error objects (e.g., `{ t: 'e', v: '#REF!' }`). When `cellDates: false`, formula errors would be stringified and fail to parse as amounts. The current behavior (skip with error message) is correct but untested.

### T12-04: No test for PDF multi-line cell content (LOW)
The PDF table parser splits lines by column boundaries, but if a cell value wraps to the next line (e.g., a long merchant name), the parser would treat it as a separate row. This edge case is untested.

## Test Quality Notes
- Existing 313 bun + 231 vitest tests are well-structured
- Date-utils tests (27 tests) cover most date format variations
- CSV adapter tests cover all 10 bank adapters
- XLSX parity tests ensure server/web consistency
- Table-parser tests cover basic PDF table extraction