# Implementation Plan -- Cycle 48

## P1. Sync web-side SUMMARY_ROW_PATTERN with server-side [MEDIUM]
**File**: `apps/web/src/lib/parser/column-matcher.ts`
**What**: Add `(?<![가-힣])합\s*산(?![가-힣])` to web-side SUMMARY_ROW_PATTERN. Server-side already has this term (added in cycle 47), but web-side was missed.

## P2. Add SUMMARY_ROW_PATTERN guard to web-side XLSX forward-fill [MEDIUM]
**File**: `apps/web/src/lib/parser/xlsx.ts`
**What**: Add `SUMMARY_ROW_PATTERN.test()` check before updating `lastDate` and `lastMerchant` in the forward-fill logic, matching server-side behavior in `packages/parser/src/xlsx/index.ts` lines 300-304. Without this guard, summary row values contaminate forward-filled data.

## P3. Add `.tsv` to web-side detectFormatFromFile [LOW]
**File**: `apps/web/src/lib/parser/detect.ts`
**What**: Add explicit `.tsv` extension check. Currently `.tsv` falls through to the default 'csv' return, which works but doesn't match server-side explicit handling.

## P4. Add `합산` test to column-matcher tests [LOW]
**File**: `packages/parser/__tests__/column-matcher.test.ts`
**What**: Add test case verifying "합산" summary row is correctly matched.

## Deferred
- D-01: Server/web shared module (architectural refactor)
- D-02: PDF multi-line headers (edge case)
- D-03: Web CSV hand-rolled adapters -> factory pattern