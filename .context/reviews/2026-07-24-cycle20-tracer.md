# Current causal trace review — Cycle 20

## Review identity

- Date: 2026-07-24
- Baseline: `c59938ee5ca5b0c5756e34907330a4eacd2898f9`
- Role: tracer — execution, state, data, error, cancellation, and persistence
  flows
- Disposition: **no genuinely new Cycle 20 root finding**
- Immutable copy: `.context/reviews/2026-07-24-cycle20-tracer.md`

## Complete inventory

The pass classified all **2,424 tracked paths** before tracing: 192 production
source paths, 181 test/E2E paths, 739 rule/generated-publication paths, 1,252
review/plan provenance paths, and 60 manifests, configs, docs, workflows,
fixtures, and other assets. Every tracked area was enumerated and searched;
critical paths were then read across their full caller/callee boundaries:

- statement admission and normalized facts:
  `packages/parser/src/statement.ts:48-109`,
  `packages/parser/src/shared/transaction-facts.ts:1-224`;
- browser analysis and calendar context:
  `apps/web/src/lib/analyzer.ts:143-465`,
  `packages/core/src/analysis/context.ts:60-207`;
- reward calculation and optimization:
  `packages/core/src/calculator/reward.ts:1-1728`,
  `packages/core/src/optimizer/greedy.ts:1-980`;
- result coherence, persistence, and store epochs:
  `apps/web/src/lib/analysis-result.ts:1-1111`,
  `apps/web/src/lib/persistence.ts:148-925`,
  `apps/web/src/lib/store.svelte.ts:1-356`;
- catalog generation, cache generations, and publication identity:
  `scripts/catalog-publication.ts:97-413`,
  `scripts/build-json.ts:301-499`,
  `apps/web/src/lib/cards.ts:93-508`;
- CLI/report output and cleanup:
  `tools/cli/src/commands/report.ts:1-116`,
  `tools/cli/src/report-output.ts:1-337`,
  `packages/viz/src/report/generator.ts:1-496`.

## Causal hypotheses and dispositions

### Lower-bound calendar data no longer escapes total validation

- Regions:
  `packages/core/src/analysis/context.ts:77-114`,
  `apps/web/src/lib/analysis-result.ts:893-984`,
  `apps/web/src/lib/persistence.ts:905-918`.
- Failure scenario checked: a structurally valid truncated snapshot names
  `0000-01` and a calendar-derived previous-spending basis.
- Current result: coherence returns `false`; deserialization additionally
  converts an unexpected validator exception to its existing invalid result.
- Status: **confirmed resolved history**, Cycle 18/19 provenance, not new.
- Fix: none in Cycle 20. Keep the exact lower-bound and deserialization
  regressions.

### A phantom truncated month remains a Plan 109 repair obligation

- Regions:
  `packages/core/src/analysis/context.ts:137-175,189-205`,
  `apps/web/src/lib/analysis-result.ts:926-984`,
  `apps/web/src/lib/persistence.ts:822-844,867-925`,
  `apps/web/src/components/dashboard/SpendingSummary.svelte:31-37,105-108`.
- Failure sequence confirmed:
  1. a current-version truncated payload supplies June spending of 777,777
     won with `transactionCount: 0` and a normal July bucket;
  2. structural and truncated coherence admit the nonnegative zero count;
  3. previous-spending provenance treats June as absent because it tests
     `count > 0`;
  4. deserialization restores the payload; and
  5. the dashboard nevertheless includes June spending in its all-month sum.
- Direct result: coherence returned `true`; deserialization restored a
  truncated result whose all-month sum was 787,777 won.
- Severity/confidence/status: **Low / High / confirmed current defect**, but
  **historical Plan 109 completion gap**, not a genuinely new Cycle 20 root.
- Fix: require a positive safe-integer count for every persisted/truncated
  monthly bucket in both admission layers; preserve zero spending with a
  positive count; add pure-coherence, deserializer, and honest-control tests.

### Publication projections cannot silently split generations

- Regions:
  `scripts/catalog-publication.ts:97-135,282-413`,
  `scripts/build-json.ts:301-400`,
  `apps/web/src/lib/cards.ts:93-140`,
  `apps/web/src/lib/card-catalog-reader.ts:114-200`.
- Failure scenario checked: a legacy full/compact or issuer-shard projection
  changes while the browser summary retains an old identity.
- Current result: the hash covers the keyed identity-free projection set plus
  both legacy payloads, is injected everywhere, and the first validated
  runtime artifact pins later loads.
- Status: **confirmed resolved history**, Cycle 18 provenance, not new.
- Fix: none; the existing generation-mismatch rejection is the intended
  recovery.

### Unsupported-only catalog entries cannot manufacture recommendations

- Regions:
  `packages/rules/src/card-availability.ts:7-28`,
  `packages/core/src/optimizer/greedy.ts:579-645`,
  `packages/rules/src/optimizer-artifact.ts:1-60`.
- Failure scenario checked: an active but entirely unsupported card enters the
  published catalog and wins a zero or guessed score.
- Current result: catalog visibility intentionally remains broader than
  executable optimization; the optimizer prepares only cards with a supported
  rule and records genuinely unassigned spending.
- Status: **preventive note**, not a defect.
- Fix: none; narrowing the publication artifact would regress browseability.

### Cancellation and output races remain contained

- Regions:
  `apps/web/src/lib/cards.ts:93-105,252-275,278-508`,
  `apps/web/src/lib/store.svelte.ts:183-356`,
  `tools/cli/src/report-output.ts:39-337`.
- Failure scenarios checked: one aborted catalog caller cancels shared work;
  an older analysis overwrites a newer one; a report destination or parent
  directory is swapped during write.
- Current result: caller abort races only that caller, store epochs reject
  stale completion, and retained directory identity plus exclusive/atomic
  filesystem operations fail closed.
- Status: **historical/preventive**, no new root.
- Fix: none.

## Verification and final missed-file sweep

`bun run dependencies:check` passed. Two non-browser focused runs passed
**383 tests**: 248 calendar/coherence/persistence tests and 135
calculator/optimizer/artifact/report-output tests. A final tracked-file,
import/export, exception/catch, async/abort, storage, filesystem/network,
date/number, TODO/suppression, and generated-artifact sweep produced no
genuinely new or unowned causal failure. The one current gap above maps
directly to archived Plan 109. Known upload deduplication, parser duplication,
and shared-fetch lifecycle notes retain historical owners and were not
promoted.

No browser, Chrome, Playwright, E2E, deployment, implementation, plan, or
generated-data mutation was performed. The six protected untracked Cycle 42
artifacts were not touched.

Confirmed new findings: **0**. Likely findings: **0**. Manual-validation-only
findings: **0**. Confirmed historical repair obligations: **1**.
