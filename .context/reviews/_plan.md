# Cycle 24 Implementation Plan

**Source:** `_aggregate.md` (3 findings)

## Fixes

### Fix 1: Keyword Set alignment with column regex patterns [HIGH]
- **File:** `packages/parser/src/csv/column-matcher.ts`
- **Action:** Add missing entries to keyword Sets:
  - `AMOUNT_KEYWORDS`: add `'price'`, `'won'` (matched by AMOUNT_COLUMN_PATTERN `^price$`, `^won$`)
  - `MERCHANT_KEYWORDS`: add `'shop'` (matched by MERCHANT_COLUMN_PATTERN `^shop$`)
- **Verification:** Add tests in `column-matcher.test.ts` verifying English-only header rows pass isValidHeaderRow

### Fix 2: Expand SUMMARY_ROW_PATTERN [MEDIUM]
- **File:** `packages/parser/src/csv/column-matcher.ts`
- **Action:** Add `승인\s*합계`, `결제\s*합계`, `총\s*(?:사용|이용)` to the pattern
- **Verification:** Add tests for new summary variants in `column-matcher.test.ts`

### Fix 3: Keyword Set completeness test [LOW]
- **File:** `packages/parser/__tests__/column-matcher.test.ts`
- **Action:** Add test that exercises English-only headers through isValidHeaderRow to catch future Set/regex drift
- **Verification:** Run full test suite

## Deferred Items (unchanged from cycle 23)
- Server-side ColumnMatcher module path consistency
- Web-side CSV parser vs server-side duplication
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode complete migration