# Cycle 35 Implementation Plan

**Source:** Cycle 35 aggregate review (4 findings)

## Fixes

### P-01: CRITICAL — Web PDF fallback amount group 3 (F-01)
**File:** `apps/web/src/lib/parser/pdf.ts` line 554
Change `amountMatch[1] ?? amountMatch[2]` to `amountMatch[1] ?? amountMatch[2] ?? amountMatch[3]`

### P-02: Server PDF parseAmount 마이너스 prefix (F-02)
**File:** `packages/parser/src/pdf/index.ts` parseAmount (line 56-68)
Add 마이너스 prefix detection matching web-side/CSV patterns.

### P-03: Server PDF fallback regex 마이너스 (F-03)
**File:** `packages/parser/src/pdf/index.ts` line 293
Add 마이너스 alternation to fallbackAmountPattern.

### P-04: Tests (F-04)
Add tests for server PDF 마이너스, parenthesized negatives, and fallback amount parity.

## Deferred
| ID | Item | Reason |
|----|------|--------|
| D-01 | Web CSV factory refactor | Requires shared module architecture |
| D-02 | PDF multi-line header support | Requires header row merging logic |
| D-03 | Server/web CSV parser dedup | Architecture refactor needed |