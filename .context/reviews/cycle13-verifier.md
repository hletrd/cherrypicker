# Cycle 13 verifier report

Date: 2026-07-24
Reviewed commit: `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9`
Branch: `codex/review-plan-fix-no-deploy-20260723`

## Verdict

Two genuinely new current-HEAD issues survive independent reproduction,
full-history duplicate control, and the repository gates:

| Verifier ID | Same-cycle aliases | Severity | Confidence | Status |
| --- | --- | --- | --- | --- |
| `RPF13-VER-001` | `C13-CR-001`, `RPF13-TE-001` | Medium | High | **Confirmed** |
| `RPF13-PERF-001` | performance reviewer; critic/architect confirmation | Medium | High | **Confirmed** |

An exact monthly-cap hit correctly records that the *reaching transaction*
was not clipped. If another eligible purchase follows, however, its positive
reward is suppressed without any cap-loss telemetry. Browser, terminal, and
standalone-report presentation then treat the earlier event-local equality as
proof that there was no benefit loss and render `혜택 손실 없음`. The reward
total is correct; the newly exposed explanation is false for the full input.

The second finding is a separable performance regression from the new
shared-cap correctness guard. The guard correctly validates arbitrary direct
calculator input, but the optimizer re-runs the same rule/tier scan and
rebuilds its maps on every reward replay for the same card definitions. An
independent full-artifact differential preserved byte-identical results while
removing 39.0 ms / 16.1% from the verifier's 100-transaction median.

No third new issue met the evidence threshold. The security review found no
new vulnerability, and the designer's current-HEAD review found no new UI
issue after assigning its same-category identity concern to the existing
Cycle 12 owner.

## Revision lock, inventory, and method

The review remained locked to the revision and branch above. The exact Git
tree contains **2,318 tracked paths**:

| Family | Paths |
| --- | ---: |
| `.context` plans, reviews, and history | 1,152 |
| `packages/` | 878 |
| `apps/` | 171 |
| `tools/` | 63 |
| `scripts/` | 19 |
| `e2e/` | 16 |
| Root, workflow, configuration, and vendor-integrity paths | 19 |
| **Total** | **2,318** |

The newline-delimited tracked manifest hashes to
`af023ceb841754a802816c05ee6ede12823f6a7316099a7f03ddd0f49b00a5cd`;
the **1,166-path** non-`.context` manifest hashes to
`c2a5477df81359722ca37509f76be9be4090b2a8fdb87f9c1d9684e76d23e6c1`.
The active inventory includes 363 TypeScript, JavaScript, Svelte, Astro, CSS,
and HTML paths, 683 canonical card YAML files, and 24 issuer directories.

The current Cycle 12 repair range from
`e72a4c69f7c0eab7053c61a587c2d040760c236c` through HEAD changes 56 paths
across cap identity, cap wording, scraper admission/provenance, CLI buffer
ownership and routing, contrast, browser disclosure, PR verification, tests,
and completion documentation. I traced each changed producer through public
entry points, state/worker/persistence boundaries, and final browser, CLI,
terminal, and report consumers. Repository-wide verification and the
candidate-specific probes below followed the source review.

At final adjudication, `.context` contained **1,166 files**: 1,152 tracked
records plus fourteen authorized untracked Cycle 13/Cycle 42 artifacts. I
indexed all of them, then directly read the implicated Cycle 7–12 reviews,
aggregates, deferred register, Plans 72, 104, 110, 121, 127, 129, 130, and
136, every available same-cycle specialist report, and the rejected
prefixed-XLSX history. This report does not infer novelty merely from the
absence of a matching title.

## `RPF13-VER-001` — exact exhaustion hides later cap-blocked reward while disclosures report no loss

- **Severity:** Medium
- **Confidence:** High
- **Status:** **Confirmed**
- **Manual validation:** not required; a current catalog artifact reproduces
  the result through the calculator, optimizer, browser helper, and
  visualization helper
- **Primary calculator locations:**
  `packages/core/src/calculator/reward.ts:314-388,470-559,788-845,1025-1040`
- **Result contract:** `packages/core/src/models/result.ts:25-35`
- **Optimizer propagation:**
  `packages/core/src/optimizer/greedy.ts:207-250,405-444,514-535`
- **Browser presentation:**
  `apps/web/src/lib/cap-disclosures.ts:23-50`;
  `apps/web/src/components/ui/CapDisclosures.svelte:20-35`
