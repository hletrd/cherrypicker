# Cycle 16 Tracer Review

## Review basis

- Role: tracer
- Reviewed HEAD: `4b1f368d6b8b92cf009ba18d93639f841a8b5d06`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Method: inventory, end-to-end call tracing, dependency-source inspection,
  bounded probes, focused tests, full-history duplicate search, and a final
  missed-path sweep

## Inventory

The review inventory covered every production path that can turn a spreadsheet
or HTML table into statement rows:

- CLI entry and dispatch:
  - `tools/cli/src/commands/analyze.ts`
  - `tools/cli/src/commands/optimize.ts`
  - `tools/cli/src/commands/report.ts`
  - `tools/cli/src/parse-statement.ts`
  - `packages/parser/src/statement.ts`
- Server adapters and shared kernel:
  - `packages/parser/src/xlsx/index.ts`
  - `packages/parser/src/html/index.ts`
  - `packages/parser/src/shared/sheet-cells.ts`
  - `packages/parser/src/shared/xlsx-archive.ts`
  - `packages/parser/src/browser.ts`
  - `packages/parser/src/index.ts`
  - `packages/parser/src/types.ts`
- Browser entry, workers, and adapters:
  - `apps/web/src/lib/analyzer.ts`
  - `apps/web/src/lib/upload-admission.ts`
  - `apps/web/src/lib/parser/index.ts`
  - `apps/web/src/lib/parser/worker-runner.ts`
  - `apps/web/src/lib/parser/worker-protocol.ts`
  - `apps/web/src/lib/parser/workers/xlsx-worker.ts`
  - `apps/web/src/lib/parser/workers/html-worker.ts`
  - `apps/web/src/lib/parser/xlsx.ts`
  - `apps/web/src/lib/parser/html.ts`
  - `apps/web/src/lib/parser/types.ts`
- Relevant tests:
  - `packages/parser/__tests__/xlsx.test.ts`
  - `packages/parser/__tests__/html.test.ts`
  - `packages/parser/__tests__/xlsx-archive.test.ts`
  - `packages/parser/__tests__/statement-runtime.test.ts`
  - `packages/parser/__tests__/non-spending-parity.test.ts`
  - `packages/parser/__tests__/conformance/workbook.ts`
  - `apps/web/__tests__/parser-html.test.ts`
  - `apps/web/__tests__/parser-conformance.test.ts`
  - `apps/web/__tests__/parser-cycle5-integrity.test.ts`
  - `apps/web/__tests__/parser-cycle6-integrity.test.ts`
  - `apps/web/__tests__/parser-cycle7-direction.test.ts`
  - `apps/web/__tests__/parser-diagnostic-boundaries.test.ts`
- Dependency and policy evidence:
  - `packages/parser/package.json`
  - `apps/web/package.json`
  - `bun.lock`
  - the complete repository review instructions and repository agent rules
  - all historical review and plan Markdown files matching spreadsheet,
    worksheet, SheetJS, range, row, column, cell, and merge terms

The parser package and web application both pin the repository-vendored
SheetJS `0.20.3`.

## End-to-end trace

### Server spreadsheet route

1. Each CLI command calls `parseStatementLocalFirst()`
   (`tools/cli/src/parse-statement.ts:58-128`).
2. `parseStatement()` dispatches spreadsheet input to `parseXLSXBuffer()`
   (`packages/parser/src/statement.ts:91-97`).
3. `parseXLSXBuffer()` reads HTML-as-XLS directly, or runs the archive-byte
   preflight and then calls SheetJS
   (`packages/parser/src/xlsx/index.ts:106-139`).
4. It walks every `SheetNames` entry to choose the sheet with the most
   transactions (`packages/parser/src/xlsx/index.ts:141-163`).
5. Every present sheet reaches `sheet_to_json()` before header or row
   validation (`packages/parser/src/xlsx/index.ts:169-223`).
6. A sheet with a valid header then reaches `createSheetMergeIndex()` before
   transaction rows are processed (`packages/parser/src/xlsx/index.ts:239-413`).

### Server HTML-table route

1. `parseStatement()` decodes HTML and dispatches to `parseHTML()`
   (`packages/parser/src/statement.ts:131-138`).
2. `parseHTML()` normalizes text, calls SheetJS, and walks every generated
   sheet (`packages/parser/src/html/index.ts:52-96`).
3. Each sheet reaches `sheet_to_json()` first and merge indexing after header
   recognition (`packages/parser/src/html/index.ts:100-160`).

### Browser routes

1. `parseAndCategorize()` calls `parseFile()`
   (`apps/web/src/lib/analyzer.ts:143-158`).
2. `parseFile()` sends spreadsheet and HTML inputs through dedicated workers
   when workers exist, or calls the same browser adapters directly
   (`apps/web/src/lib/parser/index.ts:79-90,125-136`).
3. The two workers delegate without an intervening worksheet check
   (`apps/web/src/lib/parser/workers/xlsx-worker.ts:1-8` and
   `apps/web/src/lib/parser/workers/html-worker.ts:1-11`).
4. Browser spreadsheet and HTML adapters mirror the server flow: every sheet
   reaches `sheet_to_json()` at
   `apps/web/src/lib/parser/xlsx.ts:180-182` and
   `apps/web/src/lib/parser/html.ts:86-87`, then merge indexing at
   `apps/web/src/lib/parser/xlsx.ts:264` and
   `apps/web/src/lib/parser/html.ts:144`.

