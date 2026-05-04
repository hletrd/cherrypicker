# Cycle 25 Implementation Plan

**Source:** `_aggregate.md` (2 findings)

## Fixes

### Fix 1: Sync web-side column-matcher.ts with server-side [HIGH]
- **File:** `apps/web/src/lib/parser/column-matcher.ts`
- **Action:** Update to match server-side `packages/parser/src/csv/column-matcher.ts`:
  - `SUMMARY_ROW_PATTERN`: add `승인\s*합계|결제\s*합계|총\s*(?:사용|이용)`
  - `HEADER_KEYWORDS`: add `'shop'`, `'price'`, `'won'`
  - `AMOUNT_KEYWORDS`: add `'price'`, `'won'`
  - `MERCHANT_KEYWORDS`: add `'shop'`
- **Verification:** Add vitest tests in `apps/web/` verifying the synced patterns

### Fix 2: Add isValidHeaderRow rejection test for summary variants [MEDIUM]
- **File:** `packages/parser/__tests__/column-matcher.test.ts`
- **Action:** Add test that `isValidHeaderRow(['승인합계', '100,000'])` returns false (only amount keyword, 1 category)
- **Verification:** Run bun tests

## Deferred Items (updated)
- Server-side ColumnMatcher module path consistency
- Web-side CSV parser vs server-side duplication (acknowledged debt -- kept separate for build system reasons)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode complete migration