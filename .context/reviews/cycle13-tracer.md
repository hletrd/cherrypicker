# Review-plan-fix Cycle 13 — tracer

## Revision lock and disposition

- Date: 2026-07-24
- Reviewed revision: `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: causal source → state → sink tracing, competing hypotheses, failure
  modes, alternative causes, and historical ownership
- Verdict: **2 current Cycle 13 root causes independently confirmed; 0 unique
  tracer additions**
- Aggregate count: **2 Medium, both High confidence and Confirmed**
- Scope: review and this report only; no implementation, source/test/config,
  generated artifact, plan, staging, commit, push, deployment, browser,
  preview server, or E2E run

The first root is already described under the same-cycle aliases
`C13-CR-001`, `C13-CT-001`, `RPF13-TE-001`, and `RPF13-VER-001`. The second
retains `RPF13-PERF-001`. This report does not mint duplicate tracer IDs.

## Inventory and trace method

The exact Git tree contains **2,318 tracked paths**: **1,152** tracked
`.context` records and **1,166** active product, data, test, documentation,
workflow, configuration, and vendor-integrity paths.

| Family | Tracked paths |
| --- | ---: |
| `packages` | 878 |
| `apps` | 171 |
| `tools` | 63 |
| `scripts` | 19 |
| `e2e` | 16 |
| Root/workflow/configuration/vendor | 19 |
| `.context` | 1,152 |

The active tree includes 683 authored card YAML files, a 682-card compiled
optimizer artifact, and 551 currently executable cards. The complete sorted
tracked-path manifest SHA-256 is
`af023ceb841754a802816c05ee6ede12823f6a7316099a7f03ddd0f49b00a5cd`;
the 1,166-path non-`.context` manifest hashes to
`c2a5477df81359722ca37509f76be9be4090b2a8fdb87f9c1d9684e76d23e6c1`.

Before classification I indexed all **1,166 `.context` files then present**:
the 1,152 tracked records, six protected Cycle 42 artifacts, and eight earlier
Cycle 13 reports. I directly reconciled the deferred ledger, recent
aggregates, Plans 104, 110, 121, 127, 129, 130, and 136, and every historical
hit for exact exhaustion, post-exhaustion transactions, cap-loss wording,
optimizer replay, repeated validation, prepared inputs, and shared-cap
coherence. Late architect and verifier reports were included before close.

The current Cycle 12 repair range changes 56 paths across cap identity and
wording, scraper admission/provenance, CLI byte ownership and root parsing,
source contrast, browser cap disclosure, workflow verification, tests, and
completion documentation. I traced those changed producers through runtime
state, worker/persistence boundaries, and browser/terminal/report sinks, then
performed a repository-wide missed-issue sweep.

## Causal summary

| Root | Producer | Lost or repeated state | Observable sink |
| --- | --- | --- | --- |
| Exact reach followed by later eligible spending | Cap availability changes a positive rule to undifferentiated `inapplicable` | No cap-blocked reason or potential reward survives; the prior exact reach event remains equal actual/applied | Browser, terminal, and standalone report infer analysis-wide `혜택 손실 없음` from the event-local equality |
| Shared-cap coherence in calculator replay | A correct structural scan runs at every `calculateRewards()` entry | The same rules/tiers are rescanned and new maps rebuilt for every immutable-card replay | Browser worker result latency and CPU/battery use; synchronous CLI latency |

## Confirmed root 1 — exact cap exhaustion hides later cap-blocked reward while dedicated disclosures report no loss

- **Aggregate aliases:** `C13-CR-001`, `C13-CT-001`,
  `RPF13-TE-001`, `RPF13-VER-001`
- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed on current HEAD
- **Manual validation:** Not required
- **Event DTO:** `packages/core/src/models/result.ts:25-35`
- **Availability producer:** `packages/core/src/calculator/reward.ts:314-388`
- **Rule selection:** `packages/core/src/calculator/reward.ts:451-559`
- **Cap state and transaction exit:**
  `packages/core/src/calculator/reward.ts:767-780,807-845`
- **Event emission:**
  `packages/core/src/calculator/reward.ts:953-990,1025-1040`
- **Exact-event predicate:**
  `packages/core/src/calculator/reward.ts:605-641`
- **Optimizer projection:**
  `packages/core/src/optimizer/greedy.ts:207-250,405-445,514-535`
- **Browser sink:** `apps/web/src/lib/cap-disclosures.ts:23-50`;
  `apps/web/src/components/ui/CapDisclosures.svelte:20-35`
- **Terminal/report sinks:**
  `packages/viz/src/cap-disclosure.ts:16-29`;
  `packages/viz/src/terminal/summary.ts:86-97`;
  `packages/viz/src/terminal/comparison.ts:77-89`;
  `packages/viz/src/report/generator.ts:415-435`
- **Existing green sequence:**
  `packages/core/__tests__/cycle7-exact-reward-cap-state.test.ts:326-349`
- **Current-card witness:**
  `packages/rules/data/cards/bc/baro-clear-plus.yaml:20-23,75-106`

### Source → state

`previewRuleAvailability()` reads `globalRemaining` and
`capGroupMonthUsed`. If the global cap has no remaining capacity, or current
rule/shared-group usage is at least the tier's monthly cap, it sets
`capExhausted`. It still computes enough of a percentage or fixed rule to know
whether the rule would otherwise be positive, but converts that condition to
the same `{ status: "inapplicable" }` used for ordinary zero benefit
(`reward.ts:329-388`).

`findRules()` may then select a lower-priority exclusive candidate, but if
none remains executable it returns no selected rule. It does not preserve:

- that a cap, rather than a merchant/tier/value mismatch, blocked the rule;
- the stable rule/cap-group or global identity responsible; or
- the checked potential reward before the exhausted cap.

The main loop records the transaction's category spending, then exits on an
empty selection before reward execution or any new cap event
(`reward.ts:807-845`).

The only retained `CapInfo` is therefore the event from the earlier
transaction that reached the cap. `applyMonthlyCap()` marks `capReached` only
when usage was below the cap and the current positive reward moves it to the
cap (`reward.ts:605-641`). For an exact hit, that event correctly has
`actualReward === appliedReward`. Later transactions begin with an already
exhausted state and cannot emit another event.

This is a coherent **reach-event** contract. It is not a complete
**analysis-loss** contract. `CapInfo` carries neither transaction identity nor
post-exhaustion consequences, and its comments do not define aggregate scope.

### State → optimizer

The optimizer scores each card from the difference between a before and after
calculator replay (`greedy.ts:224-250`). A transaction eligible only for an
already exhausted rule has zero marginal reward and enters generic
`unassignedSpending`/`unassignedTransactionCount` (`:514-535`).

`buildCardResults()` then recalculates only the transactions actually assigned
to each card (`:405-445`). The cap-reaching purchase and its equal
actual/applied event survive. The later purchase, its exhausted-cap cause, and
its potential reward do not. Generic unassigned spending says only that there
was no calculable positive marginal benefit; it does not repair the missing
cap identity or amount.

### State → presentation

The browser maps only retained `capsHit` events and defines:

```text
lostReward = max(0, actualReward - appliedReward)
```

It turns zero into `혜택 손실 없음`
(`apps/web/src/lib/cap-disclosures.ts:23-50`). The component introduces the
section as the place to inspect both applied benefit and money not received
because of caps, then renders that unqualified result
(`CapDisclosures.svelte:20-35`).

The visualization helper performs the same event subtraction and uses the
same no-loss wording. Terminal summary, terminal comparison, and generated
HTML all flatten `cardResults[].capsHit` through that helper. Worker decoding,
analysis-result coherence, and persistence shape-check and preserve the DTO,
but none can reconstruct state the calculator discarded.

### Executable current-catalog scenario

`bc-baro-clear-plus` has a supported exclusive Coupang rule at tier 1: 10%
reward and a 5,000 Won monthly cap. I used the checked optimizer artifact,
150,000 Won previous spending, this card only, and two 50,000 Won Coupang
purchases.

Current HEAD returned:

```json
{
  "totalSpending": 100000,
  "totalReward": 5000,
  "unassignedSpending": 50000,
  "unassignedTransactionCount": 1,
  "assignmentSpending": 50000,
  "cardResultSpending": 50000,
  "capsHit": [{
    "capType": "monthly_category",
    "capAmount": 5000,
    "actualReward": 5000,
    "appliedReward": 5000,
    "ruleId": "reward-002",
    "capGroup": "reward-002"
  }],
  "browser": {
    "lostReward": 0,
    "outcome": "혜택 손실 없음"
  },
  "vizOutcome": "혜택 손실 없음"
}
```

The first purchase exactly consumes the cap. The second purchase has another
checked 5,000 Won pre-cap reward under the same supported rule, but the
exhausted state suppresses it before execution. The optimized total is
correct; every dedicated cap-loss formatter receives only the first event and
states that no benefit was lost.

A complete artifact query found **1,004 supported positive monthly-capped
rules across 371 cards**. It found no currently authored supported shared
groups, so shared-group behavior is a public-contract regression case rather
than a current-catalog witness. Exact global-cap exhaustion follows the same
availability and telemetry path.

### Competing hypotheses and failure modes

1. **“Equal actual/applied is correct, so no-loss is correct.”** Equal values
   are correct for the reaching transaction. They prove only that this event
   was not clipped. They do not describe later eligible purchases.
2. **“The third transaction is intentionally absent.”** Correct for a
   reach-event list: the existing test explicitly requires cumulative exact
   exhaustion once and not again after exhaustion. That intentional producer
   behavior is exactly why the downstream analysis-wide inference is invalid.
3. **“Unassigned spending discloses the effect.”** It exposes spending but
   not the cap cause or foregone amount, while the dedicated cap section makes
   the opposite affirmative claim.
4. **“The lost amount is always the skipped rule's raw reward.”** Not
   necessarily. An exhausted specific rule can fall back to another rule, and
   the optimizer can assign another card. Gross reward blocked for one card
   and net portfolio-level benefit loss are distinct metrics.
5. **“Force the exhausted rule to execute to get telemetry.”** That can break
   exclusive fallback, additive projection, fixed-per-day state, and greedy
   selection. Telemetry collection must not change the selected reward path.
6. **Exact hit as the final eligible purchase.** In that control, no later
   reward was lost. A repair must not invent aggregate loss merely because a
   cap was reached exactly.

### Required contract repair

Keep “cap reached on this transaction” distinct from “reward blocked after
cap exhaustion.”

- If only event-local telemetry is intended, document and name that scope,
  narrow exact-hit copy to “no clipping on the cap-reaching purchase,” and
  stop claiming analysis-wide lost benefit.
- If numeric loss is required, core must preserve a typed exhausted-cap
  reason and checked potential reward for an otherwise positive candidate,
  with stable card/rule/cap identity and explicit scope.
- Define gross per-card blocked reward versus fallback reward and net
  portfolio-level loss before localization. Do not aggregate greedy candidate
  replays, which would double-count the same transaction/card possibility.
- Carry the new contract through worker decoding, analysis coherence,
  persistence, browser presentation, viz, terminal, and standalone HTML.

Regression coverage should compose the real producer through its sinks and
include: exact hit at end; single and cumulative exact hit followed by another
eligible purchase; clipped hit plus later purchases without double counting;
rule, shared-group, and global caps; additive and exclusive selection; lower
rule and alternate-card fallback; fixed reward state; zero cap; and
all-unassigned output.

## Confirmed root 2 — shared-cap coherence is rebuilt on every hot-path reward replay

- **Aggregate alias:** `RPF13-PERF-001`
- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed on current HEAD
- **Manual validation:** Not required
- **Structural validator:**
  `packages/core/src/calculator/reward.ts:74-121`
- **Unconditional invocation:**
  `packages/core/src/calculator/reward.ts:742-752`
- **Optimizer replay sites:**
  `packages/core/src/optimizer/greedy.ts:195-230,295-309,359-390,
  405-445,603-624`
- **Existing semantic validation:**
  `packages/rules/src/catalog-validation.ts:407-459`
- **Browser path:** `apps/web/src/lib/analyzer.ts:191-215,253-259`;
  `apps/web/src/lib/optimizer/worker-runner.ts:52-135`
- **CLI paths:** `tools/cli/src/card-catalog.ts:31-80`;
  `tools/cli/src/commands/optimize.ts:76-97`;
  `tools/cli/src/commands/report.ts:81-101`

### Source → repeated state

Commit `2812cea6bcbf568d5caf3b89bc00a71d01171095` correctly introduced
`assertCoherentCapGroupMonthlyCaps()`. The helper walks every supported reward
and tier, creates an outer `Map`, creates an inner `Map` per cap group, and
rejects conflicting monthly caps for a shared group and performance tier.

That check is necessary at the public `calculateRewards()` boundary because a
direct caller can supply arbitrary mutable rules. The placement problem is
that `calculateRewards()` calls it unconditionally before every transaction
evaluation. `greedyOptimize()` uses the public function as its internal replay
primitive:

- scoring performs a before and after calculation for every executable card
  and transaction;
- final assignment rewards recalculate cards;
- alternatives replay candidate histories;
- `cardResults` recalculate assigned histories; and
- best-single comparison evaluates every card again.

The same card definition is structurally rescanned during each replay, and no
validated/prepared identity survives to the next call.

The compiled artifact already passed the equivalent semantic rule at
publication. Web loads and caches that validated artifact before sending it
to the optimizer worker. CLI authoring catalogs call `validateCardCatalog()`,
and compiled CLI mode loads the validated artifact. An arbitrary direct
optimizer caller still needs the guard, but once per distinct card per
optimizer invocation is sufficient.

### Independent operation and timing evidence

I reproduced the helper's exact scan in an isolated read-only benchmark over
the 551 current executable cards. For 100 transactions, the unavoidable
before/after scoring floor alone is:

```text
calculator/structural passes:  2 × 551 × 100 = 110,200
outer Maps:                    110,200
inner cap-group Maps:          288,000
reward-rule visits:            382,200
supported tier visits:         650,200
```

These are lower-bound counts: assignment, alternatives, card-result, and
best-single replays add more.

Seven warmed samples of just those helper-equivalent validation passes were:

```text
30.198375, 30.243125, 30.921042, 31.076500,
31.211042, 32.951500, 33.384458 ms
median: 31.076500 ms
```

The unchanged current optimizer on the 551 executable cards and the same 100
synthetic valid transactions produced the same 195,840 Won reward and 34
assignments across seven warmed runs:

```text
272.743583, 280.745542, 280.982791, 283.140875,
292.978540, 297.068541, 307.088875 ms
median: 283.140875 ms
```

As same-cycle corroboration, the isolated performance differential removed
only the repeated valid-card check and preserved byte-identical output. Its
100-transaction mix measured 125,075 calculator calls, 451,946 coherence
maps, and 267.6 ms versus 221.8 ms: **45.8 ms / 20.6%**. Its fresh-process
1,000-transaction comparison measured **301.7 ms** avoidable latency with the
same result. The verifier independently measured a **39.0 ms / 16.1%**
100-transaction delta on a different mix. The tracer conclusion does not
depend on either sibling's exact sample.

### Competing hypotheses and impact

1. **“Remove the validation.”** Rejected. Public calculator and arbitrary
   optimizer inputs must still fail deterministically on incoherent groups.
   The repair is lifecycle placement, not weakened validation.
2. **“The artifact was already validated, so cache the object globally.”**
   A bare process-global `WeakSet` is unsafe while callers can mutate a
   previously validated rules object. A prepared value must be immutable,
   snapshotted, or capability-bound to the invocation.
3. **“The greedy replay count is already deferred.”** Deferred `D-C1-040` /
   `D-C10-02` owns the older replay algorithm. This whole-rule/tier scan was
   added after that baseline and can be hoisted without implementing an
   incremental reward accumulator.
4. **“The browser worker eliminates the impact.”** It protects main-thread
   responsiveness, but result readiness, CPU, allocation/GC churn, and battery
   still increase. CLI `optimize` and `report` pay the cost synchronously.
5. **Severity.** Current 100-row measurements remain below one second and
   returned unchanged results, so Medium is proportionate rather than High.

### Required lifecycle repair

- Introduce an invocation-scoped opaque/immutable prepared card
  representation that validates structural execution invariants once.
- Keep public `calculateRewards()` defensive: prepare arbitrary input, then
  execute through a private prepared path.
- Have `greedyOptimize()` prepare each distinct card once and use the prepared
  path for scoring, assignment, alternatives, card results, and best-single
  evaluation.
- Avoid a bare global identity cache unless card-rule immutability is actually
  enforced.
- Test that malformed groups still fail through both public entry points,
  prepared/direct results remain identical, and the structural cap validator
  runs at most once per distinct card per optimization invocation. Add an
  operation-count guard and a bounded full-artifact performance regression.

## Historical reconciliation

| Prior or current owner | Disposition |
| --- | --- |
| Cycle 7 / Plan 104 exact global-cap event | Fixed control. It added the event that exactly reaches the global cap; it did not own later blocked reward. |
| Cycle 8 / Plan 110 exact rule-cap event | Fixed control. It deliberately emits one equal actual/applied reach event and not another event after exhaustion. |
| Deferred `D-29` cap/zero assignment | Different scope. It concerned old zero-benefit assignment; the newer dedicated no-loss assertion is the current failure. |
| Cycle 11 / Plan 127 plural cap identity | Different scope. It added rule/cap-group identities but not post-exhaustion loss state. |
| Cycle 12 / Plans 130 and 136 | Plan 130 fixed period wording. Plan 136 introduced the browser loss projection and broad no-loss copy that exposes the incomplete event contract. |
| Same-cycle exact-cap aliases | Merge `C13-CR-001`, `C13-CT-001`, `RPF13-TE-001`, and `RPF13-VER-001` as one root. |
| Cycle 10 / Plan 121 duplicate analysis-result validation | Different validator and boundary; it removed a browser main-thread result-coherence pass. |
| Plan 129 shared-cap correctness | The invariant is correct. The new defect is repeating it inside every immutable-card reward replay. |
| Deferred optimizer replay (`D-C1-040`, `D-C10-02`) | Older architecture owner, not the new constant-factor scan. |
| `RPF13-PERF-001` | Retain as the second separate root. |

Full-history searches found no earlier owner for positive reward suppressed
*after* exact exhaustion and then presented as an analysis-wide no-loss
conclusion. They also found no earlier owner for the `2812cea` coherence scan
being repeated per calculator replay.

## Verification and final missed-issue sweep

Focused suites passed:

```text
bun test \
  packages/core/__tests__/cycle7-exact-reward-cap-state.test.ts \
  apps/web/__tests__/cap-disclosures.test.ts \
  packages/core/__tests__/cycle12-cap-identity-coherence.test.ts \
  packages/core/__tests__/optimizer.test.ts \
  packages/rules/__tests__/catalog-validation.test.ts

