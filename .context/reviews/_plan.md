# Cycle 41 Implementation Plan

## Priority 1: Fix server PDF fallback amount pattern [BUG-FIX]
- **File:** `packages/parser/src/pdf/index.ts:23`
- **Change:** Replace `[₩]\d` with `₩\d` to remove unnecessary character class
- **Impact:** Code consistency with web-side pattern

## Priority 2: Add tests for PDF amount parsing edge cases [TEST]
- **File:** `packages/parser/__tests__/table-parser.test.ts`
- Add tests for: parenthesized amounts with 원 suffix, 마이너스 prefix, Won sign variants

## Deferred
| ID | Item | Reason |
|----|------|--------|
| D-01 | Web/server CSV parser shared module | Architecture refactor |
| D-02 | Headerless CSV fallback | Low ROI edge case |