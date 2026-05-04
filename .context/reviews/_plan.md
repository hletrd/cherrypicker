# Implementation Plan -- Cycle 49

## P1. Fix web CSV parseAmount parenthesized negative + Won sign [MEDIUM]
**File**: `apps/web/src/lib/parser/csv.ts`
**What**: Move 마이너스 prefix detection and parenthesized negative check BEFORE stripping 원/₩. Match server-side order of operations.

## P2. Add bare 5+ digit integer pattern to CSV AMOUNT_PATTERNS [LOW]
**Files**: `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`
**What**: Add `/^\d{5,}원?$/` to AMOUNT_PATTERNS arrays so column-detection heuristics recognize bare 5+ digit amounts like `50000`.

## P3. Add "|" splitting to findColumn [LOW]
**File**: `packages/parser/src/csv/column-matcher.ts`
**What**: Split combined headers on "|" in addition to "/" in both exact-match and regex-match passes.

## P4. Add YYMMDD to PDF DATE_PATTERN [LOW]
**Files**: `packages/parser/src/pdf/table-parser.ts`, `apps/web/src/lib/parser/pdf.ts`
**What**: Add bounded 6-digit pattern `(?<!\d)\d{6}(?!\d)` to DATE_PATTERN for YYMMDD detection in PDF table rows.

## P5. Add YYMMDD to CSV DATE_PATTERNS [LOW]
**Files**: `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`
**What**: Add YYMMDD entry with isYYMMDDLike validator guard to DATE_PATTERNS arrays.

## P6. Add comprehensive edge-case tests [LOW]
**Files**: `packages/parser/__tests__/csv.test.ts`, `packages/parser/__tests__/column-matcher.test.ts`
**What**: Tests for parenthesized Won amounts, full-width Won sign, 마이너스 prefix, pipe delimiters, YYMMDD detection, bare 5+ digit amounts, "|" combined headers.

## Deferred
- D-01: Server/web shared module (architectural refactor)
- D-02: PDF multi-line headers (edge case)
- D-03: Web CSV hand-rolled adapters -> factory pattern
- D-04: normalizeHeader unicode character class readability