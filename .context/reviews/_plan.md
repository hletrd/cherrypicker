# Cycle 82 Implementation Plan

## Priority 1: F82-01 — PDF DATE_PATTERN missing YYYYMMDD in parseTable() [HIGH]

### Problem
The `DATE_PATTERN` regex used by `parseTable()` does NOT include `\d{8}` alternative. Lines with YYYYMMDD dates (e.g., "20240115 Starbucks 3500원") are only recognized if the amount pattern alone matches. Small amounts without comma formatting are missed entirely.

### Implementation

#### 1. Server-side `packages/parser/src/pdf/table-parser.ts`
- Add `(?<!\d)\d{8}(?!\d)` alternative to `DATE_PATTERN` regex (at module scope, line 5)

#### 2. Web-side `apps/web/src/lib/parser/pdf.ts`
- Add same `(?<!\d)\d{8}(?!\d)` alternative to `DATE_PATTERN` regex

#### 3. Tests `packages/parser/__tests__/table-parser.test.ts`
- Add test: `parseTable()` recognizes YYYYMMDD line as table content
- Add test: `filterTransactionRows()` accepts YYYYMMDD rows with small amounts

### Files to modify
1. `packages/parser/src/pdf/table-parser.ts`
2. `apps/web/src/lib/parser/pdf.ts`
3. `packages/parser/__tests__/table-parser.test.ts`

## Priority 2: F82-02 — Add SUMMARY_ROW_PATTERN export [LOW]

### Problem
Server-side parser package exports column patterns but not `SUMMARY_ROW_PATTERN`.

### Implementation

#### 1. `packages/parser/src/index.ts`
- Add `SUMMARY_ROW_PATTERN` to the export list from column-matcher

### Files to modify
1. `packages/parser/src/index.ts`

## Deferred Items (unchanged)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode
- D-01 shared module refactor