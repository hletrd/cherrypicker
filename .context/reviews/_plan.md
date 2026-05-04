# Cycle 32 Implementation Plan

**Source:** `2026-05-05-cycle32-comprehensive.md` (5 findings, 1 deferred)

## Fixes

### F-01: PDF AMOUNT_PATTERN missing Won sign prefix (MEDIUM)

**Files:**
- `packages/parser/src/pdf/table-parser.ts` line 12
- `apps/web/src/lib/parser/pdf.ts` line 40

**Changes:**
1. Add `₩\d[\d,]*원?` and `￦\d[\d,]*원?` alternatives to AMOUNT_PATTERN regex in both server and web PDF table parsers
2. This ensures PDF lines with small Won-sign-prefixed amounts (e.g., "₩500") are correctly detected as transaction rows

### F-02: YYMMDD date format support (LOW)

**Files:**
- `packages/parser/src/date-utils.ts`
- `apps/web/src/lib/parser/date-utils.ts`

**Changes:**
1. Add 6-digit YYMMDD pattern after YYYYMMDD (8-digit) check
2. Parse YY (>=50 → 1900s, <50 → 2000s), MM, DD
3. Validate month/day ranges with isValidDayForMonth

### F-04: normalizeHeader directional characters (LOW)

**Files:**
- `packages/parser/src/csv/column-matcher.ts` line 12
- `apps/web/src/lib/parser/column-matcher.ts` line 16

**Changes:**
1. Add U+200E (LRM), U+200F (RLM), U+202A-202E (directional), U+FEFF (BOM) to the strip regex

### F-05: "마이너스" amount prefix support (LOW)

**Files:**
- `packages/parser/src/csv/shared.ts`

**Changes:**
1. Strip "마이너스" prefix from amount string in parseCSVAmount before other cleaning

### F-06: Test coverage (MEDIUM)

**Files:**
- `packages/parser/__tests__/date-utils.test.ts`
- `packages/parser/__tests__/table-parser.test.ts`
- `packages/parser/__tests__/csv-shared.test.ts`
- `packages/parser/__tests__/column-matcher.test.ts`

**Test cases:**
- YYMMDD date format parsing
- Won sign amounts in PDF context
- "마이너스" amount prefix
- normalizeHeader with directional Unicode
- PDF AMOUNT_PATTERN with ₩ prefix for small amounts

## Deferred

| ID | Item | Reason |
|----|------|--------|
| F-03 | Web CSV factory refactor | Requires shared module architecture (D-01) |

## Quality Gates
- `bun test packages/parser/__tests__/`
- `npx vitest run`
- `bun run build`