113 pass
0 fail
369 expectations
5 files
657 ms
```

This is useful negative evidence. The core exact-cap test contains the missed
post-exhaustion sequence but asserts only correct event-local behavior. The
browser disclosure test maps fabricated events separately. No test composes
that production sequence through a loss sink. Optimizer and catalog tests
preserve correctness but do not constrain structural-validation frequency.

The closing sweep revisited cap arithmetic and ordering; shared/global/rule
identity; additive/exclusive and fixed-per-day state; optimizer marginal,
fallback, assignment, alternatives, and unassigned flows; worker, coherence,
and persistence schemas; every browser/viz/CLI cap sink; parser
format/encoding/archive admission; scraper fetch/extract/write boundaries;
CLI buffer ownership and root parsing; generated catalog publication;
contrast; workflow policy; and all current changed paths.

Rejected or historically owned candidates included:

- same-category shared-cap identity presentation, already owned by Cycle 12
  `C12-CT-001`;
- the legacy `monthly_category` label for a future cross-category shared
  group, with zero current authored supported shared groups;
- the designer's browser upload stall, which had no reproducible DOM,
  console, stack, or product evidence and was outside this tracer's
  no-browser scope;
- captured CLI buffer mutation, where production parsers are read-only and
  the digest guard protects the remote boundary;
- unnamed decorative SVGs, already owned in Cycle 9;
- prefixed/leading-NUL XLSX inflation, still blocked by offset-zero archive
  dispatch and unsupported by new evidence; and
- the other repaired Cycle 12 scraper, CLI, contrast, and workflow paths,
  which remained closed.

The security specialist retained no new vulnerability. No third current,
non-duplicate causal root survived the final sweep.

At close, tracked and staged diffs remained empty. The only repository path
written by this tracer role is `.context/reviews/cycle13-tracer.md`. The six
protected Cycle 42 artifacts remained byte-identical.

**Final tracer count: 0 unique additions. Aggregate Cycle 13 recommendation:
retain 2 current findings — both Medium, High confidence, Confirmed.**
