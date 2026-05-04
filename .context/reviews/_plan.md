# Cycle 73 Plan

## Fix 1: XLSX amount column forward-fill with whitespace guard (C73-01)
Add amount column forward-fill to both server and web XLSX parsers.
Limit forward-fill to whitespace-only cells only (not truly empty cells) to prevent
contamination from legitimately empty amount cells.

## Fix 2: XLSX whitespace-only cell forward-fill guard (C73-02)
Update forward-fill condition for all columns (date, merchant, category, installments, memo)
to treat whitespace-only cells as empty by checking `.trim() === ''` in addition to `!== ''`.
This prevents whitespace artifacts from contaminating forward-fill state.

## Fix 3: Add missing column header keywords (C73-03)
Add to column-matcher.ts:
- Amount pattern: "환급금액", "입금금액"
- Memo pattern: "카드명", "이용카드"
- Date pattern: "이용시간"
- English: "debit", "credit", "net", "recipient", "outlet", "trans_date", "book_date"

## Fix 4: XLSX parseAmount Excel error detection (C73-04)
Add EXCEL_ERROR_PATTERN check to parseAmount in both server and web XLSX parsers
for specific error messages matching the parseDateToISO pattern.

## Fix 5: Tests for all new features
Add tests for amount forward-fill, whitespace guard, new column patterns, Excel error in amount.

## Deferred (explicitly not this cycle)
- PDF multi-line headers (architectural complexity)
- Historical amount display format
- Card name suffixes
- Global config integration
- CSS dark mode
