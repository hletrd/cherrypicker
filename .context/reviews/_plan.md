# Cycle 88 Implementation Plan

## Goal
Fix leap year short date validation bug in 4 parser files and add test coverage.

## Plan

### P1: Fix `isDateLikeShort()` in server CSV parser
**File**: `packages/parser/src/csv/generic.ts`
- Modify `isDateLikeShort()` to validate month/day against both current year AND previous year
- Currently: `day <= daysInMonth(new Date().getFullYear(), month)`
- Fix: `day <= daysInMonth(new Date().getFullYear(), month) || day <= daysInMonth(new Date().getFullYear() - 1, month)`
- This ensures Feb 29 from leap-year statements is accepted regardless of current year

### P2: Fix `isValidShortDate()` in server PDF parser
**File**: `packages/parser/src/pdf/table-parser.ts`
- Same 2-year window fix in `isValidShortDate()`

### P3: Fix `isDateLikeShort()` in web CSV parser
**File**: `apps/web/src/lib/parser/csv.ts`
- Same 2-year window fix for server/web parity

### P4: Fix `isValidShortDate()` in web PDF parser
**File**: `apps/web/src/lib/parser/pdf.ts`
- Same 2-year window fix for server/web parity

### P5: Tests
**File**: `packages/parser/__tests__/date-utils.test.ts`
- Test that `parseDateStringToISO("2.29")` returns valid ISO date (will use inferYear which checks if date is in future)
- Test that `parseDateStringToISO("2/29")` handles Feb 29

**File**: `packages/parser/__tests__/table-parser.test.ts`
- Test that `filterTransactionRows` accepts rows with "2.29" dates

**File**: `packages/parser/__tests__/csv.test.ts`
- Test that generic CSV parsing accepts "2.29" as a valid date column value

### P6: Quality gates
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