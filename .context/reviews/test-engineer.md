# Test Engineer Review -- Cycle 19

## Test Coverage Gaps

### 1. XLSX parenthesized negative amounts (carried from F18-04)

No test in `packages/parser/__tests__/xlsx.test.ts` verifies that `(1,234)` in an XLSX cell is parsed as -1234 and then skipped (amount <= 0). This is a critical format that Korean bank exports use for refunds.

### 2. XLSX spaced/whitespace amounts (carried from F18-05)

No test verifies that `"1 234"` or `"₩ 1,234"` (with internal whitespace) is correctly parsed by the XLSX `parseAmount()`. The `.replace(/\s/g, '')` was added but never tested.

### 3. XLSX Excel formula error cells

The `EXCEL_ERROR_PATTERN` constant (`#VALUE!`, `#REF!`, `#DIV/0!`, `#NAME?`, `#NULL!`, `#NUM!`, `#CALC!`, `#N/A`) and its error handling in `parseDateToISO()` has no dedicated test.

### 4. PDF category/memo column extraction

When PDF table headers contain category (업종) or memo (비고) columns, no test verifies these are extracted and included in transactions.

### 5. Summary row pattern extraction

The summary row skip pattern is duplicated 7 times but has no dedicated unit test. A shared constant would benefit from a test that verifies all variants are matched.

### 6. CSV generic parser with findColumn() consistency

After switching generic CSV to use `findColumn()`, verify that all existing tests still pass and that the behavior is identical.

## Current Test Counts

- Bun: 734 pass, 0 fail
- Vitest: 233 pass, 0 fail
- Total: 967 tests passing