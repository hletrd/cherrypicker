# Implementation Plan -- Cycle 54

## Fix C54-01: Add fullwidth-minus to CSV generic AMOUNT_PATTERNS
**Priority:** MEDIUM
**Files:**
- `packages/parser/src/csv/generic.ts` (AMOUNT_PATTERNS)
- `apps/web/src/lib/parser/csv.ts` (AMOUNT_PATTERNS)
- `packages/parser/__tests__/csv.test.ts` or `csv-shared.test.ts` (tests)

**Change:** Add fullwidth-minus (U+FF0D `－`) variant to the negative amount patterns in AMOUNT_PATTERNS arrays. Currently only ASCII minus `-` is handled. Add pattern `－[\d,]+원?` alongside existing `-[\d,]+원?`.

## Fix C54-02: Increase CSV data-inference sample rows from 4 to 8
**Priority:** LOW
**Files:**
- `packages/parser/src/csv/generic.ts` (sampleRows)
- `apps/web/src/lib/parser/csv.ts` (sampleRows)

**Change:** Change `headerIdx + 5` to `headerIdx + 9` in both files to scan 8 rows instead of 4 for column inference.

## Deferred
- C54-03: XLSX data-inference fallback (complex, separate effort)
- C53-04: Web-side CSV adapter dedup (requires D-01 shared module)