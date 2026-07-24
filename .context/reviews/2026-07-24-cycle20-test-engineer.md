# Review-plan-fix Cycle 20 — test engineer

## Review result

- Date: 2026-07-24
- Revision: `c59938ee5ca5b0c5756e34907330a4eacd2898f9`
- Role: complete test inventory, assertion quality, regression reachability,
  runner topology, resource cleanup, and flake-risk review
- Genuinely new Cycle 20 test roots: **0**
- Supporting regression gaps: **one**, attached to the confirmed Plan 109
  repair obligation `C20-B-001`
- Browser/E2E execution: none
- Product, test, plan, commit, push, and deployment changes: none

The missing case is not an independent finding. The production defect is that
truncated coherence accepts a positive-spending monthly bucket with zero
transactions; the test gap explains why the completed Plan 109 contract could
regress unnoticed.

## Complete test inventory

All **2,424 tracked paths** were inventoried, including 1,252 historical
review/plan records and all 1,172 active paths. The executable test matrix has
**148 test/spec files**:

| Surface | Executable files |
| --- | ---: |
| `apps/web` | 57 |
| `packages/core` | 19 |
| `packages/parser` | 23 |
| `packages/rules` | 7 |
| `packages/viz` | 3 |
| `scripts` | 9 |
| `tools/cli` | 10 |
| `tools/scraper` | 10 |
| Playwright E2E | 10 |
| **Total** | **148** |

The wider test/E2E support inventory has 181 paths when helpers, fixtures,
screenshots, CSS, process code, and runner configs are included.

Runner inclusion was traced from source:

- `bun run test` executes every workspace test through Turbo and then the nine
  script tests.
- `bun run test:bun` supplies the explicit parser/scraper Bun matrix.
- `bunx vitest run` includes 128 files across web, all package suites, CLI,
  and scraper; only the Bun process-spawn CLI suite is deliberately excluded.
- `bun run test:e2e` goes through the owned lifecycle wrapper and the
  regression Playwright config, which ignores only the dedicated screenshot
  capture spec.
- `bun run test:e2e:screenshots` uses the separate screenshot-only config.
- CI runs `verify` and then the owned browser regression suite before any
  Pages artifact can be uploaded.

Every test file and relevant production file was content-scanned. The
test-engineer then reviewed assertion strength and interaction coverage for:

1. parser format/detection/encoding/direction parity and worker boundaries;
2. analysis context, previous-spending provenance, optimizer arithmetic,
   cap-loss telemetry, persistence, reset/replacement, and state races;
3. catalog schema, generation identity, runtime readers, dependency ownership,
   manifests/lock/vendor checks, and documentation drift;
4. CLI process behavior, consent, scraper network/write controls, terminal and
   report sinks;
5. Svelte/static DOM contracts, accessibility, responsive states, request
   boundaries, visual baselines, and E2E core-dist freshness.

## Regression gap attached to C20-B-001

- Severity: **Low**
- Confidence: **High**
- Classification: **confirmed missing regression for a Plan 109 production
  obligation; zero independent new test roots**
- Producer domain:
  `packages/core/src/analysis/context.ts:157-175,189-205`
- Pure truncated validator:
  `apps/web/src/lib/analysis-result.ts:926-984`
- Persistence admission:
  `apps/web/src/lib/persistence.ts:822-844,905-925`
- Existing pure tests:
  `apps/web/__tests__/analysis-result.test.ts:667-843`
- Existing persistence tests:
  `apps/web/__tests__/store-persistence.test.ts:620-720,1756-1769,2121-2142`
- Historical test promise:
  `.context/plans/_archive/109-cycle8-analysis-coherence.md:21-35`

### What the current tests prove

The existing matrix checks:

- explicit truncation provenance is present, exclusive, and positive;
- the represented transaction total is positive and no greater than the
  omitted-transaction count;
- latest-month spending/count agrees with category and optimization facts;
- individual latest-month spending/count mutations are rejected;
- duplicate months, malformed months, unsafe sums, and the `0000-01`
  lower-bound interaction fail closed;
- valid `0000-02 -> 0000-01` and honest oversized round trips remain accepted.

### What it misses

No test inserts an additional non-latest monthly bucket whose fields are
individually valid but relationally impossible:

```text
month: previous calendar month
spending: positive safe integer
transactionCount: 0
```

The current validator adds zero to the represented count, treats the month as
absent when validating `missing-calendar-month`, but preserves the spending.
A direct witness confirms both `isAnalysisResultCoherent()` and
`deserializeAnalysis()` accept this snapshot.

This is exactly the kind of coordinated mutation that Plan 109 promised to
cover: monthly count/spending summaries in a deliberately truncated snapshot.
It is therefore supporting coverage for the existing persistence-coherence
root, not a new test-only issue.

