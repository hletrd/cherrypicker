# Cycle 81 Implementation Plan

## Priority 1: F81-01 — PDF YYYYMMDD Date Detection [HIGH]

### Problem
PDF parsers cannot detect YYYYMMDD (8-digit) dates in:
1. `findDateCell()` — used by structured table parser
2. `isValidDateCell()` — used by `filterTransactionRows()`
3. `fallbackDatePattern` — used by fallback line scanner

The shared `parseDateStringToISO()` already handles this format, but the detection layer doesn't recognize it.

### Implementation

#### 1. Server-side `packages/parser/src/pdf/index.ts`
- Add a `isValidYYYYMMDD()` helper (validate month 1-12, day 1-31, similar to `isValidYYMMDD` but 8-digit)
- Add `isValidYYYYMMDD(cell)` check in `findDateCell()` after existing patterns
- Add `(?<!\d)\d{8}(?!\d)` alternative to `fallbackDatePattern`

#### 2. Server-side `packages/parser/src/pdf/table-parser.ts`
- Add `isValidYYYYMMDD()` helper or reuse from date-utils.ts
- Add `isValidYYYYMMDD(trimmed)` check in `isValidDateCell()` for 8-digit strings

#### 3. Web-side `apps/web/src/lib/parser/pdf.ts`
- Mirror all server-side changes

#### 4. Tests `packages/parser/__tests__/table-parser.test.ts`
- Add test for `isValidDateCell("20240115")` returning true
- Add test for `filterTransactionRows` accepting rows with YYYYMMDD dates
- Add test for invalid YYYYMMDD dates (e.g., "20241315" with month 13) returning false

### Files to modify
1. `packages/parser/src/pdf/index.ts`
2. `packages/parser/src/pdf/table-parser.ts`
3. `apps/web/src/lib/parser/pdf.ts`
4. `packages/parser/__tests__/table-parser.test.ts`

### Deferred Items (unchanged)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode
- D-01 shared module refactor
