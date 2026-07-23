# Review-plan-fix Cycle 13 — architect

## Provenance and disposition

- Review date: 2026-07-24
- Reviewed revision: `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: dependency direction, layering, contract ownership, validation
  lifecycle, state and worker boundaries, failure isolation, and extensibility
- Architect verdict: **confirm both current Cycle 13 roots at Medium / High
  confidence; no third genuinely new architect finding**
- Counting: the two confirmed roots remain owned by `C13-CR-001` /
  `C13-CT-001` / `RPF13-TE-001` / `RPF13-VER-001` and
  `RPF13-PERF-001`. This report does not assign duplicate architect IDs.
- Scope: review and this report only; no implementation, source, test, plan,
  generated artifact, staging, commit, push, browser/E2E, workflow dispatch,
  or deployment

## Inventory and architecture coverage

The locked tree contains **2,318 tracked paths**: **1,152** tracked `.context`
paths and **1,166** active product, data, test, documentation, configuration,
workflow, and vendor-integrity paths. The active inventory contains 878
package paths, 171 application paths, 63 tool paths, 19 scripts, 16 E2E paths,
and 19 root/workflow/configuration/vendor paths. It includes all 683 authored
card YAML files and the 682-card optimizer artifact, with 551 currently
executable cards.

Before classification I indexed and candidate-searched all **1,165**
`.context` files then present: the 1,152 tracked records, six protected Cycle
42 artifacts, and all seven earlier Cycle 13 specialist reports. I directly
reconciled the deferred ledger, recent Cycle 6–12 architect reports and
aggregates, Plans 104, 110, 121, 127, 129, 130, and 136, and every historical
hit for cap exhaustion, loss telemetry, repeated validation, optimizer
replays, and prepared inputs.

The production package direction remains acyclic:

```text
web     -> core, parser, rules
core    -> rules
viz     -> core, rules
CLI     -> core, parser, rules, scraper, viz
scraper -> rules, viz
```

`bun run dependencies:check` confirmed the declared/imported graph and
vendored identities. No production package imports an application. The
architecture sweep followed:

1. statement admission -> parser worker -> normalized facts -> categorization
   -> analysis context -> optimizer worker -> decoded result -> replacement,
   persistence, Svelte state, and browser presentation;
2. card YAML and taxonomy -> schema/semantic validation -> deterministic
   publication and shared identity -> browser/CLI readers -> core calculator
   and optimizer;
3. cap/rule execution state -> worker/coherence/persistence DTOs -> browser,
   terminal, and standalone-report sinks;
4. CLI local/remote byte ownership, scraper network/extraction/quarantine,
   generated-data gates, and PR/build/deployment privilege boundaries.

## Current candidate 1 — confirmed: an event DTO is used as an analysis-wide loss summary

- **Aggregate aliases:** `C13-CR-001`, `C13-CT-001`, `RPF13-TE-001`,
  `RPF13-VER-001`
- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed by an independent current-card calculator/optimizer
  reproduction; no manual validation is required
- **Domain contract:** `packages/core/src/models/result.ts:25-35`
- **Exhaustion decision:** `packages/core/src/calculator/reward.ts:314-388,
  451-559`
- **Transaction exit and event creation:**
  `packages/core/src/calculator/reward.ts:807-845,1025-1040`
- **Optimizer projection:** `packages/core/src/optimizer/greedy.ts:207-250,
  405-444,514-535`
- **Browser interpretation:** `apps/web/src/lib/cap-disclosures.ts:23-50`;
  `apps/web/src/components/ui/CapDisclosures.svelte:20-35`
- **Terminal/standalone interpretation:**
  `packages/viz/src/cap-disclosure.ts:16-29`;
  `packages/viz/src/terminal/summary.ts:86-95`;
  `packages/viz/src/terminal/comparison.ts:77-87`;
  `packages/viz/src/report/generator.ts:415-430`
- **Current catalog witness:**
  `packages/rules/data/cards/bc/baro-clear-plus.yaml:20-23,75-106`

### Architectural assessment

`CapInfo` is structurally an event: its `actualReward` and `appliedReward`
describe the purchase that reached or crossed a cap. The type names those
fields only as what “you would get” and “actually get”; it does not state the
event scope, carry a transaction identity, represent later cap-blocked
spending, or claim to be an aggregate.

The calculator follows the event interpretation. Once a rule/shared or global
cap is exhausted, `previewRuleAvailability()` returns `inapplicable`.
`findRules()` may try another rule, but otherwise the transaction exits before
reward execution and before a second `CapInfo` can be created. An earlier
exact-reaching event correctly retains equal actual/applied values.

The presentation layers silently strengthen that contract. Browser and viz
subtract the two event fields, then turn zero into the unqualified
analysis-level conclusion `혜택 손실 없음`. The browser section explicitly
says it reports money not received because of caps. Worker decoding,
coherence validation, and persistence preserve and shape-check the DTO, but
none can recover semantic information that the producer never emitted.

I independently loaded `bc-baro-clear-plus`, used its supported tier-1 Coupang
rule, and evaluated two 50,000-Won purchases at 150,000 Won previous spending.
Current HEAD returned:

```json
{
  "calculator": {
    "totalSpending": 100000,
    "totalReward": 5000,
    "capsHit": [{
      "capType": "monthly_category",
      "capAmount": 5000,
      "actualReward": 5000,
      "appliedReward": 5000,
      "ruleId": "reward-002",
      "capGroup": "reward-002"
    }]
  },
  "optimizer": {
    "totalSpending": 100000,
    "totalReward": 5000,
    "unassignedSpending": 50000,
    "cardResultSpending": 50000
  },
  "browser": {
    "lostReward": 0,
    "outcome": "혜택 손실 없음"
  }
}
```

The first purchase exactly consumed the 5,000-Won cap. The second purchase had
another 5,000-Won pre-cap benefit under the same supported rule, but no
contract records that it was rejected because the cap was already full. The
reward and assignment totals are internally coherent; the explanation is
false. This is why Medium, rather than High, is appropriate.

### Root repair

Keep reach telemetry and aggregate consequences as different domain concepts.
At minimum, rename/document the current shape as an event and narrow exact-hit
copy to “no clipping on the cap-reaching purchase”; do not infer a whole-run
no-loss statement from equality.

If numeric loss is required, core must own a typed exhaustion result with an
explicit scope and stable card/rule/cap identity. It must distinguish:

- gross reward suppressed for one card by its exhausted cap;
- fallback reward earned from another rule or card; and
- net portfolio-level benefit loss.

That distinction belongs before localization. A naive counter in the greedy
scoring loop would double-count candidate-card replays, so aggregation must be
based on a defined final-evaluation pass, not presentation arithmetic.
Worker/coherence/persistence schemas should then transport and validate the
new semantic type. Tests need exact-at-end controls, exact-then-later cases,
clipped plus later cases, rule/shared/global caps, additive/exclusive fallback,
alternate-card assignment, and all-unassigned inputs.

## Current candidate 2 — confirmed: validation preparation is coupled to every execution replay

- **Aggregate alias:** `RPF13-PERF-001`
- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed by source-level lifecycle tracing and the isolated
  output-identical current-catalog differential
- **Structural guard:** `packages/core/src/calculator/reward.ts:74-121`
- **Unconditional execution:** `packages/core/src/calculator/reward.ts:742-752`
- **Replay callers:** `packages/core/src/optimizer/greedy.ts:195-230,
  295-309,359-390,405-445,603-624`
- **Canonical catalog validation:**
  `packages/rules/src/catalog-validation.ts:407-459`;
  `scripts/build-json.ts:197-207`
- **Browser worker boundary:**
  `apps/web/src/lib/optimizer/worker-runner.ts:52-135`;
  `apps/web/src/lib/analyzer.ts:253-259`
- **CLI catalog boundary:** `tools/cli/src/card-catalog.ts:31-80`

### Architectural assessment

The new coherence guard is correct at an untrusted public calculator boundary:
an arbitrary mutable `CardRuleSet` must not make transaction order choose
between conflicting shared monthly caps. The problem is that
`calculateRewards()` combines two lifecycle phases:

```text
validate/prepare immutable card structure -> execute transactions
```

`greedyOptimize()` then treats that combined public function as its private
replay primitive. It passes the same card definition through the structural
phase twice per card/transaction during scoring and again for assignments,
alternatives, card results, and best-single comparison. The canonical artifact
already passed catalog validation at publication; authoring-mode CLI input is
validated by `loadCliCardCatalog()`. An arbitrary direct optimizer caller also
needs validation, but only once per distinct card for that invocation.

The performance differential removed only the repeated call from an isolated
exact-HEAD copy and retained byte-identical results. On the real artifact and
100 transactions, current HEAD made 125,075 calculator calls and allocated
451,946 coherence maps; the five-sample median was 267.6 ms versus 221.8 ms,
or 45.8 ms / 20.6% slower. A 1,000-transaction run added about 301.7 ms with
the same reward and assignments. The worker isolates browser responsiveness,
but it cannot remove result latency, CPU, or battery cost; CLI callers pay it
synchronously.

This is distinct from deferred `D-C1-040` / `D-C10-02`. Those own the older
greedy history replay and eventual incremental accumulator. The new structural
phase was added by commit `2812cea` and can be hoisted without changing the
greedy algorithm.

### Root repair

Split preparation from execution:

1. Core should expose or internally create an opaque `PreparedCardRule` that
   validates execution invariants and compiles tier/rule/cap identities once.
2. Public `calculateRewards()` should prepare arbitrary input and then call a
   private prepared execution path, preserving its current defensive contract.
3. `greedyOptimize()` should prepare each distinct card once inside the worker
   or CLI invocation and use only the opaque representation for all replays.
4. Do not use a process-global bare `WeakSet`; a caller can mutate a previously
   validated object. Use an invocation-scoped immutable snapshot/capability or
   enforce actual immutability.

Malformed shared groups must still fail through both public entry points.
Prepared/direct result parity and an operation-count assertion should require
at most one structural validation per distinct optimizer card.

## Historical and same-cycle reconciliation

- Cycle 7/Plan 104 and Cycle 8/Plan 110 own the fixed absence of exact cap
  reach events. They correctly require equal actual/applied values for the
  reaching purchase. The first candidate begins with a later eligible
  purchase and the newer analysis-wide copy.
- Deferred `D-29` concerned zero-benefit assignment after cap exhaustion.
  That assignment behavior was changed; it did not own the subsequently added
  no-loss assertion.
- Plans 127, 130, and 136 own plural identity, cap-period copy, and browser
  presentation. None defines post-exhaustion loss scope.
- Cycle 10 `RPF10-PERF-001` concerned duplicate exhaustive analysis-result
  coherence validation on the browser main thread and was fixed by Plan 121.
  It is not this rule/tier map rebuild inside core reward replays.
- Plan 129 introduced the correct shared-cap invariant but did not assign a
  preparation lifecycle or performance budget.
- Parser/application duplication, handwritten runtime-schema drift,
  analysis-result ownership, replacement/persistence state machines, catalog
  projection/browser-reader duplication, navigation state, CLI custom
  taxonomy binding, optimizer/matcher redesigns, streaming/virtualization,
  and parser/resource work retain fixed, rejected, or deferred owners.
- The prefixed/leading-NUL XLSX inflation hypothesis remains rejected; no new
  offset-zero archive-dispatch evidence appeared.

The same-cycle code, test, critic, and verifier reports independently converge
on the first root. The performance and critic reports converge on the second.
They should be aggregated as **two** findings, not multiplied by reviewer
count.

## Verification and final missed-issue sweep

- `bun run dependencies:check` passed.
- **136 focused tests, 497 expectations, 0 failures** passed across exact cap
  state, shared-cap coherence, browser/viz disclosure, catalog validation,
  optimizer-worker decoding/ownership, analysis coherence, and persistence.
- The independent live-card probe reproduced the calculator, optimizer, and
  browser result shown above.
- No browser, E2E, server, workflow dispatch, full repository gate, commit,
  push, or deployment was run by this role.

The closing sweep revisited public exports and deep imports; framework/domain
ownership; parser adapters and worker terminal states; analyzer replacement,
abort, and persistence ordering; handwritten clone/storage decoders; catalog
projection identity and stale-shard failure; scraper trust promotion; CLI
input ownership; workflow privilege direction; and all active changes since
the Cycle 12 architect baseline. No third concrete, non-duplicate architecture
failure survived.

The six protected Cycle 42 artifacts remained byte-identical. The only
repository path written by this architect role is
`.context/reviews/cycle13-architect.md`.

**Final architect count: 0 additional findings. Aggregate recommendation:
retain 2 current Cycle 13 Medium findings, both High confidence and
Confirmed.**
