# Implementation Plan -- Cycle 53

## Fix C53-01: Full-width digit/comma normalization in amount parsing
**Priority:** HIGH
**Files:**
- `packages/parser/src/csv/shared.ts` (parseCSVAmount)
- `packages/parser/src/xlsx/index.ts` (parseAmount)
- `packages/parser/src/pdf/index.ts` (parseAmount)
- `apps/web/src/lib/parser/csv.ts` (parseAmount)
- `apps/web/src/lib/parser/xlsx.ts` (parseAmount)
- `apps/web/src/lib/parser/pdf.ts` (parseAmount)
- `packages/parser/__tests__/csv-shared.test.ts` (tests)
- `packages/parser/__tests__/xlsx.test.ts` (tests)
- `packages/parser/__tests__/table-parser.test.ts` (tests)

**Change:** Add full-width digit normalization (U+FF10-U+FF19 -> 0-9) and full-width comma normalization (U+FF0C -> ,) to the cleaning step of all parseAmount implementations. Add test cases for full-width amounts.

## Fix C53-02: PDF inline daysInMonth -> shared utility
**Priority:** MEDIUM
**Files:**
- `packages/parser/src/pdf/table-parser.ts` (import + replace)
- `apps/web/src/lib/parser/pdf.ts` (import + replace)

**Change:** Import daysInMonth from date-utils.ts and replace inline `new Date(fullYear, month, 0).getDate()` with `daysInMonth(fullYear, month)`.

## Fix C53-03: Add missing memo terms to HEADER_KEYWORDS
**Priority:** LOW
**Files:**
- `packages/parser/src/csv/column-matcher.ts` (HEADER_KEYWORDS array)
- `apps/web/src/lib/parser/column-matcher.ts` (HEADER_KEYWORDS array)

**Change:** Add `내용`, `설명`, `참고`, `상세내역`, `memo`, `note`, `remarks` to HEADER_KEYWORDS.

## Deferred
- C53-04: Web-side CSV adapter dedup (requires D-01 shared module)
- C53-05: XLSX data-inference fallback (complex, separate effort)