# Current architecture review — Cycle 20

## Review identity

- Date: 2026-07-24
- Baseline: `c59938ee5ca5b0c5756e34907330a4eacd2898f9`
- Role: architect — ownership, layering, coupling, invariants, and drift
- Disposition: **no genuinely new Cycle 20 root finding**
- Immutable copy: `.context/reviews/2026-07-24-cycle20-architect.md`

## Complete inventory and architecture map

All **2,424 tracked paths** were classified first: 192 production source
paths, 181 test/E2E paths, 739 rule/generated-publication paths, 1,252
historical review/plan paths, and 60 remaining docs, manifests, configs,
workflows, fixtures, and assets. All source, test, documentation, manifest,
workflow, and data families were enumerated and searched; boundary-defining
files and their consumers were read in depth.

| Boundary | Owner and invariant | Consumers checked |
| --- | --- | --- |
| authored card truth | `packages/rules/src/schema.ts`, `catalog-validation.ts`, `data/` | core, generator, CLI, web |
| statement facts | `packages/parser/src/shared/*`, browser/Node adapters | analyzer, CLI, persistence |
| reward/calendar domain | `packages/core/src/analysis/*`, `calculator/*`, `optimizer/*` | web, CLI, viz |
| generated publication | `scripts/catalog-publication.ts`, `build-json.ts` | web readers and CLI compiled reader |
| browser orchestration | `apps/web/src/lib/analyzer.ts`, workers, store | Astro/Svelte routes/components |
| presentation/output | `packages/viz/src/*`, `tools/cli/src/report-output.ts` | terminal and standalone report |

The import sweep confirmed the intended direction: rules supply contracts;
core consumes rules without depending on parser or UI; parser owns statement
normalization; web uses browser-safe package entry points; CLI owns Node
filesystem/remote parsing; viz consumes domain result types.

## Boundary hypotheses and dispositions

### Partial `YearMonth` predecessor is contained by total callers

- Regions:
  `packages/core/src/analysis/context.ts:77-114`,
  `apps/web/src/lib/analysis-result.ts:893-991`,
  `apps/web/src/lib/persistence.ts:905-918`.
- Failure scenario checked: the partial predecessor operation at `0000-01`
  leaks through a boolean coherence predicate or discriminated deserializer.
- Current result: user totals avoid predecessor work, calendar bases reject
  the lower bound as incoherent, and persistence has a defensive catch.
- Severity/confidence/status: no current issue; **resolved Cycle 19 history**
  (previous root was Low / High / confirmed).
- Fix: none. Do not weaken the domain primitive's explicit `RangeError`.

### Monthly-bucket producer invariants are incomplete at the persistence seam

- Regions:
  `packages/core/src/analysis/context.ts:137-175,189-205`,
  `apps/web/src/lib/analysis-result.ts:926-984`,
  `apps/web/src/lib/persistence.ts:822-844,867-925`,
  `.context/plans/_archive/109-cycle8-analysis-coherence.md:7-35`.
- Failure scenario confirmed: a truncated snapshot carries positive spending
  in a zero-transaction prior-month bucket. Persistence restores it while
  provenance treats the month as absent, and the dashboard later sums the
  impossible spending.
- Architectural cause: the canonical producer creates a bucket only while
  counting a transaction, but the DTO/persistence boundary encodes
  `transactionCount >= 0` rather than the producer invariant
  `transactionCount > 0`.
- Severity/confidence/status: **Low / High / confirmed current defect**,
  classified as an archived **Plan 109 coherence-contract completion gap**,
  not a genuinely new Cycle 20 root.
- Fix: express the positive-count invariant in both pure coherence and
  persistence shape admission; keep zero spending valid for a positive-count
  refunds-only month; add rejection and valid-control coverage.

### Publication identity has one authority across all projections

- Regions:
  `scripts/catalog-publication.ts:97-135,282-413`,
  `scripts/build-json.ts:301-400`,
  `apps/web/src/lib/catalog-publication-identity.ts:1-24`,
  `apps/web/src/lib/cards.ts:93-140`.
- Failure scenario checked: summary, optimizer, categories, detail shards, or
  legacy artifacts from different generator states are accepted together.
- Current result: a two-phase identity-free build hashes the complete keyed
  payload set, then injects one identity; runtime consumers pin the first
  validated generation.
- Severity/confidence/status: no issue; **resolved Cycle 18 history**.
- Fix: none.

### Browseability and executable optimization are deliberately distinct

- Regions:
  `packages/rules/src/card-availability.ts:7-28`,
  `packages/rules/src/optimizer-artifact.ts:1-60`,
  `packages/core/src/optimizer/greedy.ts:579-617`,
  `tools/cli/src/card-catalog.ts:28-84`.
- Failure scenario checked: an unsupported-only active card either disappears
  from catalog/detail surfaces or participates in guessed reward math.
- Current result: recommendation eligibility governs catalog presence;
  executable eligibility governs scoring. This is an explicit contract, with
  unassigned spending providing the honest optimizer outcome.
- Severity/confidence/status: **preventive note**, not a finding.
- Fix: none; merging the two predicates would collapse a useful architectural
  distinction.

### Defensive validation does not reverse package dependencies

- Regions:
  `packages/parser/src/shared/transaction-facts.ts:47-56,185-224`,
  `packages/core/src/calculator/reward.ts:28-35,1074-1101`,
  `apps/web/src/lib/tx-validation.ts:1-98`,
  `scripts/check-dependencies.ts:8-22,465-509`.
- Failure scenario checked: core imports parser-owned normalization, or a
  browser bundle reaches a Node-only package surface. The duplicated 200 L
  guard was also checked for semantic drift.
- Current result: parser owns canonical fact admission; core retains a
  matching defense for direct callers without introducing a reverse
  dependency; web imports browser entry points. The dependency gate includes
  `.mts` and `.cts` in its single extension authority.
- Severity/confidence/status: **historical/preventive**, no new root.
- Fix: none. A future shared fact-contract package would be a redesign, not a
  Cycle 20 defect fix.

### Stateful side effects stay at adapters

- Regions:
  `apps/web/src/lib/store.svelte.ts:117-356`,
  `apps/web/src/lib/cards.ts:93-105,252-508`,
  `tools/cli/src/report-output.ts:39-337`,
  `tools/scraper/src/network-policy.ts:1-324`.
- Failure scenario checked: stale async completion mutates current UI state,
  shared cache ownership leaks caller cancellation, or domain code performs
  network/filesystem writes.
- Current result: epochs, caller-local abort races, adapter-owned caches, and
  guarded output services keep effects outside pure domain packages.
- Severity/confidence/status: no issue; older cache/parser/output discussions
  retain historical ownership.
- Fix: none.

## Final sweep and verification

The final sweep revisited package exports, import graph, package manifests,
browser/Node splits, DTO validation, worker protocols, persistence migrations,
generation/write phases, output sinks, workflows, root configs, README
claims, and all Cycle 18/19 changed contracts. The one live coherence gap
above reconciles exactly to Plan 109 rather than a new root. Known parser
duplication, same-name/same-size upload deduplication, optimizer complexity,
and static-host constraints remain historical or deferred; they were not
relabeled as new.

`bun run dependencies:check` passed. Focused non-browser suites passed
**383 tests** across calendar/coherence/persistence and
calculator/optimizer/artifact/report-output boundaries.

No browser, Chrome, Playwright, E2E, deployment, implementation, plan, or
generated-data change was made. Protected untracked Cycle 42 artifacts were
not touched.

Confirmed new findings: **0**. Likely findings: **0**. Manual-validation-only
findings: **0**. Confirmed historical repair obligations: **1**.
