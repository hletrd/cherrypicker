# Review-plan-fix Cycle 16 - dependency expert

- Date: 2026-07-24
- Reviewed revision: `4b1f368d6b8b92cf009ba18d93639f841a8b5d06`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: one current dependency-adjacent parser finding
- Scope: manifests, Bun lock resolution, vendored SheetJS identity, installed
  SheetJS behavior, browser-safe exports, server/browser spreadsheet and HTML
  table entry points, relevant tests, and historical ownership

## Inventory and dependency result

The review covered all eight root/workspace manifests, all 567 package rows
and eight workspace rows in `bun.lock`, `vendor/README.md`, both committed
SheetJS digest records, the dependency policy and its 15 focused tests, parser
and web TypeScript configuration, the parser package exports, the web bundle
isolation checks, the four spreadsheet/HTML adapters, both worker routes, the
shared sheet-cell helper, SheetJS worksheet conversion and HTML import code,
and the corresponding server/browser tests.

Both direct consumers declare the same
`file:../../vendor/xlsx-0.20.3.tgz` dependency. The lock has exactly one
`xlsx@../../vendor/xlsx-0.20.3.tgz` row. The archive currently matches the
committed SHA-256 and SHA-512 values. Its installed `package.json`,
`xlsx.mjs`, `xlsx.js`, type declarations, and license match the archive
byte-for-byte. The package exposes its ES module, CommonJS module, and types,
marks Node-only modules unavailable to browser bundlers, has no runtime
dependencies, and is imported directly only by the two declaring workspaces.

`bun run dependencies:check` passed. The focused dependency suite passed 15
tests and 34 expectations. No manifest, lock, archive identity, package
export, workspace declaration, peer contract, or browser resolution mismatch
was found.

## RPF16-DEP-001 - large worksheet metadata bounds are absent before shared conversion and indexing

- Severity: Medium
- Confidence: High
- Status: Confirmed
- Server spreadsheet path:
  `packages/parser/src/statement.ts:91-97`,
  `packages/parser/src/xlsx/index.ts:106-119,141-175,256`
- Server HTML table path:
  `packages/parser/src/statement.ts:131-137`,
  `packages/parser/src/html/index.ts:52-65,75-101,160`
- Browser spreadsheet path:
  `apps/web/src/lib/parser/index.ts:79-90`,
  `apps/web/src/lib/parser/xlsx.ts:109-126,153-182,264`
- Browser HTML table path:
  `apps/web/src/lib/parser/index.ts:125-136`,
  `apps/web/src/lib/parser/html.ts:42-50,60-87,144`
- Shared index:
  `packages/parser/src/shared/sheet-cells.ts:18-31`
- Installed dependency behavior:
  `node_modules/xlsx/xlsx.mjs:15853-15917,22610-22669,27487-27583`

### Evidence

All four adapters call `XLSX.read`, iterate every returned sheet, and call
`sheet_to_json` before any application-owned logical worksheet limit. The
installed SheetJS implementation decodes the sheet `!ref`, prepares every
column in that range, and visits every row through the range. With the current
`header: 1` and `defval: ''` options, blank logical rows and columns are
materialized in the returned arrays.

After conversion, every adapter calls `createSheetMergeIndex`. That helper
visits every cell covered by every `!merges` entry and stores a string-keyed
`Map` item for it. Its work and retained entries therefore grow with covered
logical cells rather than with the number of merge records.

A bounded local probe confirmed the dependency behavior without modifying
the repository: an otherwise empty worksheet covering 100 rows and 26
columns produced 100 arrays of width 26, while one merge over that area
produced 2,600 map entries. The installed HTML reader also retained the same
merge extent in `!merges`. A normal 16 KiB workbook with that bounded
worksheet extent reached both application entry points and returned matching
valid transaction results.

The existing XLSX archive preflight limits archive bytes and entry metadata,
but it does not inspect the logical worksheet metadata returned by SheetJS.
HTML tables enter the same conversion and merge-index code through SheetJS.
The upstream `sheetRows` option covers only part of the required policy and
does not bound all worksheet, workbook, column, or merge totals.

### Concrete failure scenario

A normal spreadsheet export can retain an unusually large used area despite
containing few visible transaction cells. Similarly, an HTML table can carry
a large cell span. The current parser fully converts or indexes that logical
area before it decides whether the table has useful headers or transactions.
The import can consequently consume work and memory far beyond the visible
statement content and may not return the expected parse result.

This is an application input-validation and correctness gap. The dependency
version, archive identity, and browser packaging are consistent; changing the
package reference alone would not establish the product's intended limits.

### Required fix

1. Add one dependency-free, browser-safe worksheet metadata validator beside
   `sheet-cells.ts`, and export it from `packages/parser/src/browser.ts`.
2. Define explicit application limits for sheet count, rows, columns, logical
   cells per sheet and workbook, merge records, cells per merge, and merged
   cells per sheet and workbook.
3. Validate finite safe integers, nonnegative ordered endpoints, each sheet,
   and cumulative workbook totals immediately after `XLSX.read` and before
   any `sheet_to_json` call. Apply the same policy to spreadsheet and HTML
   table paths on server and browser.
4. Return one stable, short `ParseError` code and Korean message when the
   logical worksheet policy is exceeded.
5. Replace the per-cell merge map with a bounded row-interval index, preserving
   the current merge-anchor behavior and the current last-record-wins result
   for overlapping metadata.
6. Keep the helper free of Node imports so `@cherrypicker/parser/browser` and
   the deferred web parser chunks remain valid. No new package is needed.

### Required tests

- Unit-test every shared limit at the boundary and one step beyond it,
  including cumulative workbook totals and malformed numeric endpoints.
- Exercise the ordinary server and browser spreadsheet entry points and both
  HTML table entry points, asserting the same stable error code.
- Preserve the existing normal workbook, multi-sheet, real-merge, HTML span,
  diagnostic-bound, and worker round-trip results.
- Extend the browser-boundary test to include the new shared validator and
  keep the bundle-isolation checks green.

## Historical ownership and final sweep

All 1,185 tracked `.context` paths were searched for worksheet metadata,
logical worksheet size, SheetJS conversion, merge-index, and vendored
SheetJS ownership. Plan 80 owns and completed vendored dependency identity.
Plan 108 owns and completed archive-byte checks. Plan 69 owns and completed
merge value semantics. None owns large worksheet metadata bounds, so this is
a new current root rather than a renamed completed item.

The final missed-path sweep rechecked all four ordinary entry points, worker
dispatch, every sheet loop, shared browser exports, installed SheetJS source
and types, direct dependency declarations, the single lock resolution,
archive and installed-file identity, relevant parser tests, and bundle
isolation. No second actionable dependency root survived.

The six protected user files still match their recorded SHA-256 values and
remain untracked and unstaged. The four recovery reports and all other
pre-existing untracked files were left untouched. This report is the only
file written by this role, and nothing was staged.

Final count: 1 Medium finding with High confidence.
