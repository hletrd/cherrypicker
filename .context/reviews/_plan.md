# Cycle 10 Implementation Plan

## Fix 1: Add `isValidISODate` to server-side date-utils (HIGH)
- **File**: `packages/parser/src/date-utils.ts`
- **Change**: Add and export `isValidISODate` function, matching web-side `apps/web/src/lib/parser/date-utils.ts:146-148`.
- **Prerequisite for**: Fixes 2, 3.

## Fix 2: Server generic CSV parser — add date error reporting (HIGH)
- **File**: `packages/parser/src/csv/generic.ts`
- **Change**: Import `isValidISODate` from date-utils. After `parseDateStringToISO`, check `!isValidISODate(result)` and push error, matching web-side csv.ts behavior.
- **Impact**: CLI users get visible errors for malformed dates instead of silent corruption.

## Fix 3: Server XLSX parser — use `isValidISODate` for date error check (HIGH)
- **File**: `packages/parser/src/xlsx/index.ts`
- **Change**: Import `isValidISODate` from date-utils. Replace `result === raw.trim()` check at line 92 with `!isValidISODate(result)`.
- **Impact**: Catches more invalid date formats than the current string-equality check.

## Fix 4: `isAmountLike` — add parenthesized negative amounts (HIGH)
- **Files**: `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`
- **Change**: Add `/^\([\d,]+\)$/` to AMOUNT_PATTERNS in both files.
- **Impact**: Column inference correctly identifies `(1,234)` format as amount-like.

## Fix 5: Server PDF `tryStructuredParse` — add error logging (MEDIUM)
- **File**: `packages/parser/src/pdf/index.ts`
- **Change**: Add `console.warn` in the catch block, matching web-side pdf.ts:295.
- **Impact**: Structured parse failures become visible in server logs.

## Fix 6: Add tests for CSV shared utilities (MEDIUM)
- **File**: `packages/parser/__tests__/csv-shared.test.ts` (new)
- **Tests**: `splitCSVLine` (RFC 4180, doubled quotes, non-comma delimiters), `parseCSVAmount` (normal, Won sign, parenthesized negatives, NaN), `isValidCSVAmount`, `parseCSVInstallments`.
- **Impact**: Critical parsing primitives get regression protection.

## Fix 7: Add tests for generic CSV `isAmountLike` with parenthesized negatives (MEDIUM)
- **File**: `packages/parser/__tests__/csv.test.ts`
- **Change**: Add test for CSV with `(amount)` format columns.
- **Impact**: Verifies Fix 4.

## Deferred (explicitly not this cycle)
- Server/web parser dedup (build system limitation, requires shared module)
- Web CSV bank adapter factory refactor (600+ line refactor)
- DATE_PATTERNS dedup across generic CSV files
- Transaction-level deduplication
- All items from cycles 1-9 deferred list