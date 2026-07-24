# Review-plan-fix Cycle 16 — code reviewer

## Review identity

- Date: 2026-07-24
- Revision: `4b1f368d6b8b92cf009ba18d93639f841a8b5d06`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: one genuinely new finding
- Finding count: one Medium, High confidence
- Scope: review and this report only

## Inventory and coverage

The exact Git tree contains 2,354 tracked paths: 1,185 review and plan
records plus 1,169 active source, test, data, documentation, configuration,
workflow, and vendor-integrity paths. The review inventoried all paths before
tracing:

- statement detection through server and browser CSV, spreadsheet, PDF, JSON,
  OFX, and HTML parsing;
- parsed transactions through categorization, calculation, optimization,
  worker transport, persistence, and every presentation sink;
- authored card data through schema checks and generated publication files;
- CLI and scraper entry points, file ownership, cancellation, and error
  handling;
- build, dependency, data, documentation, and E2E ownership checks; and
- all current and archived review/plan history for novelty.

The four authorized Cycle 15 recovery reports were read. Their zero-finding
conclusions were used only as provenance and are not counted here. The six
protected Cycle 42 files remained outside the reviewed Git tree and were not
edited or staged.

## Retained finding

### C16-CR-001 — large worksheet metadata bounds

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
- CLI routing: `packages/parser/src/statement.ts:91-97,131-137`
- Browser routing: `apps/web/src/lib/parser/index.ts:79-90,125-136`

All four supported sheet paths perform full logical table conversion before
an application-owned row, column, or cell limit is checked. The shared merge
helper then indexes every covered cell without its own count or area limit.
The existing upload and archive checks apply to file bytes, so they do not
close this separate logical-size gap.

A normal spreadsheet may retain a much larger used range than its populated
transaction table after ordinary formatting or template edits. A normal HTML
statement may likewise retain a broad table span. Both inputs can therefore
require disproportionate work before header and transaction validation runs,
causing an otherwise supported import to take too long or fail to finish.

Small controls confirmed that conversion work follows the declared logical
table size while ordinary archive size remains nearly unchanged. Separate
small controls confirmed that the current merge index grows with covered
cells. No large fixture was used.

The fix should:

1. add one browser-safe shared policy for sheet count, rows, columns, logical
   cells, merge count, individual merge size, and cumulative workbook totals;
2. validate finite, safe, nonnegative, ordered metadata before conversion or
   indexing;
3. return one stable, sanitized parse error in server, browser, spreadsheet,
   HTML-as-XLS, and direct HTML paths;
4. make the shared merge helper enforce admitted limits and store row
   intervals instead of one entry per covered cell; and
5. add bounded server/browser parity tests for accepted boundaries, rejected
   boundaries, invalid metadata, multi-sheet totals, and normal merged tables.

## Novelty and exclusions

No tracked review, plan, or deferred record owns this logical-size boundary.
The prior archive-byte plan, the older whole-workbook performance note, and
the merge-correctness plan cover different roots. The previously rejected
prefixed-XLSX candidate remains rejected and distinct.

Plans 141 and 142 remain verified complete at this revision. Existing
deferred optimizer, parser-architecture, and UI items retain their historical
owners. No second new finding survived exact-source validation and historical
deduplication.

## Verification and closing sweep

- Focused spreadsheet, archive, and HTML suites: 151 passed, 0 failed.
- Current Cycle 14 calculator and optimizer matrix: 80 passed, 0 failed.
- Exact-HEAD and protected-file hash checks: passed.
- Final sweep: all executable families, tests, generated data, configs,
  workflows, docs, and review history were covered; no relevant file was
  skipped.

Final count: one new Medium finding, High confidence.
