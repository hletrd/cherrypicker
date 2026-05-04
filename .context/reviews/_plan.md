# Cycle 79 Implementation Plan

## Fix 1: Add missing terms to HEADER_KEYWORDS and create CATEGORY/MEMO keyword Sets (C79-01)
**Priority**: HIGH (header detection / format diversity)
**Files**:
- `packages/parser/src/csv/column-matcher.ts`
- `apps/web/src/lib/parser/column-matcher.ts`

**Changes**:
1. Add missing CATEGORY_COLUMN_PATTERN terms to HEADER_KEYWORDS: 거래유형, 결제유형, 결제구분, 이용구분, 구분, 가맹점유형, 매장유형, 카드종류, 카드구분
2. Add missing MERCHANT_COLUMN_PATTERN term `가게` to HEADER_KEYWORDS and MERCHANT_KEYWORDS
3. Add missing MEMO_COLUMN_PATTERN term `기타` to HEADER_KEYWORDS
4. Create CATEGORY_KEYWORDS Set with all terms from CATEGORY_COLUMN_PATTERN (Korean + English)
5. Create MEMO_KEYWORDS Set with all terms from MEMO_COLUMN_PATTERN (Korean + English)
6. Update isValidHeaderRow() to check DATE_KEYWORDS, MERCHANT_KEYWORDS, AMOUNT_KEYWORDS, CATEGORY_KEYWORDS, MEMO_KEYWORDS (5 categories, require 2+)

## Fix 2: Expand English date abbreviations in DATE_COLUMN_PATTERN (C79-02)
**Priority**: MEDIUM (format diversity)
**Files**: Same as Fix 1

**Changes**:
1. Add English abbreviation patterns to DATE_COLUMN_PATTERN: `txn[\s_-]?d(?:ate|t)`, `trans(?:action)?[\s_-]?d(?:ate|t)`, `purchase[\s_-]?d(?:ate|t)`
2. Add `txn`, `txn_dt`, `txndate`, `trans_dt`, `transdate`, `purchasedt`, `purchase_dt` to DATE_KEYWORDS

## Fix 3: Add tests for new patterns (C79-03)
**Priority**: MEDIUM (robustness)
**Files**:
- `packages/parser/__tests__/column-matcher.test.ts`

**Changes**:
1. Tests for CATEGORY_KEYWORDS and MEMO_KEYWORDS in isValidHeaderRow()
2. Tests for category-only headers (거래유형 + 결제구분)
3. Tests for English date abbreviations (txn_date, trans_dt, purchase_dt)
4. Tests for `가게` merchant and `기타` memo matching

## Deferred Items (STRICT)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode
- D-01 shared module refactor (web CSV duplication)