# Review-plan-fix Cycle 9 — performance reviewer

- Date: 2026-07-24
- Baseline: `c5c6eab9b421e547d66716e989e08c747cc36aa1`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: CPU growth, allocation/clone boundaries, main-thread responsiveness,
  admission bounds, rendering scale, and resource cleanup

## Inventory and coverage

The locked snapshot contains 2,232 tracked paths. I enumerated them with
`git ls-files`: 166 under `apps/web`, 38 under `packages/core`, 85 under
`packages/parser`, 733 under `packages/rules`, 14 under `packages/viz`, 28
under `tools/cli`, 35 under `tools/scraper`, 19 scripts, 16 E2E paths, 1,079
historical plan/review paths, and 19 root/config/workflow/vendor paths. The
active non-context inventory is 1,153 paths, including all 159 tracked
test/spec paths, 686 YAML paths, and 59 JSON paths.

The performance pass covered all active path families: upload limits and
multi-file scheduling; browser/server CSV, XLSX, HTML, JSON, OFX, and PDF
parsers; worker payload ownership and cleanup; categorization; analysis
context; calculator and optimizer state; catalog fetch/validation/publication;
persistence; every dashboard/report/terminal renderer; CLI and scraper
commands; build/check scripts; manifests, workflow, lock/vendor policy; E2E
fixtures; and the generated/authored card corpus. Plans 108–113 and prior
performance reports were checked before classifying current observations.
The six protected untracked Cycle 42 files were left untouched.

## Result: no new non-duplicate performance finding

No new performance defect met the reporting threshold after excluding work
that is already explicitly open or deferred.

The following current costs were independently revalidated, but are not new
Cycle 9 findings:

- **Incremental optimizer (`D-C1-040`) remains open.**
  `packages/core/src/optimizer/greedy.ts:54-116,137-238,350-469` still replays
  assigned transaction history for marginal scores and counterfactuals. A
  deterministic one-card/no-cap probe measured 200, 400, 800, and 1,600
  transactions at 73.4, 183.3, 700.1, and 1,619.3 ms. A current-catalog probe
  over 566 executable cards measured 100, 200, and 400 transactions at 390.9,
  766.9, and 1,575.4 ms. This is the already documented incremental-optimizer
  debt, not a new regression.
- **Compiled merchant matching (`D-C1-041`) remains open.**
  `packages/core/src/categorizer/matcher.ts:51-60,184-315` scans substring
  entries on unique cache misses. The current four keyword maps contain
  13,568 authored entries; 100, 500, 1,000, and 2,000 unique misses measured
  32.3, 119.2, 239.9, and 465.5 ms. Categorization remains synchronous at
  `apps/web/src/lib/analyzer.ts:73-104,138-174`. This is the known compiled
  matcher/main-thread debt.
- **Transaction-table virtualization remains deferred.**
  `apps/web/src/components/dashboard/TransactionReview.svelte:242-325,
  435-493` still materializes every visible row and a full grouped category
  option tree per row. This is the existing transaction-table virtualization
  item, not a new Cycle 9 issue.
- **Large-PDF text assembly/bounding remains previously reported.**
  `apps/web/src/lib/parser/pdf-lifecycle.ts:45-115` assembles all extracted
  text and `apps/web/src/lib/parser/pdf.ts:28-73` parses it on the application
  thread. The absence of a text/page budget and the concatenation pattern were
  already reported as the PDF text-extraction size/concatenation debt.
- **Optimizer catalog cloning belongs to `D-C1-040`.**
  `apps/web/src/lib/optimizer/worker-runner.ts:48-97` creates an owned worker
  and posts the cached card rules on each run. The current optimizer artifact
  is 1,970,084 bytes with 682 cards. Plan 72 explicitly includes duplicated
  catalog memory in the deferred incremental worker redesign.

### Rejected prefixed-XLSX hypothesis

`preflightXLSXArchive()` returns `not-zip` unless the payload starts with
`PK` (`packages/parser/src/shared/xlsx-archive.ts:118-130`), and both the
server and browser then call SheetJS
(`packages/parser/src/xlsx/index.ts:106-137`;
`apps/web/src/lib/parser/xlsx.ts:109-151`). A generated valid workbook with
one leading zero byte did return `not-zip`, but SheetJS treated the payload as
plain tabular text: its rows contained ZIP bytes and the product parser
returned zero transactions with a header error. It did not enter ZIP
inflation. Therefore the probe does not bypass the archive budgets and is not
a performance/security finding.

## Verification

- Focused suites passed: 170 tests across optimizer contracts, date parsing,
  XLSX archive preflight, analyzer merge, upload admission, optimizer worker
  ownership, PDF lifecycle, and transaction review.
- Executable probes covered optimizer growth, current artifact/card counts,
  merchant-matcher miss growth, and the prefixed-XLSX competing hypothesis.
- The final missed-issue sweep revisited all unbounded builders, nested loops,
  clone/transfer sites, caches, sort/filter chains, file/response budgets,
  worker lifecycle paths, reactive list renderers, CLI sinks, scraper limits,
  and generated-data checks.
- No browser/E2E run, product-source edit, generated-artifact edit, commit, or
  deployment was performed.

Final count: **0 new performance findings**.
