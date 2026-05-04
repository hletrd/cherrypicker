# Implementation Plan -- Cycle 58

## Fix C58-01: Add fullwidth minus `－` to PDF amount patterns
**Priority:** MEDIUM
**Files:**
- `packages/parser/src/pdf/index.ts` (AMOUNT_PATTERN)
- `packages/parser/src/pdf/table-parser.ts` (AMOUNT_PATTERN, STRICT_AMOUNT_PATTERN)
- `apps/web/src/lib/parser/pdf.ts` (AMOUNT_PATTERN, STRICT_AMOUNT_PATTERN)

**Change:** Add `－` as an optional negative prefix alongside existing `-` in all PDF amount regex patterns. Specifically:
- `AMOUNT_PATTERN`: add `－` before digit sequences (parallel to existing `₩?-?` pattern)
- `STRICT_AMOUNT_PATTERN`: change `-?` to `[－-]?` in the amount group
- Also add `￦` to the server-side `index.ts` AMOUNT_PATTERN (it only has `₩` currently)

## Fix C58-02: Add YYMMDD to PDF fallback date patterns
**Priority:** MEDIUM
**Files:**
- `packages/parser/src/pdf/index.ts` (fallbackDatePattern)
- `apps/web/src/lib/parser/pdf.ts` (fallbackDatePattern)

**Change:** Add `(?<!\d)\d{6}(?!\d)` to the fallback date regex. In the loop body, add YYMMDD validation via isValidYYMMDD/isYYMMDDLike before using the matched date. If validation fails, continue to next line.

## Fix C58-03: Add `－` capture to PDF fallback amount pattern
**Priority:** LOW
**Files:**
- `packages/parser/src/pdf/index.ts` (fallbackAmountPattern)
- `apps/web/src/lib/parser/pdf.ts` (fallbackAmountPattern)

**Change:** Add `－([\d,]+)원?` capture group to fallbackAmountPattern, parallel to existing `마이너스([\d,]+)원?` group. Update amount extraction to use the new group index.

## Fix C58-04: Add tests for new patterns
**Priority:** MEDIUM
**Files:**
- `packages/parser/__tests__/table-parser.test.ts`
- `packages/parser/__tests__/csv.test.ts`

**Change:** Add tests for:
- PDF amount patterns matching fullwidth-minus amounts
- PDF fallback date pattern matching YYMMDD dates
- Fullwidth-minus amount detection in structured PDF rows

## Deferred
- F4: Fullwidth letter normalization in headers (extremely rare)
- F5: PDF multi-line header support (complex)
- F6: Server/web CSV parser duplication (D-01 architectural)