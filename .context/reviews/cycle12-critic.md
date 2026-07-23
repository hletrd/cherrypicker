# Review-plan-fix Cycle 12 — critic

- Date: 2026-07-24
- Reviewed revision: `e72a4c69f7c0eab7053c61a587c2d040760c236c`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **changes requested**
- Final count: **1 genuinely new critic finding — 1 Medium**
- Scope: review and this report only; no implementation, source/test/generated
  artifact change, staging, commit, push, server, browser/E2E run, deployment,
  or external-system mutation

## Inventory and method

I locked the review to the exact revision above and inventoried all **2,291
tracked paths**: **1,129** tracked `.context` paths and **1,162** active product,
data, test, documentation, configuration, workflow, and vendor-integrity paths.

| Family | Tracked paths |
| --- | ---: |
| `apps/web` | 168 |
| `packages/core` | 43 |
| `packages/parser` | 86 |
| `packages/rules` | 734 |
| `packages/viz` | 14 |
| `tools/cli` | 28 |
| `tools/scraper` | 35 |
| `scripts` | 19 |
| `e2e` | 16 |
| Root/config/workflow/vendor/other | 19 |

The complete and active sorted-path manifest hashes were respectively
`1e63a3eb6976ea3c9026611a888d460fdc589166021f1add07987793bb2f4ff4` and
`a36230ca2fc486313b206852fd5864f1fa3931850bfa33e6dac5e0e4ac88be1d`.
Bulk authored/generated data was assessed through its complete schema,
semantic-validation, publication, identity, runtime-reader, and full-catalog
boundaries rather than sampling.

I challenged each same-cycle candidate against its producer, boundary, sink,
tests, executable behavior, and historical root cause. The final duplicate
index contained **1,142 `.context` Markdown files on disk**, including all
then-current Cycle 12 reports and the protected Cycle 42 artifacts.

## C12-CT-001 — the browser results and report surfaces discard every cap-hit explanation

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed by static cross-surface trace and a real-card executable
  optimizer reproduction
- **Producer contract:** `packages/core/src/models/result.ts:1-35`;
  `packages/core/src/optimizer/greedy.ts:405-447`
- **Preserved web boundary:** `apps/web/src/lib/store.svelte.ts:291-303`;
  `apps/web/src/lib/optimizer/worker-protocol.ts:87-144`;
  `apps/web/src/lib/persistence.ts:247-313`
- **Results-page sinks:** `apps/web/src/pages/results.astro:76-115`;
  `apps/web/src/components/ui/AnalysisWarnings.svelte:15-84`;
  `apps/web/src/components/dashboard/SavingsComparison.svelte:19-31`;
  `apps/web/src/components/dashboard/OptimalCardMap.svelte:9-48`
- **In-app/print report sink:**
  `apps/web/src/components/report/ReportContent.svelte:13-24,40-130,198-246`
- **Working comparison sinks:**
  `packages/viz/src/terminal/comparison.ts:77-89`;
  `packages/viz/src/terminal/summary.ts:86-97`;
  `packages/viz/src/report/generator.ts:346-383,412-427`

`CardRewardResult.capsHit` is the authoritative collection of reached caps,
including the uncapped and applied reward amounts. The worker and persistence
boundaries validate and retain it, and the Svelte store exposes the complete
`cardResults`. Both browser presentation paths then drop it:

- `/results` mounts parse warnings, a savings comparison, and the assignment
  map. `SavingsComparison` deliberately projects each card result to card,
  spending, reward, and rate, omitting `capsHit`; the other two components do
  not read it.
- `ReportContent` derives the complete `cardResults` and renders summary,
  unsupported-rule, assignment, and per-card sections, but never inspects
  `capsHit`.

This is not dead or speculative telemetry. A one-card optimizer probe loaded
the authored `bc-baro-on-off` rule with 300,000 Won previous spending and one
20,000 Won dining transaction. It assigned that transaction to the card and
returned:

```json
{
  "totalReward": 1000,
  "capsHit": [{
    "category": "dining",
    "capType": "per_transaction",
    "capAmount": 1000,
    "actualReward": 2000,
    "appliedReward": 1000,
    "ruleId": "reward-002",
    "capGroup": "reward-002"
  }]
}
```

The browser results and printable in-app report show the 1,000 Won reward but
never say that the purchase's calculated 2,000 Won benefit was clipped by a
1,000 Won per-purchase cap. The standalone HTML and terminal reports do surface
the same event. There are 44 supported authored reward rules with positive
per-transaction caps, in addition to monthly cap paths.

The numerical recommendation remains correct, which keeps this below High.
However, the primary browser experience withholds a financially material
explanation of why the reward is lower and whether later purchases can still
earn a benefit. That omission can make a per-purchase cap look like a weak rate
or make a monthly exhaustion impossible to diagnose.

**Root fix:** create one browser cap-disclosure projection over
`cardResults.flatMap(capsHit)` and render it on both `/results` and
`ReportContent`, including print. Use explicit labels for
`per_transaction`, `monthly_category`, and `monthly_total`; distinguish exact
exhaustion from clipped loss using `actualReward - appliedReward`; resolve the
raw category to its Korean label; and preserve card plus rule/cap-group identity
when several events share a category. Add component/source and browser
regressions for exact, clipped, repeated, and plural same-category events. The
type-label helper should be coordinated with `C12-CR-002`, but the two defects
remain separate: that report mislabels an event it renders, while the browser
renders no event at all.

## Same-cycle candidate falsification and ownership

