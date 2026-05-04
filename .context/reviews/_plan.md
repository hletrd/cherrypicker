# Cycle 61 Implementation Plan

## Changes Implemented

### F1: Tighten bare-integer amount threshold (C61-01)
- `packages/parser/src/csv/generic.ts`: Changed `/^\d{5,}원?$/` to `/^\d{8,}원?$/`
- `apps/web/src/lib/parser/csv.ts`: Same change for parity
- Prevents 5-7 digit transaction IDs from being misidentified as amounts during data inference

### F2: Eliminate 10 redundant web-side bank adapters (C61-02)
- `apps/web/src/lib/parser/csv.ts`: Replaced 10 hand-written bank adapter objects
  (samsung, shinhan, kb, hyundai, lotte, hana, woori, nh, ibk, bc) with
  createBankAdapter() factory calls, eliminating ~700 lines of duplicated code
- All 24 banks now use the same factory pattern

### F3: Add tests for bare-integer threshold
- `packages/parser/__tests__/csv.test.ts`: Added 3 tests verifying:
  1. 5-7 digit bare integers don't match as amounts
  2. 8+ digit bare integers still match as amounts
  3. Comma-formatted amounts still work regardless of digit count

## Deferred
### D1: PDF multi-line header support
Low frequency, high complexity. Future cycle.
