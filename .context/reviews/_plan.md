# Cycle 77 Implementation Plan

## Fix 1: Add Missing Date Terms to DATE_KEYWORDS (C77-01)
**Priority**: Medium (format diversity)
**Files**:
- `packages/parser/src/csv/column-matcher.ts`
- `apps/web/src/lib/parser/column-matcher.ts`

**Changes**:
1. Add "취소일", "정산일", "환불일", "반품일", "교환일" to `DATE_KEYWORDS` Set in both files (server line 100, web line 84)

## Fix 2: Add Tests for DATE_KEYWORDS Sync (C77-02)
**Priority**: Medium (test coverage)
**Files**:
- `packages/parser/__tests__/column-matcher.test.ts` (if exists)
- Otherwise add to existing test file

**Changes**:
1. Test that isValidHeaderRow accepts rows with "환불일" + "금액" (2-category requirement met)
2. Test that DATE_KEYWORDS contains all terms from DATE_COLUMN_PATTERN

## Deferred Items (STRICT)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode
- D-01 shared module refactor (web CSV duplication)