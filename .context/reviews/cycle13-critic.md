# Review-plan-fix Cycle 13 — critic

- Date: 2026-07-24
- Reviewed revision: `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **changes requested**
- Final count: **2 genuinely new current-HEAD root causes — 2 Medium**
- Aggregate ownership: merge `C13-CT-001`, `C13-CR-001`,
  `RPF13-TE-001`, and `RPF13-VER-001`; they are independent descriptions of
  one defect, not four findings. Retain `RPF13-PERF-001` as the second root.
- Scope: review and this report only; no product, test, generated artifact,
  plan, dependency, staging, commit, push, deployment, or external-system
  mutation

## Inventory and method

I reset the review at the exact revision above and inventoried all **2,318
tracked paths**: **1,152** tracked `.context` paths and **1,166** active
product, data, test, documentation, configuration, workflow, and
vendor-integrity paths.

| Family | Tracked paths |
| --- | ---: |
| `apps` | 171 |
| `packages` | 878 |
| `tools` | 63 |
| `scripts` | 19 |
| `e2e` | 16 |
| Root/config/workflow/vendor/other | 19 |
| `.context` | 1,152 |

The active tree contains 363 non-generated TypeScript, JavaScript, Svelte,
Astro, CSS, and HTML source files; 147 test/E2E paths; 52,787 implementation
lines; and 683 authored card YAML files across 24 issuers. The complete sorted
manifest SHA-256 is
`af023ceb841754a802816c05ee6ede12823f6a7316099a7f03ddd0f49b00a5cd`;
excluding `.context`, it is
`c2a5477df81359722ca37509f76be9be4090b2a8fdb87f9c1d9684e76d23e6c1`.
Large authored/generated families were checked through their complete schema,
semantic-validation, publication, runtime-reader, and drift gates rather than
sampled.

The critic pass followed the user and operator flows from statement admission
through parsing, categorization, reward calculation, optimization, worker and
persistence boundaries, dashboard/results/report presentation, CLI output,
catalog publication, scraper review, and PR/deployment policy. It then
challenged every available Cycle 13 candidate against the opposite
interpretation, executable behavior, current catalog exposure, tests, and the
full historical ledger. The initial duplicate index contained 1,161
`.context` files before this report, including the then-available code,
security, and test Cycle 13 reports and all protected Cycle 42 evidence. The
designer, performance, and verifier reports appeared before close and were
read and reconciled rather than omitted from a stale snapshot.

## C13-CT-001 — event-local cap telemetry is presented as an analysis-wide “no loss” conclusion

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed by a current-card optimizer reproduction, independent
  same-cycle reproduction, source trace, and a green regression that contains
  the missed sequence
- **Public result contract:** `packages/core/src/models/result.ts:1-35`
- **Cap-exhaustion filter:** `packages/core/src/calculator/reward.ts:314-388,
  451-559`
- **Event emission:** `packages/core/src/calculator/reward.ts:1025-1040`
- **Existing exact-then-later regression:**
  `packages/core/__tests__/cycle7-exact-reward-cap-state.test.ts:326-349`
- **Browser projection and copy:**
  `apps/web/src/lib/cap-disclosures.ts:23-50`;
  `apps/web/src/components/ui/CapDisclosures.svelte:20-35`
- **Generic unassigned explanation:**
  `apps/web/src/components/report/ReportContent.svelte:57-64`;
  `apps/web/src/components/dashboard/SavingsComparison.svelte:135-147`
- **Terminal/standalone formatter:** `packages/viz/src/cap-disclosure.ts:16-29`
- **Current catalog witness:**
  `packages/rules/data/cards/bc/baro-clear-plus.yaml:20-23,75-106`

### The interpretation challenge

The calculator is internally consistent if `CapInfo` is read as an event
record. The transaction that lands exactly on a cap was not clipped, so that
event correctly has equal `actualReward` and `appliedReward`. Plans 104 and 110
deliberately established that equality to avoid inventing a loss on the
cap-reaching transaction.

That event-local interpretation does not support the current presentation:

1. A later positive exclusive candidate is marked `inapplicable` as soon as
   its rule/shared or global cap has no remaining capacity. It never reaches
   reward execution, so no potential reward, cap-blocked reason, or second
   event survives.
2. `collectCapDisclosures()` subtracts only the reaching event's two values.
3. The component does not identify a transaction or say “on the transaction
   that reached the cap.” It instead asks the user to inspect “한도 때문에
   받지 못한 금액” and emits the unqualified conclusion `혜택 손실 없음`.
4. `appliedReward` is also transaction-local. The existing cumulative exact
   regression reaches a 100-Won cap with a 50-Won transaction, so a browser
   item would say “한도 100원 도달 · 적용 혜택 50원” without explaining that
   50 Won is only the triggering purchase, not the monthly applied total.

If the copy is event-local, its scope is missing and the broad explanation is
false. If the copy is analysis-wide, the data is incomplete and the “no loss”
conclusion is false. Plan 136's hidden assumption was that the plural
`capsHit` event list was authoritative not only for reached events but also
for total lost benefit. Exact exhaustion followed by another eligible
purchase disproves that assumption.

### Current-card failure

`bc-baro-clear-plus` has a supported Coupang allowlist rule that pays 10% at
`tier1` with a 5,000-Won monthly cap. With 150,000 Won previous spending, only
that card selected, and two 50,000-Won Coupang purchases, current HEAD returns:

```json
{
  "totalSpending": 100000,
  "totalReward": 5000,
  "unassignedSpending": 50000,
  "cardResult": {
    "totalSpending": 50000,
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
  "browserOutcome": {
    "lostReward": 0,
    "text": "혜택 손실 없음"
  }
}
```

The first purchase exactly consumes the cap. The second has another checked
5,000-Won reward under the authored rule before cap state, but the availability
preview discards it. Because no other card was selected, the optimizer leaves
the entire second purchase unassigned. The generic statement “계산 가능한
양의 혜택 없음” is true only after applying the exhausted-cap state; it neither
attributes the zero to the cap nor repairs the dedicated section's affirmative
“no loss” claim.

An independent Cycle 13 test witness reproduced the cumulative variant with
the tracked Digital Samsung card: 7,000 Won, then 3,000 Won to reach a
10,000-Won cap exactly, then a purchase with another 7,000-Won pre-cap
benefit. The only retained event is 3,000/3,000 and every formatter still says
`혜택 손실 없음`. The two witnesses also rule out a single-card-data anomaly.

A full canonical-artifact query found **1,004 supported positive
monthly-capped rules across 371 cards**; all 1,004 are exclusive rules and
there are currently zero shared `capGroup` values used by more than one
supported rule on a card. Exact exhaustion followed by another eligible
purchase is therefore a live ordinary-catalog shape, while shared-group copy
remains a custom-authoring/future-catalog concern.

The calculated recommendation and reward total remain correct, which keeps
this below High. The defect is the financial explanation across browser,
terminal, and saved report: a concrete zero-loss assertion can understate
cap-caused missed benefit and obscure why spending was left unassigned.

### Root fix and tests

First define which quantity the product promises:

- For an **event-local** disclosure, replace the unqualified outcome with
  explicit scope such as “한도 도달 거래에서 삭감 없음,” identify the event,
  and stop describing that value as the result's total cap-caused loss.
- For an **analysis-level** disclosure, preserve a typed reason and checked
  potential when a positive candidate is rejected solely because a
  rule/shared/global cap is exhausted. Reconcile that suppressed candidate
  with any lower-priority rule or alternative card actually selected so the
  UI distinguishes gross blocked benefit from net analysis loss and does not
  double count fallback rewards.

The second design gives users the missing reason as well as truthful totals.
It must preserve current exclusive fallback, additive-rule, fixed-per-day,
and greedy-selection behavior; simply forcing an exhausted rule through
execution would change selection semantics.

Regression coverage should compose the real producer with every sink and
include: an exact hit as the final eligible purchase; cumulative exact hit
plus a later match; clipped hit plus later matches; zero caps; rule, coherent
shared, and global caps; additive versus exclusive rules; a lower-priority
rule fallback; another-card fallback; and unassigned spending. Assertions
must distinguish event clipping, gross suppressed reward, and net lost
benefit. The browser test must render the built component rather than only
searching its source.

## Independent confirmation — RPF13-PERF-001: shared-cap coherence is rebuilt on every optimizer replay

- **Severity:** Medium
- **Confidence:** High
- **Status:** Retained after static call-graph review, delta attribution, and
  an isolated output-identical benchmark from the performance lane
- **New structural scan:** `packages/core/src/calculator/reward.ts:74-121`
- **Unconditional invocation:** `packages/core/src/calculator/reward.ts:742-752`
- **Hot replay path:** `packages/core/src/optimizer/greedy.ts:195-230,
  286-309,359-390,405-445,603-624`
- **Default browser catalog path:** `apps/web/src/lib/analyzer.ts:191-215,
  253-259`
- **Existing publication validation:**
  `packages/rules/src/catalog-validation.ts:407-459`

Commit `2812cea` correctly added a direct-calculator guard for incoherent
shared monthly caps. The helper visits every supported rule and tier and
allocates an outer map plus one inner map per cap group. `calculateRewards()`
runs it unconditionally.

The placement is the problem. For each transaction,
`scoreCardsForTransaction()` calls `calculateRewards()` twice for every
executable card: once with the card's current assigned history and once with
the candidate appended. Assignment totals, alternatives, card results, and
best-single comparison replay it again. The browser's normal unfiltered path
loads the cached, already validated optimizer artifact and passes the whole
executable set to a worker; a card filter applies only when the user supplied
IDs. CLI optimize/report inherit the same core loop synchronously.

I challenged both possible dismissals:

1. **“The check is required for correctness.”** It is required at the public
   calculator boundary, and arbitrary direct optimizer input also needs
   validation. Neither requirement needs the same immutable card definition
   rebuilt and revalidated on every replay. One validation per distinct card
   inside an optimization invocation preserves fail-fast behavior.
2. **“This is only the deferred greedy complexity.”** `D-C1-040` and
   `D-C10-02` own the pre-existing history replay and eventual incremental
   accumulator. The cap scan was added after the Cycle 12 performance
   baseline and can be removed from replays without changing the greedy
   algorithm. A newly multiplied constant-factor regression is not absorbed
   merely because the multiplier is historical.

The performance lane removed only the new call in an isolated exact-HEAD copy
and alternated current/comparison order after warm-up. Results were
byte-identical. With the real 682-card artifact and 100 categorized
transactions, current HEAD made 125,075 calculator calls, created 451,946
coherence maps, and took a five-sample median 267.6 ms versus 221.8 ms:
**45.8 ms / 20.6%** added latency. At 1,000 transactions, both variants
returned the same 1,326,730-Won reward and 70 assignments, while the repeated
check added about 301.7 ms. Peak memory barely changed, which is consistent
with short-lived allocation/GC and CPU cost rather than retained leakage.

The absolute time stays below the deferred optimizer's one-second target for
100 rows, so Medium is appropriate. It still delays browser result readiness,
adds worker CPU/battery cost, and delays synchronous CLI output for work that
has already been proved for the same object graph.

**Root fix:** keep public `calculateRewards()` defensive, but introduce an
opaque prepared-card path for optimizer-owned replays. At `greedyOptimize()`
entry, validate each distinct card once and retain the compiled cap/tier
identity used by the private calculator path. Do not use a process-global
bare `WeakSet`: a caller could mutate an object after validation. An
invocation-scoped immutable snapshot/capability, or an actually frozen
prepared representation, keeps the safety claim honest.

Tests should prove malformed shared groups still fail through both public
boundaries, prepared/direct outputs remain identical, and structural cap
validation runs at most once per distinct card per optimization invocation.
Keep a bounded operation-count or relative benchmark around the full default
artifact so another per-call structural pass cannot silently re-enter the
replay loop.

## Candidate falsification and ownership

| Candidate | Critic disposition | Evidence and consequence |
| --- | --- | --- |
| `C13-CR-001` / `RPF13-TE-001` / `RPF13-VER-001` — exact exhaustion plus later eligible spending | **Confirm and merge with `C13-CT-001` at Medium/High.** | Both opposite interpretations were tested above. The calculator's event is valid, but neither its shape nor the UI copy supports a result-level “no loss” claim. Two current cards and a separate global-cap control reproduce the same root. |
| `RPF13-PERF-001` — cap coherence validation inside every reward replay | **Confirm as a separate Medium/High root.** | The correctness guard is valid but its hot-path placement is not required. Removing only that placement preserved exact output and cut the 100-row full-artifact median by 20.6%; the regression postdates and is separable from the deferred greedy redesign. |
| Cap rule/cap-group text is not visibly differentiated | **Reject as Cycle 13-new; retain under Cycle 12 `C12-CT-001` root-fix scope.** | The Cycle 12 critic explicitly required rule/cap-group identity for plural same-category events. Current rendering preserves separate events but can produce text-identical rows. That is incomplete historical scope, not a new root. Current catalog exposure is also zero shared groups. |
| `monthly_category` / `카테고리별 월 한도` can describe a future cross-category shared group | **Do not promote separately.** | The label follows a legacy public enum and all 1,004 current positive monthly-capped supported rules are independently keyed. Record the semantic risk when manual/custom shared groups are introduced; it does not establish another current-catalog failure. |
| Source-host contrast, root `parse`, scraper nonempty/provenance wording, CLI buffer ownership, cap identity/coherence, and PR verification | **Fixed; no new regression found.** | The current implementation preserves the intended product and operational boundaries. PR code has read-only build authority and cannot upload Pages artifacts or enter the write/OIDC deploy job; root parse reaches the real analyze command; scraper provenance remains trusted-boundary stamped. |
| Shared captured Buffer can be mutated after the copy reduction | **Reject.** | Production adopts the uniquely owned `fs.readFile` buffer, current parser paths are read-only, and digest checks surround consent and remote retry. A malicious injected dependency is not a production boundary. |
| Prefixed/leading-NUL XLSX bypasses archive limits | **Reject again.** | ZIP preflight still requires `PK` at byte zero. No current parser evidence contradicts the prior rejection, so the hypothesis is not resurrected. |
| Designer's stalled upload automation | **Reject as inconclusive.** | The owned browser process became non-responsive, but no DOM, accessibility, console, network, or stack evidence separated an application loop from an automation/Chrome failure. The designer cleaned the isolated process and did not turn the stall into a product claim. |

The Cycle 13 security review's zero-finding conclusion survives the critic
check. No new auth, secret, URL, XSS, parser/archive, LLM, filesystem,
subprocess, dependency, or workflow-privilege failure was reproduced.

## Historical reconciliation

This finding does not reopen the fixed exact-cap omission:

- Cycle 7/Plan 104 required the transaction that exactly reaches a global cap
  to emit an event.
- Cycle 8/Plan 110 did the same for rule caps and correctly required
  event-local `actualReward === appliedReward`.
- Cycle 11/Plan 127 preserved plural rule and cap identities.
- Cycle 12/Plan 136 added the browser sink and introduced the broad lost-benefit
  interpretation. The new failure begins after the exact-reaching event.

The older `C3-D02` / deferred `D-29` deserves explicit overlap control. It
observed that a transaction after cap exhaustion could receive zero marginal
reward and then be assigned arbitrarily to a zero-benefit card; its proposed
UX annotation was “cap reached.” Plan 110 later removed zero-benefit
assignments and made that spending explicitly unassigned. The current failure
is distinct: a disclosure added much later affirmatively says there was no
loss. The old item did not involve exact-hit telemetry, loss arithmetic, or
this sink. Its annotation idea should be absorbed into the root repair rather
than revived as a second finding.

Full-ledger searches for post-exhaustion transactions, exact-then-later
sequences, event-local loss, and `혜택 손실 없음` found no historical owner for
that affirmative cross-layer contradiction. Conversely, the unnamed CardGrid
magnifier remains the historical `C9-D-01` / Plan 119 root and receives no new
ID.

For the performance finding, `D-C1-040`, `D-C10-02`, and their aliases own
calculator-history replay, full card rescoring, and the eventual incremental
optimizer. They predate `assertCoherentCapGroupMonthlyCaps()` and do not own
this new repeated structural scan. Cycle 12's performance baseline predates
commit `2812cea`, while Plan 129 discussed correctness/coherence but never
budgeted validation frequency. No historical helper-name, map-rebuild, or
per-call validation search produced another owner.

## Verification and final missed-issue sweep

- `bun test packages/core/__tests__/cycle7-exact-reward-cap-state.test.ts
  apps/web/__tests__/cap-disclosures.test.ts` passed **24 tests, 104
  expectations, 0 failures**. This is meaningful negative evidence: the core
  suite contains exact exhaustion followed by a later purchase, while the web
  suite separately maps an exact event to `혜택 손실 없음`; no test composes
  those layers.
- Complete artifact queries independently confirmed 1,004 positive supported
  monthly-capped rules across 371 cards, all exclusive, and zero currently
  shared supported cap groups.
- The performance lane's isolated differential removed only the new
  coherence-call placement, preserved byte-identical results, and measured
  the full-artifact 100-row median at 267.6 ms versus 221.8 ms. Its focused
  calculator/optimizer/catalog suite passed **89 tests, 265 expectations, 0
  failures**.
- At this same revision, the verifier's complete `bun run verify` passed:
  toolchain, migrations, dependencies, audit, all 683 card files and
  generated/docs drift, lint, typecheck, workspace/root tests, production web
  build, and bundle budgets. The critic lane did not repeat the full gates.
- No browser, E2E, server, commit, push, workflow dispatch, or deployment was
  run by this critic lane.

The closing sweep revisited numeric and cap state, fallback/stacking order,
optimizer assigned/unassigned invariants, worker and persistence coherence,
all cap sinks, parser format/archive boundaries, upload replacement state,
catalog semantics/publication, CLI consent/bytes/output, scraper
fetch/extract/quarantine, accessibility and contrast, root scripts,
dependencies, and PR/publication authority. Other candidates were fixed,
historically owned, explicitly deferred, correctly event-local, unsupported
by a production scenario, or non-reproducible.

The six protected Cycle 42 artifacts remained byte-identical. This report is
the only repository path created by the critic lane.

**Final count: 2 genuinely new current-HEAD root causes — 2 Medium.**
