# Implementation Plan -- Cycle 59

## Fix C59-01: Add KRW prefix to PDF AMOUNT_PATTERN (Medium)
**Files:**
- `packages/parser/src/pdf/table-parser.ts` (line 14)
- `apps/web/src/lib/parser/pdf.ts` (line 43)

Add `(?<![a-zA-Z\d])KRW[\d,]+원?(?![a-zA-Z\d])` alternation to both AMOUNT_PATTERN regexes. This allows filterTransactionRows() to detect KRW-prefixed amounts as transaction amounts.

## Fix C59-02: Add KRW group to PDF fallback amount pattern (Medium)
**Files:**
- `packages/parser/src/pdf/index.ts` (line 364)
- `apps/web/src/lib/parser/pdf.ts` (line 587)

Add `KRW([\d,]+)원?` as a capture group to fallbackAmountPattern. Place it before the generic comma/5+digit group so it matches first.

## Fix C59-03: Extract isValidYYMMDD to date-utils.ts (Low)
**Files:**
- `packages/parser/src/date-utils.ts` — add exported `isValidYYMMDD()`
- `packages/parser/src/pdf/index.ts` — import from date-utils, remove local `isYYMMDDLike()`
- `packages/parser/src/pdf/table-parser.ts` — import from date-utils, remove local `isValidYYMMDD()`

## Fix C59-04: Add raw row text to web-side amount errors (Low)
**File:** `apps/web/src/lib/parser/csv.ts`

In the generic CSV parser's data loop, after `isValidAmount()` returns false, enrich the last error with `raw` row text, matching server-side pattern.

## Tests
- Add KRW amount test to `packages/parser/__tests__/table-parser.test.ts`
- Add isValidYYMMDD test to `packages/parser/__tests__/date-utils.test.ts`
- Verify existing tests pass after all changes