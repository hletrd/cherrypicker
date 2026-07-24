# Cycle 16 Document Specialist Review

## Result

One actionable current root was retained.

## Review inventory

- Public format claims and entry points:
  - `README.md:19-37,113-140`
  - `packages/parser/package.json:1-30`
  - `packages/parser/src/index.ts:1-49`
  - `packages/parser/src/browser.ts:1-151`
  - `apps/web/src/lib/supported-formats.ts:1-33`
  - `apps/web/src/pages/index.astro:54-78`
- Parser result and error contracts:
  - `packages/parser/src/types.ts:1-80`
  - `apps/web/src/lib/parser/types.ts:1-89`
  - `apps/web/src/lib/parser/worker-protocol.ts:1-213`
  - `apps/web/src/lib/analyzer-helpers.ts:86-103`
  - `apps/web/src/lib/analyzer.ts:143-188,343-405`
  - `tools/cli/src/terminal.ts:1-11`
  - `tools/cli/src/commands/analyze.ts:20-49`
- Spreadsheet and HTML-table routing and implementation:
  - `packages/parser/src/statement.ts:43-139`
  - `packages/parser/src/xlsx/index.ts:101-175,253-257`
  - `packages/parser/src/html/index.ts:49-101,160-161`
  - `apps/web/src/lib/parser/index.ts:25-137`
  - `apps/web/src/lib/parser/xlsx.ts:109-182,261-265`
  - `apps/web/src/lib/parser/html.ts:41-87,144-145`
  - `packages/parser/src/shared/sheet-cells.ts:1-59`
- Tests used as contract documentation:
  - `packages/parser/__tests__/xlsx.test.ts`
  - `packages/parser/__tests__/html.test.ts`
  - `packages/parser/__tests__/conformance/workbook.ts`
  - `apps/web/__tests__/parser-html.test.ts`
  - `apps/web/__tests__/parser-xlsx-parity.test.ts`
  - `apps/web/__tests__/parser-conformance.test.ts`
  - `apps/web/__tests__/parser-diagnostic-boundaries.test.ts`
  - `apps/web/__tests__/parser-browser-boundary.test.ts`
- Historical ownership:
  - `.context/plans/_archive/69-cycle1-parser-cli-integrity.md`
  - `.context/plans/_archive/108-cycle8-parser-boundaries.md`
  - repository-wide searches across prior review and plan Markdown for sheet
    conversion, row/column ranges, merge indexing, and workbook totals

## C16-DOC-001: large worksheet metadata bounds are absent from the parser contract

- Severity: Medium
- Confidence: High
- Status: Confirmed

### Why this is a current contract gap

The README and web format list present Excel and HTML tables as ordinary
supported inputs (`README.md:31,118-125,139`;
`apps/web/src/lib/supported-formats.ts:7-26`). The parser API expresses
recoverable failures through `ParseResult.errors` and structured `ParseError`
fields (`packages/parser/src/types.ts:27-63`;
`apps/web/src/lib/parser/types.ts:31-73`). Web workers preserve an error code
and message (`apps/web/src/lib/parser/worker-protocol.ts:21-44,179-203`), while
the web and CLI show the message to the user
(`apps/web/src/lib/analyzer-helpers.ts:98-103`;
`tools/cli/src/terminal.ts:5-10`).

That contract has no parser-owned policy for logical sheet size:

- Both XLSX adapters call `sheet_to_json` before checking any row, column, or
  workbook total (`packages/parser/src/xlsx/index.ts:169-175`;
  `apps/web/src/lib/parser/xlsx.ts:180-182`).
- Both HTML adapters follow the same order
  (`packages/parser/src/html/index.ts:99-101`;
  `apps/web/src/lib/parser/html.ts:83-87`).
- All four adapters then call `createSheetMergeIndex`, whose nested loops add
  one string-keyed `Map` entry for every cell covered by every merge
  (`packages/parser/src/shared/sheet-cells.ts:18-31`).
- The best-sheet loops inspect every named sheet, but there is no sheet-count,
  per-sheet, or cumulative logical-cell policy
  (`packages/parser/src/xlsx/index.ts:145-161`;
  `apps/web/src/lib/parser/xlsx.ts:157-175`;
  `packages/parser/src/html/index.ts:79-94`;
  `apps/web/src/lib/parser/html.ts:64-78`).
