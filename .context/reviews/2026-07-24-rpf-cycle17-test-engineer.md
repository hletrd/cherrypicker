# Review-plan-fix Cycle 17 — test engineer

## Review identity

- Date: 2026-07-24
- Revision: `857e12a794e585560a0c447b0a1619def02cbcf3`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Role: test architecture, coverage, assertions, runner reach, isolation,
  flake risk, and regression design
- Disposition: no genuinely new test-engineer-only finding
- Scope: read-only source and test review, bounded focused checks, and this
  report only. No source, test, fixture, generated artifact, runner,
  configuration, plan, commit, deployment, or external state was changed.

## Exhaustive inventory

The exact Git tree contains 2,374 tracked paths: 1,204 tracked `.context`
records and 1,170 active paths. Every active production, generated-data,
configuration, test, fixture, and E2E path was classified before the
candidate-specific review.

The test/E2E inventory contains exactly 180 tracked paths:

| Surface | Executable unit/integration files | E2E specs | Helpers, fixtures, or assets | Total |
| --- | ---: | ---: | ---: | ---: |
| `apps/web` | 57 | 0 | 0 | 57 |
| `packages/core` | 19 | 0 | 0 | 19 |
| `packages/parser` | 23 | 0 | 26 | 49 |
| `packages/rules` | 7 | 0 | 0 | 7 |
| `packages/viz` | 3 | 0 | 0 | 3 |
| `tools/cli` | 10 | 0 | 0 | 10 |
| `tools/scraper` | 10 | 0 | 1 | 11 |
| `scripts` | 8 | 0 | 0 | 8 |
| `e2e` | 0 | 10 | 6 | 16 |
| **Total** | **137** | **10** | **33** | **180** |

The 147 executable files contain 3,502 `describe`, `test`, or `it`
declarations. No committed test contains `.skip`, `.todo`, or `.only`.

Production-contract coverage included:

- browser upload admission, parser dispatch/workers, analysis,
  reoptimization, optimizer dispatch, persistence, catalog loading, and
  result/card UI consumers;
- server parser formats and shared decoding, date, amount, archive, worksheet,
  and merge kernels;
- core calendar context, performance qualification, reward evaluation,
  numeric guards, cap state, and greedy optimization;
- rules schemas, authored catalog loading, validation, availability, and
  publication;
- CLI analysis, catalog loading, commands, and report sinks;
- scraper arguments, network policy, extraction, schema quarantine, and
  output;
- visualization aggregation, terminal sinks, standalone HTML, escaping, and
  CSP;
- catalog, dependency, toolchain, bundle, migration, workflow, and E2E process
  scripts; and
- all manifests, lock data, TypeScript configs, `bunfig.toml`, Turbo, Vitest,
  both Playwright configs, Astro config, and the deployment workflow.

## Runner, assertion, and isolation assessment

- The root Bun/Turbo test route reaches all 137 unit/integration files,
  including the eight repository-script files.
- Vitest reaches the seven workspace test trees. It intentionally excludes
  `tools/cli/__tests__/command-process.test.ts`, which remains Bun-owned, and
  does not own `scripts/__tests__`. Its `bun:test` shim therefore complements
  rather than silently replaces the Bun route.
- `bunfig.toml` excludes `e2e/**` from unit discovery. The regression
  Playwright config selects nine specs; the screenshot config selects the
  tenth. Regression runs are serialized, CI retries twice, and
  `failOnFlakyTests` is enabled. The E2E launcher owns and cleans up its
  processes.
- Candidate-adjacent suites mostly use exact result, diagnostic, count, byte,
  or call assertions. The Cycle 16 worksheet suite is especially strong:
  exact-limit and one-over cases, cumulative totals, all-sheet validation,
  malformed metadata, direct helper calls, server/browser parity, and normal
  behavior are asserted.
- Global `fetch`, timers, environment variables, console methods, temporary
  directories, listeners, and workers were checked for restoration. The
  reviewed tests reset caches and mocks, use `finally`/lifecycle hooks, or
  have owned process cleanup. No concrete order-dependent or leaking test was
  retained.
- Two files that import Vitest directly were also run with Bun
  (`packages/parser/__tests__/amount.test.ts` and
  `packages/core/__tests__/public-api.test.ts`): 31 tests and 63 expectations
  passed. No present cross-runner behavior divergence was reproduced.

## Existing roots and required regressions

The missing coverage below confirms the current four owners. A missing test is
not counted as a fifth defect when its failure mechanism is the same
production root.

### `C17-CR-001` — heterogeneous legacy reward ranking

- Existing coverage: `scripts/__tests__/catalog-publication.test.ts` strongly
  covers canonical publication values, supported/unsupported rows, identity,
  and deterministic projections. No test references `pickBestTier`,
  `getTierComparableValue`, `rewardValueKind`, `bestValueKind`,
  `byCategoryIndex`, or the cross-kind `slice(0, 5)` behavior in
  `scripts/build-json.ts:79-86,248-271,373-404`.
- Coverage risk: the tested pure publication layer preserves kind and unit,
  while the untested generator branch discards those dimensions for ordering
  and truncation.
- Required regression:
  1. Extract the legacy index/compact projection into a side-effect-free
     function.
  2. Use a table containing percentage, fixed-per-transaction, fixed-per-day,
     mileage-per-spend, and per-liter rewards.
  3. Assert that incomparable kind/unit groups are never globally ranked or
     truncated against one another.
  4. If a contextual cross-kind rank is retained, assert the explicit purchase,
     performance, cap, and usage scenario and prove that changing the scenario
     can change the order.
  5. Assert deterministic ordering only within comparable groups and exact
     generated artifact semantics.

### `RPF17-PERF-001` — strict calendar validation is repeated

