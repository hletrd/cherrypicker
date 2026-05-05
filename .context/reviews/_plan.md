# Cycle 90 Implementation Plan

## Goal
Fix the server PDF fallback scanner's `isValidShortDate()` to use a 4-year window (parity with all other 5 implementations) and add test coverage.

## Plan

### P1: Fix isValidShortDate() in server PDF index
**File**: `packages/parser/src/pdf/index.ts`
- Line 47: Replace `return day >= 1 && day <= daysInMonth(new Date().getFullYear(), month);`
  with the 4-year window check matching table-parser.ts, web/pdf.ts, generic.ts, web/csv.ts
- Add comment referencing C88-01 and parity with other implementations

### P2: Add test for server PDF fallback scanner Feb 29 handling
**File**: `packages/parser/__tests__/table-parser.test.ts`
- Add test that verifies the server PDF parser's `isValidShortDate` accepts Feb 29

### P3: Quality gates
- Run `bun test packages/parser/__tests__/`
- Run `npx vitest run`
- Run typecheck
- Run lint

## Deferred (unchanged)
- D-01: Shared module refactor
- PDF multi-line headers
- Historical amount display
- Card name suffixes
- Global config
- Generic parser fallback
- CSS dark mode