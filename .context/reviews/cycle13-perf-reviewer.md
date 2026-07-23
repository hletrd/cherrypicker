# Review-plan-fix Cycle 13 — performance reviewer

- Date: 2026-07-24
- Reviewed revision: `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: CPU and allocation growth, browser/CLI responsiveness, concurrency,
  cancellation/backpressure, worker/resource lifecycle, I/O bounds, rendering
  scale, and cross-file runtime behavior
- Disposition: **1 genuinely new finding — 1 Medium**
- Scope: review and this report only; no implementation, source/test/config or
  generated-artifact change, staging, commit, push, deployment, browser,
  preview server, or E2E run

## Inventory and coverage

The exact Git tree contains **2,318 tracked paths**: **1,152** tracked
`.context` paths and **1,166** active product, data, test, documentation,
workflow, configuration, and vendor-integrity paths. The active inventory
contains 878 package paths, 171 web paths, 63 tool paths, 19 scripts, 16 E2E
paths, and 19 root/workflow/configuration/vendor paths. It includes all 683
authored card YAML files and the 682-card compiled optimizer artifact, of which
551 cards are executable by the current optimizer.

The specialist sweep covered:

- upload admission, quick detection, the two-lane parse queue, every
  browser/server parser family, parser and PDF worker ownership, cloning and
  cancellation;
- categorization and matcher construction/cache costs, calendar/performance
  context, result validation, replacement, persistence, reoptimization, and
  browser rendering;
- reward-rule selection, cap/occurrence state, calculator allocations, greedy
  scoring, alternatives, best-single evaluation, optimizer worker transfer,
  and synchronous CLI optimization;
- catalog schema/semantic validation, generated projections and loaders,
  terminal/standalone output, scraper DNS/fetch/body/LLM/write bounds,
  repository generation scripts, bundle budgets, workflow gates, and current
  documentation.

Known open costs were not relabeled: the incremental optimizer (`D-C1-040` /
`D-C10-02`), compiled merchant matcher (`D-C1-041`), transaction-table
virtualization, parser source duplication/streaming and whole-workbook work,
large-PDF text assembly, persistence serialization, bounded-diagnostic
residuals, optimizer-catalog cloning, and historical HTML allocation work all
retain their existing owners. The finding below isolates a new cost added
after the Cycle 12 performance baseline.

## Finding

### RPF13-PERF-001 — shared-cap coherence is rebuilt on every hot-path reward replay

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed by an executable current-catalog differential; no
  browser/manual validation is required to establish the core regression
- **New validation and allocations:**
  `packages/core/src/calculator/reward.ts:74-121`
- **Per-call invocation:**
  `packages/core/src/calculator/reward.ts:742-752`
- **Repeated optimizer callers:**
  `packages/core/src/optimizer/greedy.ts:195-230,295-309,359-390,405-445,
  603-624`
- **Browser worker boundary:**
  `apps/web/src/lib/optimizer/worker-runner.ts:52-135`;
  `apps/web/src/lib/analyzer.ts:253-259`
- **Synchronous CLI callers:**
  `tools/cli/src/commands/optimize.ts:91-97`;
  `tools/cli/src/commands/report.ts:95-101`
- **Existing one-time semantic validator:**
  `packages/rules/src/catalog-validation.ts:407-459`;
  `scripts/build-json.ts:197-207`

Commit `2812cea` correctly added
`assertCoherentCapGroupMonthlyCaps()`. It scans every supported reward and tier,
creates an outer `Map`, creates another `Map` for each cap group, and rejects
conflicting monthly caps. `calculateRewards()` invokes that structural check
unconditionally before evaluating transactions.

That is appropriate at the public calculator boundary, where a direct caller
may provide an unvalidated mutable rule. It is not appropriate inside the
optimizer's replay loop. `scoreCardsForTransaction()` calls the calculator
twice per executable card and transaction. Assignment construction,
counterfactual alternatives, card results, and best-single evaluation call it
again. Every call receives the same card-rule object, but no prepared/validated
identity or cache survives to the next call.

The generated artifact has already passed the same cap-group coherence rule at
publication. Authoring-mode CLI catalogs also pass `validateCardCatalog()`
before optimization. Even for an arbitrary direct optimizer caller, one
validation per distinct card at the optimizer boundary is sufficient to fail
before scoring; reconstructing the same maps on every replay adds no safety.

### Executable current-catalog differential

I made an isolated exact-HEAD copy outside the repository and removed only the
single hot-path call to `assertCoherentCapGroupMonthlyCaps()`. The helper,
calculator, optimizer, card artifact, transactions, and every other statement
were unchanged. After warm-up, current and comparison runs alternated order.
They returned byte-identical JSON results.

For the real 682-card artifact and 100 valid categorized transactions:

```text
calculateRewards calls:          125,075
new coherence Maps created:      451,946
supported reward visits:         326,871
tier-definition visits:          737,954

five-sample median
current HEAD:                    267.6 ms
without repeated valid-card check:
                                 221.8 ms
