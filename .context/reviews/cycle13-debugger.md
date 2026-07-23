# Review-plan-fix Cycle 13 — debugger

- Date: 2026-07-24
- Reviewed revision: `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: latent bugs, failure modes, regressions, state transitions, and
  cross-boundary error behavior
- Disposition: **both retained Cycle 13 roots independently confirmed; no
  genuinely new debugger finding**
- Final count: **2 retained aggregate roots, 0 debugger-new roots**
- Scope: review and this report only; no implementation, source/test/plan/
  generated-artifact change, staging, commit, push, deployment, server,
  browser, or E2E run

## Inventory and method

I locked the pass to the exact revision above and inventoried all **2,318
tracked paths**: **1,152** tracked `.context` paths and **1,166** active
product, data, test, documentation, workflow, configuration, and
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

The active inventory contains **363 non-generated
TS/JS/Svelte/Astro/CSS/HTML files**, **147 test/E2E paths**, and **52,787
implementation lines**. Declarative data includes **683 authored card YAML
files across 24 issuers**; the canonical optimizer artifact contains 682 cards,
551 of them executable.

The complete tracked-path manifest SHA-256 is
`af023ceb841754a802816c05ee6ede12823f6a7316099a7f03ddd0f49b00a5cd`.
The active manifest excluding `.context` is
`c2a5477df81359722ca37509f76be9be4090b2a8fdb87f9c1d9684e76d23e6c1`.
Large authored/generated populations were followed through their common
schema, semantic validator, publication projection, runtime loaders, and
complete data gate rather than sampled.

The executable sweep traced statement bytes through parser admission,
categorization, calculation, greedy assignment, worker decoding, analysis
coherence, persistence, and browser/terminal/report presentation. It also
revisited direct calculator and optimizer boundaries, cap state transitions,
CLI snapshot ownership and consent, scraper fetch/extraction failure paths,
archive preflight, workflow authority, and the complete active delta since the
Cycle 12 review baseline.

## Adjudication matrix

| Candidate | Severity / confidence | Debugger disposition | Ownership |
| --- | --- | --- | --- |
| Exact cap exhaustion followed by later eligible spending is presented as `혜택 손실 없음` | Medium / High | **Confirmed on current HEAD.** Reward totals remain correct, but event-local reach telemetry is used as an analysis-wide no-loss conclusion after a later positive reward was suppressed by the cap. | `C13-CR-001`; **0 debugger-new** |
| Shared-cap coherence is rebuilt during every optimizer reward replay | Medium / High | **Confirmed on current HEAD.** One live-card/two-transaction run made seven calculator calls and repeated both structural reward scans on every call. The isolated current-catalog differential establishes material latency without an output change. | `RPF13-PERF-001`; **0 debugger-new** |
| A prefixed XLSX can bypass archive preflight and still reach SheetJS ZIP inflation | — | **Refuted.** Every tested prefix changes offset-zero dispatch to `not-zip`; the parser returns no transactions and never preserves workbook parsing. | No finding |

## Confirmed retained root 1 — post-exhaustion cap loss is not represented

- **Calculation sites:** `packages/core/src/calculator/reward.ts:314-388,
  451-559,788-845,1025-1040`
- **Optimizer replay and result construction:**
  `packages/core/src/optimizer/greedy.ts:207-250,286-445`
- **Browser projection:** `apps/web/src/lib/cap-disclosures.ts:23-50`
- **Browser copy:** `apps/web/src/components/ui/CapDisclosures.svelte:20-35`
- **Generic unassigned presentation:**
  `apps/web/src/components/report/ReportContent.svelte:57-64`;
  `apps/web/src/components/dashboard/SavingsComparison.svelte:135-147`
- **Terminal/standalone projection:**
  `packages/viz/src/cap-disclosure.ts:16-29`
- **Existing state-transition test:**
  `packages/core/__tests__/cycle7-exact-reward-cap-state.test.ts:326-349`
- **Current authored witness:**
  `packages/rules/data/cards/bc/baro-clear-plus.yaml:20-23,75-106`

`previewRuleAvailability()` first determines that a rule's monthly/shared or
card-global capacity is exhausted. An otherwise positive exclusive candidate
then becomes the same undifferentiated `inapplicable` state used for a rule
that offers no benefit. It never reaches checked reward execution, and neither
its cap-blocked reason nor its potential reward survives.

The earlier transaction that exactly reached the cap does survive as one
`CapInfo` event. That event correctly records equal event-local
`actualReward` and `appliedReward`. The existing regression deliberately
requires that it be emitted once and not emitted again for a later transaction
after exhaustion. Presentation then subtracts those two event-local fields,
gets zero, and expands zero to the unqualified conclusion `혜택 손실 없음`.

### Independent executable witness

I loaded the checked-in optimizer artifact and selected the real
`bc-baro-clear-plus` card. Its supported `reward-002` gives 10% at `tier1` for
Coupang, with a 5,000 Won monthly cap. Optimizing two 50,000 Won Coupang
purchases with 150,000 Won previous spending returned:

```json
{
  "totalSpending": 100000,
  "totalReward": 5000,
  "unassignedSpending": 50000,
  "unassignedTransactionCount": 1,
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
  "browserDisclosure": {
    "lostReward": 0,
    "outcome": "혜택 손실 없음"
  }
}
```

The first purchase exactly earns 5,000 Won and consumes the cap. The second
matches the same supported positive rule but is filtered before execution. The
numeric result and decision not to invent a zero-benefit assignment are
correct. The dedicated cap explanation is not: the page introduces the list
as the amount not received because of a cap, yet the only conclusion says
there was no loss.

The most favorable competing interpretation is that the message describes
only the cap-reaching transaction. The product copy does not establish that
scope: “한도가 적용된 혜택과 한도 때문에 받지 못한 금액” is analysis-level,
“적용 혜택” has no transaction identity, and the terminal/report helper has the
same unqualified outcome. The separate generic unassigned-spending row cannot
repair that affirmative conclusion because it does not identify the cap or
the suppressed amount.

Reachability is broad rather than synthetic. The current optimizer artifact
contains **1,004 supported positive monthly-capped rules across 371 cards**;
all 1,004 are exclusive. The same availability path also handles exact global
cap exhaustion.

### Fix boundary and regression requirements

Preserve a typed cap-exhaustion reason and a checked potential reward when a
positive candidate is rejected solely because rule/shared/global capacity is
gone. Reconcile that gross suppressed reward with fallback rules and
alternative cards before describing net analysis loss. Do not force the
exhausted rule through normal execution or change selection merely to collect
telemetry.

If the product intentionally keeps `CapInfo` event-local, the minimum safe
copy is correspondingly local, such as “한도 도달 거래에서 삭감 없음”; it
must not claim analysis-wide absence of cap loss. Complete tests should compose
exact reach plus a later eligible transaction, clipped reach plus a later
transaction, rule/shared/global caps, additive and exclusive rules, fallback
rules, alternative cards, zero-loss controls, and every browser/terminal/
standalone sink.

**Debugger result:** confirmed, Medium severity, High confidence, current
status Confirmed. This remains one aggregate root under `C13-CR-001`.

## Confirmed retained root 2 — validation work is multiplied by replay

- **New structural scan and map construction:**
  `packages/core/src/calculator/reward.ts:74-121`
- **Unconditional calculator calls:**
  `packages/core/src/calculator/reward.ts:742-752`
- **Existing adjacent structural scan:**
  `packages/core/src/calculator/reward.ts:56-72`
- **Optimizer replay sites:**
  `packages/core/src/optimizer/greedy.ts:195-230,286-390,405-445,603-624`
- **Already validated browser catalog boundary:**
  `apps/web/src/lib/analyzer.ts:191-215,253-259`
- **Publication validator:**
  `packages/rules/src/catalog-validation.ts:407-459`

`assertCoherentCapGroupMonthlyCaps()` correctly rejects inconsistent
shared-cap definitions. It visits every supported rule and tier and creates
outer and per-group maps. `calculateRewards()` invokes it unconditionally.
That defensive behavior is appropriate for the public calculator, but
`greedyOptimize()` repeatedly calls the calculator with the same card object:
before and after each candidate transaction, while building final assignments
and alternatives, while constructing card results, and while finding the best
single card.

I instrumented a live one-card input without changing repository source by
counting calls to that card's reward-array `forEach`. Two transactions
produced:

```json
{
  "structuralForEachCalls": 14,
  "inferredCalculateRewardsCalls": 7,
  "totalReward": 5000,
  "unassigned": 1
}
```

There are exactly two whole-reward-array `forEach` scans at calculator entry:
unique tier-reference validation and the new cap-coherence validation. Seven
calculator replays therefore perform fourteen structural scans for one
immutable card and two transactions.

The performance lane independently removed only the new coherence invocation
in an isolated exact-HEAD copy and obtained byte-identical outputs. On the real
682-card artifact with 100 transactions it measured 125,075 calculator calls,
451,946 new coherence maps, 326,871 supported-reward visits, and 737,954 tier
visits. Alternating five-sample medians were **267.6 ms current versus
221.8 ms comparison**, a **45.8 ms / 20.6%** delta. A fresh 1,000-transaction
run returned the same 1,326,730 Won reward and 70 assignments, but took
3,455.5 ms current versus 3,153.8 ms comparison.

The strongest safety objection is that direct callers can supply a mutable,
unvalidated `CardRuleSet`. That requires validation at each public boundary;
it does not require rebuilding the same proof for every internal replay. An
arbitrary direct optimizer caller can be rejected by one preflight per distinct
card before scoring. The generated browser catalog has already passed the
publication validator and is loaded as a cached object graph.

The fix should use an invocation-scoped, opaque prepared-card capability:
validate/compile each distinct card once at the optimizer boundary, then pass
that capability to a private calculator path for replay. Keep the public
`calculateRewards()` defensive. A bare global `WeakSet` is unsafe unless
immutability is enforced because a caller could mutate an object after its
first validation. Regression coverage should exercise malformed shared groups
through both public boundaries, output parity between prepared and direct
calculation, and an operation-count ceiling of at most one cap-coherence
validation per card per optimization run.

**Debugger result:** confirmed, Medium severity, High confidence, current
status Confirmed. This remains one aggregate root under `RPF13-PERF-001`.

## Refuted and deduplicated latent candidates

### Prefixed XLSX remains rejected

`preflightXLSXArchive()` requires `PK` at bytes zero and one
(`packages/parser/src/shared/xlsx-archive.ts:113-132`). I generated a valid
SheetJS workbook in memory, then tested prefixes `[0]`, `[32]`, `[10]`,
`[0,0,0,0]`, and `[65]`.

Every prefixed buffer returned `kind: "not-zip"` from preflight.
`parseXLSXBuffer()` returned zero transactions and the sanitized
`헤더 행을 찾을 수 없습니다.` diagnostic. The unprefixed workbook retained its
`PK` ZIP dispatch. No prefix preserved workbook parsing or reached ZIP
inflation, so the candidate has no executable failure scenario.

### Other challenged paths

- The CLI production path adopts its unique filesystem `Buffer`; non-Buffer
  injected sources are copied, and digest checks bind local parse, consent,
  and any remote retry to one snapshot (`tools/cli/src/parse-statement.ts:
  58-128`). A malicious injected dependency is not the production trust
  boundary, so no mutation or copy-regression finding was promoted.
- The root `parse` script now reaches the supported CLI command, and process
  coverage exercises help, missing, nonexistent, and valid inputs. No export-
  barrel regression survived.
- `cleanHTML()` skips normalized-empty selectors and the extractor rejects
  trimmed-empty input (`tools/scraper/src/fetcher.ts:321-360`;
  `tools/scraper/src/extractor.ts:38-52`). A selector containing only invisible
  non-whitespace code points is, at most, incomplete scope of the historical
  Cycle 12 meaningful-content root without a current product witness; it is
  not a new root.
- Pull requests run read-only verification, while Pages upload and deployment
  are limited to manual runs or pushes to `main`
  (`.github/workflows/deploy.yml:3-79`). No PR publication regression exists.
- The current catalog contains no supported shared `capGroup` across distinct
  rules. Prospective shared-group wording and labels therefore do not establish
  a separate current-data defect.
- A headless upload attempt reported by the design lane produced no DOM,
  console, stack, repeatable trace, or product-state evidence. It remains
  inconclusive rather than a third debugger finding.

## Historical reconciliation

| Historical owner | Duplicate decision |
| --- | --- |
| Cycle 7 / Plan 104 exact global-cap event | Fixed control. It made the exact-reaching transaction observable; the current failure starts with later eligible spending. |
| Cycle 8 / Plan 110 exact rule-cap event | Fixed control. It intentionally emits one equal actual/applied reach event and not another after exhaustion. Presentation overstates what that event proves. |
| Cycle 3 `C3-D02` / deferred `D-29` | Different historical behavior. It concerned arbitrary zero-marginal assignment and suggested a cap annotation. Plan 110 now leaves zero-benefit spending unassigned. The newer affirmative no-loss conclusion remains independently false. |
| Cycle 11 / Plan 127 plural rule/cap identity | Different scope. It preserved event identity but did not model positive reward suppressed after exhaustion. |
| Cycle 12 / Plan 136 browser cap disclosure | The downstream introduction point. It added the broad loss copy and assumed event-local fields were authoritative for analysis-wide lost benefit. |
| Deferred optimizer replay redesign (`D-C1-040`, `D-C10-02`) | The replay count is historical debt, but the new whole-card coherence scan and map allocations were added afterward and are removable without redesigning the optimizer. `RPF13-PERF-001` owns only that new constant factor. |

No additional cap, optimizer, parser, state/race, persistence, worker,
scraper, CLI, workflow, or presentation candidate survived both the evidence
and novelty checks.

## Verification

This role ran the focused cross-boundary suite:

```text
388 tests
1,309 expectations
15 files
0 failures
```

It covered exact rule/global cap state, shared-cap identity, optimizer
replays, catalog semantics, browser cap projection, analysis coherence,
persistence, optimizer worker ownership and decoding, CLI unit/process
contracts, XLSX archive preflight, scraper fetch/extract/schema contracts, and
workflow authority. The same exact HEAD also passed the full non-browser
repository verifier before this report was finalized.

The six protected Cycle 42 artifacts remained outside this role's write scope.
The only repository path written by this role is
`.context/reviews/cycle13-debugger.md`.

**Final disposition: retain `C13-CR-001` and `RPF13-PERF-001`; 0
debugger-new findings.**
