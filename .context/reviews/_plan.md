# Cycle 23 Implementation Plan

**Source:** `_aggregate.md` (3 findings)

## Fixes

### Fix 1: Web-side CSV bank adapters missing summary row skip [HIGH]
- **File:** `apps/web/src/lib/parser/csv.ts`
- **Action:** Add `if (SUMMARY_ROW_PATTERN.test(line)) continue;` after the empty-line check in all 10 bank adapters (samsung, shinhan, kb, hyundai, lotte, hana, woori, nh, ibk, bc)
- **Pattern:** `SUMMARY_ROW_PATTERN` is already imported at top of file from `./column-matcher.js`
- **Verification:** Add test with summary rows in bank-specific CSV content

### Fix 2: Server-side PDF table-parser DATE_PATTERN full-width dot parity [MEDIUM]
- **File:** `packages/parser/src/pdf/table-parser.ts`
- **Action:** Update DATE_PATTERN short-date lookbehind from `(?<![.\d])` to `(?<![.\d．。])` and lookahead from `(?![.\-\/\d])` to `(?![.\-\/\d．。])`
- **Verification:** Add bun test for full-width dot short dates in table-parser.test.ts

### Fix 3: Integration tests for full-width dot dates [LOW]
- **File:** `packages/parser/__tests__/csv.test.ts`, `packages/parser/__tests__/table-parser.test.ts`
- **Action:** Add test cases for full-width dot dates through CSV and PDF table-parser
- **Verification:** Run full test suite

## Deferred Items (unchanged)
- Server-side ColumnMatcher module path consistency
- Web-side CSV parser vs server-side duplication (root cause of F1)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode complete migration