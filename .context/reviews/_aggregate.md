# Cycle 78 Aggregate Review

## Review Summary

After 77 cycles of intensive parser improvements, the parser is highly mature with 24 bank adapters and extensive column patterns. This cycle expanded format diversity by adding 50+ new column header terms (Korean and English) across all column patterns, 2 new summary row patterns, and 34 new tests covering parity, combined headers, and English-only header detection.

## Findings

### 1. Missing Korean Column Header Terms [FIXED C78-01]
- **Severity**: HIGH (format diversity)
- **Details**: 15 new Korean terms added across DATE (결제일시, 주문시간, 승인완료, 조회시간, 처리일시), MERCHANT (상점, 판매점, 이용매장명, 구매내용), AMOUNT (이용대금, 실결제액, 청구액, 사용액, 할인금액, 포인트할인), CATEGORY (결제구분, 매장유형), MEMO (메모사항, 기타)

### 2. Missing English Column Header Terms [FIXED C78-01]
- **Severity**: HIGH (format diversity)
- **Details**: 13 new English terms added: statementdate, paymentdate, invoicedate, timestamp, supplier, brand, location, transactionamount, paymentamount, billedamount, netamount, gross, payment_type

### 3. Missing Summary Row Patterns [FIXED C78-02]
- **Severity**: MEDIUM (false positive prevention)
- **Details**: Added 포인트합계 and 승인취소합계 to SUMMARY_ROW_PATTERN

### 4. HEADER_KEYWORDS and Keyword Sets Synced [FIXED C78-03]
- **Severity**: HIGH (header detection)
- **Details**: All new terms added to HEADER_KEYWORDS, DATE_KEYWORDS, MERCHANT_KEYWORDS, AMOUNT_KEYWORDS

### 5. Test Coverage Expanded [FIXED C78-04]
- **Severity**: MEDIUM (robustness)
- **Details**: 34 new tests for new patterns, summary rows, combined headers (+ delimiter, 3-part), English-only headers, and full server-web parity (INSTALLMENTS, CATEGORY, MEMO patterns + all keyword Sets)
- **Location**: `packages/parser/src/csv/column-matcher.ts` line 100, `apps/web/src/lib/parser/column-matcher.ts` line 84
- **Issue**: `DATE_KEYWORDS` ReadonlySet missing: `취소일`, `정산일`, `환불일`, `반품일`, `교환일`. These ARE in `DATE_COLUMN_PATTERN` regex and `HEADER_KEYWORDS` array but were never added to the keyword Set.
- **Impact**: `isValidHeaderRow()` may reject valid header rows where the date column exclusively uses one of these terms.
- **Fix**: Add 5 missing terms to `DATE_KEYWORDS` in both server and web column-matcher files.

## Server/Web Parity Status
All parser parity items remain resolved. Both server and web use identical column patterns, date utilities, amount parsing, and summary row detection. The only discrepancy is Finding 1 — both sides have the same missing terms.

## Deferred Items (unchanged from cycle 76)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode complete migration
- D-01 shared module refactor (web CSV duplication)