# Cycle 13 — Code Reviewer

## Review identity and disposition

- **Reviewed revision:** `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9`
- **Branch:** `codex/review-plan-fix-no-deploy-20260723`
- **Lens:** correctness, logic, code quality, SOLID boundaries, cross-package
  contracts, failure behavior, and maintainability
- **Disposition:** **1 genuinely new current-HEAD finding**
- **Finding count:** 1 Medium, 0 High/Critical
- **Confidence:** High
- **Validation:** confirmed by direct calculator and optimizer execution; no
  manual validation is required

This was a review-only pass. No product source, test, generated artifact,
plan, dependency, commit, deployment, or protected Cycle 42 artifact was
changed.

## Complete inventory and coverage

I built the repository inventory from the exact Git tree before reviewing
implementation. HEAD contains **2,318 tracked files**:

| Family | Files | Review treatment |
| --- | ---: | --- |
| `.context` historical reviews/plans | 1,152 | Complete path inventory and topic search; Cycle 12 aggregate, specialist reports, Plans 129–137, and every historical hit related to retained/rejected candidates were read directly |
| `packages` | 878 | All implementation/test/config paths inventoried; core calculation/optimization, parser kernels/adapters, rule schema/semantics, and viz sinks traced directly |
| `apps` | 171 | All implementation/test/config paths inventoried; upload → parse → analysis → worker → persistence → dashboard/results/report paths traced directly |
| `tools` | 63 | CLI parsing/analysis/reporting and scraper fetch/extract/validate/write paths traced directly |
| `scripts` | 19 | Publication, dependency, bundle, README, migration, and E2E-process checks inspected and executed where applicable |
| `e2e` | 16 | Runner/process ownership plus page-flow specifications and fixtures inventoried |
| Root, workflow, instructions, vendor policy, `.omc` | 19 | Direct inspection and consistency checks |

The extension inventory is 1,180 Markdown, 686 YAML, 321 TypeScript, 59 JSON,
15 Svelte, 14 JavaScript, 13 CSV, 6 Astro, 5 HTML, and 29 other
configuration/fixture/vendor files. The active source inventory contains
**363 non-generated TS/JS/Svelte/Astro/CSS/HTML files**, **147 test/E2E
paths**, and **52,787 implementation lines**. The declarative population is
**683 authored card YAML files across 24 issuers**, plus its generated catalog
families.

The complete sorted manifest SHA-256 is
`af023ceb841754a802816c05ee6ede12823f6a7316099a7f03ddd0f49b00a5cd`;
excluding `.context`, it is
`c2a5477df81359722ca37509f76be9be4090b2a8fdb87f9c1d9684e76d23e6c1`.
The large YAML/generated populations were not sampled: the review followed
their shared schema, semantic validator, publication projection, runtime
readers, and complete executable `data:check` coverage.

Cross-file traces included:

1. statement bytes → format/encoding detection → concrete parser → typed facts
   → categorization → calendar/performance context;
2. card YAML → schema/semantic validation → optimizer artifact → web/CLI
   loaders → reward calculator → greedy assignment;
3. rule/per-transaction/shared/global caps → optimizer clone boundary →
   persistence/coherence → browser, terminal, and standalone-report sinks;
4. upload and optimizer worker cancellation/ownership → store replacement,
   reset, and reload;
5. scraper target/network policy → bounded fetch → untrusted LLM extraction →
   quarantine → semantic validation → atomic writer;
6. workflow/build/publication/dependency/bundle policy → checked-in generated
   artifacts and deployment gates.

## Finding

### C13-CR-001 — Exact cap exhaustion hides later cap-blocked reward while every disclosure reports “혜택 손실 없음”

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed on current HEAD
- **Manual validation:** Not required
- **Primary calculation sites:** `packages/core/src/calculator/reward.ts:314-388,
  451-559, 1025-1040`
