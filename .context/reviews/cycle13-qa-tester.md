# Review-plan-fix Cycle 13 — QA tester

## Revision lock and disposition

- Date: 2026-07-24
- Reviewed revision: `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **2 current Cycle 13 findings independently confirmed; no
  additional QA finding**
- Retained severity: **2 Medium**
- Confidence/status: **both High / Confirmed**
- New QA finding count: **0**
- Scope: review, read-only probes, source/unit/process tests, and this report
  only; no implementation, source/test/config/generated-artifact change,
  staging, commit, push, deployment, browser, server, or E2E run

The exact-cap finding is one root under the same-cycle aliases
`C13-CR-001`, `C13-CT-001`, `RPF13-TE-001`, and `RPF13-VER-001`.
`RPF13-PERF-001` remains the separate validation-placement root. This QA pass
does not create duplicate IDs.

## Inventory and QA method

The locked Git tree contains **2,318 tracked paths**: **1,152** tracked
`.context` records and **1,166** active product, data, test, documentation,
workflow, configuration, and vendor-integrity paths.

| Family | Paths |
| --- | ---: |
| `packages` | 878 |
| `apps` | 171 |
| `tools` | 63 |
| `scripts` | 19 |
| `e2e` | 16 |
| Root/workflow/configuration/vendor | 19 |
| `.context` | 1,152 |

The test inventory contains **143 runnable specification files**. Per the
role constraint, the 10 Playwright E2E specifications were inventoried but
not executed. All **133 non-E2E unit and repository-process files** were
exercised. The active data surface contains 683 authored cards across 24
issuers, a 682-card optimizer artifact, and 551 optimizer-executable cards.

Before adjudication I indexed all **1,167 `.context` files then present**:
1,152 tracked records, six protected Cycle 42 artifacts, and nine earlier
Cycle 13 reports. I directly reconciled the deferred ledger, Cycle 7–12
aggregates and QA/test reports, Plans 104, 110, 121, 127, 129, 130, and 136,
the corrected prefixed-XLSX investigation, and every current same-cycle
candidate. Coverage gaps that explain an already-owned product failure are
repair requirements for that root, not new QA findings.

The debugger and document-specialist reports appeared during final integrity
checking. I read and reconciled both before close; they independently confirm
the same two roots and add no ID. The final pre-QA-report dedupe corpus was
therefore 1,169 files, and the corpus including this report is 1,170 files.

## Cross-surface QA matrix

| Surface | Files/tests executed | Success and failure-state coverage | Result |
| --- | ---: | --- | --- |
| Core calculator/optimizer | 16 files, 273 tests | Safe integers/currencies, tiers, rule selection, exact/clipped/zero caps, shared identity/coherence, rollback, alternatives, deterministic ordering, unsupported rules | **Pass**, with the retained cross-layer exact-cap oracle gap independently reproduced below |
| Parser package | 23 files, 1,539 tests | CSV/TSV, XLS/XLSX, PDF, JSON, OFX/QFX, HTML, encoding/date/amount boundaries, archive budgets, adapter direction, diagnostics, local/remote failure states | **Pass** |
| Rules/catalog | 7 files, 137 tests | Schema rejection, semantic catalog validation, cap-group conflicts, safe URLs/provenance, optimizer artifact identity/parity, full authored catalog | **Pass** |
| Visualization | 3 files, 23 tests | Terminal sanitization, summary/comparison, standalone HTML escaping, exact and clipped cap event copy | **Pass**, but fixtures remain event-local and do not refute the retained aggregate-loss failure |
| Web source/runtime units | 56 files, 836 tests | Parser parity/workers, queues/cancellation, analysis replacement/reset/coherence, persistence, optimizer worker, formatting, cap helpers, component/page source contracts | **Pass**, with no composed exact-then-later producer-to-sink oracle |
| CLI | 10 files, 101 tests | Root command routing, help/error exits, parse/optimize/report processes, local-first consent/integrity, compiled catalog, exclusive/atomic report output, disclosures | **Pass** |
| Scraper | 10 files, 102 tests | Argument admission, DNS/network policy, redirects/body budgets, meaningful-content fallback, extraction quarantine, schema validation, safe writer | **Pass** |
| Repository/workflows | 8 files, 72 tests | Toolchain pin, dependencies/vendor integrity, publication, generated docs, workflow event/permission/order contract, bundle graph, E2E process ownership as pure process tests | **Pass** |

The seven workspace suites were forced past Turbo's local cache and executed
fresh:

```text
parser    1,539 pass
web         836 pass
core        273 pass
rules       137 pass
scraper     102 pass
CLI         101 pass
viz          23 pass
scripts      72 pass
-------------------
total     3,083 pass, 0 fail
```

Additional non-browser process gates passed:

- exact Bun 1.3.12 toolchain;
- domain-contract migration cleanliness;
- dependency/import and vendored-archive integrity;
- `bun audit` with no reported vulnerability;
- generated data and documentation drift checks for all 683 cards;
- all package typechecks; Astro reported 0 errors, 0 warnings, and 0 hints.

## Retained finding 1 — exact reach-event equality becomes a false analysis-wide no-loss conclusion

- **Aggregate aliases:** `C13-CR-001`, `C13-CT-001`,
  `RPF13-TE-001`, `RPF13-VER-001`
- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed by independent current-catalog QA controls
- **Result DTO:** `packages/core/src/models/result.ts:25-35`
- **Exhaustion filter:** `packages/core/src/calculator/reward.ts:314-388`
- **Selection/early exit:**
  `packages/core/src/calculator/reward.ts:451-559,807-845`
- **Reach events:**
  `packages/core/src/calculator/reward.ts:953-990,1025-1040`
- **Optimizer projection:**
  `packages/core/src/optimizer/greedy.ts:207-250,405-445,514-535`
- **Browser sink:** `apps/web/src/lib/cap-disclosures.ts:23-50`;
  `apps/web/src/components/ui/CapDisclosures.svelte:20-35`
- **Visualization sinks:**
  `packages/viz/src/cap-disclosure.ts:16-29`;
  `packages/viz/src/terminal/summary.ts:86-97`;
  `packages/viz/src/terminal/comparison.ts:77-89`;
  `packages/viz/src/report/generator.ts:415-435`
- **Existing incomplete oracle:**
  `packages/core/__tests__/cycle7-exact-reward-cap-state.test.ts:326-349`
- **Current witness:**
  `packages/rules/data/cards/bc/baro-clear-plus.yaml:20-23,75-106`

### Independent QA control matrix

I loaded `bc-baro-clear-plus` from the checked optimizer artifact. Its
supported tier-1 Coupang rule pays 10% with a 5,000 Won monthly cap. The
optimizer was restricted to that card with 150,000 Won previous spending.

| Scenario | Correct reward state | Current cap telemetry | Browser/viz outcome | QA verdict |
| --- | --- | --- | --- | --- |
| One 50,000 Won purchase, exact hit is final | 5,000 reward; 0 unassigned | one 5,000/5,000 exact event | `혜택 손실 없음` | **Truthful control** |
| Same exact hit, then another eligible 50,000 Won purchase | 5,000 reward; 50,000 unassigned | unchanged one 5,000/5,000 event | unchanged `혜택 손실 없음` | **Failure confirmed** |
| One 60,000 Won purchase, clipped at 5,000 | 5,000 reward; 0 unassigned | one 6,000/5,000 event | 1,000 Won loss | **Truthful clipped control** |

The exact-then-later optimizer output was:

```json
{
  "totalSpending": 100000,
  "totalReward": 5000,
  "unassignedSpending": 50000,
  "unassignedTransactionCount": 1,
  "capsHit": [{
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

The first purchase correctly records that its own reward was not clipped.
The later rule is reduced to undifferentiated `inapplicable` before execution,
so its otherwise positive reward and cap-blocked reason never enter the DTO.
The optimizer records only generic unassigned spending and recalculates
`cardResults` from assigned transactions. Browser and visualization then
subtract the earlier event's values and overstate that event-local zero as the
loss result for the analyzed input.

A separate synthetic card-wide control confirmed the same failure mode. Two
25,000 Won purchases cumulatively reached a 5,000 Won global cap exactly and
truthfully rendered no loss. Adding a third eligible 25,000 Won purchase left
the 5,000 Won total, the sole 2,500/2,500 `monthly_total` event, and the
no-loss outcome unchanged.

### Why green suites do not refute it

The core regression at
`cycle7-exact-reward-cap-state.test.ts:326-349` already includes an exact
cumulative hit followed by a later purchase. It correctly asserts one
reach-event and no duplicate event after exhaustion, but never passes that
result to a loss formatter. Browser and viz tests construct isolated event
fixtures and correctly expect an exact **event** to report zero clipping.
No suite compares the truthful exact-at-end control with the failing
exact-then-later analysis through a production sink.

### Required repair and acceptance tests

Keep “cap reached on this transaction” separate from “reward suppressed after
the cap was exhausted.”

1. At minimum, document `CapInfo` as event-local and narrow the exact copy to
   no clipping on the cap-reaching purchase; do not infer aggregate no-loss
   from equal event values.
2. If complete numeric disclosure is required, preserve a typed cap-exhausted
   reason and checked potential reward with stable card/rule/cap identity.
3. Define gross per-card blocked reward separately from fallback reward and
   net portfolio loss. Do not sum repeated greedy candidate replays.
4. Compose calculator/optimizer output through worker decoding, coherence,
   persistence, browser, terminal, and HTML tests for exact-at-end,
   exact-then-later, clipped-plus-later, rule/shared/global caps,
   additive/exclusive selection, lower-rule/alternate-card fallback, zero
   caps, and all-unassigned inputs.

## Retained finding 2 — cap-group coherence validation repeats on every optimizer replay

- **Aggregate alias:** `RPF13-PERF-001`
- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed by independent invocation counting and failure controls
- **Validator:** `packages/core/src/calculator/reward.ts:74-121`
- **Unconditional call:** `packages/core/src/calculator/reward.ts:742-752`
- **Replay sites:**
  `packages/core/src/optimizer/greedy.ts:195-230,295-309,359-390,
  405-445,603-624`
- **Catalog validator:** `packages/rules/src/catalog-validation.ts:407-459`
- **Browser worker path:** `apps/web/src/lib/analyzer.ts:191-215,253-259`;
  `apps/web/src/lib/optimizer/worker-runner.ts:52-135`
- **CLI catalog and callers:** `tools/cli/src/card-catalog.ts:31-80`;
  `tools/cli/src/commands/optimize.ts:76-97`;
  `tools/cli/src/commands/report.ts:81-101`

### Independent QA control matrix

I instrumented the `tiers.forEach` boundary of a valid one-card fixture and
classified its call stack without changing repository source.

```json
{
  "transactions": 3,
  "reward": 300,
  "coherenceCalls": 9,
  "uniqueTierCalls": 9,
  "otherTierForEach": 0
}
```

For one card and three transactions, the optimizer invoked
`assertCoherentCapGroupMonthlyCaps()` nine times: the before/after scoring
replays plus final result paths. The same immutable card definition was
validated each time.

The important failure-state controls remain correct. A fixture with two
supported rules sharing `capGroup: "shared"` but defining 1,000 and 2,000 Won
monthly caps failed through both public boundaries with the same precise
diagnostic:

```text
cap group "shared" defines monthlyCap 2000 for performance tier "t",
but rewards.0.tiers.0.monthlyCap defines 1000
```

Thus QA does not recommend removing the invariant. Direct
`calculateRewards()` must validate arbitrary mutable input, and direct
`greedyOptimize()` must reject malformed cards. The failure is lifecycle
placement: a valid card is rescanned for every replay even though the
generated artifact already passed publication validation and CLI authoring
mode calls `validateCardCatalog()`.

### Required repair and acceptance tests

- Prepare an invocation-scoped opaque/immutable card representation once per
  distinct optimizer card.
- Keep public `calculateRewards()` defensive, then execute through a private
  prepared path.
- Use the prepared path for scoring, assignments, alternatives, card results,
  and best-single evaluation.
- Do not use a bare process-global `WeakSet` while callers can mutate a
  previously validated object.
- Preserve malformed-group rejection at both public boundaries, prove
  prepared/direct output parity, and assert at most one coherence validation
  per distinct card per optimizer invocation. Add a bounded full-artifact
  operation/time regression.

This root is distinct from deferred `D-C1-040` / `D-C10-02`, which owns the
older greedy replay algorithm. The new rule/tier scan was added in
`2812cea6bcbf568d5caf3b89bc00a71d01171095` and can be hoisted without
implementing an incremental reward accumulator.

## Explicit rejection — prefixed XLSX does not enter ZIP inflation

The historical leading-NUL/prefixed-XLSX hypothesis remains **rejected**.

`preflightXLSXArchive()` enters ZIP metadata inspection only when bytes zero
and one are `PK`; otherwise it returns `not-zip`
(`packages/parser/src/shared/xlsx-archive.ts:113-132`). SheetJS likewise
dispatches to `read_zip` only from the offset-zero `0x50 0x4b` case; other
prefixes fall through to legacy/plaintext parsing
(`node_modules/xlsx/xlsx.mjs:27239-27271`).

I generated a valid one-row workbook and exercised both server and web parser
implementations:

```text
valid prefix:              [80, 75]
valid preflight:           zip
valid server/web rows:     1 / 1

leading-NUL prefix:        [0, 80]
prefixed preflight:        not-zip
prefixed server/web rows:  0 / 0
prefixed error:            헤더 행을 찾을 수 없습니다.
```

The prefixed input produced a synthetic plaintext/PRN interpretation, did not
preserve the workbook's sheet semantics, and did not reach ZIP inflation.
This matches the corrected Cycle 9 reproduction and supplies no new evidence
for resurrection.

## Historical reconciliation and final missed-issue sweep

- Cycle 7/Plan 104 and Cycle 8/Plan 110 correctly added exact cap-reach events.
  The retained disclosure failure starts with later eligible spending and the
  newer analysis-wide copy.
- Deferred `D-29` concerned old zero-benefit assignment behavior, not the
  later affirmative no-loss conclusion.
- Plan 127 added plural rule/cap-group identity; Plans 130 and 136 added
  period-aware viz and browser presentation. None modeled post-exhaustion
  loss scope.
- Plan 129 correctly introduced cap-group coherence. Repeating the invariant
  during every optimizer replay is a new placement cost, not the fixed
  correctness defect.
- Cycle 10/Plan 121 removed a different duplicated browser
  analysis-coherence pass.
- Same-category cap identity presentation remains owned by Cycle 12
  `C12-CT-001`; it is not a new QA root.

The final sweep revisited valid, empty, malformed, unsafe-integer,
foreign-currency, exact, clipped, zero, post-exhaustion, cumulative,
shared/global/rule cap, fallback, all-unassigned, worker-cancelled,
persisted/restored, parser-format, encoding, archive-budget, CLI consent,
atomic-output, scraper-empty/body-budget/quarantine, generated-data drift,
workflow-trigger/permission, and terminal/HTML escaping paths. Every
additional candidate was fixed, deferred, historically owned, a direct test
facet of the two retained roots, or unsupported by a reproducible product
failure. No third genuinely new QA defect survived.

## Repository integrity

HEAD and branch remained locked. Tracked and staged diffs were empty before
this report. The only repository path written by this QA role is
`.context/reviews/cycle13-qa-tester.md`. The six protected Cycle 42 artifacts
remained byte-identical.

**Final QA count: retain 2 current Cycle 13 findings — both Medium, High
confidence, Confirmed; 0 additional QA findings.**
