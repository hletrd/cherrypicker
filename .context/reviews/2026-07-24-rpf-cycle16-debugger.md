# Cycle 16 Debugger Review

## Scope and inventory

I traced the spreadsheet and HTML-table flows from their ordinary entry points
through SheetJS conversion, shared merge lookup, returned parser diagnostics,
and browser workers. The reviewed surface was:

- shared worksheet logic:
  `packages/parser/src/shared/sheet-cells.ts`,
  `packages/parser/src/browser.ts`
- package routes:
  `packages/parser/src/statement.ts`,
  `packages/parser/src/xlsx/index.ts`,
  `packages/parser/src/html/index.ts`,
  `packages/parser/src/types.ts`
- browser routes:
  `apps/web/src/lib/parser/index.ts`,
  `apps/web/src/lib/parser/xlsx.ts`,
  `apps/web/src/lib/parser/html.ts`,
  `apps/web/src/lib/parser/worker-protocol.ts`,
  `apps/web/src/lib/parser/worker-runner.ts`,
  `apps/web/src/lib/parser/workers/xlsx-worker.ts`,
  `apps/web/src/lib/parser/workers/html-worker.ts`,
  `apps/web/src/lib/parser/types.ts`
- focused package/browser tests for XLSX, HTML, statement routing, workers,
  diagnostics, merge semantics, and parity
- historical plans and reviews matching SheetJS conversion, used ranges,
  row/column spans, and merge indexing

## Confirmed finding

### C16-DB01 — large worksheet metadata bounds

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed

The four parser implementations accept decoded worksheet dimensions and merge
ranges without app-owned logical limits:

- `packages/parser/src/xlsx/index.ts:141-175,256`
- `apps/web/src/lib/parser/xlsx.ts:153-182,264`
- `packages/parser/src/html/index.ts:75-101,160`
- `apps/web/src/lib/parser/html.ts:60-87,144`
- `packages/parser/src/shared/sheet-cells.ts:18-31`

Each XLSX or HTML route first reads a workbook, then visits every listed sheet.
Within each sheet, `sheet_to_json` runs before any worksheet-size check. The
shared merge helper subsequently inserts one `Map` entry for every cell in
every merge range. Its nested row/column loops have no count, endpoint, or
cumulative-workbook validation.

SheetJS confirms the first half of the flow:
`node_modules/xlsx/xlsx.mjs:27557-27580` iterates every column and row decoded
from `!ref`, including empty cells when the callers pass `defval: ''`.

#### Bounded reproduction

All probes used small values and ordinary parser APIs:

1. A workbook and an HTML table with a two-row vertical merge produced the
   same two transactions and zero errors in package and browser parsers.
2. A workbook with two populated rows and `!ref = A1:AN2000` reopened with the
   same used range. `sheet_to_json` returned 2,000 arrays of width 40. Both
   parsers accepted it, returned the one populated transaction, and returned
   no metadata diagnostic.
3. An HTML table with `rowspan=2000` produced one merge range covering 2,000
   rows. The current shared helper creates 2,000 `Map` entries for that one
   range, and both HTML parsers return no metadata diagnostic.
4. Malformed workbook bytes and HTML without a table returned matching
   `ParseError` results across package and browser implementations. This shows
   that parser validation normally uses returned diagnostics, but no stable
   diagnostic exists for worksheet metadata.

A normal spreadsheet can retain a stale used range after rows or columns are
cleared, and an HTML export can retain an accidental large span. In either
case, a file with very little transaction data can require work proportional
to the declared worksheet area or merged-cell area. Multi-sheet selection
repeats that work for every sheet. The existing read-time `try` blocks end
before sheet conversion and merge indexing, so later failures do not become a
consistent package/browser `ParseError`.

#### History and ownership

Archived Plan 108 bounds workbook archive bytes before SheetJS reads them.
Archived Plan 69 owns merge-value semantics. Neither plan bounds decoded
worksheet dimensions, merge counts, per-merge area, or workbook-wide totals.
The wider history search found no existing owner for this root cause.

#### Recommended fix

Add one dependency-free, browser-safe validator beside
`packages/parser/src/shared/sheet-cells.ts` and export it from
`packages/parser/src/browser.ts`.

1. Decode and validate every sheet's `!ref` and `!merges` before converting
   any sheet. Require finite safe integers, nonnegative values, and ordered
   endpoints.
2. Use documented shared limits for sheet count, rows, columns, logical cells,
   merge count, cells per merge, merged cells per sheet, and cumulative
   workbook totals. Suggested starting limits are 64 sheets, 100,000 rows,
   256 columns, 1,000,000 logical cells per sheet, 2,000,000 per workbook,
   10,000 merges per sheet, 20,000 per workbook, 10,000 cells per merge,
   100,000 merged cells per sheet, and 200,000 per workbook.
3. Return one stable parser result in all four routes, for example code
   `sheet_metadata_rejected` with the Korean message
   `표의 행, 열 또는 병합 범위가 너무 커서 읽지 않았어요.`
4. Replace the per-cell merge `Map` with row-indexed intervals while
   preserving current anchor resolution, duplicate suppression, and
   last-range-wins behavior.
5. Add small direct-validator tests at and one past every limit, cumulative
   multi-sheet tests, and package/browser XLSX and HTML parity tests. Keep the
   existing real-merge fixtures as regression checks.

## Verification

Focused baseline:

```text
bun test packages/parser/__tests__/xlsx.test.ts \
  packages/parser/__tests__/html.test.ts \
  apps/web/__tests__/parser-xlsx-parity.test.ts \
  apps/web/__tests__/parser-html.test.ts \
  apps/web/__tests__/parser-conformance.test.ts \
  apps/web/__tests__/parser-diagnostic-boundaries.test.ts \
  apps/web/__tests__/parser-format-routing-parity.test.ts

163 pass, 0 fail, 513 expectations
```

## Final sweep

I checked every caller of `sheet_to_json`, `createSheetMergeIndex`, and
`resolveSheetCell`, the package/browser entry points, worker behavior, focused
tests, and matching historical records. C16-DB01 is the only retained
actionable root cause from this debugger pass; no second independent issue was
confirmed.