`rg` found no other production `xlsx.read`, `sheet_to_json`, or
`createSheetMergeIndex` call site outside these four adapters.

## Retained finding

### C16-TR-001 — large worksheet metadata bounds

- Severity: Medium
- Confidence: High
- Status: Confirmed

#### Root cause

There is no application-owned worksheet metadata validation between
`xlsx.read()` and the first logical conversion. The four adapters do not bound:

- workbook sheet count;
- rows, columns, or rectangular logical cells per sheet;
- cumulative logical cells across all sheets;
- merge count per sheet or workbook;
- rows, columns, or logical cells represented by one merge or by all merges;
- finite, safe-integer, non-negative, and ordered range endpoints.

The archive-byte preflight in
`packages/parser/src/shared/xlsx-archive.ts:118-298` checks ZIP structure and
byte totals before SheetJS reads an XLSX file. It does not validate the decoded
worksheet metadata. Browser upload limits in
`apps/web/src/lib/upload-admission.ts:3-5,26-70` likewise describe file bytes
and file counts, not the logical table size.

SheetJS `sheet_to_json()` derives its loops from `sheet["!ref"]`. With the
repository's `{ header: 1, raw: true, defval: '' }` options, it emits blank
logical rows and fills every represented column. The application calls it
before deciding whether a header exists. Separately,
`createSheetMergeIndex()` nests row and column loops and inserts one `Map`
entry for every position covered by each merge
(`packages/parser/src/shared/sheet-cells.ts:20-31`).

An ordinary statement workbook can retain a much larger used range after old
rows or formatting are cleared, or include a formatting-only sheet alongside
the real transaction sheet. Because all sheets are examined, that stale
metadata still drives conversion even if an earlier sheet is already valid.
An exported HTML table can likewise carry a long row or column span. The parser
then performs work and allocation unrelated to the statement rows, making
normal parsing unreliable for such files.

#### Bounded confirmation

A direct, bounded probe used a sheet with only three populated header cells and
`!ref = "A1:Z1000"`. Current SheetJS returned 1,000 rows of width 26.
`createSheetMergeIndex()` over the matching 1,000-by-26 merge returned 26,000
entries. This confirms that logical metadata, rather than populated cells,
controls both operations.

A second in-memory probe wrote a valid 16,036-byte workbook containing one
transaction and the same `A1:Z1000` used range. Both
`parseXLSXBuffer()` and the browser `parseXLSX()` accepted it and returned the
transaction. A small HTML table with `rowspan="1000"` likewise reached both
HTML adapters and returned its transaction. Thus the behavior is reachable
through all four ordinary parser entry points rather than only through direct
helper calls.

#### Recommended fix

1. Add one dependency-free, browser-safe worksheet metadata validator beside
   `packages/parser/src/shared/sheet-cells.ts`, with documented constants and a
   stable validation error.
2. Validate the full workbook once, immediately after SheetJS returns and
   before any sheet reaches `sheet_to_json()` or merge indexing. Check every
   limit above with overflow-safe arithmetic so a later sheet cannot evade a
   cumulative workbook limit.
3. Call the same validator from server and browser spreadsheet and HTML
   adapters. Convert validation failures to the same sanitized `ParseError`
   code and Korean message on all four routes.
4. Make `createSheetMergeIndex()` independently enforce its accepted contract.
   Replace its per-position `Map` with bounded row spans or an equivalent
   range-aware index. Preserve the current last-range-wins behavior for
   overlapping metadata and keep `resolveSheetCell()` source identity stable.
5. Export the constants, validator, error type, and revised index types through
   `packages/parser/src/browser.ts`; do not create a second browser copy.

#### Required tests

- Direct validator tests at and one past every sheet, row, column, logical-cell,
  and merge limit.
- Invalid endpoint tests for non-integer, non-finite, negative, and reversed
  ranges.
- Cumulative workbook tests where each sheet is individually accepted but the
  total is not.
- Server/browser spreadsheet parity using the same generated workbook bytes.
- Server/browser HTML parity using the same table text.
- A workbook with an ordinary valid first sheet and an excessive later sheet,
  proving all metadata is checked before any candidate sheet is selected.
- Ordinary multi-sheet and merged-cell fixtures proving existing parsing,
  duplicate suppression, and last-range-wins semantics remain unchanged.
- Tests that instrument conversion and merge-index creation to show neither is
  called after metadata validation fails.

## Historical duplicate adjudication

The full review/plan history was searched, not sampled.

- Archived Plan 108 owns ZIP structure and byte limits before SheetJS. It does
  not own decoded worksheet metadata or logical table limits.
- Archived Plan 69 owns merge-backed value correctness and source identity. It
  does not bound merge indexing.
- Older performance notes describe multi-sheet traversal as acceptable for
  typical statements but do not define or implement worksheet metadata limits.
- The prior prefixed-workbook candidate remains distinct and rejected.

No historical owner was found for `C16-TR-001`, so it is new rather than a
restatement of completed archive or merge-correctness work.

## Verification and final sweep

- Focused parser run:
  - `bun test packages/parser/__tests__/xlsx.test.ts packages/parser/__tests__/html.test.ts apps/web/__tests__/parser-html.test.ts apps/web/__tests__/parser-conformance.test.ts`
  - Result: 123 passed, 0 failed, 370 expectations.
- Every production SheetJS read, logical conversion, merge-index creation,
  worker handoff, direct fallback, CLI dispatch, and relevant server/browser
  parity test was rechecked after the finding was formed.
- No second actionable root cause survived the final trace and duplicate
  review.
