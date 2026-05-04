# Code Review -- Cycle 24

## Finding 1: AMOUNT_KEYWORDS / MERCHANT_KEYWORDS missing entries that column regexes match [HIGH]

**Location:** `packages/parser/src/csv/column-matcher.ts` lines 71-73

**Problem:** `isValidHeaderRow()` uses `AMOUNT_KEYWORDS`, `MERCHANT_KEYWORDS`, and `DATE_KEYWORDS` Sets to count how many distinct categories a header row covers. But these Sets are incomplete compared to the column regex patterns:

- `AMOUNT_COLUMN_PATTERN` matches `^price$`, `^won$` (case-insensitive) but `AMOUNT_KEYWORDS` only has `['amount', 'total']` -- missing `'price'` and `'won'`
- `MERCHANT_COLUMN_PATTERN` matches `^store$`, `^shop$` but `MERCHANT_KEYWORDS` only has `['merchant', 'store', 'description']` -- `'shop'` is missing

This means a CSV with `['Date', 'Shop', 'Price']` headers would fail `isValidHeaderRow()` (only 1 category matched: date) and the parser would return a "header row not found" error. The column patterns would correctly match these headers, but the validation gate rejects them.

**Fix:** Add `'price'`, `'won'` to `AMOUNT_KEYWORDS` and `'shop'` to `MERCHANT_KEYWORDS`.

## Finding 2: SUMMARY_ROW_PATTERN missing common Korean variants [MEDIUM]

**Location:** `packages/parser/src/csv/column-matcher.ts` line 55

**Problem:** The pattern `/총\s*합계|합\s*계|총\s*계|소\s*계|합계|총계|소계|누계|잔액|이월|소비|당월|명세|total|sum/i` misses several real-world Korean bank statement footer variants:

- `승인합계`, `승인 합계` (approval total) -- common in Shinhan, KB exports
- `결제합계`, `결제 합계` (payment total) -- common in Woori exports
- `총사용`, `총 사용`, `총이용`, `총 이용` (total usage) -- common in BC, Lotte exports

**Fix:** Add these variants to the pattern.

## Finding 3: No test coverage for keyword Set completeness against regex patterns [LOW]

**Location:** `packages/parser/__tests__/column-matcher.test.ts`

**Problem:** Tests verify that `isValidHeaderRow` works with standard headers, but there's no test that ensures every entry matched by the column regex patterns is also present in the keyword Sets. This means Set/regex drift (like Finding 1) is not caught by tests.

## Previous Cycle Status

Cycle 23 F1 (web CSV summary row skip): CONFIRMED FIXED -- all 10 web adapters now include `SUMMARY_ROW_PATTERN.test(line)` checks.
Cycle 23 F2 (PDF DATE_PATTERN full-width dot): CONFIRMED FIXED -- server-side `table-parser.ts` line 5 now includes full-width dot variants.
Cycle 23 F3 (full-width dot integration tests): Still open, low priority.