- No current source validates that row and column endpoints are finite,
  non-negative safe integers in ascending order before conversion or indexing.

A normal export can contain a mostly empty used area or an unusually broad
merged title block. Even when its file bytes fit the existing upload policy,
large row/column endpoints make conversion visit the declared logical grid,
and large merge ranges make the shared helper allocate an entry per covered
cell. A bounded probe confirmed the implementation shape: one 1,000 by 256
merge produced 256,000 map entries, while a sheet declared as 500 by 64
produced 500 arrays of 64 values. The work follows metadata size rather than
the number of transaction cells.

Because conversion and merge indexing sit outside the read-only `try` blocks,
a failure there can also escape the normal `ParseResult.errors` path instead
of returning a stable parser explanation.

### Required fix

1. Put one dependency-free workbook policy in
   `packages/parser/src/shared/sheet-cells.ts`. Give it explicit limits for
   sheet count, absolute rows, columns, logical cells per sheet and workbook,
   merge count, cells per merge, and total merged cells. Validate finite,
   non-negative safe-integer endpoints and ordered ranges.
2. Validate every sheet immediately after SheetJS creates the workbook and
   before any candidate sheet reaches `sheet_to_json`. Apply the same shared
   policy to server and browser XLSX and HTML entry points, including
   HTML-as-XLS routing. Check cumulative workbook totals before parsing the
   first sheet.
3. Make `createSheetMergeIndex` enforce its own limits for direct callers.
   Replace the per-cell string-key map with bounded row intervals while
   preserving current merge-anchor behavior and deterministic overlap order.
4. Export the policy constants, types, validator, and stable error constants
   through `@cherrypicker/parser/browser`, keeping that entry point free of
   runtime-specific imports.
5. Return the same structured error everywhere. A suitable contract is code
   `sheet_geometry_rejected` with the natural Korean message
   `표의 행, 열 또는 병합 범위가 너무 커서 읽지 않았어요.` Preserve it
   through worker serialization, direct browser fallback, `parseStatement`,
   and CLI display.
6. Add a short README note beside the supported-format claim so “supported”
   does not imply an unlimited logical sheet.

### Required tests

- Direct shared-policy tests for every exact limit and one step beyond it,
  malformed endpoints, ordered ranges, per-sheet totals, and cumulative
  workbook totals.
- Server/browser XLSX entry-point parity for an ordinary workbook, exact-limit
  sheets, one-over-limit sheets, many sheets, and merge totals.
- Server/browser HTML and HTML-as-XLS parity for ordinary tables and the same
  table limits.
- Regression tests proving ordinary merged dates, merchants, installments,
  and memos still resolve from their anchors, overlapping ranges keep the
  documented order, and ordinary blank cells remain blank.
- Error-contract tests for the exact code and Korean message through direct
  adapters and the browser worker round trip.
- A browser-boundary test confirming the new shared module remains safe for
  `@cherrypicker/parser/browser`.

### Historical ownership and novelty

- Archived Plan 69 owns merge-backed value meaning and provenance
  (`.context/plans/_archive/69-cycle1-parser-cli-integrity.md:96-111,168-194`);
  it does not define logical sheet budgets.
- Archived Plan 108 owns workbook-byte checks and parser contract
  centralization
  (`.context/plans/_archive/108-cycle8-parser-boundaries.md:30-52,69-87`);
  it does not validate post-read row/column or merge totals.
- Earlier multi-sheet notes discuss selecting the best sheet and the cost of
  scanning ordinary workbooks, but no retained or archived plan owns large
  worksheet metadata bounds.

This is therefore a new root rather than a reopening of either completed plan.

## Verification and final sweep

- Focused current tests passed: 147 tests, 0 failures, 458 expectations across
  the server/browser XLSX, HTML, parity, and diagnostic suites listed above.
  Those tests document ordinary merge semantics and byte-level workbook
  handling, but none assert logical sheet limits.
- A source-wide search found exactly four `sheet_to_json` call sites and one
  shared merge-index implementation. It found no sheet-size validator or
  row/column/merge budget constants.
- Public exports, worker serialization, web error selection, CLI formatting,
  relevant tests, Git history, and historical review/plan ownership were
  checked again after the main pass.
- No second actionable current root was retained.
- No product file was edited and nothing was staged.
