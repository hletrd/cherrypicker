# Cycle 39 Implementation Plan

## Priority 1: Fix server-side PDF parseAmount whitespace stripping [BUG-FIX]
- File: `packages/parser/src/pdf/index.ts`
- Add `.replace(/\s/g, '')` to parseAmount cleaning chain at line 57
- Parity with all other 5 parseAmount implementations

## Priority 2: Fix server-side PDF error reporting for unparseable amounts [BUG-FIX]
- File: `packages/parser/src/pdf/index.ts`
- In `tryStructuredParse`: add ParseError when amount is null (match XLSX pattern)
- In fallback scanner: add ParseError when amount is null (match web PDF pattern)

## Priority 3: Add tests for 7 untested bank adapters [TEST]
- File: `packages/parser/__tests__/csv-adapters.test.ts`
- Add smoke tests for: suhyup, jb, kwangju, jeju, mg, cu, kdb

## Deferred
| ID | Item | Reason |
|----|------|--------|
| D-01 | Web CSV adapter factory refactor | Architecture (shared module) |
| D-02 | PDF multi-line header support | Complex, low ROI |
| D-03 | Server/web CSV parser dedup | Architecture refactor |