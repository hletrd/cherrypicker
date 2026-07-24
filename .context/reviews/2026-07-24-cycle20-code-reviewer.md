# Review-plan-fix Cycle 20 — code reviewer

## Review identity

- Date: 2026-07-24
- Reviewed revision: `c59938ee5ca5b0c5756e34907330a4eacd2898f9`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Role: correctness, edge cases, failure handling, maintainability, and
  cross-package contracts
- Scope: whole tracked repository and documentation, with Cycle 18 and Cycle
  19 treated as resolved provenance
- Review mode: read-only except for this report; no implementation, plan,
  generated-data, Git-history, browser, E2E, publication, or deployment change

## Complete inventory and coverage

The inventory was built before source inspection. The reviewed revision has
2,424 tracked paths:

| Classification | Paths | Coverage |
| --- | ---: | --- |
| Historical/current `.context` reviews and plans | 1,252 | Inventoried and searched for ownership, rejection, deferral, and novelty; current, active, deferred, and Cycle 18/19 records were read directly |
| Authored card YAML | 683 | All entered the canonical schema, publication, and documentation drift check |
| Generated/public compatibility artifacts | 30 | Reconciled through their generator, readers, shared identity, schema versions, and drift checks |
| Tests and E2E source | 181 | Inspected for contract coverage, missing edges, process ownership, and false-green paths |
| Production source | 211 | Inspected across web, core, parser, rules, viz, scripts, CLI, and scraper |
| Documentation | 29 | Repository, contributor, vendor, and all issuer documentation included |
| Manifests/configuration/workflow | 21 | Workspace, compiler, task, test, browser, build, dependency, and CI policy inspected |
| Fixture | 1 | Included with its parser contract |
| Other tracked assets | 16 | Templates, vendor integrity metadata, and repository support files included |

The cross-file trace followed authored input through schema validation and
publication; browser/CLI file admission through parsing, categorization,
calendar selection, optimization, coherence, rendering, and persistence; and
scraper input through network, model-quarantine, validation, and durable-write
boundaries. The six protected untracked Cycle 42 files were identified only
from `git status` and were not opened, searched, or modified.

## Result

No genuinely new Cycle 20 code-review root survived review.

| Classification | Count | Severity | Confidence | Failure scenario | Recommended fix |
| --- | ---: | --- | --- | --- | --- |
| Confirmed new | 0 | Not applicable | High for reviewed interactions | None | None |
| Likely new | 0 | Not applicable | Medium-high whole-tree negative confidence | None | None |
| Manual-validation-only new | 0 | Not applicable | Medium-high | None | None |

## Current-baseline closure checks

### Cycle 19 lower-bound validation is closed

`previousCalendarMonth()` remains deliberately partial at
`packages/core/src/analysis/context.ts:96-114`. Its boolean consumer now
validates `user-total` without deriving a predecessor, and returns `false` for
calendar-derived bases at `0000-01`
(`apps/web/src/lib/analysis-result.ts:893-924`). Both truncated and
transaction-backed paths pass month-membership callbacks rather than
precomputing the predecessor
(`apps/web/src/lib/analysis-result.ts:926-984,991-1097`). The persistence
boundary converts any unexpected final coherence exception to its normal
corrupted result (`apps/web/src/lib/persistence.ts:905-925`).

The former failure scenario was a structurally admitted, transaction-free v4
snapshot whose latest month was `0000-01`: coherence and deserialization could
throw instead of failing closed. Focused regressions now prove user-total
acceptance, calendar-derived rejection, the `0000-02 -> 0000-01` control,
full-transaction rejection, and persistence cleanup. This is resolved Cycle
19 provenance, not a Cycle 20 finding.

### Cross-layer invariants remain aligned

- Calendar construction validates exact ISO dates and branded months before
  selection (`packages/core/src/analysis/context.ts:60-114,124-175`).
- The analyzer uses one context for latest-month optimization and provenance
  (`apps/web/src/lib/analyzer.ts:286-425`), then admits only a coherent result
  (`apps/web/src/lib/analysis-result.ts:991-1111`).
