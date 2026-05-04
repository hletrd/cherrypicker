# Cycle 38 Implementation Plan

## Priority 1: Fix server-side CATEGORY_COLUMN_PATTERN missing "카테고리"
- File: `packages/parser/src/csv/column-matcher.ts`
- Add `카테고리` to CATEGORY_COLUMN_PATTERN regex

## Priority 2: Sync web-side column patterns with server-side
- File: `apps/web/src/lib/parser/column-matcher.ts`
- Sync all 5 column patterns (DATE, MERCHANT, AMOUNT, INSTALLMENTS, CATEGORY)
- Sync HEADER_KEYWORDS array
- Sync DATE_KEYWORDS, MERCHANT_KEYWORDS, AMOUNT_KEYWORDS Sets

## Priority 3: Add tests for newly synced keywords
- File: `packages/parser/__tests__/column-matcher.test.ts`
- Test `카테고리`, `접수일`, `발행일`, `청구금액`, `할부횟수`, etc.

## Deferred
| ID | Item | Reason |
|----|------|--------|
| D-01 | Web CSV adapter factory refactor | Architecture (shared module) |
| D-02 | PDF multi-line header support | Complex, low ROI |
| D-03 | Server/web CSV parser dedup | Architecture refactor |