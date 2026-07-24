# Review-plan-fix Cycle 18 — performance reviewer

## Review identity

- Date: 2026-07-24
- Revision: `c182c8144a4284bae1f28f009a5b0930d7762d5c`
- Role: performance, concurrency, CPU and memory behavior, I/O amplification,
  parser scaling, web responsiveness, build/runtime cost, and shared-state
  review
- Disposition: **no genuinely novel actionable finding**
- Scope: read-only repository review plus this report; no source, plan, test,
  configuration, generated-artifact, git, or process changes

## Inventory and coverage

The complete tracked manifest contained 2,394 paths. Its SHA-256 manifest hash
was `aaa29e56a6f33df7b4556c30c105a3381a0cf14d464f7a8ef9d83513a084154e`.
The 1,172 paths outside `.context` had manifest hash
`9682f3440d2416a10c9b05660d629937e9d0fdaab5c3a1c61cf3cf3d`.
Every tracked path was included in the inventory:

| Area | Tracked paths |
|---|---:|
| `.context/plans` | 318 |
| `.context/reviews` | 904 |
| `apps/web` | 172 |
| `e2e` | 16 |
| `packages/core` | 47 |
| `packages/parser` | 86 |
| `packages/rules` | 734 |
| `packages/viz` | 14 |
| `scripts` | 21 |
| `tools/cli` | 28 |
| `tools/scraper` | 35 |
| Root, workflow, configuration, documentation, and vendored metadata | 19 |

The implementation pass covered parser format adapters and browser workers;
CSV, JSON, OFX, HTML, PDF, and worksheet limits; archive and decoded-workbook
bounds; upload admission and two-lane scheduling; worker, timer, listener, and
abort lifecycles; analysis context; reward calculation; matcher, taxonomy, and
greedy optimizer hot paths; result validation and persistence; catalog
generation, sharding, loading, and caching; Svelte reactive lists and
dashboard rendering; Astro and bundle configuration; CLI parsing, analysis,
report generation, and atomic output; scraper networking, bounded response
assembly, extraction, validation, and output; visualization aggregation and
rendering; build/publication/check scripts; e2e process support; dependency
metadata; and the vendored SheetJS integrity boundary.

## Current-HEAD assessment

No performance root survived both source confirmation and historical
deduplication.

The Cycle 17 date-validation finding is closed at current HEAD:
`packages/core/src/analysis/context.ts:114-162` validates and projects each
transaction month once, sorts the projection, and builds the latest,
previous, and monthly views in one pass. The Cycle 16 decoded worksheet
metadata finding is likewise closed by the shared row, column, logical-cell,
workbook, and merge limits and interval-indexed merge lookup.

The final candidate sweep rejected the following as non-novel or
non-actionable:

- Greedy marginal scoring, repeated full reward calculation, best-single-card
  evaluation, previous-spending resolution, and nearby array/map construction
  remain owned by `D-09`, `D-51`, `D-79`, `D-92`, `D-93`,
  `C20-PERF01`, `C34-D02`, and `PERF-39-03`.
- Linear taxonomy and matcher work remains owned by `D-100` and the Cycle 1
  matcher deferral. The more recent compiled merchant-boundary repair is
  present at current HEAD.
- HTML-as-XLS decoding, HTML row-string allocation, PDF line/column work, CSV
  whole-input parsing, parser diagnostic amplification, JSON field-map
  allocation, and browser worker materialization already have explicit
  current or archived owners. Current archive, worksheet, file-count, and
  byte limits prevent relabeling those roots as new unbounded-input defects.
- Long transaction-list rendering, persistence serialization, catalog worker
  startup/cloning, and full-result coherence checks have existing owners or
  later repairs. The current immutable-result validation cache prevents the
  previously reported duplicate main-thread coherence pass.
- The scraper assembles at most 5 MiB, enforces one operation deadline and
  redirect bound, cancels response bodies on failure, and decodes the bounded
  bytes once. No leak or unbounded network-to-memory path was found.
- The build generator's sequential YAML reads and shard writes are
  build-only, cardinality-bounded work. No measured or user-visible failure
  mode justified a new finding. Similarly, synchronous visualization template
  loading occurs once in the one-report CLI path rather than in a loop or
  request server.
- Upload `File` references are bounded by the existing 50-file/50-MiB
  admission policy and live only in the upload workflow. Source tracing did
  not establish unbounded heap growth or a stale cross-operation reference,
  so this was not retained.

## Historical reconciliation

All 1,222 tracked `.context` paths were included in the history inventory and
searched candidate-by-candidate across current and archived plans, specialist
reports, aggregates, completed repairs, explicit deferrals, and rejected
hypotheses. In particular, the sweep reconciled the recent merchant-boundary,
result-validation, parser-diagnostic, UTF-8 decoding, consent-byte,
shared-cap-coherence, append-telemetry, worksheet-metadata, and
validated-month repairs. It also retained the existing deferrals for optimizer
complexity, matcher/taxonomy scans, HTML/PDF/CSV allocation, persistence, and
long-list rendering without presenting them as Cycle 18 discoveries.

The six protected untracked Cycle 42 artifacts were identified only from
repository status. They were not opened, searched, hashed, or modified.

## Closing missed-issue sweep

The closing sweep rechecked whole-input loops and sorts, nested optimizer
replays, parser byte-to-object expansion points, structured-clone boundaries,
shared mutable caches, concurrent caller cancellation, worker termination,
event-listener cleanup, timers, retained `File`/buffer references, synchronous
window-thread work, reactive collection growth, report/string assembly,
filesystem read/write amplification, scraper response limits, build
cardinality, and bundle/catalog guards. Cross-file browser and CLI call paths
were traced through their ordinary entry points and cleanup paths.

No additional candidate produced a current, reachable failure scenario that
was both material at supported limits and absent from repository history.
Therefore there are no severity, confidence, or validation-status entries to
report for Cycle 18.

No build, test, browser, benchmark, or end-to-end process was run because this
role was review-only and made no production change. Final new finding count:
**0**.
