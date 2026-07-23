# Review-plan-fix Cycle 8 — debugger

- Date: 2026-07-24
- Baseline: `3fd993d471a8676170031f20715f6a53c99e8a9f`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: latent bug surface, boundary conditions, failure modes, regressions,
  and test gaps

## Inventory and coverage

The debugger inventory covered all 2,199 tracked paths and every active
implementation/test/config/data family: web, core, parser, rules, viz, CLI,
scraper, scripts, workflows, E2E, manifests, lock/vendor policy, 683 authored
card YAML files, and generated catalog/publication artifacts. Six protected
untracked Cycle 42 files were not touched.

I exercised or traced successful, empty, malformed, partial, stale, cancelled,
overflow, exact-boundary, clipped-cap, exhausted-cap, unsupported-rule,
serialization, restore, and output paths through parser → categorizer →
analysis context → calculator → optimizer → web/CLI/report. Recent Cycle 7
changes received a separate regression pass. The fixed exact **global** cap
finding was excluded; the finding below is the still-divergent rule-level
monthly-cap path.

## RPF8-DBG-001 — exact rule-level monthly-cap hits disappear from `capsHit`

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Rule-cap primitive:** `packages/core/src/calculator/reward.ts:539-571`
- **Divergent state/telemetry:** `packages/core/src/calculator/reward.ts:878-888,
  944-954`
- **Result contract:** `packages/core/src/models/result.ts:9-29`
- **Visible consumers:** `packages/viz/src/terminal/summary.ts:86-96`;
  `packages/viz/src/terminal/comparison.ts:63-74`;
  `packages/viz/src/report/generator.ts:328-345,389-405`
- **Test gap:** `packages/core/__tests__/cycle7-exact-reward-cap-state.test.ts:
  196-303`

`applyMonthlyCap()` reports `capReached` only when `rawReward > remaining`,
which means reward was clipped. The caller separately uses
`newMonthUsed >= monthlyCap` to set the category bucket's `capReached` flag,
so an exact hit is recognized there. However, it appends a
`monthly_category` entry to `capsHit` only when the primitive's strict
`capReached` value is true.

A direct calculator probe used a 10% reward on 1,000 won with a 100-won
rule-level monthly cap and no global cap. It returned:

```json
{
  "rewards": [{
    "reward": 100,
    "capReached": true,
    "capAmount": 100
  }],
  "capsHit": []
}
```

The calculation amount and category flag are correct, but the public result
contradicts itself. Terminal comparison, terminal summary, and standalone HTML
derive their cap warnings/counts from `capsHit`, so they omit the exact
rule-level exhaustion. The Cycle 7 tests assert exact public-helper semantics
and exact global-cap telemetry. Their combined rule/global case checks only
the category flag and the global `monthly_total` entry, so the missing
`monthly_category` record passes unnoticed.

**Concrete failure:** a user's last purchase exactly consumes a category/rule
monthly benefit cap. The data bucket says the cap is reached, but CLI and HTML
outputs show no cap warning when no global cap also fires. The user can infer
that more benefit remains even though the next matching transaction receives
none.

**Fix:** give the internal and public cap contracts one definition. For a
positive reward, treat `newMonthUsed === monthlyCap` as reached and emit a
`monthly_category` `CapInfo` with equal `actualReward`/`appliedReward`; retain
the greater-than case for clipped loss. Keep zero-cap behavior explicit so a
zero reward does not manufacture a hit. Add single and cumulative exact-hit,
one-below, clipped, zero-cap, shared-cap-group, and simultaneous global-cap
tests, then assert terminal and report disclosure through the actual
`capsHit` result.

## Verification

- Direct `calculateRewards()` probe confirmed `capReached: true` with
  `capsHit: []` at an exact rule-level cap.
- Existing parser direction and exact reward/cap suites passed **31/31**,
  including Cycle 7's global-cap regressions; this exact category telemetry
  assertion is absent.
- Static consumer tracing confirmed all three warning sinks depend on
  `capsHit`, not the bucket flag.
- No browser/E2E run, commit, deployment, product-source change, generated
  artifact change, or protected Cycle 42 file change was made.

## Final missed-issue sweep

The bounded final pass rechecked tier gaps, exact decimal arithmetic,
same-rule and shared-cap state, additive/exclusive projection, global rollback,
per-transaction caps, occurrence and fixed-per-day state, optimizer
counterfactuals, parser row validity, partial-file success, worker
cancellation, persistence coherence, catalog selection, filesystem cleanup,
and recent hash routing. No additional distinct debugger issue met the
evidence threshold.

Final count: **1 Medium finding** (`RPF8-DBG-001`).
