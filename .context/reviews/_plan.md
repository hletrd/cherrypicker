# Implementation Plan -- Cycle 56

## Fix C56-01: Add "KRW" currency prefix support to all amount parsers
**Priority:** MEDIUM
**Files:**
- `packages/parser/src/csv/shared.ts` (parseCSVAmount)
- `packages/parser/src/xlsx/index.ts` (parseAmount)
- `packages/parser/src/pdf/index.ts` (parseAmount)
- `apps/web/src/lib/parser/csv.ts` (parseAmount)
- `apps/web/src/lib/parser/xlsx.ts` (parseAmount)
- `apps/web/src/lib/parser/pdf.ts` (parseAmount)
- `packages/parser/src/csv/generic.ts` (AMOUNT_PATTERNS)
- `apps/web/src/lib/parser/csv.ts` (AMOUNT_PATTERNS)

**Change:** Add `.replace(/^KRW\s*/i, '')` to the cleaning chain in all 6 parseAmount implementations (before the Won sign/원 strip). Add `/^KRW[\d,]+원?$/` pattern to both AMOUNT_PATTERNS arrays.

## Fix C56-02: Expand XLSX parity tests
**Priority:** LOW
**Files:**
- `packages/parser/__tests__/xlsx-parity.test.ts`

**Change:** Add tests verifying SUMMARY_ROW_PATTERN source, HEADER_KEYWORDS content, and column pattern arrays match between server and web.

## Fix C56-03: Add numeric-only header guard test
**Priority:** LOW
**Files:**
- `packages/parser/__tests__/csv.test.ts`

**Change:** Add test for CSV file with purely numeric headers returning error.

## Fix C56-04: parseCSVAmount early return
**Priority:** VERY LOW
**Files:**
- `packages/parser/src/csv/shared.ts`

**Change:** Add `if (!raw.trim()) return null;` at top of parseCSVAmount.

## Deferred
- C55-F3: Web-side hand-written adapter dedup (architectural)
- C55-F4: PDF multi-line header support (complex)