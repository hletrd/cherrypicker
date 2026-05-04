# Cycle 38 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 38
**Tests:** 683 bun (before changes)
**Reviewer:** Cycle 38 inline deep scan (server/web parity focus)

---

## Finding 1: Server-side CATEGORY_COLUMN_PATTERN missing "카테고리" [BUG-FIX]
- **Severity**: Medium
- **File**: `packages/parser/src/csv/column-matcher.ts:60`
- **Detail**: Web-side column-matcher.ts (line 54) includes `카테고리` in CATEGORY_COLUMN_PATTERN, but server-side does not. Files with "카테고리" headers fail category detection on server-side CSV/XLSX parsers.
- **Impact**: Format diversity bug -- "카테고리" is a common Korean column header.

## Finding 2: Web-side column patterns missing ~15 keywords from server-side [BUG-FIX]
- **Severity**: Medium
- **File**: `apps/web/src/lib/parser/column-matcher.ts`
- **Detail**: Keyword-level diff:
  - DATE: web missing `승인일시`, `접수일`, `발행일`, `posted`, `billing`
  - MERCHANT: web missing `승인가맹점`, `이용내용`, `거래내용`, `name`
  - AMOUNT: web missing `청구금액`, `출금액`, `결제대금`, `승인취소금액`, `charge`, `payment`
  - INSTALLMENTS: web missing `할부횟수`
- **Impact**: Web-side fails to detect these header variants in CSV/XLSX/PDF files.

## Finding 3: Web-side HEADER_KEYWORDS and category Sets missing ~14 entries [BUG-FIX]
- **Severity**: Medium
- **File**: `apps/web/src/lib/parser/column-matcher.ts`
- **Detail**:
  - HEADER_KEYWORDS: missing `접수일`, `발행일`, `승인일시`, `이용내용`, `거래내용`, `청구금액`, `출금액`, `결제대금`, `승인취소금액`, `name`, `charge`, `payment`, `posted`, `billing`
  - DATE_KEYWORDS: missing `접수일`, `발행일`, `승인일시`, `posted`, `billing`
  - MERCHANT_KEYWORDS: missing `승인가맹점`, `이용내용`, `거래내용`, `name`
  - AMOUNT_KEYWORDS: missing `청구금액`, `출금액`, `결제대금`, `승인취소금액`, `charge`, `payment`
- **Impact**: Header row validation on web-side rejects valid header rows using these keywords.

## Finding 4: Missing tests for newly synced keywords [TEST]
- No tests verify that server-side patterns match keywords like `접수일`, `발행일`, `청구금액`, `할부횟수`.
- **Fix**: Add test cases in column-matcher.test.ts.

---

## Deferred Items
| ID | Item | Reason |
|----|------|--------|
| D-01 | Web CSV adapter factory refactor (14 missing banks) | Architecture refactor |
| D-02 | PDF multi-line header support | Complex, low ROI |
| D-03 | Server/web CSV parser dedup | Architecture refactor |