- **Terminal and standalone presentation:**
  `packages/viz/src/cap-disclosure.ts:16-29`;
  `packages/viz/src/terminal/summary.ts:86-95`;
  `packages/viz/src/terminal/comparison.ts:77-87`;
  `packages/viz/src/report/generator.ts:415-430`
- **Oracle gap:**
  `packages/core/__tests__/cycle7-exact-reward-cap-state.test.ts:326-349`;
  `apps/web/__tests__/cap-disclosures.test.ts:68-117`;
  `packages/viz/__tests__/cycle7-cap-disclosure.test.ts:167-216`
- **Current-card witness:**
  `packages/rules/data/cards/bc/baro-clear-plus.yaml:20-23,75-106`

### Producer-to-sink trace

`previewRuleAvailability()` computes an exhausted flag from the remaining
card-wide cap and the rule/cap-group monthly usage. For an otherwise positive
exclusive rule, exhaustion is returned only as `status: "inapplicable"`
(`reward.ts:329-388`). `findRules()` then moves to another exclusive rule or
returns no selected rule; it does not retain a typed “blocked by cap” reason
or the checked potential reward (`reward.ts:470-559`).

The transaction still enters category spending, but an empty selection exits
before reward execution or cap-event creation (`reward.ts:807-845`). The
earlier transaction that exactly reached the monthly cap already emitted the
one required `CapInfo`, with equal event-local `actualReward` and
`appliedReward` (`reward.ts:1025-1040`). Consequently the later blocked reward
cannot be reconstructed from `capsHit`.

The optimizer independently exposes the same gap. It calculates marginal
reward from before/after calculator totals; the later transaction scores zero
(`greedy.ts:207-250`) and is recorded only as generic unassigned spending
(`:514-535`). `cardResults` are then recalculated from assigned transactions
only (`:405-444`). Neither output says that an exhausted cap caused the zero
marginal benefit or preserves the forgone amount.

The browser helper maps only existing cap events and defines loss as:

```text
max(0, cap.actualReward - cap.appliedReward)
```

For an exact reach event this is correctly zero *for that event*. The helper
then expands zero into the unqualified `혜택 손실 없음`
(`cap-disclosures.ts:23-50`). The component introduces the section as the
place to inspect “한도 때문에 받지 못한 금액” and renders that outcome
(`CapDisclosures.svelte:20-35`). The shared visualization helper applies the
same event-local subtraction to terminal and standalone HTML output
(`packages/viz/src/cap-disclosure.ts:16-29`). Thus a correct reach-event
contract is presented as a complete statement about an input containing
later cap-blocked spending.

### Current catalog reproduction

`BC 바로 클리어 플러스` has a supported exclusive Coupang/online-shopping
rule: tier 1 earns 10% with a 5,000 Won monthly cap. With previous spending of
150,000 Won, the current canonical loader and calculator produced:

| Input | Analyzed spending | Reward | Category rate | `capsHit` | Rendered outcome |
| --- | ---: | ---: | ---: | --- | --- |
| One 50,000 Won Coupang purchase | 50,000 | 5,000 | 10% | one 5,000/5,000 exact event | `혜택 손실 없음` |
| The same purchase, then another eligible 50,000 Won purchase | 100,000 | 5,000 | 5% | the same one 5,000/5,000 exact event | `혜택 손실 없음` |

The first row is a truthful control: the exact hit is the final eligible
purchase, so no later reward was discarded. In the second row, the second
purchase independently earns 5,000 Won under the supported rule before cap
state is considered, but the exhausted rule is removed before execution.
The returned total remains correctly capped at 5,000 Won; the claimed
no-loss explanation is wrong by 5,000 Won.

The production optimizer made the downstream effect explicit:

```json
{
  "totalSpending": 100000,
  "totalReward": 5000,
  "unassignedSpending": 50000,
  "unassignedTransactionCount": 1,
  "assignment": {
    "spending": 50000,
    "transactionCount": 1,
    "reward": 5000
  },
  "capsHit": [{
    "category": "online_shopping",
    "capType": "monthly_category",
    "capAmount": 5000,
    "actualReward": 5000,
    "appliedReward": 5000,
    "ruleId": "reward-002",
    "capGroup": "reward-002"
  }],
  "browserLostReward": 0,
  "browserOutcome": "혜택 손실 없음",
  "vizOutcome": "혜택 손실 없음"
}
```

A separate synthetic card-wide-cap control produced the same distinction.
Two 500 Won purchases at 10% exactly reached a 100 Won global cap and
truthfully rendered no loss. Adding a third identical purchase left
`totalReward`, the single 50/50 `monthly_total` event, and both rendered
outcomes unchanged, even though another 50 Won had been blocked by the global
cap. The issue is therefore not limited to the BC rule-level cap.

