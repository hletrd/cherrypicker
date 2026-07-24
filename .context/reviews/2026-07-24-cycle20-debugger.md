# Cycle 20 debugger review

## Review identity

- Date: 2026-07-24
- Baseline: `c59938ee5ca5b0c5756e34907330a4eacd2898f9`
- Role: debugger — latent failures, competing hypotheses, exception paths,
  races, cleanup, and regressions
- Disposition: **no genuinely new Cycle 20 root finding**
- Immutable copy: `.context/reviews/2026-07-24-cycle20-debugger.md`

## Complete inventory

The debugger inventory covered all **2,424 tracked paths**: 192 production
source paths, 181 test/E2E paths, 739 rule/generated-publication paths, 1,252
review/plan provenance paths, and 60 other docs/config/workflow/asset paths.
All families were enumerated and searched for thrown/caught errors, rejected
promises, abort and worker ownership, stale epochs, storage admission,
date/number boundaries, unsafe casts, network/filesystem cleanup, temporary
files, generated-data drift, TODOs, and suppressions. Suspect paths were traced
through callers, tests, and historical owners before disposition.

## Competing hypotheses

### H1 — lower-bound persisted data can still throw during restore

- Regions:
  `packages/core/src/analysis/context.ts:77-114`,
  `apps/web/src/lib/analysis-result.ts:893-984`,
  `apps/web/src/lib/persistence.ts:720-742,905-918`.
- Concrete failure attempted: truncated current-v4 state reports latest month
  `0000-01` with either a user-total or calendar-derived basis.
- Evidence: user-total returns before predecessor construction; calendar
  bases return incoherent at the lower bound; persistence catches any
  remaining coherence exception and produces `invalidResult()`.
- Status: **confirmed resolved Cycle 19 history**, not new.
- Current fix: none. Retain the lower-bound coherence and persistence tests.

### H2 — a zero-count truncated month carries phantom spending

- Regions:
  `packages/core/src/analysis/context.ts:137-175,189-205`,
  `apps/web/src/lib/analysis-result.ts:926-984`,
  `apps/web/src/lib/persistence.ts:822-844,867-925`,
  `apps/web/src/components/dashboard/SpendingSummary.svelte:31-37,105-108`.
- Concrete reproduction: a current-version truncated result contains
  `{month: "2026-06", spending: 777777, transactionCount: 0}` before a valid
  July bucket and declares June missing for previous-spending purposes.
- Observed result: `isAnalysisResultCoherent(...)` returned `true`;
  `deserializeAnalysis(...)` restored it with `warningKind: "truncated"` and
  `shouldRemove: false`; the monthly sum was 787,777 won.
- Cause: both admission paths accept a nonnegative count while the producer
  can create a monthly bucket only by incrementing its count.
- Severity/confidence/status: **Low / High / confirmed current defect**;
  historical **Plan 109 completion gap**, not a genuinely new Cycle 20 root.
- Fix: require a positive safe-integer monthly transaction count at both
  boundaries, preserve zero spending with positive count, and add pure,
  deserializer, and valid-control regressions.

### H3 — an unsupported-only card or zero reward corrupts optimizer totals

- Regions:
  `packages/rules/src/card-availability.ts:7-28`,
  `packages/core/src/optimizer/greedy.ts:579-980`,
  `packages/core/src/calculator/reward.ts:1-1728`.
- Concrete failure attempted: an active unsupported-only card wins a tie, or
  positive spending with no modeled reward vanishes from result accounting.
- Evidence: only executable cards are prepared; zero best scores are not
  assigned; spending and count are accumulated in explicit unassigned fields;
  calculator and optimizer boundary checks reject non-finite, fractional, and
  unsafe money.
- Status: **rejected hypothesis / preventive note**.
- Fix: none.

### H4 — report writing follows a swapped symlink or commits through a
replaced directory

- Regions:
  `tools/cli/src/report-output.ts:39-337`,
  `tools/cli/__tests__/report-output.test.ts:1-247`.
- Concrete failure attempted: replace the final path or an intermediate
  directory between validation, temporary-file creation, and rename.
- Evidence: trusted directory device/inode and canonical path are retained and
  rechecked; new files use `O_EXCL | O_NOFOLLOW`; overwrites use a private
  synced temporary file and atomic rename; cleanup avoids unlinking through a
  replaced path. Thirteen focused race/symlink cases passed.
- Status: **rejected hypothesis**, older output-hardening provenance.
- Fix: none.

### H5 — caller cancellation poisons shared catalog caches or stale analysis
overwrites current state

- Regions:
  `apps/web/src/lib/cards.ts:93-105,252-275,278-508`,
  `apps/web/src/lib/store.svelte.ts:183-356`,
  `apps/web/src/lib/analysis-replacement-runtime.ts:1-156`.
- Concrete failure attempted by trace: one caller aborts while another awaits
  the same artifact; an older analyze/reoptimize completion arrives after a
  newer operation.
- Evidence: caller signals race their own wait and never own the shared
  controller; failed shared promises clear only their matching cache entry;
  store operation epochs gate every completion and cleanup.
- Status: **historical/preventive**, no new reproducible failure.
- Fix: none. The known same-name/same-size upload identity limitation remains
  deferred and is not a Cycle 20 regression.

### H6 — a generator-only change can reuse stale publication identity

- Regions:
  `scripts/catalog-publication.ts:97-135,282-413`,
  `scripts/build-json.ts:301-400`,
  `apps/web/src/lib/cards.ts:131-140`.
- Concrete failure attempted by trace: change a compact legacy field or detail
  shard without changing source YAML, then mix it with an older artifact.
- Evidence: the canonical hash input includes all split projections and both
  legacy payloads; every emitted artifact receives that hash; the browser
  rejects a later mismatch.
- Status: **confirmed resolved Cycle 18 history**, not new.
- Fix: none.

## Verification

- `bun run dependencies:check`: passed.
- Calendar/coherence/persistence selection: **248 passed, 0 failed**.
- Calculator/optimizer/artifact/report-output selection:
  **135 passed, 0 failed**.
- Combined non-browser verification: **383 passed, 0 failed**.
- Direct phantom-month probe: coherence `true`, restored `true`, truncated
  warning retained, all-month spending 787,777 won.

No E2E or browser suite was started, so this review created no Chrome or
Playwright process to terminate. No deployment, implementation, plan, or
generated-data mutation occurred.

## Final missed-file sweep

The final sweep rechecked the complete tracked inventory plus package entry
points, configs, workflows, README, worker protocols, parser format adapters,
catalog YAML/public outputs, CLI/scraper services, UI persistence, and Cycle
18/19 deltas. Invalid-date direct-call concerns, parser duplication, upload
deduplication, shared-fetch cancellation, and output hardening were matched to
existing history or deferred ownership. The one live defect above is owned by
Plan 109; no genuinely new or unowned failure survived.

The protected six untracked Cycle 42 artifacts were not touched.

Confirmed new findings: **0**. Likely findings: **0**. Manual-validation-only
findings: **0**. Confirmed historical repair obligations: **1**.
