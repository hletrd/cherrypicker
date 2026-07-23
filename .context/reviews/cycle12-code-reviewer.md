# Review-plan-fix Cycle 12 — code reviewer

- Date: 2026-07-24
- Reviewed revision: `e72a4c69f7c0eab7053c61a587c2d040760c236c`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **3 genuinely new findings — 1 Medium, 2 Low**
- Scope: review and this report only; no implementation, source/test/generated
  artifact change, staging, commit, push, server, browser/E2E run, deployment,
  or external-system mutation

## Inventory and coverage

I classified all **2,291 tracked paths** before reviewing the implementation:
**1,129** tracked `.context` paths and **1,162** active product, data, test,
documentation, workflow, configuration, and vendor-integrity paths.

| Family | Tracked paths | Reviewed areas |
| --- | ---: | --- |
| `apps/web` | 168 | analysis lifecycle, workers, persistence/coherence, catalog loading, stores, upload queue, Svelte/Astro consumers, public artifacts, tests |
| `packages/core` | 43 | categorization, calculator/cap state, constraints, optimizer, result models, numeric guards, tests |
| `packages/parser` | 86 | detection/encoding and CSV, HTML, JSON, OFX, PDF, XLSX paths, shared amount/date/archive logic, fixtures/tests |
| `packages/rules` | 734 | schema/types, category registry, semantic validation, loaders/publication readers, 683 authored card YAML files, tests |
| `packages/viz` | 14 | terminal and standalone-HTML renderers, escaping, cap disclosures, tests |
| `tools/cli` | 28 | command/options flow, calendar analysis, custom catalog loading, consent/local-first parsing, reports, tests |
| `tools/scraper` | 35 | arguments/config, network fetch, HTML cleaning, LLM boundary, validation/quarantine, writer, tests |
| `scripts` | 19 | catalog/docs generation, dependency/toolchain/bundle/workflow checks, tests |
| `e2e` | 16 | static review of fixtures/specifications and process ownership; not executed |
| Root/other | 19 | manifests, lockfile, workflow, compiler/build configuration, documentation, vendored integrity inputs |

The active inventory contains 354 code-like paths, 174 test/E2E paths, 686
YAML paths, 58 JSON paths, and 29 Markdown paths (classifications overlap).
The sorted tracked-path manifest hashes were
`1e63a3eb6976ea3c9026611a888d460fdc589166021f1add07987793bb2f4ff4`
for the complete tree and
`a36230ca2fc486313b206852fd5864f1fa3931850bfa33e6dac5e0e4ac88be1d`
with `.context` excluded.

High-volume authored/generated data was reviewed through its complete schema,
semantic-validation, publication, source-hash, runtime-reader, and renderer
boundaries, plus catalog-wide executable queries where relevant. I also traced
the Cycle 11 changes end to end: composed amount signs, compiled merchant
boundaries, exact/plural cap telemetry, analysis persistence/coherence, and
external source labeling.

## Findings

### C12-CR-001 — `capGroup` is overloaded as rule identity and shared caps have no coherence validation

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed by static trace and two executable reproductions
- **Primary locations:**
  - `packages/core/src/calculator/reward.ts:88-90` maps every rule to
    `capGroup` as its general `rewardKey`.
  - `packages/core/src/calculator/reward.ts:315-321,345-387,633-639` uses that
    key for both projected/actual monthly-cap state and the
    `fixed_per_day` occurrence tracker.
  - `packages/core/src/calculator/reward.ts:790-805,837-860,897-968` applies
    each contributing rule's own `monthlyCap` against the shared counter.
  - `packages/rules/src/catalog-validation.ts:201-404,425-455` validates rules
    individually and checks same-scope ambiguity, but never validates one
    coherent monthly-cap definition for a shared `capGroup`.
  - `tools/cli/src/card-catalog.ts:45-56` and
    `tools/scraper/src/validators.ts:31-64` make that semantic validator the
    custom-authoring and scraper admission boundary.

The domain contract says that shared caps use `capGroup`, independent caps use
distinct groups, and source order must not determine behavior
(`.context/plans/_archive/68-cycle1-domain-state-contract.md:341-346`).
The implementation conflates two identities:

1. A schema-valid card with separate dining/grocery rules, the same
   `capGroup`, and tier-0 monthly caps of 100 and 1,000 Won passed
   `validateCardRuleSet`. `calculateRewards` returned 200 Won for
   dining-then-grocery but 100 Won for grocery-then-dining. The first order
   emitted a 100-Won cap event; the reverse emitted none.
2. With a coherent shared 1,000-Won monthly cap, two separate
   `won_per_day` rules worth 100 and 200 Won on the same date also passed
   validation, but returned only 100 Won. The first rule's
   `shared-monthly:2026-07-01` day key suppressed the second rule even though
   `capGroup` specifies cap sharing, not shared per-rule daily eligibility.

The optimizer's canonical transaction sort can make one ordering repeatable,
but it cannot make contradictory cap thresholds correct; direct public
calculator callers also observe the permutation difference. A catalog-wide
query found **zero currently authored shared cap groups across all 683 cards**,
so the deployed catalog is not presently affected. The defect is nevertheless
reachable through the supported CLI `--cards` authoring mode and can admit a
future reviewed scraper/catalog rule with materially wrong rewards.

- **Concrete failure scenario:** an author models two issuer benefits that
  share a monthly pool by assigning the same `capGroup`. A cap typo silently
  makes the computed benefit depend on which transaction is processed first;
  even with matching caps, two legitimate daily flat benefits can collapse to
  one.