- **Public result contract:** `packages/core/src/models/result.ts:25-35`
- **Optimizer propagation:** `packages/core/src/optimizer/greedy.ts:224-250,
  514-557`
- **Browser presentation:** `apps/web/src/lib/cap-disclosures.ts:23-50`;
  `apps/web/src/components/ui/CapDisclosures.svelte:20-35`
- **Terminal/report presentation:** `packages/viz/src/cap-disclosure.ts:16-29`
- **Existing regression that exposes the gap:** `packages/core/__tests__/
  cycle7-exact-reward-cap-state.test.ts:326-349`
- **Live catalog witness:** `packages/rules/data/cards/bc/
  baro-clear-plus.yaml:20-23,75-106`

`previewRuleAvailability()` marks a candidate inapplicable as soon as its
monthly cap or the card-global cap has no remaining capacity. The skipped
candidate therefore never reaches reward execution, and its otherwise
positive uncapped reward is not recorded anywhere. The only retained
`CapInfo` is the earlier event that happened to reach the cap. When that event
was an exact hit, `actualReward === appliedReward`.

Every presentation helper treats that event-local equality as proof that no
benefit was lost:

```text
lostReward = max(0, actualReward - appliedReward)
=> 0
=> "혜택 손실 없음"
```

That conclusion is false once another matching purchase occurs after the
exact hit. The browser section makes the scope especially explicit: it tells
the user to inspect “한도 때문에 받지 못한 금액,” then reports none. Terminal
and standalone report use the same event-local subtraction.

#### Reproduction with a current authored card

I loaded the checked-in optimizer artifact and selected
`bc-baro-clear-plus`. Its supported `reward-002` gives 10% at `tier1` with a
5,000 Won monthly cap for the authored Coupang allowlist. I optimized two
50,000 Won Coupang purchases with 150,000 Won previous spending and only this
card selected.

