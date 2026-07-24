# Plan 143: Cycle 16 Large Worksheet Metadata Bounds

**Finding:** C16-001 (Medium/High)
**Status:** planned
**Deploy mode:** none

## Evidence

- Server spreadsheet conversion begins at
  `packages/parser/src/xlsx/index.ts:169-175`; browser spreadsheet conversion
  begins at `apps/web/src/lib/parser/xlsx.ts:180-182`.
- Server HTML-table conversion begins at
  `packages/parser/src/html/index.ts:100-101`; browser HTML-table conversion
  begins at `apps/web/src/lib/parser/html.ts:86-87`.
- Each outer adapter walks every named sheet to select the result with the
  most transactions, but no app-owned sheet count, dimension, logical-cell,
  merge-count, or cumulative-workbook limit runs before conversion.
- `packages/parser/src/shared/sheet-cells.ts:20-31` stores one map entry for
  every cell covered by a merge and has no independent accepted-input
  contract.
- Existing upload and archive checks bound file bytes rather than decoded
  worksheet metadata.
- Twelve independent Cycle 16 roles confirmed the same root through ordinary
  server/browser spreadsheet and HTML-table paths. Small bounded probes
  reproduced the behavior without a large fixture.

## Outcome

All supported server and browser sheet parsers validate decoded worksheet
metadata before the first logical-table conversion. A shared browser-safe
policy owns explicit per-sheet and cumulative-workbook limits, invalid
metadata returns one stable natural parse error, and merge lookup uses bounded
row intervals while preserving current anchor and duplicate-suppression
semantics.

## Shared policy

Export and enforce these limits from
`packages/parser/src/shared/sheet-cells.ts`:

- `MAX_WORKBOOK_SHEETS = 64`
- `MAX_WORKSHEET_ROWS = 100_000`
- `MAX_WORKSHEET_COLUMNS = 256`
- `MAX_WORKSHEET_LOGICAL_CELLS = 1_000_000`
- `MAX_WORKBOOK_LOGICAL_CELLS = 2_000_000`
- `MAX_WORKSHEET_MERGES = 10_000`
- `MAX_WORKBOOK_MERGES = 20_000`
- `MAX_MERGE_LOGICAL_CELLS = 10_000`
- `MAX_WORKSHEET_MERGED_CELLS = 100_000`
- `MAX_WORKBOOK_MERGED_CELLS = 200_000`

Use stable parser code `worksheet_metadata_rejected` and Korean message
`표의 행, 열 또는 병합 범위가 너무 커서 읽지 않았어요.`.

## Implementation

1. Add a bounded red regression in
   `apps/web/__tests__/cycle16-worksheet-metadata.test.ts`. Prove current
   server/browser spreadsheet and HTML-table entry points do not return the
   required stable error for a small one-over input, and prove the current
   merge index stores more than one row entry for a wide merge.
2. Add minimal structural sheet/workbook types, exported constants, a typed
   `WorksheetMetadataValidationError`, and dependency-free validators beside
   the shared merge helper.
3. Decode the normalized one-cell and two-endpoint A1 forms emitted by
   SheetJS without importing SheetJS into the shared browser entry. Reject
   malformed values and non-finite, non-safe-integer, negative, reversed, or
   out-of-range endpoints.
4. Use checked multiplication and remaining-budget addition for per-sheet and
   cumulative logical cells, merge counts, and merge coverage.
5. Validate every named sheet once immediately after each successful
   `xlsx.read()` and before any call to `sheet_to_json()` in:
   - `packages/parser/src/xlsx/index.ts`;
   - `apps/web/src/lib/parser/xlsx.ts`;
   - `packages/parser/src/html/index.ts`; and
   - `apps/web/src/lib/parser/html.ts`.
6. Apply the same per-sheet validation at both exported `parseHTMLSheet()`
   entry points so direct callers cannot bypass the contract.
7. Translate the typed validator error into the same sanitized `ParseError`
   code/message on server and browser paths, with the appropriate `xlsx` or
   `html` format and no internal metadata details.
8. Change `SheetMergeIndex` to a row-keyed map of ordered spans. Add one span
   per represented row, scan spans from the end in `resolveSheetCell()`, and
   preserve last-range-wins behavior, `sourceKey`, `fromMerge`, ordinary blank
   handling, and merged-amount duplicate suppression.
9. Make `createSheetMergeIndex()` enforce the per-sheet merge contract for
   direct callers before it creates any spans.
10. Export the policy constants, structural types, validator functions,
    exception, and revised merge-index types through
    `packages/parser/src/browser.ts`.
11. Expand the Cycle 16 regression to cover exact and one-over sheet, row,
    column, logical-cell, merge-count, per-merge, per-sheet, and cumulative
    workbook totals; malformed numeric metadata; ordinary XLSX; legacy XLS;
    HTML-as-spreadsheet; direct HTML; a valid first sheet followed by an
    out-of-bounds sheet; direct sheet calls; interval order; and normal merged
    tables.
12. Keep fixtures small. Exercise represented limits through metadata objects,
    narrow one-over documents, and repeated tiny ranges rather than allocating
    the full logical table.

## Acceptance

- [ ] Every workbook path validates all named sheets before the first
      `sheet_to_json()` call.
- [ ] Direct server/browser `parseHTMLSheet()` calls enforce the same
      per-sheet contract.
- [ ] Exact supported limits pass and one-over values fail for every exported
      limit.
- [ ] Missing metadata remains compatible with empty-sheet behavior.
- [ ] Malformed A1 values and invalid numeric merge endpoints fail with the
      typed shared exception.
- [ ] All parser entry points return code `worksheet_metadata_rejected` and
      the same Korean message, with no transactions.
- [ ] A valid first sheet cannot hide an out-of-bounds later sheet.
- [ ] Merge indexing stores row intervals rather than one entry per covered
      cell and independently enforces its direct-call bounds.
- [ ] Overlap order, anchor resolution, source identity, ordinary blanks,
      merged-value inheritance, and duplicate suppression remain unchanged.
- [ ] The shared policy remains usable through
      `@cherrypicker/parser/browser` without a Node-only import.
- [ ] Existing spreadsheet, HTML, archive, worker, statement-router, and
      server/browser conformance suites remain green.
- [ ] No deferred item, schema change, dependency update, generated-data
      change, or deployment is introduced.

## Verification

First record the bounded failing regression on the pre-fix implementation.
Then run the new Cycle 16 test and all focused spreadsheet, HTML, archive,
worker, statement-routing, and conformance suites.

After focused green, run the required full-repository gates:

- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test`
- `bun run test:bun`
- `bunx vitest run`
- `bun run test:e2e`

Before and after E2E, prove exact harness/session/profile/server/port ownership,
clean only the exact owned resources, and finish with
`bun scripts/run-e2e.ts status --assert-clean`, TCP 4173 free, and no
repository-owned process tree.

## Execution note

The requested `ralph` capability is unavailable. Prompt 3 will use the
approved disciplined manual fallback: add and record a deterministic bounded
red regression, implement the smallest shared root fix, run focused green and
parity checks, then run every required repository gate. No deployment will
occur.