The complete canonical catalog contains **1,004 supported positive
monthly-capped rules across 371 cards**. There are no currently authored
supported shared cap groups, so shared-group behavior is a required
regression boundary rather than a present catalog witness. Card-wide exact
exhaustion reaches the same disclosure failure through the global state.

### User impact

Users receive the correct capped reward total but a materially misleading
reason for it. On dashboard, results, and report/print, a dedicated cap-loss
section can say no benefit was lost while later eligible spending received
zero benefit solely because that cap was already full. CLI terminal and saved
standalone HTML have the same incomplete explanation. The optimizer's
unassigned-spending notice is not a substitute: it calls the purchase
generically non-beneficial and provides neither the exhausted cap identity
nor the otherwise eligible reward.

### Why the green tests do not refute it

The core regression at `cycle7-exact-reward-cap-state.test.ts:326-349`
already contains two transactions that cumulatively reach a rule cap exactly
and a third transaction after exhaustion. It intentionally asserts only one
equal actual/applied reach event. That is the correct reach-event contract,
but it never sends the production result to a loss presentation sink.

The browser test builds fabricated isolated cap events, expects an exact
event to say `혜택 손실 없음`, and checks page wiring by reading component
source. The visualization fixture is similarly event-only. None compares an
exact-at-end control with an exact-then-later-eligible sequence.

The three implicated suites therefore pass despite the cross-layer failure:

```text
27 tests passed
119 expectations passed
0 failures
```

### Required repair

The repair should keep “cap reached on this transaction” separate from
“reward discarded because this cap was exhausted.”

1. Document `CapInfo.actualReward` and `appliedReward` as reach-event-local,
   and stop treating equality as an analysis-wide loss total.
2. At minimum, replace the unconditional no-loss copy with narrow truth such
   as “한도 도달 거래에서 추가 차감 없음,” or omit aggregate loss language
   when later cap-blocked reward is not represented.
3. For complete numeric disclosure, preserve a typed cap-exhaustion reason
   and checked potential reward when an otherwise applicable positive rule is
   rejected solely because its rule/shared or card-wide cap has no remaining
   capacity. Aggregate it under an explicit scope and stable card/rule/cap
   identity instead of mutating the historical reach event.
4. Define optimizer semantics before summing loss: distinguish per-card
   forgone reward from portfolio-level loss, account for an alternative rule
   or card that actually earns reward, and avoid counting the same candidate
   from repeated marginal scoring.
5. Add calculator, optimizer, worker/coherence/persistence, browser,
   terminal, and standalone regressions for:
   - exact hit as the final eligible purchase;
   - single and cumulative exact hit followed by matching spending;
   - rule, shared-group, and global monthly caps;
   - exclusive fallback, additive stacking, and alternate-card assignment;
   - clipped-on-hit followed by exhaustion without double counting; and
   - zero-cap/all-unassigned behavior under an explicit contract.

## `RPF13-PERF-001` — shared-cap coherence maps are rebuilt on every optimizer replay

- **Severity:** Medium
- **Confidence:** High
- **Status:** **Confirmed**
- **Manual validation:** not required; an independent real-artifact
  differential preserved byte-identical output
- **Structural scan:**
  `packages/core/src/calculator/reward.ts:74-121`
- **Unconditional invocation:**
  `packages/core/src/calculator/reward.ts:742-752`
- **Optimizer replay sites:**
  `packages/core/src/optimizer/greedy.ts:195-230,286-309,359-390,405-445,603-624`
- **Existing publication validator:**
  `packages/rules/src/catalog-validation.ts:407-459`;
  `scripts/build-json.ts:197-207`
- **Browser worker path:**
  `apps/web/src/lib/optimizer/worker-runner.ts:52-135`;
  `apps/web/src/lib/analyzer.ts:253-259`
- **Synchronous CLI paths:**
  `tools/cli/src/commands/optimize.ts:91-97`;
  `tools/cli/src/commands/report.ts:95-101`

### Lifecycle and call-graph confirmation

Commit `2812cea6bcbf568d5caf3b89bc00a71d01171095` correctly added
`assertCoherentCapGroupMonthlyCaps()`. For arbitrary direct calculator input,
the check prevents two supported rules from assigning different monthly caps
to one shared group. It walks every supported reward and tier and allocates an
outer `Map` plus an inner tier-definition `Map` for each cap group.

