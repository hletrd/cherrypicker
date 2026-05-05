# Cycle 86 Code Review

## Summary
After 85 cycles, the parser is very mature. This review identifies **4 actionable findings** related to missing English keywords in HEADER_KEYWORDS that prevent valid English-only header rows from being detected, plus missing `할인` in SUMMARY_ROW_PATTERN.

## Findings

### F1 — Missing English date keywords in HEADER_KEYWORDS (MEDIUM)
**Area:** `packages/parser/src/csv/column-matcher.ts` + `apps/web/src/lib/parser/column-matcher.ts`
**Description:** Several English date terms present in DATE_COLUMN_PATTERN and DATE_KEYWORDS are absent from HEADER_KEYWORDS. Since `isValidHeaderRow()` checks HEADER_KEYWORDS to detect header rows, rows containing only these English terms fail detection.
**Missing terms:** `settlementdate`, `paymentdate`, `invoicedate`, `purchasedt`, `purchase_dt`, `transdate`, `transdt`, `transactiondt`, `transaction_dt`, `txndt`, `bookdate`, `canceldate`, `refunddate`
**Impact:** CSV/XLSX files from international card companies or user-reformatted English statements may fail header detection.

### F2 — Missing `name` merchant keyword in HEADER_KEYWORDS (LOW)
**Area:** `packages/parser/src/csv/column-matcher.ts` + `apps/web/src/lib/parser/column-matcher.ts`
**Description:** MERCHANT_COLUMN_PATTERN includes `^name$` but `name` is not in HEADER_KEYWORDS. A header row like `['Name', 'Amount']` would not be detected as valid.

### F3 — Missing English amount keywords in HEADER_KEYWORDS (LOW)
**Area:** `packages/parser/src/csv/column-matcher.ts` + `apps/web/src/lib/parser/column-matcher.ts`
**Description:** AMOUNT_COLUMN_PATTERN includes `debit`, `credit`, `net`, `netamount`, `gross` but these are not in HEADER_KEYWORDS. A header row like `['Date', 'Debit']` would fail header detection.

### F4 — Missing `할인` in SUMMARY_ROW_PATTERN (LOW)
**Area:** `packages/parser/src/csv/column-matcher.ts` + `apps/web/src/lib/parser/column-matcher.ts`
**Description:** Some bank exports produce standalone "할인" summary rows. The existing pattern has `할인\s*합계` and `포인트\s*할인` but lacks a standalone `할인` guard for lines like "할인 1,234원" which represent summary discount amounts.

## Server/Web Parity
Both server and web column-matcher.ts files must be updated in sync. All other parsers (CSV, XLSX, PDF) import from column-matcher so they automatically pick up changes.