- Existing coverage:
  `apps/web/__tests__/analysis-context.test.ts` and
  `packages/core/__tests__/analysis.test.ts` cover invalid dates, leap years,
  month selection, January rollover, previous-month provenance, totals, and
  overflow behavior. They assert correctness but not how many strict calendar
  proofs occur.
- Coverage risk: output remains correct while every valid row receives four
  strict validations, so all correctness tests stay green.
- Required regression:
  1. Keep table-driven parity for unsorted rows, invalid rows, leap day,
     multiple months, missing predecessor month, January rollover, and an
     explicit previous-month total.
  2. Add a deterministic operation-count seam proving at most one strict
     calendar validation per input row. Do not make wall-clock timing the
     blocking unit assertion.
  3. Compare every returned field before and after the one-validation
     implementation, including row identity/order, periods, monthly buckets,
     invalid-date quarantine, and previous-spending provenance.
  4. Keep a non-blocking bounded benchmark for six-figure valid input so a
     future change cannot casually restore the main-thread pass.

### `C17-SEC-001` — category data is interpolated into TypeScript

- Existing coverage: rules schema tests cover category structure and the
  current catalog; `scripts/__tests__/readme-catalog.test.ts` only verifies
  regeneration documentation. No test round-trips source-significant category
  strings through the fallback generator or parses the generated TypeScript.
- Coverage risk: current benign data and the checked-in module compile, but an
  ordinary apostrophe accepted by the schema makes the next generated module
  invalid.
- Required regression:
  1. Extract fallback-module projection into a pure function over category
     tuples.
  2. Cover apostrophes, backslashes, newlines, carriage returns, Unicode,
     template-marker text, and closing-tag-like text in both IDs and labels.
  3. Parse/transpile the emitted module and compare its `Map` entries exactly
     with the input tuples; textual substring assertions alone are
     insufficient.
  4. Assert duplicate bare and qualified keys according to one documented
     policy.
  5. Run the same generator test in check mode so authored data cannot pass
     schema validation but fail only at the later web build.

### `C17-DEP-001` — the web test does not own `iconv-lite`

- Existing coverage:
  `scripts/__tests__/check-dependencies.test.ts` asserts the current
  production-import graph and many lock/peer/integrity fixtures. The scanner
  in `scripts/check-dependencies.ts:553-595` inventories workspace `src`
  paths and production `dependencies`; it has no test/config import fixture
  and no development-dependency ownership assertion.
- Coverage risk:
  `apps/web/__tests__/parser-cycle5-integrity.test.ts:3,48-50` passes because
  the full workspace hoists parser's `iconv-lite`, so the test that needs the
  declaration also masks its absence.
- Required regression:
  1. Give the import scanner a compact temporary-workspace fixture seam.
  2. Assert that a package imported only by a test/config file fails when it
     is absent from both dependency sets.
  3. Assert that the same import passes when declared as a development
     dependency and that production imports still require the production
     dependency set.
  4. Encode narrow repository-level exemptions for shared runners explicitly;
     do not infer ownership from a transitive package being resolvable.
  5. Keep the CP949 parity scenario after either adding the web development
     dependency or moving fixture encoding behind an owner-declared helper.

## Fifth hypothesis adjudication

The root `zod` development declaration was examined as a possible fifth
candidate. No root script/config/E2E source imports it directly, and the
current dependency checker does not enforce an unused-declaration policy.
However, rules and scraper both own compatible direct Zod declarations, the
root generator executes rules schemas, the lock already has one shared
identity, and no isolated install, command, build, or user failure was
demonstrated from the root declaration. This is at most manifest-minimization
hygiene, not a distinct current defect. It is not retained.

If the project chooses to enforce minimal declarations in the future, the
policy should use explicit command/config exemptions and fixture tests rather
than treating every package absent from a static `src` grep as unused.

## Bounded verification

The focused candidate and current-repair matrix was:

```text
bun test \
  scripts/__tests__/catalog-publication.test.ts \
  scripts/__tests__/check-dependencies.test.ts \
  apps/web/__tests__/analysis-context.test.ts \
  apps/web/__tests__/parser-cycle5-integrity.test.ts \
  apps/web/__tests__/cycle16-worksheet-metadata.test.ts \
  packages/rules/__tests__/schema.test.ts
```

Result: 163 passed, 0 failed, with 3,241 expectations. The focused
`bun scripts/check-dependencies.ts` command also passed. These green results
are expected: the four candidate-specific regression contracts above are
absent.

Cycle 16's repair remains well specified by its 17 focused tests: exact and
one-over worksheet/merge bounds, per-sheet and cumulative totals, later-sheet
validation, direct merge-index callers, server/browser XLSX and HTML paths,
and ordinary parity all passed within this matrix.

## History and closing sweep

All 1,204 tracked `.context` records, including the complete Cycle 16 set,
Plan 143, current reports available at review time, archived plans, deferred
items, and prior test/runner findings, were searched. Existing owners for
runner unification, browser matrix breadth, parser duplication, DOM harnesses,
date-array sorting, monthly rebuilds, and generator testability were not
reopened. None owns the four exact regression omissions above as a separate
test-only root.

The final sweep reconciled all 180 test/E2E paths to their runners and
production boundaries, rechecked skipped/focused tests, weak assertions,
mutable globals, timers, temporary paths, listeners, workers, processes, and
candidate-specific searches. No independent flake, runner divergence, or
fifth production root survived.

No full verify, build, data regeneration, browser, Playwright, deployment, or
external-system command was run. Protected untracked Cycle 42 artifacts were
not opened, edited, staged, removed, or adopted.

Final result: **0 new test-engineer findings; four existing roots confirmed
with concrete regression requirements**.
