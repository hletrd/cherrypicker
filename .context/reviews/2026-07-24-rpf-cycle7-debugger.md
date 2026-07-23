# Review-plan-fix Cycle 7 — debugger

- Date: 2026-07-24
- Baseline: `3086a379e31e5b17f82401807f5b3c24325b9962`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: latent defects, boundary behavior, stateful calculations, error paths,
  data integrity, regression risk, and test adequacy
- Scope: review only; no product source, tests, plans, generated artifacts, or
  protected Cycle 42 evidence changed

## Inventory and coverage

I classified and read all 2,175 tracked paths: 1,045 context/planning/review
paths, 151 web paths, 868 package paths (`core` 36, `parser` 87, `rules` 733,
`viz` 12), 59 tool paths, 18 scripts, 15 E2E paths, and 19
root/config/vendor/instruction paths. This includes 320 tracked
TS/JS/Svelte/Astro files, 147 test paths, all 683 authored card-rule YAML
files, and 72 JSON/CSV inputs or generated artifacts. Every review-relevant
tracked path was included in the source/search pass and complete content read.

I followed successful, empty, malformed, partial, cancelled, stale, overflow,
exact-boundary, exhausted-cap, unsupported-rule, serialization, restore, and
output paths through parser → categorizer → analysis context → calculator →
optimizer → web/CLI/report. I separately followed catalog authoring →
schema/semantic validation → generated artifact → split web and compiled CLI
consumers, and scraper fetch/extraction → validation → filesystem writer.
High-volume data was checked through the complete schema, semantic,
publication, and drift gates. Current implementation and executable probes,
not comments alone, determined the finding. Earlier review provenance was used
to remove duplicates after the independent pass.

## RPF7-DBG-001 — an exactly exhausted global monthly cap is reported as untouched

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Calculation location:** `packages/core/src/calculator/reward.ts:920-959`
- **Contract:** `packages/core/src/models/result.ts:9,13-29`
- **Visible consumers:** `packages/viz/src/report/generator.ts:327-364,
  388-404`; `packages/viz/src/terminal/summary.ts:84-96`;
  `packages/viz/src/terminal/comparison.ts:62-76`
- **Test gap:** `packages/core/__tests__/reward-cap-rollback.test.ts:65-117`;
  `packages/core/__tests__/calculator.test.ts:396-406`

The calculator marks a global monthly cap only when the current reward is
strictly greater than the remaining cap and is clipped:

```ts
if (rewardAfterMonthlyCap > globalRemaining) {
  // push monthly_total and set bucket.capReached
}
```

It updates `globalMonthUsed` afterward, but never checks whether a positive
reward made that total exactly equal to `globalCap`. Therefore an exact hit
leaves both `CategoryReward.capReached` false and `capsHit` empty. This
contradicts the result contract (“Which caps were reached”) and causes every
terminal and HTML cap sink to omit the exhausted global cap. Rule-level exact
monthly exhaustion has an explicit equality check at lines 921-929; the
parallel global path does not.

An executable one-transaction probe used a 10% reward on 1,000 won with a
100-won global monthly cap. The result was:

```json
{
  "totalReward": 100,
  "rewards": [{ "reward": 100, "capReached": false }],
  "capsHit": []
}
```

The reward amount is numerically correct, and the next transaction is blocked
because selection sees zero global remaining. The defect is the externally
reported state: users are told no cap was reached precisely when no global
benefit capacity remains.

**Concrete failure:** a user's last rewarded transaction lands exactly on a
card's monthly total benefit cap. The web/CLI comparison and generated report
show no “한도 도달” indicator. A user can reasonably infer that another
purchase still earns benefits, although the calculator will award zero on the
next transaction.

**Root-cause fix:** after applying a positive reward, compute the new checked
global total and record exact exhaustion when it is equal to the cap, in
addition to the existing clipping branch. Harmonize the public semantics:
either make `capsHit` truly mean reached and represent an exact hit explicitly,
or split “reached/exhausted” from “clipped/lost reward” so consumers do not
describe a zero-loss exact hit as clipping. In both designs,
`CategoryReward.capReached` must become true. Add regressions for a single
exact hit, a cumulative multi-transaction exact hit, one-under-cap, clipping,
zero cap, and interaction with an exact rule-level cap; assert calculator,
optimizer result, terminal, and HTML disclosure.

## Verification

- Direct calculator probe: **confirmed** `totalReward === globalCap` while
  `capReached === false` and `capsHit` is empty.
- `bun run data:check`: **passed** for all 683 authored rules, generated
  artifacts/shards/fallback labels, and README catalog.
- `bun run typecheck`: **passed** for parser, rules, core, viz, scraper, CLI,
  and web; Astro reported 0 errors, 0 warnings, and 0 hints.
- No browser/E2E run was required for the pure calculation/output-state
  reproduction.

## Final missed-issue sweep

The bounded final pass revisited tier selection, exact decimal arithmetic,
additive/exclusive state projection, shared rule/global caps, rollback,
occurrence/fixed-per-day state, optimizer counterfactual alternatives,
calendar provenance, required parser fields, malformed and partial file
success, worker cancellation, persistence migration/truncation, catalog
selection identity, filesystem cleanup, scraper validation, and every recent
Cycle 6 fix. Previously reported or explicitly deferred issues were excluded.
No second new, non-duplicate debugger defect met the evidence threshold.

Final count: **1 Medium finding**, confirmed with High confidence.
