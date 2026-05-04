# Cycle 68 Plan

## Priority 1: Trailing minus sign for negative amounts (C68-01)

**What**: Korean bank exports sometimes use "1,234-" (trailing minus) instead of
"-1,234" (leading minus) for negative amounts. Support this across all parsers.

**Files to modify** (8 parsers + 2 PDF fallback scanners):

1. `packages/parser/src/csv/shared.ts` — `parseCSVAmount()`: add trailing minus detection
2. `packages/parser/src/csv/generic.ts` — `AMOUNT_PATTERNS`: add trailing minus pattern
3. `packages/parser/src/pdf/index.ts` — `parseAmount()`, `AMOUNT_PATTERN`, `STRICT_AMOUNT_PATTERN`, `fallbackAmountPattern`
4. `packages/parser/src/pdf/table-parser.ts` — `AMOUNT_PATTERN`
5. `packages/parser/src/xlsx/index.ts` — `parseAmount()`
6. `apps/web/src/lib/parser/csv.ts` — `parseAmount()`, `AMOUNT_PATTERNS`
7. `apps/web/src/lib/parser/pdf.ts` — `parseAmount()`, `AMOUNT_PATTERN`, `STRICT_AMOUNT_PATTERN`, `fallbackAmountPattern`
8. `apps/web/src/lib/parser/xlsx.ts` — `parseAmount()`

**Approach**:
- In parseAmount functions: detect trailing minus (`/\d-$/`) and strip it before checking isNeg
- In AMOUNT_PATTERNS: add trailing minus pattern
- In AMOUNT_PATTERN regexes: add trailing minus alternative
- In fallbackAmountPattern: add trailing minus capture group

## Priority 2: Tests

Add tests for trailing minus format in:
- `packages/parser/__tests__/csv-shared.test.ts` — parseCSVAmount trailing minus
- `packages/parser/__tests__/csv.test.ts` — CSV parser trailing minus
- `packages/parser/__tests__/table-parser.test.ts` — PDF amount pattern trailing minus

## Deferred items (explicitly not in this cycle)
- PDF multi-line headers (C68-04)
- Server/web column-matcher dedup (C68-03, requires D-01)
- CSS dark mode migration
- Global config integration