# Review-plan-fix Cycle 10 — performance reviewer

- Date: 2026-07-24
- Reviewed commit: `56c0f1fcd5b670b20cd972556199f37e3f382d8d`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: CPU and allocation growth, main-thread responsiveness, concurrency,
  worker/resource lifecycle, I/O bounds, rendering scale, and cross-file
  runtime behavior

## Inventory and coverage

The locked snapshot contains 2,252 tracked paths. Its sorted manifest SHA-256
is `9bc49df85b00827a14ffb7916e5a964abc7d4d72c921359803418ec264538598`.
After excluding 1,096 historical `.context` paths, the 1,156-path active
manifest has SHA-256
`1c030d6f0f2323e7dd779d02655cbf942528de24c66dd0de4d3e95cec252bf06`.
The active inventory comprises 167 web paths, 39 core paths, 86 parser paths,
733 rules paths, 14 visualization paths, 28 CLI paths, 35 scraper paths, 19
scripts, 16 E2E paths, and 19 root/config/vendor/other paths.

The performance pass covered upload admission and two-lane parsing; all
browser/server parser families and worker protocols; categorization and
matcher caching; analysis context, result validation, replacement, editing,
and persistence; optimizer scoring, deterministic ordering, worker ownership,
and catalog transfer; catalog fetch/validation/cache lifecycle; every web
renderer and reactive collection; report and terminal sinks; scraper
network/body/timer bounds; CLI and filesystem output; publication/build
scripts; manifests, workflows, generated artifacts, and the authored card
corpus through their schema/publication boundaries. Every current-HEAD source
change was inspected directly, followed by a repository-wide missed-issue
sweep over loops, sorts, clones, JSON transforms, listeners, timers, workers,
abort paths, and unbounded builders.

All historical performance reports and candidate-specific `.context` matches
were checked before classification. This report does not repeat the deferred
incremental optimizer (`D-C1-040`), compiled merchant matcher (`D-C1-041`),
transaction-table virtualization, previously reported persistence
serialization, large-PDF text assembly, parser diagnostic amplification, or
optimizer catalog cloning. No prior report identifies the duplicate
post-worker full-result validation below.

## RPF10-PERF-001 — full transaction coherence validation blocks the main thread twice after optimization

- Severity: Medium
- Confidence: High
- Status: Confirmed
- Primary validation work:
  `apps/web/src/lib/analysis-result.ts:490-495,501-648`
- First normal-analysis call:
  `apps/web/src/lib/analyzer.ts:405-452`
- Duplicate replacement-boundary call:
  `apps/web/src/lib/analysis-replacement-runtime.ts:168-198`
- Edited-result call:
  `apps/web/src/lib/store.svelte.ts:363-434`
- Admitted scale:
  `apps/web/src/lib/upload-admission.ts:3-5`

`buildAnalysisContext()` has already partitioned and sorted the transactions
and built the latest-month periods and monthly breakdown before the optimizer
worker starts. Once that worker returns, `analyzeMultipleFiles()` nevertheless
calls `isAnalysisResultCoherent()` on the window thread. For the complete
transaction array, that validator materializes an ID array and `Set`, filters
valid rows, maps and sorts all year-month values, filters latest and positive
rows, maps amounts, reconstructs the canonical category summary, sorts two
fresh date arrays for the periods, and rebuilds the monthly map.

The normal store path then calls the same validator on the same object again
in `AnalysisReplacementRuntime` before committing it. Neither pass yields,
and both occur after the optimizer's worker-isolated work has completed.
Reoptimization performs one equivalent full pass before persistence. The
current category-witness checks add another latest-month aggregation to this
already allocation-heavy validator.

An executable Bun probe constructed a valid current-schema no-benefit result,
warmed the function, and measured five samples containing the two sequential
calls made by normal analysis:

```text
100,000 transactions: median 233.6 ms
250,000 transactions: median 550.1 ms
500,000 transactions: median 1,236.0 ms
```

The probe measured only the two coherence calls. It excluded parsing,
categorization, optimizer CPU, worker cloning, persistence serialization, and
rendering. Browser and device timings will vary, but each measured duration is
well beyond a 50 ms long-task boundary. The UI admits 10 MiB per file, 50 MiB
in aggregate, and 50 files without a transaction-count cap, so a six-figure
row set is within the supported input envelope.

Concrete failure scenario: a user analyzes several valid CSV statements whose
combined size is below 50 MiB and which contain 100,000 or more transaction
rows. Parsing and optimization can leave the page responsive through their
workers, but immediately after the optimizer replies, the two synchronous
coherence passes freeze input and animation for hundreds of milliseconds
before the result is committed. Larger admitted row sets can make the apparent
completion stall exceed one second.

Suggested fix:

1. Keep the exhaustive validator at the untrusted `sessionStorage`
   deserialization boundary, but do not apply it twice to a freshly produced
   in-memory result.
2. At the analyzer boundary, compare optimizer/category totals directly
   against the already computed `AnalysisContext`, then return an opaque or
   branded validated result so `AnalysisReplacementRuntime` does not rescan it.
3. Where a full transaction validation remains necessary, make one pass that
   tracks unique IDs, min/max dates, latest month, category totals, and monthly
   totals without intermediate `map`/`filter` arrays or full-array sorts.
   For very large sets, perform that work in the existing worker or in
   yieldable chunks.
4. Add a regression that asserts one producer-side validation per analysis
   and a large synthetic benchmark/operation-count guard for the validator.

## Verification and final sweep

- Focused analysis-result, replacement-runtime, and persistence suites:
  146 passed, 0 failed.
- Direct scale probe: confirmed the two-call medians above after warm-up.
- Worker listeners, abort listeners, owned workers, request timers, component
  listeners, request controllers, PDF teardown, and scraper response
  cancellation all had matching cleanup paths.
- The final sweep found no second new, non-duplicate performance issue above
  the evidence threshold.
- No browser/E2E run, product source/test/plan edit, staging, commit, push, or
  deployment was performed.

Final count: **1 new performance finding — 1 Medium (High confidence,
Confirmed).**
