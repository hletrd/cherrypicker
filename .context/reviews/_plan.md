# Cycle 78 Implementation Plan

## Fix 1: Expand Column Pattern Coverage (C78-01)
**Priority**: HIGH (format diversity)
**Files**:
- `packages/parser/src/csv/column-matcher.ts`
- `apps/web/src/lib/parser/column-matcher.ts`

**Changes**:
1. DATE_COLUMN_PATTERN: Add 결제일시, 주문시간, 승인완료, 조회시간, 처리일시 + English statementdate, paymentdate, invoicedate, timestamp
2. MERCHANT_COLUMN_PATTERN: Add 상점, 판매점, 이용매장명, 구매내용 + English supplier, brand, location
3. AMOUNT_COLUMN_PATTERN: Add 이용대금, 실결제액, 청구액, 사용액, 할인금액, 포인트할인 + English transactionamount, paymentamount, billedamount, netamount, gross
4. CATEGORY_COLUMN_PATTERN: Add 결제구분, 매장유형 + English payment_type
5. MEMO_COLUMN_PATTERN: Add 메모사항, 기타

## Fix 2: Expand Summary Row Patterns (C78-02)
**Priority**: HIGH (false positive prevention)
**Files**: Same as Fix 1

**Changes**:
1. Add 포인트합계 and 승인취소합계 to SUMMARY_ROW_PATTERN

## Fix 3: Sync HEADER_KEYWORDS and Keyword Category Sets (C78-03)
**Priority**: HIGH (header detection)
**Files**: Same as Fix 1

**Changes**:
1. Add all new terms to HEADER_KEYWORDS array
2. Add all new terms to DATE_KEYWORDS, MERCHANT_KEYWORDS, AMOUNT_KEYWORDS Sets

## Fix 4: Add Test Coverage (C78-04)
**Priority**: MEDIUM (robustness)
**Files**:
- `packages/parser/__tests__/column-matcher.test.ts`
- `packages/parser/__tests__/xlsx-parity.test.ts`

**Changes**:
1. Tests for new column pattern terms (date, merchant, amount, category, memo)
2. Tests for new summary row patterns (포인트합계, 승인취소합계)
3. Tests for combined headers with + delimiter
4. Tests for 3-part combined headers
5. Tests for English-only header detection
6. Parity tests for CATEGORY_COLUMN_PATTERN, MEMO_COLUMN_PATTERN, INSTALLMENTS_COLUMN_PATTERN
7. Parity tests for DATE_KEYWORDS, MERCHANT_KEYWORDS, AMOUNT_KEYWORDS Sets

## Deferred Items (STRICT)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode
- D-01 shared module refactor (web CSV duplication)