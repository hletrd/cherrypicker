# Review-plan-fix Cycle 16 — architect

- Date: 2026-07-24
- Baseline: `4b1f368d6b8b92cf009ba18d93639f841a8b5d06`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: parser ownership, browser/server layering, shared contracts, and
  regression boundaries

## Inventory and coverage

The repository inventory contains 56 parser source files and 81 parser-facing
test files. I read the shared worksheet helper and browser barrel, both server
adapters, both browser adapters, server and browser dispatchers, browser worker
edges, parser result types, package manifests, the relevant parser fixtures and
tests, and the installed SheetJS conversion code. I also searched all 1,185
tracked `.context` files for prior ownership.

The ordinary routes are:

- server XLS/XLSX:
  `packages/parser/src/statement.ts:91-97` →
  `packages/parser/src/xlsx/index.ts:106-163,169-256`;
- server HTML/HTM:
  `packages/parser/src/statement.ts:131-138` →
  `packages/parser/src/html/index.ts:52-101,160`;
- browser XLS/XLSX:
  `apps/web/src/lib/parser/index.ts:79-90`, optionally through
  `apps/web/src/lib/parser/workers/xlsx-worker.ts:1-9`, then
  `apps/web/src/lib/parser/xlsx.ts:109-182,264`;
- browser HTML/HTM:
  `apps/web/src/lib/parser/index.ts:125-136`, optionally through
  `apps/web/src/lib/parser/workers/html-worker.ts:1-12`, then
  `apps/web/src/lib/parser/html.ts:42-87,144`.

The four adapters all use the package-owned helper in
`packages/parser/src/shared/sheet-cells.ts`, exported to the browser through
`packages/parser/src/browser.ts:89-98`. Repository-wide call-site searches
found no other production SheetJS conversion or merge-index path.

## Confirmed finding

### C16-AR-001 — large worksheet metadata bounds

- Severity: Medium
- Confidence: High
- Status: Confirmed

`packages/parser/src/shared/sheet-cells.ts:18-31` defines merge ownership but
does not define an accepted worksheet size contract. It creates a string-keyed
`Map` entry for every cell represented by every merge. Each of the four
adapters first calls SheetJS `sheet_to_json()` and only later builds that map:

- `packages/parser/src/xlsx/index.ts:169-175,256`;
- `packages/parser/src/html/index.ts:99-101,160`;
- `apps/web/src/lib/parser/xlsx.ts:180-182,264`;
- `apps/web/src/lib/parser/html.ts:86-87,144`.

The surrounding entry points check only whether any sheet exists. They do not
bound sheet count, row and column endpoints, logical cells per sheet or
workbook, merge count, cells represented by one merge, or cumulative merged
cells. The server and browser dispatchers add no such contract.

The installed SheetJS implementation at
`node_modules/xlsx/xlsx.mjs:27531-27583` derives its column and row loops from
the worksheet `!ref` string. Its HTML reader at
`node_modules/xlsx/xlsx.mjs:22610-22670` turns `rowspan` and `colspan` values
into `!merges`. A bounded in-memory check with `!ref=A1:Z1000` returned 1,000
rows of width 26, and the matching merge produced 26,000 entries in the
current helper. A small HTML table with `rowspan=1000` and `colspan=26`
produced `!ref=A1` plus the same 1,000-by-26 merge. These are normal
spreadsheet and HTML-table parser paths.

This is one shared-contract root cause, not four adapter findings. The package
already owns merge semantics, but the accepted metadata contract is absent.
As a result, each adapter reaches conversion or indexing before the
application can return a stable parser result for an over-limit workbook.

### Smallest browser-safe design

Keep the policy in `packages/parser/src/shared/sheet-cells.ts`; it is already
dependency-free and shared by every adapter. Add:

1. a strict, dependency-free A1 range decoder that accepts the normalized
   one-cell or two-endpoint forms produced by SheetJS and rejects malformed,
   non-integer, negative, reversed, or non-finite endpoints;
