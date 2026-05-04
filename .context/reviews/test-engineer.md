# Test Engineer Review -- Cycle 24

## New Test Cases Needed

### 1. Keyword Set completeness against column regex patterns (F1)

Add tests in `column-matcher.test.ts` that verify `isValidHeaderRow()` accepts headers using ONLY regex-matched entries (not just Set entries):
- `['Date', 'Shop', 'Price']` should pass isValidHeaderRow (Date=date, Shop=merchant via regex, Price=amount via regex)
- `['Date', 'Store', 'Won']` should pass
- `['transaction_date', 'shop', 'price']` should pass

### 2. Expanded SUMMARY_ROW_PATTERN variants (F2)

Add tests verifying new summary variants are matched:
- `승인 합계 100,000원` should match
- `결제 합계` should match
- `총사용 50,000` should match
- `총 이용 금액` should match

### 3. English-only CSV parsing end-to-end

Add a test in `csv.test.ts` that parses a full CSV with English-only headers:
```
Date,Shop,Amount
2024-01-15,Starbucks,5000
```
This exercises the full pipeline: header detection, column matching, and parsing.

## Current Test Counts
- Bun: 512 pass, 0 fail