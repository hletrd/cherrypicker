# Test Engineer Review -- Cycle 59

## Coverage Status
- 879+ bun tests, 131+ vitest tests passing
- column-matcher.test.ts, csv.test.ts, csv-shared.test.ts, csv-adapters.test.ts, date-utils.test.ts, detect.test.ts, table-parser.test.ts, xlsx.test.ts, xlsx-parity.test.ts all exist

## T59-01: No test for KRW-prefixed amounts in PDF AMOUNT_PATTERN
The `filterTransactionRows()` function is tested via `table-parser.test.ts`, but no test verifies that KRW-prefixed amounts like "KRW10,000" are detected as transaction amounts. Add tests after fixing C59-01.

## T59-02: No test for KRW in PDF fallback scanner
The fallback line scanner path in `packages/parser/src/pdf/index.ts` is not tested for KRW amounts. Add test after fixing C59-02.

## T59-03: isYYMMDDLike consolidation needs test update
After extracting to `date-utils.ts`, existing tests in `date-utils.test.ts` should cover the new function. The existing `isYYMMDDLike` tests in `csv.test.ts` and `table-parser.test.ts` should continue to pass since they test the behavior, not the import path.