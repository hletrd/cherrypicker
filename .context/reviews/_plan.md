# Cycle 34 Implementation Plan

**Source:** Cycle 34 aggregate review (5 findings)

## Fixes

### P-01: Server PDF AMOUNT_PATTERN Won-sign (F-01)
Add `╋` alternation to `packages/parser/src/pdf/index.ts` AMOUNT_PATTERN.

### P-02: Server+Web PDF fallback Won-sign (F-02)
Add Won-sign alternations to fallbackAmountPattern in both:
- `packages/parser/src/pdf/index.ts`
- `apps/web/src/lib/parser/pdf.ts`

### P-03: Server XLSX 마이너스 prefix (F-03)
Add "마이너스" prefix handling to `packages/parser/src/xlsx/index.ts` parseAmount.

### P-04: Web PDF 마이너스 prefix (F-04)
Add "마이너스" prefix handling to `apps/web/src/lib/parser/pdf.ts` parseAmount.

### P-05: Tests (F-05)
Add test cases for all new functionality in bun and vitest test files.

## Deferred
| ID | Item | Reason |
|----|------|--------|
| D-01 | Web CSV factory refactor | Requires shared module architecture |