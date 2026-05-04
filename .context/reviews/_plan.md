# Cycle 76 Implementation Plan

## Fix 1: Add Missing Date Column Header Terms (C76-01)
**Priority**: Medium (format diversity)
**Files**:
- `packages/parser/src/csv/column-matcher.ts`
- `apps/web/src/lib/parser/column-matcher.ts`

**Changes**:
1. Add "취소일", "정산일", "환불일", "반품일", "교환일" to `DATE_COLUMN_PATTERN`
2. Add same terms to `HEADER_KEYWORDS` array
3. Add same terms to `DATE_KEYWORDS` Set

## Fix 2: Add Missing Summary Row Patterns (C76-01)
**Priority**: Low
**Files**:
- `packages/parser/src/csv/column-matcher.ts`
- `apps/web/src/lib/parser/column-matcher.ts`

**Changes**:
1. Add "할부수수료" and "연체료" summary row patterns with Korean boundary constraints to `SUMMARY_ROW_PATTERN`

## Fix 3: Add Tests for New Patterns (C76-01)
**Priority**: Medium (test coverage)
**Files**:
- `packages/parser/__tests__/column-matcher.test.ts`

**Changes**:
1. Test that "취소일", "정산일", "환불일" match DATE_COLUMN_PATTERN
2. Test that "할부수수료" and "연체료" summary rows match SUMMARY_ROW_PATTERN
3. Test that the new date terms are recognized in isValidHeaderRow

## Deferred Items (STRICT)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode
- D-01 shared module refactor (web CSV duplication)