# Cycle 94 Implementation Plan

## Goal
Fix XLSX date validation bug, improve generic CSV merchant inference, and add
missing header keyword for format diversity.

## Plan

### P1: XLSX isValidISODate post-parse check (F-94-01, BUG)
**Files**: `packages/parser/src/xlsx/index.ts`, `apps/web/src/lib/parser/xlsx.ts`
- After `parseDateToISO(dateRaw, errors, i)`, add `isValidISODate` check
- If invalid and dateRaw is non-empty, push error with raw row text
- Import `isValidISODate` from `../date-utils.js` (already imported in web xlsx.ts)

### P2: Generic CSV merchant inference improvement (F-94-02, ENHANCEMENT)
**Files**: `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`
- Change merchant inference from "first Korean-text column" to "column with most
  Korean characters" by collecting all candidates and ranking by count.

### P3: Add "매입일자" header keyword (F-94-03, FORMAT DIVERSITY)
**Files**: `packages/parser/src/csv/column-matcher.ts`, `apps/web/src/lib/parser/column-matcher.ts`
- Add "매입일자" to DATE_COLUMN_PATTERN regex
- Add "매입일자" to HEADER_KEYWORDS array
- Add "매입일자" to DATE_KEYWORDS Set

### P4: Tests
- Add test for XLSX invalid date validation
- Add test for merchant inference with memo-before-merchant column order
- Add test for "매입일자" header detection

### P5: Quality gates
- `bun test packages/parser/__tests__/`
- `npx vitest run`
- typecheck
- lint

## Deferred
- D-01: PDF multi-line header support
- D-02: Web-side code duplication / shared module refactor
- D-03: Six copies of isValidShortDate/parseAmount
- D-04: Historical amount display, card name suffixes, global config