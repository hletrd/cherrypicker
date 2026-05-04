# Implementation Plan -- Cycle 15

## P1: PDF Header Row Detection (HIGH)
**Files:** `packages/parser/src/pdf/table-parser.ts`, `packages/parser/src/pdf/index.ts`

### Changes to table-parser.ts
1. Export a `detectHeaderRow(tableLines: string[][]): number` function that scans the first ~15 rows for one containing header keywords (using the shared `HEADER_KEYWORDS` vocabulary from `../csv/column-matcher.js`).
2. Export a `getHeaderColumns(headerRow: string[]): { dateCol: number; merchantCol: number; amountCol: number; installmentsCol: number }` function that uses the shared column patterns (`DATE_COLUMN_PATTERN`, `MERCHANT_COLUMN_PATTERN`, `AMOUNT_COLUMN_PATTERN`, `INSTALLMENTS_COLUMN_PATTERN`) to map column indices.
3. Modify `parseTable()` to also return header row metadata (or export the detection separately so `index.ts` can use it).

### Changes to index.ts (server-side)
4. In `tryStructuredParse()`, after getting parsed table rows, detect the header row.
5. If a header row is found, use the detected column positions for date/merchant/amount extraction instead of positional heuristics.
6. If no header found, fall back to existing positional heuristics.
7. Export `tryStructuredParse` errors collection to match web-side behavior.

## P2: Server extractor.ts Deduplication (MEDIUM)
**File:** `packages/parser/src/pdf/extractor.ts`

8. Refactor `extractPages()` to reuse `extractPagesFromBuffer()` instead of duplicating the pdfParse + pagerender logic.

## P3: XLSX Memo Column Forward-Fill (MEDIUM)
**Files:** `packages/parser/src/xlsx/index.ts`

9. Add forward-fill tracking for the memo column, matching the pattern used by date, merchant, category, and installments columns.

## P4: CSV adapter-factory headerKeyword Normalization (LOW)
**File:** `packages/parser/src/csv/adapter-factory.ts`

10. In the header detection loop, apply `normalizeHeader()` before comparing with `headerKeywords` to handle zero-width spaces and parenthetical suffixes.

## P5: Tests
**File:** `packages/parser/__tests__/table-parser.test.ts` (extend), new test file for PDF index

11. Add tests for `detectHeaderRow()` -- header with Korean keywords, header with English keywords, no header found.
12. Add tests for header-aware column extraction in structured parse.
13. Add test for XLSX memo forward-fill (extend `packages/parser/__tests__/xlsx.test.ts`).

## Deferred (explicitly)
- Web-side CSV parser vs server-side duplication (architectural, D-01)
- PDF multi-line header joining (complex, needs real PDF samples)
- Web/server PDF tryStructuredParse return shape parity (low impact)
- Historical amount display format
- Card name suffixes
- Global config integration
- CSS dark mode migration

## Execution Order
1. P2 (extractor.ts dedup) -- smallest, zero risk
2. P3 (XLSX memo forward-fill) -- small, contained
3. P4 (adapter-factory normalization) -- small, contained
4. P1 (PDF header detection) -- largest change
5. P5 (tests) -- validate everything