- **Suggested fix:** introduce separate stable `ruleKey` and `capKey`
  identities. Use the rule ID for per-rule daily/occurrence state and only
  `capGroup` for shared monthly accounting. In semantic validation, group
  supported rules by card, `capGroup`, and performance tier, and reject
  differing `monthlyCap` values, including `null` versus a number. Add
  validator, custom-catalog, scraper, calculator, and optimizer regressions for
  order invariance, coherent/incoherent caps, and two fixed-per-day rules
  sharing only the monthly cap.

### C12-CR-002 — standalone HTML reports call per-transaction caps monthly

- **Severity:** Low
- **Confidence:** High
- **Status:** Confirmed by static trace and executable report generation
- **Locations:**
  - `packages/viz/src/report/generator.ts:412-427` hard-codes `월 한도` for
    every `CapInfo`.
  - `packages/core/src/models/result.ts:25-35` defines distinct
    `monthly_category`, `monthly_total`, and `per_transaction` cap types.
  - `packages/core/src/calculator/reward.ts:884-895` emits real
    `per_transaction` events.

Generating a report with a `per_transaction` event (`capAmount: 100`,
`actualReward: 150`, `appliedReward: 100`) produced:

```text
[카드] dining: 월 한도 100원 도달 — 50원 혜택 손실
```

This is a reachable current-data path: 44 supported authored rules have a
positive per-transaction cap. The total and loss amount remain correct, but
the period label changes the meaning of the warning.

- **Concrete failure scenario:** a purchase is clipped to a 100-Won
  per-purchase benefit. The saved HTML report tells the user the monthly cap
  was reached, so they can wrongly conclude that later purchases receive no
  benefit that month.
- **Suggested fix:** render a label from `capType`, for example `건당 한도`,
  `월 카테고리 한도`, and `카드 월 통합 한도`. Put the mapping in one shared
  visualization helper and add standalone-report coverage for all three types;
  terminal output can use the same helper for consistent specificity.

### C12-CR-003 — a whitespace-only first content container defeats scraper fallback

- **Severity:** Low
- **Confidence:** High
- **Status:** Confirmed by static trace and executable reproduction
- **Locations:**
  - `tools/scraper/src/fetcher.ts:334-365` stops on the first selector that
    exists before normalizing or testing its text.
  - `tools/scraper/src/cli.ts:156-169` sends the cleaned value directly to the
    extraction client.
  - `tools/scraper/src/extractor.ts:38-49,145-171` enforces only a maximum
    input size, so an empty source still becomes an LLM request.

For this bounded input:

```html
<main>
</main>
<section id="content">
  <h1>카드 혜택</h1><p>대중교통 10% 할인</p>
</section>
```

`cleanHTML` returned `""`. The raw whitespace from `<main>` is truthy, so the
loop breaks before `#content`; trimming happens only after the fallback
decision. The existing cleaner test covers a populated `<main>` only.

- **Concrete failure scenario:** an issuer page has an empty SPA shell
  `<main>` followed by server-rendered benefit text in `#content`. The scraper
  discards the benefit text and still spends an extraction request on an empty
  source, which can fail or return fabricated but quarantined card metadata.
- **Suggested fix:** normalize each candidate's text before selecting it and
  continue until a non-empty candidate is found; then use the normalized body
  as the final fallback. Reject an empty cleaned source before invoking the
  LLM. Add tests for an empty/whitespace first selector followed by populated
  later selectors and for body fallback.

## Historical reconciliation

I consulted the current aggregate and Cycle 5-11 reports, their completed
plans, the active deferred register, the protected Cycle 42 artifacts, and
targeted full-ledger searches across 1,136 current/archived plan and review
Markdown files. None of the three failure modes above is a prior finding,
accepted deferral, or already completed repair.

I did not re-report fixed Cycle 11 work: composed negative markers, repeated
merchant-boundary evaluation, plural rule-cap telemetry/identity, and truthful
third-party source labels all remain closed. The outgoing-plus-neutral amount
direction case remains an intentional outgoing preference already examined by
the Cycle 8 trace, and the `+0원` report copy remains the previously documented
non-actionable cosmetic case.

The rejected prefixed/leading-NUL XLSX ZIP-inflation hypothesis remains
rejected. This review found no new evidence that input without a byte-zero
`PK` signature reaches ZIP inflation, so it is not resurrected.

## Verification and final missed-issue sweep

- Fresh focused execution passed **83 tests** across calculator correctness,
  semantic catalog validation, scraper fetching/cleaning, and cap disclosures.
- `bun run test` passed all 12 workspace test tasks and the 71 root script
  tests. No browser or E2E suite was run.
- Executable probes confirmed both shared-cap failure modes, the
  per-transaction report label, and the empty scraper selection.
- Catalog-wide queries covered all 683 authored cards: zero currently shared
  `capGroup` values and 44 supported rules with positive per-transaction caps.

The closing sweep revisited rule selection and state projection, exact numeric
and cap accounting, optimizer canonicalization/alternatives, parser format and
amount/date boundaries, worker/persistence coherence, upload/reset races,
catalog schema/publication/authoring paths, standalone and web renderers, CLI
calendar/consent/output flows, scraper fetch/extract/write boundaries,
generated data, manifests, workflow configuration, and relevant test gaps.
Candidates already fixed, deferred, historical, intentionally specified, or
not reproducible were excluded.

**Final count: 3 new findings — 1 Medium, 2 Low.**
