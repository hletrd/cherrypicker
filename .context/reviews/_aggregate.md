# Cycle 26 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 26
**Tests:** 526 bun, 242 vitest

## Actionable Findings (2)

| ID | Severity | Category | Finding | File |
|---|----------|----------|---------|------|
| F1 | MEDIUM | PDF Format | PDF merchant extraction skipped when dateIdx >= amountIdx (reversed column order in PDF table headers) | `packages/parser/src/pdf/index.ts`, `apps/web/src/lib/parser/pdf.ts` |
| F2 | LOW | Test Coverage | No tests for isValidHeaderRow rejecting summary rows with date-format strings, or getHeaderColumns handling reversed column order | `packages/parser/__tests__/column-matcher.test.ts`, `packages/parser/__tests__/table-parser.test.ts` |

## Fixes Applied

- F1: Changed `dateIdx < amountIdx` guard to `dateIdx !== amountIdx` with `Math.min/Math.max` for scanning range, supporting both normal and reversed column orders (C26-01)
- F2: Added 4 tests for isValidHeaderRow rejecting summary rows with date context, and 2 tests for getHeaderColumns with reversed column order

## Previous Cycle Status

- Cycle 25 F1 (web column-matcher parity): **CONFIRMED FIXED**
- Cycle 25 F2 (summary variant rejection tests): **CONFIRMED FIXED**
- False positive: web CSV memo extraction already exists for all 5 banks (verified via grep)

## Deferred Items

- Web CSV factory pattern refactor (D1)
- Server ColumnMatcher path consistency (D2)
- PDF multi-line transaction support
- Historical amount display format
- Card name suffixes
- Global config integration