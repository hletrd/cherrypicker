# Implementation Plan -- Cycle 47

## P1. Add "합산" to SUMMARY_ROW_PATTERN [MEDIUM]
**File**: `packages/parser/src/csv/column-matcher.ts`
**What**: Add `(?<![가-힣])합\s*산(?![가-힣])` to SUMMARY_ROW_PATTERN for bank exports that use 합산 instead of 합계.

## P2. Remove stale .omc state file [LOW]
**File**: `packages/parser/src/csv/.omc/state/last-tool-error.json`
**What**: Delete the OMC state file from the source tree.

## P3. Add amount parsing edge case tests [MEDIUM]
**File**: `packages/parser/__tests__/csv-shared.test.ts`
**What**: Add tests for `-`, `0원`, `-0`, spaces-only, Won-sign with spaces.

## P4. XLSX forward-fill summary row guard [LOW]
**File**: `packages/parser/src/xlsx/index.ts`
**What**: Skip forward-fill of date/merchant values that match SUMMARY_ROW_PATTERN.

## Deferred
- PDF table parser code duplication (D-01)
- CSV/web adapter duplication (D-01)

## P3. Summary Row Pattern [MEDIUM]
**File**: `packages/parser/src/csv/column-matcher.ts`
**What**: Add 이월잔액|전월이월|이월금액 with boundary guards

## P4. Tests
**File**: `packages/parser/__tests__/table-parser.test.ts`
**What**: Tests for new patterns and summary row edge cases

## Deferred
- D-01: Server/web shared module (architectural)
- D-02: PDF multi-line headers (edge case, deferred)
- D-03: Web CSV 10 hand-rolled adapters -> factory pattern