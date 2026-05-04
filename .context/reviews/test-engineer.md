# Test Engineer Review -- Cycle 60

## Coverage Status
- 892 bun tests, 271 vitest tests passing
- column-matcher.test.ts, csv.test.ts, csv-shared.test.ts, csv-adapters.test.ts, date-utils.test.ts, detect.test.ts, table-parser.test.ts, xlsx.test.ts, xlsx-parity.test.ts all exist

## T60-01: Test for isAmountLike false positive fix
Add tests in csv.test.ts verifying that bare small numbers like "12", "3", "123" are NOT matched as amounts, while "1,234" and "₩500" still are.

## T60-02: Test for PDF reversed-column fallback
Add tests in table-parser.test.ts or a new pdf-fallback test verifying that lines with amount before date are parsed correctly in the fallback scanner.

## T60-03: Test for new column pattern terms
Add tests in column-matcher.test.ts for "할부회차", "조회일", "처리일", "참고사항" matching.

## T60-04: Test for web-side isValidYYMMDD import
After consolidation, existing isYYMMDDLike/isValidYYMMDD tests should continue to pass since they test behavior, not import paths.