`calculateRewards()` invokes that structural validation unconditionally.
During greedy scoring, `scoreCardsForTransaction()` calls the calculator for
the current assigned history and again with the candidate transaction for
every executable card. Assignment totals, alternatives, card results, and
best-single evaluation replay the same calculator again. The card-rule object
does not change between those calls, but no prepared/validated representation
survives them.

The generated optimizer artifact has already passed the equivalent semantic
rule at publication, and CLI custom catalogs pass `validateCardCatalog()`.
An arbitrary direct `greedyOptimize()` caller must also fail on incoherent
input, but one validation per distinct card per optimizer invocation preserves
that safety. Reconstructing the same maps on every reward replay adds no
additional correctness.

### Independent verifier differential

I used Bun's in-memory build API to produce two otherwise identical bundled
core modules from exact HEAD. One retained current code; the other removed
only the call to `assertCoherentCapGroupMonthlyCaps()` from
`calculateRewards()`. No repository or temporary source file was edited.

Both modules were warmed, then run in alternating order for seven samples
against the real **682-card** optimizer artifact and the same 100 valid
categorized transactions. Every result serialized to the same SHA-256:

```text
88006423c72f740ba2da2053bddc31cb7a90c0d9c235b2a97060e1bf2f79ba86
```

The verifier's measured medians were:

| Variant | Seven-sample median |
| --- | ---: |
| Current HEAD | 281.4 ms |
| Without only the repeated valid-card check | 242.4 ms |
| **Avoidable difference** | **39.0 ms / 16.1%** |

An output-identical instrumented current build counted **117,909 structural
checks**, **308,149 inner cap-group maps**, and **695,703 tier-definition
visits** for that transaction mix: **426,058 coherence maps** including the
outer map. The performance specialist's different 100-transaction mix
measured 125,075 calls, 451,946 maps, and a 20.6% median delta. The verifier
does not depend on those exact sibling numbers; its independent transaction
mix confirms the same placement, output parity, allocation multiplier, and
material latency. A correct prepared-card fix would retain one check for each
of the 551 executable cards, so 39.0 ms is an upper bound rather than a claim
that every validation should disappear; it does not change the repeated
117,000-plus-call excess.

### Impact and repair

At 100 rows the extra work remains below the older optimizer's deferred
one-second target, so Medium is appropriate. It nevertheless delays result
readiness and consumes worker CPU/battery in the browser. CLI `optimize` and
`report` pay the same work synchronously before producing output.

The repair should split structural preparation from transaction execution:

1. Keep public `calculateRewards()` defensive for arbitrary mutable
   `CardRuleSet` input.
2. At `greedyOptimize()` entry, validate each distinct card once and create an
   invocation-scoped opaque prepared representation for all marginal,
   alternative, card-result, and best-single replays.
3. Do not use a process-global bare `WeakSet`; a caller could mutate a
   previously validated object. Freeze/snapshot the prepared structure or
   bind an unforgeable private capability to that invocation.
4. Prove malformed shared groups still fail through both public boundaries,
   direct/prepared outputs are identical, and structural cap validation runs
   at most once per distinct optimizer card. Add an operation-count guard so
   another whole-card pass cannot silently return to the replay loop.

## Historical reconciliation and rejection ledger

