# Cycle 65 Implementation Plan

## Changes

### P1: Lower CSV generic bare-integer amount threshold from 8 to 5 digits (F1)
- File: `packages/parser/src/csv/generic.ts` line 73
  - Change: `^\d{8,}원?$` -> `^\d{5,}원?$`
- File: `apps/web/src/lib/parser/csv.ts` line 188
  - Change: `^\d{8,}원?$` -> `^\d{5,}원?$`
- Restores parity with PDF parser's 5+ digit bare integer matching
- Enables column detection for CSV files with unformatted 5-7 digit amounts

### P2: Add console.warn to server adapter-factory detect failure (F2)
- File: `packages/parser/src/csv/adapter-factory.ts`
- In the signature-detect loop catch block, add `console.warn` matching web-side pattern

### P3: Add error message when data-inference column detection fails (F3)
- File: `packages/parser/src/csv/generic.ts`
- After the data-inference block, check if required columns (date, amount) still -1
- Return error message indicating column detection failure

### P4: Add tests for bare-integer column detection at 5+ digits
- File: `packages/parser/__tests__/csv.test.ts` or `packages/parser/__tests__/csv-shared.test.ts`
- Test that isAmountLike matches 5-digit bare integers
- Test that generic CSV parser handles files with unformatted amounts

## Deferred
### D1: PDF multi-line header support
Low frequency, high complexity. Future cycle.