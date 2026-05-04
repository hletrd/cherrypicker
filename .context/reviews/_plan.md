# Cycle 63 Implementation Plan

## Changes

### F1: Add KRW and 마이너스 to server-side STRICT_AMOUNT_PATTERN
- File: `packages/parser/src/pdf/index.ts` line 23
- Add `|^KRW[\d,]+원?$` and `|^마이너스[\d,]+원?$` alternatives
- Matches web-side `pdf.ts` line 72 pattern exactly
- Restore server/web parity

### F2: Add tests for KRW/마이너스 in PDF structured parsing
- File: `packages/parser/__tests__/table-parser.test.ts`
- Add test: getHeaderColumns handles KRW amount column headers
- Add test: AMOUNT_PATTERN matches KRW and 마이너스 amounts

## Deferred
### D1: PDF multi-line header support
Low frequency, high complexity. Future cycle.