| Candidate or prior owner | Adjudication | Reason |
| --- | --- | --- |
| Cycle 7 exact global-cap omission / Plan 104 | **Not a duplicate; fixed control** | It required the exact-reaching transaction to appear in `capsHit` and correctly kept equal actual/applied values. The current failure begins with later eligible spending. |
| Cycle 8 exact rule-cap omission / Plan 110 | **Not a duplicate; fixed control** | It added one exact rule event and deliberately required that event not be emitted again after exhaustion. The current core test satisfies that contract; downstream copy overstates what the event proves. |
| Deferred `D-29`, zero marginal reward at a cap | **Not a duplicate** | It concerned an old zero-rate assignment and possible annotation. Plan 110 now leaves zero-benefit spending unassigned. This issue is the newer affirmative cap-loss statement introduced on top of incomplete telemetry. |
| Cycle 11 plural cap telemetry / Plan 127 | **Not a duplicate** | It separated rule/cap-group identity and made plural `capsHit` authoritative. It did not model reward suppressed after exhaustion. |
| Cycle 12 standalone period wording / Plan 130 | **Not a duplicate** | It fixed per-purchase versus monthly labels without changing event scope or post-exhaustion telemetry. |
| Cycle 12 browser omission / Plan 136 | **New downstream failure, not the old omission** | Plan 136 introduced the browser projection and claimed that applied/lost benefit matched authoritative telemetry. Commit `c1126fd9c89efae2049cc4e2b56be025a56a4774` added the unqualified browser no-loss copy. |
| `C13-CR-001` and `RPF13-TE-001` | **Merge as one finding** | Independent live-card probes, source traces, impact, and fix boundaries agree with `RPF13-VER-001`. |
| `RPF13-PERF-001` | **Retain as a separate Medium/High root** | Static lifecycle tracing and the independent output-identical 16.1% differential confirm that the new structural guard is unnecessarily multiplied by the old replay count. |
| Deferred `D-C1-040`, `D-C10-02`, and optimizer-replay aliases | **Not a duplicate of the performance finding** | They own the pre-existing greedy replay architecture and eventual incremental accumulator. The cap-group scan was added later and can be hoisted without changing that algorithm. |
| Cycle 10 duplicate result-coherence validation / Plan 121 | **Not a duplicate** | That work removed a post-worker browser main-thread validation pass. This finding is a rule/tier map rebuild inside every core calculator replay. |
| Cycle 12 cap identity/coherence / Plan 129 | **New placement regression, not the old correctness defect** | Plan 129 introduced the correct invariant but did not define a preparation lifecycle or budget validation frequency. The public guard remains required. |
| Browser source-wiring test weakness | **Subsumed** | It explains the oracle gap but has no separate user harm from the false disclosure. |
| Rule-level and card-wide post-exhaustion cases | **One root finding** | They share the same missing post-exhaustion loss contract and the same presentation failure. |
| Designer concern: identical same-category events omit visible `ruleId`/`capGroup` | **Reject as historical duplicate** | Cycle 12 `C12-CT-001` and its root-fix text already own same-category rule/cap-group differentiation and repeated event presentation. |
| Designer browser upload stall | **Reject as inconclusive** | No extractable DOM, console, stack, or reproducible product evidence separated application behavior from the automation/Chrome failure. |
| Historical rollback/deferred cap-maintainability notes | **Reject as separate current finding** | No independently incorrect total was reproduced; they do not explain the confirmed false loss statement. |
| Leading-NUL/prefixed-XLSX ZIP inflation | **Explicitly rejected again** | `preflightXLSXArchive()` inspects ZIP metadata only for an offset-zero `PK` prefix (`packages/parser/src/shared/xlsx-archive.ts:113-132`). Non-`PK` input follows the non-ZIP/plaintext path; prior corrected probes found no preserved workbook or ZIP inflation, and this pass found no new path. |

## Verification and final sweep

`bun run verify` passed from the locked revision. This covered the Bun 1.3.12
toolchain gate, migration cleanliness, workspace dependency consistency,
`bun audit` with no reported vulnerability, canonical data/docs checks,
lint, type checking, all workspace tests plus 72 root script tests, the
five-route Astro production build, and bundle budgets. The data gate loaded
all 683 cards and 24 issuers; the documentation check reported 551
optimizer-executable cards. The web build completed with zero Astro errors,
warnings, or hints.

Additional read-only evidence:

- the live BC calculator and optimizer probes reproduced the 5,000 Won
  missing cap-loss explanation;
- the exact-at-end versus exact-then-post global-cap control reproduced the
  same indistinguishable telemetry;
- the complete catalog query confirmed 1,004 affected-rule opportunities
  across 371 cards and zero current supported shared groups;
- the focused core/browser/viz suites passed 27 tests and 119 expectations,
  demonstrating the missing cross-layer oracle;
- the independent 682-card/100-transaction performance differential produced
  byte-identical results while measuring 281.4 ms versus 242.4 ms and
  instrumenting 117,909 repeated structural checks;
- the focused cap-coherence/optimizer/catalog suites passed 89 tests and 265
  expectations, confirming current correctness guards without any
  validation-frequency oracle; and
- `bun scripts/run-e2e.ts status --assert-clean` passed, with TCP 4173 free.

The final bounded sweep rechecked calculator rule selection and cap
arithmetic, fallback/stacking identities, optimizer marginal scoring and
unassigned state, worker/persistence/coherence validation, all cap
presentation sinks, structural-validation lifecycle, the other seven Cycle 12
repair families, parser/archive admission, catalog/schema data,
build/docs/workflow contracts, and the current
aggregate/deferred history. No third new issue survived reproduction and
duplicate control.

No implementation, staging, commit, push, deployment, external mutation, or
manual browser run was performed by this verifier. At report creation,
tracked and staged diffs were empty and status contained only authorized
untracked review artifacts. The six protected Cycle 42 artifacts remained
byte-identical to their baseline SHA-256 values:

```text
596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a
272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1
1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266
6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0
c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5
c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f
```
