# Cycle 17 Implementation Plan

## Changes

### 1. Fix `normalizeHeader()` whitespace handling (F17-01)
- **Files**: `packages/parser/src/csv/column-matcher.ts`, `apps/web/src/lib/parser/column-matcher.ts`
- **Change**: Add `\t\n\r` to the invisible-char strip regex
- **Impact**: Prevents header matching failures when XLSX/CSV cells contain tab/newline chars

### 2. Expand summary row skip patterns (F17-02, F17-04, F17-05)
- **Files**: All 7 files that have summary row regex:
  - `packages/parser/src/csv/adapter-factory.ts`
  - `packages/parser/src/csv/generic.ts`
  - `packages/parser/src/xlsx/index.ts`
  - `packages/parser/src/pdf/index.ts`
  - `apps/web/src/lib/parser/csv.ts`
  - `apps/web/src/lib/parser/xlsx.ts`
  - `apps/web/src/lib/parser/pdf.ts`
- **Change**: Add `누계|잔액|이월|소비|당월|명세` to the summary row pattern
- **Impact**: Prevents summary/footer rows from being parsed as transactions

### 3. Add whitespace stripping to PDF `parseAmount()` (F17-06)
- **Files**: `packages/parser/src/pdf/index.ts`, `apps/web/src/lib/parser/pdf.ts`
- **Change**: Add `.replace(/\s/g, '')` to the cleaned amount string
- **Impact**: Prevents mis-parsing of PDF amounts with embedded whitespace

### 4. Add parenthesized negative handling to PDF fallback scanner (F17-10 impl)
- **Files**: `packages/parser/src/pdf/index.ts`, `apps/web/src/lib/parser/pdf.ts`
- **Change**: Update `fallbackAmountPattern` to also match `(1,234)` pattern
- **Impact**: Captures refund transactions in PDF fallback parsing

### 5. Add tests (F17-08, F17-09, F17-10)
- **Files**: `packages/parser/__tests__/column-matcher.test.ts`,
  `packages/parser/__tests__/table-parser.test.ts`,
  `packages/parser/__tests__/csv.test.ts`
- **Tests to add**:
  - normalizeHeader with tab/newline characters
  - Summary row variants (누계, 잔액, 이월) in CSV parsing
  - Parenthesized negative amounts in PDF fallback

## Deferred
- F17-03 (PDF fallback false-match): Low risk, skip
- F17-07 (PDF error line tracking): UX, not correctness
- D-01 (Web CSV factory): Major refactor, separate cycle