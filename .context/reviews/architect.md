# Architect Review -- Cycle 24

## 1. Keyword Set Drift in isValidHeaderRow (HIGH)

`isValidHeaderRow()` in `column-matcher.ts` uses `DATE_KEYWORDS`, `MERCHANT_KEYWORDS`, and `AMOUNT_KEYWORDS` Sets for multi-category detection. However, these Sets do not include all entries matched by the column regex patterns:

- `AMOUNT_COLUMN_PATTERN` matches `price` and `won` via regex `^price$`, `^won$` -- but `AMOUNT_KEYWORDS` does NOT contain `'price'` or `'won'`
- `MERCHANT_COLUMN_PATTERN` matches `store` and `shop` -- but `MERCHANT_KEYWORDS` does NOT contain `'store'` or `'shop'`

This means a header row with only English columns like `['Date', 'Shop', 'Price']` would:
- `Date` matches `DATE_KEYWORDS` (present)
- `Shop` does NOT match `MERCHANT_KEYWORDS` (absent -- only matched by regex)
- `Price` does NOT match `AMOUNT_KEYWORDS` (absent -- only matched by regex)

Result: only 1 category (date) found, isValidHeaderRow returns false, header row rejected.

**Fix**: Add the missing regex-matched alternatives to the keyword Sets.

## 2. Summary Row Pattern Missing Variants (MEDIUM)

Current `SUMMARY_ROW_PATTERN` misses real-world Korean bank variants:
- `승인합계`, `승인 합계` (approval total)
- `결제합계`, `결제 합계` (payment total)  
- `총사용`, `총 사용`, `총이용`, `총 이용` (total usage)

## 3. Architecture -- No New Debt

After 23 cycles, the architecture is solid. Web/server duplication is accepted (deferred). Column-matcher and date-utils are properly shared.

## Verdict

F1 (keyword Set drift) is the highest priority fix. F2 is a robustness improvement. Both are low-risk changes.