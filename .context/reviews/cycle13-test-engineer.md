# Review-plan-fix Cycle 13 — test engineer

- Date: 2026-07-24
- Reviewed revision: `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **1 genuinely new finding — 1 Medium**
- Scope: review and this report only; no implementation, source/test/config or
  generated-artifact change, staging, commit, push, deployment, browser,
  preview server, or E2E run

## Inventory and test architecture

I classified all **2,318 tracked paths** before reviewing the test system:
**1,152** tracked `.context` paths and **1,166** active product, data, test,
documentation, workflow, configuration, and vendor-integrity paths. The active
tree contains 143 runnable unit/E2E specification files:

| Test family | Files |
| --- | ---: |
| Web unit and source-contract tests | 56 |
| Core | 16 |
| Parser | 23 |
| Rules/catalog | 7 |
| Visualization/reporting | 3 |
| CLI | 10 |
| Scraper | 10 |
| Repository scripts/workflow/process controls | 8 |
| Playwright E2E specifications | 10 |
| **Total** | **143** |

The audit mapped production code to tests across every workspace and inspected
the root/workspace manifests, Turbo/Bun/Vitest/TypeScript/Astro/Playwright
configuration, repository scripts, workflow, E2E process owner, fixtures,
generated-data gates, and current documentation. No active test is marked
`.skip`, `.only`, `.todo`, or `.fixme`. The retained finding is not a runner
discovery problem: it is a cross-layer oracle gap between correct cap
calculation, intentionally event-local telemetry, and a newly added
whole-analysis presentation claim.

## Finding

### RPF13-TE-001 — an exact cap hit followed by an eligible purchase falsely renders “no benefit loss”

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed in production code with an executable current-catalog
  probe; browser rendering itself was not run
- **Locations:**
  - `packages/core/src/calculator/reward.ts:314-335,523-531` — once a monthly
    cap is full, `previewRuleAvailability()` removes that rule before normal
    reward execution and cap-event emission.
  - `packages/core/src/calculator/reward.ts:1025-1040` — the event emitted by
    the transaction that exactly reaches the cap records only that
    transaction's equal `actualReward` and `appliedReward`.
  - `packages/core/__tests__/cycle7-exact-reward-cap-state.test.ts:326-349` —
    the existing three-transaction regression deliberately locks an exact
    event followed by a post-cap transaction, but asserts only the one equal
    actual/applied event.
  - `apps/web/src/lib/cap-disclosures.ts:23-50` — browser presentation derives
    loss solely from each event's `actualReward - appliedReward`, then maps
    zero to the unqualified statement `혜택 손실 없음`.
  - `apps/web/src/components/ui/CapDisclosures.svelte:20-35` — dashboard,
    results, and in-app report describe the section as benefits not received
    because of caps and render that outcome.
  - `apps/web/__tests__/cap-disclosures.test.ts:68-117` — fabricated isolated
    events test one clipped event and one exact event; the page “wiring” test
    reads source strings. No test passes an exact-then-post-cap production
    result through a rendered sink.
  - `packages/viz/src/cap-disclosure.ts:16-29` — terminal/standalone formatting
    makes the same event-local “no loss” claim.

The tracked `sc-digital-samsung` rule is a supported production example:
after ₩300,000 previous-month spending it grants 7% on online shopping with a
₩10,000 monthly cap
(`packages/rules/data/cards/sc/digital-samsung.yaml:14-46`). I loaded that
actual YAML through `loadCardRule()` and calculated three eligible online
purchases in date order:

1. ₩100,000 → ₩7,000 reward.
2. ₩42,858 → ₩3,000 reward, reaching the cap exactly.
3. ₩100,000 → the already exhausted rule is filtered out.

Production returned:

```json
{
  "totalReward": 10000,
  "uncappedReward": 17000,
  "lostReward": 7000,
  "capsHit": [{
    "capType": "monthly_category",
    "capAmount": 10000,
    "actualReward": 3000,
    "appliedReward": 3000,
    "ruleId": "reward-001",
    "capGroup": "reward-001"
  }],
  "renderedOutcome": ["혜택 손실 없음"]
}
```

The ₩10,000 calculated total is correct. The false statement arises because
the only event describes the exact-reaching purchase, while the copy presents
that event-local delta as the loss for the analysis. The third purchase's
₩7,000 otherwise eligible reward is neither represented in `capsHit` nor
available to the formatter.

- **Concrete user impact:** dashboard, results, report, terminal, and saved
  HTML can tell a user that a cap caused no benefit loss even when later
  eligible spending demonstrably earned less because that cap was exhausted.
  The displayed total remains numerically correct, but its newly added
  explanation is materially misleading.
- **TDD fix:** start with one production-linked test using the tracked Digital
  Samsung rule and an exact-hit-plus-later-purchase sequence. Carry the real
  calculator/optimizer result through web and viz disclosure formatters and
  require truthful post-cap treatment. Preserve two controls: an exact hit as
  the final eligible purchase must not invent a loss, and a strictly clipped
  hit must retain its exact lost amount. Then define the missing contract:
  either emit/reconcile post-exhaustion forgone-benefit telemetry at rule
  selection time, or make the UI explicitly event-local and avoid claiming
  there was no loss when aggregate loss is not represented. Add a built-app
  Playwright assertion for the resulting dashboard/results/report copy; source
  substring checks are not a rendering oracle.

## Historical and same-cycle reconciliation

I indexed and candidate-searched all **1,158** `.context` files present before
this report: 1,152 tracked records plus the six protected Cycle 42 artifacts.
I read the implicated exact-cap reviews and Plans 104, 110, 127, 130, and 136,
the current aggregates and deferred register, and the recent Cycle 7–12
test/debug/verification history.

This does not revive Cycle 8's fixed exact-cap omission. That finding required
an exact-reaching transaction to emit a `capsHit` entry and correctly required
`actualReward === appliedReward` so the reaching transaction itself would not
invent a loss. The current implementation and tests satisfy that contract.
`RPF13-TE-001` begins one transaction later: the existing core regression
already contains the later purchase, but no sink test combines it with the
event-local loss formatter. The unqualified browser loss explanation landed
only in Cycle 12. Full-history searches for exact/post-cap sequences,
subsequent transactions, exhausted-cap telemetry, and no-loss copy found no
prior owner for this cross-layer false statement.

I did not separately promote the source-only cap wiring test as a generic
component-harness finding: the missing rendered Svelte harness is already an
explicit Plan 70 deferral, while the concrete false oracle above has its own
production fixture and repair contract. I also did not revive the old E2E
“total spending equals assignments” consistency-test criticism, mixed
Bun/Vitest coverage debt, fixed conditional-parser assertions, historical
browser timing debt, or the rejected prefixed-XLSX ZIP-inflation hypothesis.

## Verification and final missed-issue sweep

- The executable current-catalog probe reproduced a ₩7,000 post-cap loss while
  the production browser formatter returned only `혜택 손실 없음`.
- `bun test packages/core/__tests__/cycle7-exact-reward-cap-state.test.ts
  apps/web/__tests__/cap-disclosures.test.ts` passed **24 tests, 104
  expectations, 0 failures**, confirming that both implicated suites are green
  despite the cross-layer false statement.
- No browser, E2E, preview/dev server, full repository gate, or deployment
  command was run in this role.

The closing sweep revisited amount/date/format boundaries, conditional
assertions, parser server/browser parity, worker settlement, categorization,
reward/cap order, optimizer assigned/unassigned invariants, persistence and
replacement state, catalog validation/publication, CLI subprocess/consent
tests, scraper network/extraction/writer coverage, report sinks, timers,
retries, temporary paths, runner portability, and workflow inclusion.
Candidates that were fixed, deferred, historically owned, unsupported by a
production contract, or not reproducible were excluded.

The six protected Cycle 42 artifacts remained byte-identical. The only path
written by this role is `.context/reviews/cycle13-test-engineer.md`.

**Final count: 1 new finding — 1 Medium.**