added time:                       45.8 ms (20.6%)
```

The same alternating five-sample comparison measured:

| Transactions | Current HEAD | Without only the repeated check | Delta |
| ---: | ---: | ---: | ---: |
| 50 | 128.7 ms | 105.6 ms | +23.0 ms / 21.8% |
| 100 | 267.6 ms | 221.8 ms | +45.8 ms / 20.6% |
| 200 | 515.0 ms | 452.2 ms | +62.8 ms / 13.9% |

A fresh-process 1,000-transaction run returned the same ₩1,326,730 reward and
70 assignments in both variants, but current HEAD took 3,455.5 ms versus
3,153.8 ms: **301.7 ms of avoidable latency**. Peak RSS was 270.3 MB versus
269.5 MB because the short-lived maps are collected; CPU and allocation/GC
churn, rather than retained memory, are the material regression.

- **Concrete impact:** a 100-row statement pays roughly half a 100 ms response
  budget only to re-prove immutable card structure. A 1,000-row statement pays
  about 300 ms. The browser keeps the main thread responsive by running this
  work in an owned worker, but result readiness is delayed and battery/CPU work
  increases. CLI `optimize` and `report` perform the same extra work
  synchronously before producing output.
- **Why this is not the deferred optimizer finding:** the existing replay
  architecture determines how many calculator calls occur. This regression
  multiplies those already known calls by a newly added rule/tier scan and
  hundreds of thousands of short-lived maps. It can be removed without
  implementing incremental reward state, changing assignment semantics, or
  weakening direct-calculator validation.
- **Suggested fix:** introduce a prepared, immutable/opaque calculator input.
  `greedyOptimize()` should validate and compile each distinct card once before
  its transaction loop, then use an internal prepared-card calculation path
  for marginal, alternative, card-result, and best-single replays. The public
  `calculateRewards()` entry must continue validating untrusted direct input.
  Do not use a bare `WeakSet` unless card-rule immutability is enforced, because
  a caller could mutate a previously validated object. As a smaller first
  step, preflight every optimizer card once and pass a private validation
  capability to the calculator. Add malformed shared-group tests at both
  public boundaries, output-parity tests for prepared versus direct
  calculation, and an operation-count regression requiring at most one
  structural cap validation per card per optimization run.

## Historical and same-cycle reconciliation

Before classification I indexed and candidate-searched all `.context` files
then present, including the 1,152 tracked records, six protected Cycle 42
artifacts, current Cycle 13 sibling reports, all prior performance reports, the
deferred register, Plan 72, completed Plan 129, and recent Cycle 7–12
aggregates/plans.

`RPF13-PERF-001` is not an incomplete historical performance fix:

- `D-C1-040` and `D-C10-02` own the optimizer's replay complexity and eventual
  incremental accumulator. They predate `assertCoherentCapGroupMonthlyCaps()`.
- Cycle 11 reported boundary-regex work newly multiplied by the deferred
  merchant full scan. This finding applies the same duplicate rule: it reports
  only the newly introduced constant-factor work, not the pre-existing call
  count.
- Cycle 12's performance review ran at
  `e72a4c69f7c0eab7053c61a587c2d040760c236c`, before commit `2812cea`.
  Plan 129 and its completion evidence describe correctness and validation but
  do not assess or budget hot-path validation frequency.
- Full-history searches for the helper name, cap-group map rebuilding,
  calculator validation frequency, and per-call structural validation found no
  prior owner.

Competing candidates were rejected rather than inflated:

- Browser cap disclosure now maps and renders `capsHit`, but all current
  supported per-transaction clips that can emit events also have a monthly or
  global ceiling. The current artifact therefore did not establish an
  unbounded DOM list, and Cycle 12 already considered per-transaction cap
  telemetry without promoting it.
- The repaired CLI remote-consent path performs digest integrity checks, but
  only for explicitly remote-enabled parsing; they preserve a security
  boundary and did not clear a separate latency threshold.
- A designer-owned headless upload attempt left a Chrome renderer busy, but
  produced no DOM, console, stack, or repeatable product evidence. It remains
  inconclusive rather than a performance finding.
- The prefixed/leading-NUL XLSX ZIP-inflation hypothesis remains rejected. No
  new proof bypassed offset-zero archive dispatch or the existing budgets.

## Verification and final missed-issue sweep

- The current-catalog differential confirmed the timings, counters, identical
  outputs, and 1,000-transaction fresh-process result above. Its temporary
  comparison tree was outside the repository and was moved to Trash after the
  probe.
- `bun test packages/core/__tests__/cycle12-cap-identity-coherence.test.ts
  packages/core/__tests__/optimizer.test.ts
  packages/rules/__tests__/catalog-validation.test.ts` passed **89 tests, 265
  expectations, 0 failures**.
- No browser, E2E, preview/dev server, full repository gate, staging, commit,
  push, or deployment command was run in this role.

The closing sweep revisited every active nested loop, sort, clone/transfer,
large string/array builder, cache, reactive collection, timer/listener/worker
owner, abort path, queue release/yield, response/file/archive budget, CLI and
scraper I/O boundary, generated-data gate, and the current code delta. No
second new, non-duplicate performance issue met the evidence threshold.

The six protected Cycle 42 artifacts remained byte-identical. The only
repository path written by this role is
`.context/reviews/cycle13-perf-reviewer.md`.

**Final count: 1 new performance finding — 1 Medium (High confidence,
Confirmed).**
