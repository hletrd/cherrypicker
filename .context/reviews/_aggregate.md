# Cycle 79 Aggregate Review

## Review Summary

After 78 cycles, the parser is highly mature. Server/web column-matcher strings have zero diff (confirmed). This cycle identifies 3 actionable findings in the keyword coverage gap between COLUMN_PATTERNS and HEADER_KEYWORDS/keyword Sets, plus English date abbreviation coverage.

## Findings

### F79-01: CATEGORY_COLUMN_PATTERN terms missing from HEADER_KEYWORDS and keyword Sets [HIGH]
**Files**: `packages/parser/src/csv/column-matcher.ts`, `apps/web/src/lib/parser/column-matcher.ts`
**Issue**: 9 terms in CATEGORY_COLUMN_PATTERN are NOT in HEADER_KEYWORDS or any keyword category Set:
- `거래유형`, `결제유형`, `결제구분`, `이용구분`, `구분`, `가맹점유형`, `매장유형`, `카드종류`, `카드구분`
Also: `가게` (MERCHANT_COLUMN_PATTERN) missing from MERCHANT_KEYWORDS/HEADER_KEYWORDS.
Also: `기타` (MEMO_COLUMN_PATTERN) missing from HEADER_KEYWORDS.
**Impact**: `isValidHeaderRow()` cannot count these terms toward category matching. Headers containing only these category/memo terms fail the 2-category minimum check, even though findColumn() correctly identifies the column via regex. CSV/XLSX files with category-heavy headers get "헤더 행을 찾을 수 없습니다" error.
**Fix**: Add all missing terms to HEADER_KEYWORDS. Create CATEGORY_KEYWORDS and MEMO_KEYWORDS Sets. Include them in the isValidHeaderRow() 2-category check.

### F79-02: English date pattern abbreviation gap [MEDIUM]
**Files**: Same as F79-01
**Issue**: DATE_COLUMN_PATTERN uses anchored `^trans(?:action)?[\s_-]?date$`. After normalizeHeader() strips spaces/underscores/hyphens: "txn_date" -> "txndate", "trans_dt" -> "transdt", "purchase_dt" -> "purchasedt". None match existing patterns.
**Fix**: Add `txn`, `trans`, `purch`, `inv` abbreviation variants to DATE_COLUMN_PATTERN and DATE_KEYWORDS.

### F79-03: Test coverage gaps [MEDIUM]
No tests for:
- Category-only headers (거래유형 + 결제구분 but no date/merchant/amount)
- Memo keyword `기타` matching
- English date abbreviations (txn_date, trans_dt)
- CATEGORY_KEYWORDS / MEMO_KEYWORDS Sets in isValidHeaderRow()

## Server/Web Parity
CONFIRMED: Zero diff on all column-matcher string constants. Both sides share identical COLUMN_PATTERNS, SUMMARY_ROW_PATTERN, HEADER_KEYWORDS, and keyword Sets. Fixes must be applied to both files.

## Deferred Items (unchanged)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode
- D-01 shared module refactor