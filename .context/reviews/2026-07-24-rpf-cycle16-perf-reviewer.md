# Review-plan-fix Cycle 16 — performance reviewer

## Review identity

- Date: 2026-07-24
- Revision: `4b1f368d6b8b92cf009ba18d93639f841a8b5d06`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: one genuinely new finding
- Finding count: one Medium, High confidence
- Scope: independent performance review and this report only

## Inventory and coverage

The review inventoried the exact Git tree and traced parser, optimizer,
calculator, worker, persistence, scraper, UI, build, dependency, data, and
test work. It also searched all current and archived review and plan records
before retaining a finding.

The four authorized Cycle 15 recovery reports were read only as provenance.
The six protected Cycle 42 files remained byte-identical, untracked,
unstaged, and untouched.

## Retained finding

### C16-PR-001 — large worksheet metadata bounds

- Severity: Medium
- Confidence: High
- Status: confirmed by source tracing and small bounded checks
- Shared indexing: `packages/parser/src/shared/sheet-cells.ts:20-31`
- Server spreadsheet path:
  `packages/parser/src/xlsx/index.ts:106-119,149-175,256`
- Browser spreadsheet path:
  `apps/web/src/lib/parser/xlsx.ts:109-127,163-182,264`
- Server HTML-table path:
  `packages/parser/src/html/index.ts:52-65,82-101,160`
- Browser HTML-table path:
  `apps/web/src/lib/parser/html.ts:42-50,66-87,144`

All four supported paths convert the full logical table before an
application-owned row, column, or logical-cell limit is checked. The shared
merge helper also stores one entry for every covered cell without its own
count or area limit. Existing file-byte and archive checks operate at a
different boundary.

Small probes showed deterministic growth with logical rows, columns, and
merge coverage; no large fixture was needed. An ordinary workbook with a
stale used range after formatting or template edits can therefore require far
more work than its visible transaction table suggests. A broad but otherwise
ordinary HTML table follows the same conversion path.

The fix should add a shared browser-safe policy before conversion, validate
sheet and merge metadata plus cumulative workbook totals, return one stable
parse error across server and browser paths, and replace the per-cell merge
map with bounded row intervals. Bounded parity tests should cover accepted
and rejected limits, invalid metadata, cumulative totals, and normal merged
tables.

## Novelty and exclusions

No tracked review, plan, or deferred item owns this logical-size boundary.
The archive-byte plan, older whole-workbook performance note, and
merge-correctness plan cover different roots. The previously rejected
prefixed-XLSX item remains rejected and distinct.

The review also rechecked worker cleanup, optimizer hot paths, HTML
normalization, persistence, large-document assembly, UI lists, scraper bounds,
and build scripts. Those areas are already owned where applicable, and no
second new issue survived validation.

## Verification and closing sweep

- Focused performance matrix: 82 tests, 240 expectations, 0 failures.
- `git diff --check` passed before this report was written.
- No browser, preview server, E2E run, deployment, or production mutation was
  performed.
- Final sweep covered active loops, sorts, bulk allocation, full-file reads,
  worker owners, parser boundaries, optimizer/calculator paths, UI lists,
  CLI paths, scripts, and all historical ownership records.

Final count: one new Medium finding, High confidence.
