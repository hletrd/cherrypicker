# Cycle 95 Aggregate Review

## Summary
After 94 cycles, 1314 bun + 306 vitest tests pass with 0 failing. This cycle identifies **3 actionable findings** (2 bugs, 1 format diversity) and **2 deferred items**.

## Actionable Findings

### F-95-01: MERCHANT_KEYWORDS Set missing 3 entries (BUG)
`MERCHANT_KEYWORDS` Set is missing `구매내용`, `취소가맹점`, `가게` which are present in `MERCHANT_COLUMN_PATTERN`. This causes `isValidHeaderRow()` to fail for headers containing only these merchant terms (if no other merchant keyword is in the row).

### F-95-02: CATEGORY_KEYWORDS Set missing 2 entries (BUG)
`CATEGORY_KEYWORDS` Set is missing `가맹점유형`, `매장유형` which are present in `CATEGORY_COLUMN_PATTERN`.

### F-95-03: AMOUNT_COLUMN_PATTERN missing "원금" (FORMAT DIVERSITY)
"원금" (principal amount) is not in `AMOUNT_COLUMN_PATTERN` or `AMOUNT_KEYWORDS`. Used by some Korean bank exports.

## Deferred Items
- D-01: PDF multi-line header support (architectural)
- D-02: Shared module refactor for duplicated parseAmount/isValidShortDate across 6 files