2. one `validateWorkbookSheetMetadata()` function over a minimal structural
   workbook type, plus a typed `WorksheetMetadataValidationError`;
3. one stable parser code such as `worksheet_metadata_rejected` and the
   natural message `표의 행, 열 또는 병합 범위가 너무 커서 읽지 않았어요.`;
4. explicit exported limits:
   - at most 64 sheets;
   - last row at most 100,000 and at most 256 columns;
   - at most 1,000,000 logical cells per sheet and 2,000,000 per workbook;
   - at most 10,000 merges per sheet and 20,000 per workbook;
   - at most 10,000 cells represented by one merge;
   - at most 100,000 merged cells per sheet and 200,000 per workbook;
5. cumulative arithmetic that checks safe integers and remaining budget
   before addition or multiplication.

Call the workbook validator immediately after every successful `xlsx.read()`
and before any sheet reaches `sheet_to_json()`. Validate all named sheets
before parsing the first one so the workbook totals are deterministic.
Server and browser adapters should translate the typed exception to the same
sanitized `ParseError`; the browser barrel should export the constants, types,
validator, and exception.

`createSheetMergeIndex()` must also enforce its direct-call contract. Replace
the per-cell string map with a row-keyed interval index:

```ts
type SheetMergeIndex =
  ReadonlyMap<number, readonly SheetMergeSpan[]>;
```

Append one interval per row represented by a merge, in source order.
`resolveSheetCell()` can scan that row's intervals from the end and preserve
the current last-range-wins behavior when ranges overlap. Existing
`sourceKey` and `fromMerge` semantics remain unchanged. This keeps the helper
independently bounded while avoiding one stored entry per column in a wide
merge.

### Required tests

- Direct shared-policy tests for the exact value and one over every limit,
  missing `!ref`, malformed A1 strings, invalid merge endpoints, safe
  arithmetic, and all workbook cumulative totals.
- Server/browser XLSX and HTML entry-point parity for the stable error code and
  message. Use small one-over fixtures, such as 257 columns, rather than large
  allocations.
- Server/browser dispatcher parity through `parseStatement()` and
  `parseFile()` for both formats.
- Direct merge-index tests proving row-interval storage, anchor resolution,
  overlapping-range order, ordinary blank behavior, and the helper's own
  limit checks.
- Existing multi-sheet selection, real rowspan, merged amount de-duplication,
  and normal statement fixtures must remain unchanged.
- Keep `apps/web/__tests__/parser-browser-boundary.test.ts` green to prove the
  shared policy remains free of Node-only imports.

## Historical novelty and ownership

- Archived Plan 108 owns archive-byte checks before workbook reading; it does
  not own decoded worksheet metadata or logical table limits.
- Archived Plan 69 owns correct merge-backed value semantics and introduced
  `sheet-cells.ts`; it does not bound the helper's accepted input or storage
  shape.
- Earlier performance notes describe `sheet_to_json({ raw: true })` as
  acceptable for typical statements but define no worksheet-level policy.
- No historical review or active plan owns this exact root cause.
- The previously rejected prefixed-XLSX topic remains distinct and rejected.

## Verification

- Focused parser regression run:
  **165 passed, 0 failed, 515 expectations** across eight server/browser XLSX,
  HTML, conformance, routing, diagnostic, and browser-boundary files.
- Static production call-site sweep found exactly four conversion sites and
  four merge-index sites, all covered above.
- No product code, dependency file, generated data, staging state, commit, or
  deployment was changed. Four recovery reports and six protected artifacts
  remained untouched.

## Final missed-issue sweep

I rechecked empty and multi-sheet workbooks, HTML-as-XLS routing, direct parser
exports, worker and non-worker browser routes, exception serialization,
browser-safe imports, malformed ranges, cumulative workbook totals, merge
ordering, merge-source de-duplication, and completed historical plans. No
second independent architecture finding met the evidence threshold.

Final count: **1 Medium finding** (`C16-AR-001`).