### Required deterministic regressions

1. **Pure coherence rejection:** begin with a valid one-month truncated
   result, insert a previous-month bucket with positive spending/count zero,
   retain a matching `missing-calendar-month` basis, and require `false`.
2. **Persistence rejection:** begin with an honestly serialized oversized
   snapshot, insert the same bucket without changing total/truncated counts,
   and require the standard corrupted/removal result.
3. **Valid zero-spending control:** insert a previous-month bucket with
   `spending: 0`, `transactionCount: 1`, use a matching `statement-month`
   basis, adjust represented/truncated counts, and require acceptance.
4. **Full-snapshot control:** retain the existing exact transaction-backed
   month-map rejection so the fix stays scoped to a shared bucket invariant,
   not a truncation-specific workaround.

The smallest root fix should assert a positive safe-integer monthly
`transactionCount` in both the public pure validator and persistence shape
gate. It must not reject zero spending when at least one transaction exists.

## Assertion-quality audit

No `test.only`, `describe.only`, `skip`, or `todo` marker exists in the
tracked executable suites.

Potentially conditional assertions in old CSV inference tests are preceded by
equal or stronger length assertions, so their bodies are not vacuous. Optional
chaining used with positive equality assertions still fails on `undefined`;
the few negative optional-chain assertions have an earlier presence/shape
proof.

The reviewed Cycle 18/19 tests assert behavior rather than implementation-only
text:

- calendar tests distinguish error class/message, successful low-year
  predecessors, full-context selection, total boolean validation, and
  deserializer classification;
- catalog identity tests mutate legacy full and compact projections and check
  the tracked generated artifacts;
- dependency tests exercise `.mts` and `.cts` production, nested-test, and
  configuration ownership with exact diagnostics.

No assertion rewrite, skip, suppression, snapshot regeneration, or threshold
relaxation is needed for C20-B-001.

## Flakiness and resource audit

The final flake sweep checked:

- wall-clock and RSS thresholds;
- timers, animation frames, and async polling;
- global `fetch`, `console`, `Date.UTC`, `Array.prototype.sort`, and timer
  replacement;
- environment-variable mutation;
- temp directories/files and atomic replacement fixtures;
- random UUIDs and port selection;
- Playwright retries, screenshot policy, trace output, server reuse, and
  browser ownership records;
- process-spawn timeouts and child cleanup.

Mutable globals are restored in `finally`, hooks, or explicit cleanup in the
reviewed tests. Temporary resources use unique directories and cleanup.
Performance tests use median/memory budgets rather than a single startup
sample. Playwright is serial, refuses server reuse, fails CI flakes, and is
wrapped by repository/run/PID/PGID/port attribution.

No new flake root survived. Mixed Bun/Vitest standardization and formal
coverage thresholds retain explicit historical deferrals and were not
reissued. The Cycle 20 review itself did not launch E2E, Playwright, Chrome,
or a preview server, so it added no stale process/profile/port risk.

## Read-only evidence

| Evidence | Result |
| --- | --- |
| Focused analysis + persistence tests | 215 pass, 0 fail, 543 expectations |
| Web `astro check` | 126 files; 0 errors, warnings, or hints |
| Dependency ownership/peer/vendor gate | pass |
| Data and README drift gate | pass; 683 cards, 24 issuers, 551 executable |
| Direct C20-B-001 pure/deserializer probes | defect reproduced |
| Protected untracked artifact hashes | unchanged |

The full E2E gate was intentionally left to the owning Cycle 20 implementation
phase; running it was unnecessary to prove this data-layer regression and
would have introduced browser lifecycle work into a review-only role.

## Historical and cross-agent reconciliation

Archived Plan 109 owns the promised monthly derived-field coherence and
truncated-snapshot mutation matrix. Cycle 18 and 19 tests for YearMonth
closure and validation totality remain green and are not duplicated as new
work.

C20-B-001 should overlap the critic and verifier reports and may overlap
code-reviewer/debugger/tracer/architect. Aggregate all copies as one Plan 109
repair obligation. Do not count this report's regression gap separately.

## Final missed-issue sweep

The closing sweep revisited every executable suite, its runner inclusion, and
the corresponding production boundary for malformed/empty/large inputs,
checked arithmetic, month and count relations, duplicate identities,
unsupported facts, cache generations, cancellation, worker serialization,
network/filesystem failure, output escaping, accessibility, responsive
behavior, browser request routing, and cleanup after failures.

Final test-engineer disposition:

- Genuinely new Cycle 20 findings: **0**
- Regression gaps supporting C20-B-001: **1**
- Additional flaky, skipped, or unreachable suites promoted: **0**