| Candidate | Critic disposition | Independent evidence and duplicate result |
| --- | --- | --- |
| `C12-CR-001` — overloaded `capGroup` identity/coherence | **Confirm; retain Medium/High under the code report.** | A validator-accepted fixture returned 200 versus 100 Won when two rules sharing a group had 100/1,000 Won caps and transaction order was reversed. With coherent 1,000 Won caps, two separate `won_per_day` rules worth 100 and 200 Won collapsed to 100 because the group also keyed daily state. The current 683-card catalog has zero shared groups, limiting immediate deployment exposure but not the supported custom-authoring/future-catalog contract. |
| `C12-CR-002` — standalone report calls a per-transaction cap monthly | **Confirm; retain Low/High under the code report.** | A `per_transaction` event rendered as `월 한도 100원 도달`. The total/loss is correct, but the period claim can tell a user later purchases receive nothing. |
| `C12-CR-003` — whitespace content selector defeats scraper fallback | **Confirm; retain Low/High under the code report.** | `<main>\\n</main>` is truthy before normalization, so the selector loop stops and `cleanHTML` returns `""` instead of the populated later `#content`. The extractor has a maximum-size check but no empty-input rejection. Quarantine limits publication harm, not the discarded source or wasted request. |
| `RPF12-PERF-001` — CLI statement-sized byte copies | **Confirm; retain Medium/High under the performance report.** | The wrapper owns a copy of the read buffer and gives the parser another copy. A fresh 64 MiB seam probe used about 225.5 MiB RSS versus 97.7 MiB for a one-buffer control, and the parser buffer did not share the captured buffer's `ArrayBuffer`. The security goal of consent-bound bytes is valid but does not require every successful local parse to retain two extra full-size copies. |
| `RPF12-D-001` — source-hostname contrast | **Confirm; retain Medium/High under the design report.** | `#64748b` reaches only about 3.67:1 on the strongest Shinhan header tint and about 3.89–3.95:1 at sampled nearby pixels, below 4.5:1 for 14 px normal text. The pre-existing English card name uses the same muted token in the same banner, so the root repair should audit all muted banner text; that broader scope is not a second finding. |
| `RPF12-D-002` — unnamed CardGrid search SVG | **Behavior confirmed; Cycle 12 novelty rejected. Reopen/merge `C9-D-01` / `C9-011`, count zero here.** | Cycle 9 already found that decorative inline SVGs bypass the shared hidden-icon contract and appear as unnamed images, with the same user harm and exact `aria-hidden="true"`/`focusable="false"` repair. The CardGrid glyph was introduced in `2f67466` before Plan 119's fix commit `1599a58`; Plan 119 enumerated only FileDropzone/CardDetail and missed this pre-existing instance. A missed site in an incompletely applied root repair is not a new defect merely because the earlier report did not list this line. |

The two document-specialist findings also survive a critic check without new
IDs. `RPF12-DOC-001` reproduced with exit code zero, zero stdout bytes, and only
Bun's command echo on stderr for `bun run parse --help`; the manifest points at
an export barrel, not an executable. `RPF12-DOC-002` accurately identifies the
prompt/test mismatch: the prompt says the scraper records `url`, while the
deterministic boundary deletes it and stamps only issuer, date, and source.
The architect and security reports' zero-finding conclusions were not
contradicted by an architecture- or security-specific failure.

`RPF12-TE-001` also survives under the test-engineer report at Medium/High.
The sole tracked workflow triggers only for a `main` push or manual dispatch;
its strong verification steps therefore produce no repository-owned PR check,
and the workflow-contract test does not parse or assert the trigger map. This
is distinct from deferred `D-05`, whose stated exit criterion concerned adding
test/lint/typecheck content to the deploy workflow rather than when that
workflow starts.

## Historical reconciliation

The new browser disclosure finding is not a relabeling of the prior cap work:

- Cycle 8's exact-cap findings concern absent producer telemetry and name the
  terminal and standalone HTML consumers; they do not identify the web UI's
  complete lack of a cap sink.
- Plan 68 requires per-transaction clips to be visible in `capsHit`; it does not
  render that collection in the browser.
- Cycle 11 and Plan 127 repair plural cap identity, worker decoding, web
  coherence, persistence, and visualization. Their web tests prove that the
  telemetry survives, which is the prerequisite for this finding, but no web
  component displays it.

Targeted full-ledger searches found no earlier finding for browser results or
`ReportContent` omitting cap disclosures. Conversely, the CardGrid SVG has the
same root cause, failure class, and repair as the explicit Cycle 9 decorative
SVG finding and is therefore historical even though its exact selector was
omitted from Plan 119.

The rejected leading-NUL/prefixed-XLSX inflation hypothesis remains rejected.
No new evidence changes the byte-zero `PK` precondition in
`packages/parser/src/shared/xlsx-archive.ts:113-132`, so it is not revived.

## Verification and final missed-issue sweep

- **282 focused tests passed** across calculator/cap behavior, web analysis
  coherence and persistence, terminal/standalone cap disclosure, CLI command
  boundaries, and scraper cleaning/fetching.
- Real-card calculator and optimizer probes reproduced the retained browser
  disclosure failure. Independent bounded probes also challenged every named
  candidate as summarized above.
- `bun run parse --help` independently confirmed the document report's
  successful no-op command.
- No server, browser, or E2E suite was run in this critic lane.

The closing pass rechecked numeric and cap state, optimizer projections,
result-field producers and every browser/report sink, parser format and archive
admission, worker/persistence coherence, upload/replacement state, catalog
authoring/publication, CLI consent/bytes/output, scraper fetch/extract/quarantine,
accessibility semantics, color tokens, manifests, tests, and the complete
post-Cycle-11 change surface. Other candidates were already owned, fixed,
deferred, historical, intentionally specified, or lacked a reproducible
contract failure.

The six protected Cycle 42 artifacts remained byte-identical. This report is
the only repository file created by the critic lane.

**Final count: 1 genuinely new critic finding — 1 Medium.**
