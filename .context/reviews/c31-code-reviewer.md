# Cycle 31 Code Review

**Reviewer:** code-reviewer
**Date:** 2026-05-05
**Focus:** Format diversity, remaining edge cases, server/web parity

## Findings

### F1: AMOUNT_COLUMN_PATTERN missing common Korean bank amount keywords (HIGH)

**Impact:** CSVs with headers like "승인금액", "취소금액", "환불금액", "입금액", "카드번호" are not detected as amount columns, causing transactions to be silently skipped.

**Evidence:**
- Server-side `packages/parser/src/csv/column-matcher.ts` line 46:
  ```
  /이용금액|거래금액|금액|결제금액|승인금액|매출금액|이용액|^amount$|^total$|^price$|^won$/i
  ```
- Missing: `취소금액` (cancel amount), `환불금액` (refund amount), `입금액` (deposit amount), `결제액` (payment amount)
- Missing card-number synonym: `카드번호` is a synonym for card number in some bank exports

**Files:**
- `packages/parser/src/csv/column-matcher.ts` line 46
- `apps/web/src/lib/parser/column-matcher.ts` line 42

### F2: CATEGORY_COLUMN_PATTERN too narrow — missing merchant-name and transaction-type category keywords (HIGH)

**Impact:** When a CSV has an "업종명" column but the pattern only matches "업종", the column is not detected as category, causing all category data to be lost. Similarly, some banks use "가맹점명" or "상호" as category columns (indicating the business type rather than the specific merchant).

**Evidence:**
- Pattern: `/업종|카테고리|분류|업종분류|업종명|^category$|^type$/i`
- Missing: `가맹점유형`, `거래유형`, `결제유형`, `이용구분`, `구분`
- Pattern matches `업종명` but fails to match `업종 명` (with space) because the regex is substring-based and whitespace normalization in `normalizeHeader` would strip the space. Wait -- actually normalizeHeader DOES strip whitespace, so "업종 명" → "업종명" and would match. This is NOT an issue.

**Actually, let me re-examine.** The real issue is the keywords list for `CATEGORY_KEYWORDS` (used in isValidHeaderRow) does NOT include category-related keywords at all:

```typescript
export const DATE_KEYWORDS = new Set([...]);
export const MERCHANT_KEYWORDS = new Set([...]);
export const AMOUNT_KEYWORDS = new Set([...]);
// NO CATEGORY_KEYWORDS Set
```

This means a CSV with headers `[날짜, 가맹점, 업종, 금액]` passes `isValidHeaderRow` (from DATE+MERCHANT+AMOUNT keywords) even without category keywords. But the CATEGORY_COLUMN_PATTERN regex DOES match "업종". So this is fine for column detection but means the header validator doesn't recognize category-only headers.

**Revised assessment:** The CATEGORY_COLUMN_PATTERN is adequate for its current use. No action needed.

### F3: isValidHeaderRow requires 2+ categories but a header with only [date, category] fails (LOW)

**Impact:** If a CSV has headers like `[이용일, 업종, 내역]` without a recognized amount keyword, header detection fails. This is extremely unlikely in real credit card exports which always have an amount column.

**Severity:** LOW — theoretical only.

### F4: Web-side csv.ts still has 10 hardcoded bank adapters (MEDIUM - Architecture)

**Impact:** ~700 lines of duplicated adapter code in `apps/web/src/lib/parser/csv.ts`. Each adapter duplicates the header scanning, column matching, and row iteration logic.

**Status:** Deferred (D-01). Requires shared module architecture.

### F5: CSV `isDateLikeShort` uses `new Date().getFullYear()` which is timezone-dependent (LOW)

**Impact:** Near midnight on Dec 31 in UTC-X timezones, the year inference could be wrong. Extremely narrow edge case.

**Status:** Deferred (D-03). Documented in web-side date-utils.ts.

### F6: No test for XLSX serial date number parsing with formula error cells (MEDIUM)

**Impact:** The EXCEL_ERROR_PATTERN detection path has no dedicated test coverage in the bun test suite.

### F7: PDF fallback line scanner doesn't validate merchant extraction quality (LOW)

**Impact:** In the fallback line scanner (both server and web), merchant text is extracted as "everything between date and amount". This can include extraneous whitespace, page numbers, or header fragments. The `.replace(/\s+/g, ' ').trim()` handles whitespace but not other noise.

**Status:** Acceptable — structured parser is the primary path.

## Summary

3 actionable findings (F1 HIGH, F6 MEDIUM), 2 deferred, 2 acceptable-asis.