Current HEAD returned:

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
  "browserDisclosure": {
    "lostReward": 0,
    "outcome": "혜택 손실 없음"
  }
}
```

The first purchase exactly consumes the 5,000 Won cap. The second purchase
would produce another 5,000 Won under the same supported rule, but
`previewRuleAvailability()` filters it before execution. Its cap-caused lost
reward is neither added to the existing event nor represented by another
typed reason. The optimizer's generic unassigned-spending amount does not
identify the exhausted cap or the 5,000 Won foregone reward, while the
dedicated cap disclosure affirmatively says there was no loss.

This is not an isolated synthetic shape. A complete query of the current
canonical optimizer artifact found **1,004 supported positive
monthly-capped rules across 371 cards**. Exact exhaustion followed by another
eligible purchase is ordinary input for those rules. Global exact exhaustion
has the same telemetry gap because the same availability preview suppresses
later candidates.

The reward total and greedy assignment remain internally consistent, which is
why the severity is Medium rather than High. The defect is the authoritative
explanation: users receive a concrete but understated lost-benefit amount
from every cap sink.

#### Recommended fix

Separate “the cap was reached on this event” from “total reward discarded
because this cap was exhausted.”

1. Preserve a typed cap-exhaustion reason and checked potential reward when a
   matching positive candidate is rejected solely because the rule/shared or
   global cap has no remaining capacity. Do not change exclusive fallback or
   assignment selection merely to collect telemetry.
2. Aggregate foregone reward by card and cap identity, or add an explicit
   `lostReward`/exhaustion summary whose scope is unambiguous. Presentation
   code must not infer analysis-wide loss from one reach event's
   `actualReward - appliedReward`.
3. If exact loss cannot be modeled at the current result boundary, remove the
   unconditional “혜택 손실 없음” claim and describe it narrowly as no clipping
   on the cap-reaching purchase.
4. Add calculator, optimizer, browser, terminal, report, worker, coherence,
   and persistence regressions for:
   - single and cumulative exact hit followed by a matching purchase;
   - rule, shared-group, and global monthly caps;
   - an exhausted specific rule that correctly falls back to another rule or
     card;
   - clipped-on-hit plus later exhausted purchases, without double counting;
   - zero-cap and all-unassigned cases.

## Historical reconciliation and rejected candidates

This finding is not a restatement of the earlier exact-cap findings:

- Cycle 7 found that exact **global** exhaustion was absent from `capsHit`;
  Plan 104 added the reach event.
- Cycle 8 found the parallel exact **rule** omission; Plan 110 added one event
  with equal actual/applied reward. Its current regression explicitly expects
  the event once and “not again after exhaustion.”
- Cycle 11/Plan 127 added plural rule/cap-group identity.
- Cycle 12 Plans 130 and 136 added period-specific standalone copy and browser
  disclosures. Those changes made `capsHit` the browser's claimed source for
  both applied and lost amounts.

None of those reports measured positive reward suppressed *after* an exact
hit. The Cycle 8 behavior intentionally retained only the reach event; the
new current failure is that downstream loss copy treats that intentionally
partial event as complete loss telemetry. Searches across all current and
archived context for exact hits, post-exhaustion transactions, cap loss, and
“혜택 손실 없음” found no prior owner for this sequence.

Candidates not retained:

- **Shared `capGroup` labeled “카테고리별 월 한도”:** coherent groups can span
  categories in the public rule contract and Cycle 12 synthetic regression,
  so the legacy `monthly_category` name is imprecise for custom catalogs.
  However, a complete current-artifact query found **zero** supported shared
  groups, and no current authored result produces the cross-category label.
  I recorded it as a manual/API semantics risk rather than inflating it into a
  second current-catalog finding. If shared groups are authored, introduce a
  group-scoped cap type/label or carry enough metadata to choose the label.
- **Fact values without a parallel `factProvenance` entry:** persistence
  validates both structures but does not require one-to-one presence.
  Direct-core callers intentionally remain compatible with typed facts that
  have no serialized source descriptor, and every current parser/manual-edit
  producer inspected preserves provenance. No current producer/reload
  failure cleared the finding threshold.
- **CLI consent buffer mutation:** the digest guard detects a changed captured
  buffer before remote continuation, and production extractors are read-only.
  An injectable mutating dependency alone did not establish a current
  production defect.
- **Unnamed decorative SVGs:** already rejected in Cycle 9/Plan 119 and not
  resurfaced.
- **Prefixed XLSX ZIP inflation:** remains explicitly rejected. This pass
  found no new reproducible evidence and does not resurrect the hypothesis.

## Verification

- `bun run test` — passed all 12 workspace test tasks and the 72 root
  publication/policy/process tests; 0 failures.
- `bun run typecheck` — passed parser, rules, core, viz, scraper, CLI, and web;
  Astro reported 0 errors, 0 warnings, and 0 hints.
- `bun run data:check` — passed all 683 authored cards, 24 issuers, generated
  artifacts/shards/fallback labels, and README checks; 551 cards are reported
  optimizer-executable.
- Direct live-card calculator probe — confirmed the second positive rule
  reward disappears after exact exhaustion while the retained event has equal
  actual/applied values.
- Direct live-card optimizer probe — confirmed 100,000 Won analyzed, 5,000 Won
  reward, 50,000 Won unassigned, and browser/viz outcome
  “혜택 손실 없음.”
- Complete artifact query — confirmed 1,004 supported positive monthly-capped
  rules across 371 current cards and zero current supported shared cap groups.

## Final missed-issue sweep

The closing pass revisited checked arithmetic, tier and condition selection,
additive/exclusive projection, per-transaction/rule/shared/global caps,
rollback and occurrence state, optimizer marginal/counterfactual ordering,
calendar and performance provenance, all parser format/encoding/direction
boundaries, worker terminal ownership, persistence migrations/coherence,
catalog publication, CLI output, scraper trust/write boundaries, workflow
gates, and dashboard/results/report presentation. Cycle 12's nine completed
fixes remain closed. No second candidate survived executable validation and
historical deduplication.
