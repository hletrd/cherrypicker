# Review-plan-fix Cycle 14 — test engineer

- Date: 2026-07-24
- Reviewed revision: `5260bbd9b6f44ff35cf1bb9a11819354003e5161`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **0 genuinely new findings**
- Scope: review and this report only; no implementation, source/test/config,
  generated-artifact, plan, staging, commit, push, deployment, browser,
  preview-server, or E2E change/run

## Inventory and test architecture

I classified all **2,337 tracked paths** before reviewing the test system:
**1,169** tracked `.context` paths and **1,168** active product, data, test,
documentation, workflow, configuration, and vendor-integrity paths. The active
tree contains 145 runnable unit/E2E specification files:

| Test family | Files |
| --- | ---: |
| Web unit and source-contract tests | 56 |
| Core | 18 |
| Parser | 23 |
| Rules/catalog | 7 |
| Visualization/reporting | 3 |
| CLI | 10 |
| Scraper | 10 |
| Repository scripts/workflow/process controls | 8 |
| Playwright E2E specifications | 10 |
| **Total** | **145** |

The root `test` command delegates workspace tests through Turbo and then runs
the repository-script tests with Bun. Lint, typecheck, data, dependency,
audit, migration, test, and web-build gates are composed under `verify`;
Playwright remains a separate process-owned gate. No active test is marked
`.skip`, `.only`, `.todo`, or `.fixme`.

The audit mapped implementation to tests across every workspace and inspected
the root/workspace manifests, Bun lockfile, Turbo/Bun/Vitest/TypeScript/Astro/
Playwright configuration, repository scripts and workflow contracts, E2E
process ownership, fixtures, generated-data gates, and current documentation.
It covered all 55 paths changed since the Cycle 13 review baseline
`3e2d663`, plus the unchanged parser, rules, CLI, scraper, visualization, and
web integration boundaries needed for a repository-wide failure-mode sweep.

## Findings

No reproducible, user-impacting test deficiency that is both open at this HEAD
and genuinely new relative to the archived reviews and plans survived the
evidence and history checks.

## Changed-contract and cross-layer review

The Cycle 13 repairs were traced through their full contracts:

- Post-cap loss telemetry now flows from calculator suppression capture through
  optimizer reconciliation into `OptimizationResult.portfolioCapLosses`.
  Worker decoding, analysis coherence, persistence and legacy restoration,
  store replacement, the 4 MiB storage bound, web disclosures, terminal and
  standalone HTML output, CLI pass-through, and the exact browser regression
  all have matching positive, empty, unknown, malformed, duplicate, and
  oversized-state coverage.
- Prepared reward validation is shared by both public calculator entry points.
  Malformed shared-cap groups, prepared replay/projection equivalence, stateful
  occurrence/day behavior, and optimizer integration are covered without
  weakening the ordinary `calculateRewards()` boundary.
- The Bun lock peer checker exercises required and optional peers, exact/caret/
  OR/prerelease ranges, scoped packages, workspace peers, nearest-owner
  resolution, root fallback, malformed lock rows, and the repaired Astro
  optional-peer witness.
- The duplicate-transaction-ID editor change is covered by stable-index tests
  that distinguish repeated identifiers while preserving the intended update
  target.

The closing repository sweep revisited amount/date/format boundaries,
CSV/XLSX/PDF/JSON/HTML/OFX and browser/server parser parity, worker settlement,
categorization, reward and cap order, prepared-state replay, optimizer
assignment invariants, persistence/replacement/migration behavior, catalog
validation and publication, CLI subprocess and consent boundaries, scraper
network/extraction/writer behavior, report escaping and sinks, fake timers,
retries, temporary paths, runner portability, workflow inclusion, and
generated-artifact identity. No unowned oracle, flake, or integration-contract
failure was confirmed.

## Historical reconciliation and rejected candidates

I indexed and candidate-searched all **1,175** `.context` files present before
this report: 1,169 tracked records plus the six protected Cycle 42 artifacts.
The Cycle 10–13 test reviews and aggregates, deferred register, current plans,
and Plans 138–140 were read against the current implementation.

- A synthetic multi-card probe and a live `kb-all` probe reached the branch
  where a cap-free counterfactual is worse than the selected stronger fallback,
  causing `portfolioCapLosses` to remain `undefined`. This is not a new defect:
  Plan 138 explicitly defines `undefined` as unknown and records that negative
  offsets, hidden/cross-card state, unsafe arithmetic, and cap-free winner ties
  fail closed rather than publish a positive-only overstatement
  (`138-cycle13-post-cap-loss-telemetry.md:131-149`). The current tests lock
  that conservative contract.
- The Svelte cap “wiring” regression still uses source inspection, but the
  missing rendered component harness is already owned by the Plan 70 deferral.
  Current numeric/coherence tests and the exact Playwright specification cover
  the repaired production path; no distinct rendering failure was reproduced.
- Mixed Bun/Vitest coverage debt, old parser-parity candidates, historical
  browser-timing concerns, and E2E temporary-process cleanup are already fixed,
  deferred, or previously rejected and had no new failing evidence at this
  revision.
- The historical prefixed/leading-NUL XLSX inflation hypothesis was not
  promoted: there is still no new production fixture, failing boundary, or
  current behavioral evidence supporting it.

## Verification and final missed-issue sweep

- Focused Cycle 13 contract run:
  `bun test packages/core/__tests__/cycle13-cap-loss-telemetry.test.ts
  packages/core/__tests__/cycle13-prepared-cap-validation.test.ts
  apps/web/__tests__/analysis-result.test.ts
  apps/web/__tests__/cap-disclosures.test.ts
  apps/web/__tests__/optimizer-worker.test.ts
  apps/web/__tests__/store-persistence.test.ts
  packages/viz/__tests__/cycle7-cap-disclosure.test.ts
  scripts/__tests__/check-dependencies.test.ts`
  — **306 passed, 0 failed, 1,013 expectations across 8 files**.
- Broad non-browser run:
  `bun test packages/core packages/parser packages/rules packages/viz
  apps/web/__tests__ tools/cli tools/scraper scripts/__tests__`
  — **3,203 passed, 0 failed, 13,748 expectations across all 135 non-E2E
  specification files**.
- `git diff --check 3e2d663..HEAD` and the local `git diff --check` both
  completed cleanly.
- The 10 Playwright specifications were inspected statically. No browser,
  E2E, preview/dev server, full build, or full `verify` command was run in this
  role.

The six protected Cycle 42 artifacts remained untouched. The only path written
by this role is `.context/reviews/cycle14-test-engineer.md`.

**Final count: 0 new findings.**
