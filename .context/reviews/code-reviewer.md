# Code Reviewer -- Cycle 95

## Summary
After 94 cycles, parser handles extensive format diversity. This review identifies keyword/pattern parity bugs between column regex patterns and the keyword Sets used by `isValidHeaderRow()`.

## Findings

### F-95-01: MERCHANT_KEYWORDS Set missing 3 entries from MERCHANT_COLUMN_PATTERN (BUG)
**Severity: Medium** -- `isValidHeaderRow()` requires keywords from 2+ categories. Missing keywords cause header detection failure for banks using these terms.

Missing from `MERCHANT_KEYWORDS` but present in `MERCHANT_COLUMN_PATTERN`:
- `구매내용` (purchase description)
- `취소가맹점` (cancelled merchant)
- `가게` (store/shop)

File: `packages/parser/src/csv/column-matcher.ts` line 111

### F-95-02: CATEGORY_KEYWORDS Set missing 2 entries from CATEGORY_COLUMN_PATTERN (BUG)
**Severity: Low** -- Same parity issue for category keywords.

Missing from `CATEGORY_KEYWORDS` but present in `CATEGORY_COLUMN_PATTERN`:
- `가맹점유형` (merchant type)
- `매장유형` (store type)

File: `packages/parser/src/csv/column-matcher.ts` line 113

### F-95-03: AMOUNT_COLUMN_PATTERN missing "원금" (FORMAT DIVERSITY)
**Severity: Low** -- "원금" means "principal amount" and is used by some Korean bank exports. Not in `AMOUNT_COLUMN_PATTERN` or `AMOUNT_KEYWORDS`.

File: `packages/parser/src/csv/column-matcher.ts` lines 74, 112

## Deferred Items
- D-01: PDF multi-line header support (architectural)
- D-02: Shared module refactor for duplicated parseAmount/isValidShortDate