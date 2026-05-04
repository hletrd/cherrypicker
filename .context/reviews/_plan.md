# Cycle 71 Plan

## Fix 1: Add leading-plus pattern to CSV AMOUNT_PATTERNS (C71-01)
**Files:**
- `packages/parser/src/csv/generic.ts` - add `^\+[\d,]+원?$` to AMOUNT_PATTERNS
- `apps/web/src/lib/parser/csv.ts` - same

## Fix 2: Add leading-plus pattern to PDF amount patterns (C71-01)
**Files:**
- `packages/parser/src/pdf/table-parser.ts` - add `(?<![a-zA-Z\d])\+[\d,]+원?` to AMOUNT_PATTERN
- `packages/parser/src/pdf/index.ts` - add leading-plus to STRICT_AMOUNT_PATTERN
- `apps/web/src/lib/parser/pdf.ts` - same for both AMOUNT_PATTERN and STRICT_AMOUNT_PATTERN

## Fix 3: Add test for leading-plus column detection (C71-02)
**Files:**
- `packages/parser/__tests__/csv.test.ts` - add test for generic CSV with leading-plus amounts

## Deferred (explicitly not this cycle)
- PDF multi-line headers: architecturally complex, marginal benefit
- Historical amount display format: not a parser concern
- Card name suffixes: not a parser concern
- Global config integration: not blocking
- CSS dark mode: not a parser concern
- Generic parser fallback behavior: already well-handled