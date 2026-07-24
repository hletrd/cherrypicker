# Review-plan-fix Cycle 17 — performance reviewer

## Review identity

- Date: 2026-07-24
- Revision: `857e12a794e585560a0c447b0a1619def02cbcf3`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Role: performance, concurrency, CPU, memory, parser scaling, UI
  responsiveness, bundle, and runtime review
- Disposition: **one new actionable finding** — Medium severity, High
  confidence
- Scope: read-only repository review plus this report; no source, plan, test,
  configuration, generated-artifact, or protected Cycle 42 file changes

## Inventory and coverage

The tracked inventory contained 2,374 files (1,170 outside `.context`), with
active implementation concentrated in `packages/`, `apps/`, `tools/`,
`scripts/`, and `e2e/`. The complete tracked manifest hash was
`02ebbe004f91d30b357a8ae8e06f1ebfa258aca9bbc9da67d106ff6cd0d67a4b`;
the non-`.context` manifest hash was
`463789afd25f6c17113d86d68f0dbce2f7cb86055eb598b89cea369f21f6d151`.

The review covered the parser adapters and workers, worksheet guards, upload
queue and admission, analysis context, matcher and optimizer hot paths,
reward evaluation, catalog loading and generated artifacts, persistence,
scraper networking and output, CLI reporting, visualization, Astro/Svelte
pages and reactive lists, timers/listeners/worker lifecycles, build tooling,
and bundle budgets. The current worksheet-metadata patch and all Cycle 16
reviews, aggregate, and implementation plan were inspected in full.

## RPF17-PERF-001 — analysis context repeats strict calendar validation after dates are known valid

- Severity: **Medium**
- Confidence: **High**
- Status: **Confirmed by source tracing and an isolated bounded benchmark**
- Primary location:
  `packages/core/src/analysis/context.ts:54-65,114-132,145-160`
- Browser call paths:
  `apps/web/src/lib/analyzer.ts:407-425` and
  `apps/web/src/lib/store.svelte.ts:355-394`
- CLI call path: `tools/cli/src/analysis.ts:58-82`
- Scale boundary: `apps/web/src/lib/upload-admission.ts:3-5`

`buildAnalysisContext()` first partitions every transaction with
`isValidIsoDate()` at lines 114-121. That strict validator runs a regular
expression, numeric conversions, `Date.UTC()`, constructs a `Date`, and
round-trips its calendar fields at lines 54-65. Every member of
`validTransactions` is therefore already known to have a canonical
`YYYY-MM-DD` date.

The function nevertheless calls `yearMonthOfDate()`, which repeats the whole
strict validator before slicing the month, in each of three subsequent
transaction-wide passes:

1. the latest-month filter at lines 126-128;
2. the previous-month filter at lines 130-132; and
3. the monthly aggregation at lines 149-160.

The final sorted row also receives another redundant validation when deriving
`latestMonth` at line 125. In the common case, each valid row therefore incurs
one necessary calendar proof followed by three unnecessary regular-expression
and `Date` round-trips.

This synchronous shared-core work runs on the browser window thread. Initial
analysis calls it after parser-worker work has returned and before the
optimizer worker starts at `apps/web/src/lib/analyzer.ts:410-421`;
reoptimization repeats it before loading and invoking the optimizer at
`apps/web/src/lib/store.svelte.ts:359-386`. Upload admission permits 10 MiB per
file, 50 MiB in aggregate, and 50 files, so compact CSV uploads can plausibly
reach six-figure transaction counts. The repeated calendar construction then
adds a visible main-thread interval before optimization can begin. CLI
analysis pays the same CPU cost.

### Reproduction evidence

An isolated Bun probe used pre-sorted, already-valid `YYYY-MM-DD` values and
compared the current three `yearMonthOfDate()` passes with the same month
derivations using `slice(0, 7)`. Five warmups preceded eleven alternating
samples at each size. Both variants produced identical selected-month and
monthly-count outputs.

| Valid rows | Current median | Validated slicing median | Avoidable median |
|---:|---:|---:|---:|
| 100,000 | 87.4 ms | 15.8 ms | 71.6 ms |
| 250,000 | 286.2 ms | 79.5 ms | 206.6 ms |
| 500,000 | 589.9 ms | 196.1 ms | 393.9 ms |

The probe deliberately excludes the first required validation, initial sort,
period construction, safe-integer accumulation, parsing, matching,
optimization, persistence, and rendering. It measures only the avoidable
post-validation month derivations; absolute browser and device timings will
vary.

### Root fix

Keep the first strict partition as the trust boundary. Once a transaction has
entered `validTransactions`, derive its `YearMonth` directly from
`date.slice(0, 7)` (or a private helper whose input type documents the
validated invariant). After deriving `latestMonth` from the already-valid last
row and `previousMonth` from it, one pass over the sorted valid rows can:

- append rows to `latestTransactions` and `previousTransactions`; and
- accumulate `monthly`.

This preserves sorted output order, invalid-date quarantine, safe-integer
checks, and all current result semantics while removing the three repeated
calendar-validation passes. Add parity cases for unsorted input, invalid
dates, leap day, multiple months, and January rollover. A focused
operation-count test or bounded benchmark should also ensure that context
construction performs no more than one calendar round-trip per input date.

## Historical reconciliation

This finding is narrowly about strict calendar validation repeated after the
same dates have already passed the trust boundary. It does not reopen these
existing owners:

- Cycle 2 `C2-P06`
  (`.context/reviews/2026-04-19-cycle2-perf-reviewer.md:81-87`) owns the
  redundant period-date sorts in `dateRange()`. That nearby optimization was
  rediscovered during this pass and rejected as an exact duplicate.
- `P8-01` (`.context/plans/00-deferred-items.md:1052`) owns the necessary full
  monthly-breakdown rebuild during reoptimization. It does not cover repeated
  `Date` construction after validation.
- Cycle 10 `RPF10-PERF-001`
  (`.context/reviews/2026-07-24-rpf-cycle10-perf-reviewer.md:42-68`) owns the
  duplicate exhaustive result-coherence validation after optimization. This
  finding is in pre-optimizer context derivation.
- The known greedy prefix replay, linear merchant matching, optimizer catalog
  cloning/startup, transaction-list rendering, persistence serialization, PDF
  assembly, parser-diagnostic amplification, and JSON field-map allocation
  findings were checked and not duplicated here.

Repository-wide searches for `buildAnalysisContext`, `yearMonthOfDate`,
`isValidIsoDate`, repeated date validation, calendar passes, and `Date.UTC`
found correctness history but no prior performance owner for this root cause.

## Closing sweep

The final missed-issue sweep rechecked all active whole-input loops and sorts,
worker boundaries and cleanup, parser bounds, catalog cardinalities, UI list
growth, persistence copies, scraper concurrency, and bundle/runtime guards.
Cycle 16's worksheet row/column/cell/merge/workbook bounds and interval-indexed
merge lookup are present and distinct from this finding. No second genuinely
new performance issue survived source confirmation and history
deduplication.

No full build, browser, or end-to-end suite was run because this role was
review-only and changed no production code. The six protected untracked Cycle
42 artifacts retained their original hashes. Final new finding count: **1**.
