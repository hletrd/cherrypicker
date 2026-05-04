# Cycle 31 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 31
**Tests:** 554 bun, 243 vitest

## Summary
3 actionable findings: AMOUNT_COLUMN_PATTERN missing common bank amount keywords, CATEGORY_COLUMN_PATTERN too narrow, and no tests for expanded patterns. 2 deferred architecture items.

## Findings

### F1: AMOUNT_COLUMN_PATTERN missing common bank amount keywords (HIGH)

**Impact:** CSVs with headers like "취소금액", "환불금액", "결제액" are not recognized as amount columns. Server-side and web-side both affected.

**Files:**
- `packages/parser/src/csv/column-matcher.ts` line 46
- `apps/web/src/lib/parser/column-matcher.ts` line 42

**Keywords to add:** 취소금액, 환불금액, 입금액, 결제액

### F2: CATEGORY_COLUMN_PATTERN missing bank-variant category keywords (MEDIUM)

**Impact:** CSVs with headers like "거래유형", "결제유형", "이용구분", "구분" miss category column detection.

**Files:**
- `packages/parser/src/csv/column-matcher.ts` line 48
- `apps/web/src/lib/parser/column-matcher.ts` line 44

**Keywords to add:** 거래유형, 결제유형, 이용구분, 구분, 가맹점유형

### F3: No tests for expanded column pattern keywords (MEDIUM)

**Files:**
- `packages/parser/__tests__/column-matcher.test.ts`

## Deferred Items

| ID | Item | Reason |
|----|------|--------|
| D-01 | Server/web CSV parser duplication | Requires shared module architecture refactor |
| D-02 | Full-width digit date parsing | Extremely rare in Korean bank exports |

## Regressions
None. All 797 tests passing.