# Cycle 28 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 28
**Tests:** 534 bun, 242 vitest

## Summary
3 findings from comprehensive code review of all parser source files (14 server-side, 8 web-side).

## Findings

### F1: normalizeHeader missing NBSP (Medium)
**Files:** `packages/parser/src/csv/column-matcher.ts`, `apps/web/src/lib/parser/column-matcher.ts`
No-break space (U+00A0) not stripped from headers. Common in Korean bank exports.
Headers with NBSP fail to match expected column names, causing fallback to data inference.

### F2: CSV isDateLike rejects datetime strings (Medium)
**Files:** `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`
DATE_PATTERNS use `$` anchor, so datetime strings like "2024-01-15 10:30:00" fail isDateLike().
Column inference in generic CSV parser may fail when cells contain datetime values.

### F3: Missing column pattern terms (Low-Medium)
**Files:** Both server and web `column-matcher.ts`
MERCHANT_COLUMN_PATTERN missing "판매처", "구매처", "매장", "취급처"; DATE_COLUMN_PATTERN missing "작성일".
Alternative bank export formats with these terms fail header-based column detection.