- Parser and optimizer workers terminate on every terminal path and reject
  malformed messages (`apps/web/src/lib/parser/worker-runner.ts:79-143`;
  `apps/web/src/lib/optimizer/worker-runner.ts:62-136`).
- File parsing has generation ownership, cancellation, deterministic ordered
  consumption, and a two-lane cap
  (`apps/web/src/lib/file-parse-queue.ts:1-148`;
  `apps/web/src/lib/analyzer.ts:320-386`).
- Catalog readers structurally validate split artifacts and enforce one
  publication identity before caching them
  (`apps/web/src/lib/card-catalog-reader.ts:75-209`;
  `apps/web/src/lib/cards.ts:95-165,253-424`).

## Candidate disposition and historical ownership

| Candidate and exact region | Concrete failure scenario considered | Disposition / fix |
| --- | --- | --- |
| Lower-bound predecessor propagation — `packages/core/src/analysis/context.ts:96-114`; `apps/web/src/lib/analysis-result.ts:893-924`; `apps/web/src/lib/persistence.ts:905-925` | A stored `0000-01` truncated snapshot makes a boolean validator throw | **Resolved Cycle 19, non-new.** Basis-aware validation and defensive deserialization are present; no further fix indicated. |
| Full analysis context at year zero — `packages/core/src/analysis/context.ts:63-75,124-154` | A directly constructed `0000-01-xx` transaction might reach the partial predecessor helper | **Rejected/non-new.** Full transaction dates in year 0000 fail the documented ISO-date admission before predecessor use; supported statement parsers are narrower. Retain the Cycle 18/19 policy. |
| Complete catalog identity — `scripts/catalog-publication.ts:93-136,353-412`; `scripts/build-json.ts:301-400` | One generated projection could be mixed with another publication | **Resolved Cycle 18, non-new.** Identity-free full/compact/browser projections share one injected identity and drift checks passed. |
| Module-TypeScript dependency discovery — `scripts/check-dependencies.ts:11-22,465-510,532-692` | A production `.mts` or `.cts` import could evade manifest ownership | **Resolved Cycle 18, non-new.** Both extensions enter the same static classifier. |
| Optimizer replay, matcher scale, parser duplication, category-cache choices, static-host CSP limits, storage/privacy, and compatibility payloads | Existing complexity or policy limitations could be relabeled as current defects | **Historical duplicates, non-new.** They retain explicit deferred or prior-review owners; Cycle 20 introduced no new reachability or failure mechanism. |

## Read-only verification

- `bun run toolchain:check`: passed with Bun 1.3.12.
- `bun run dependencies:check`: passed manifest, import, peer, and vendored
  archive policy.
- `bun audit --json`: returned `{}`.
- `bun run data:check`: parsed 683 cards across 24 issuers; all generated
  projections and the 683-card/551-optimizer-card README catalog matched.
- `bun run lint`: all workspaces passed; Astro reported zero errors, warnings,
  and hints.
- `bun run typecheck`: all seven workspaces passed; Astro reported zero
  diagnostics.
- Eight focused coherence, persistence, worker, rule-security, and scraper
  suites: 319 tests passed, 0 failed, with 1,076 expectations.
- `bun scripts/check-web-bundles.ts`: all bundle and catalog budgets passed.
- `git diff --check` from the Cycle 17 closure through reviewed HEAD: passed.

## Final missed-issue sweep

The closing pass rechecked all predecessor consumers, exception-to-result
boundaries, unsafe numeric accumulation, transaction-sized sorts, worker and
abort ownership, stale-operation commits, cache rejection/reset behavior,
parser format dispatch and resource limits, schema/generator/reader agreement,
filesystem writes, dynamic markup, dependency classification, and historical
ownership. No second correctness or maintainability root, likely issue, or
manual-validation-only issue survived.

No browser process was started or terminated by this reviewer. No deployment
or publication command was invoked.

Final new code-review finding count: **0**.
