# Plan 104 — Cycle 7 Exact Reward Helpers and Cap State

**Findings:** C7-002 (Medium/High), C7-009 (Medium/High)
**Status:** completed
**Deploy mode:** none
**Archived after:** Cycle 8 review

## Evidence

- Public `calculateDiscount`, `calculatePoints`, and `calculateCashback`
  delegate to `Math.floor(amount * rate)`; `0.7 / 100` undercounts 10,000 Won
  as 69 while the main rule engine returns 70.
- The global-cap branch records only strict clipping. A positive reward that
  lands exactly on the monthly total cap leaves `capReached` false and
  `capsHit` empty.

## Outcome

All exported percentage helpers share the calculator's checked exact decimal
arithmetic, and every exactly exhausted global cap is disclosed without being
misrepresented as lost reward.

## Implementation

1. Move the checked decimal-to-rational product into the shared numeric
   module. Make exported helpers accept an explicit percentage-point value
   rather than an already-divided binary fraction, and delegate main/helper
   calculations to the same implementation.
2. Preserve safe-integer checks, cap application, and overflow failures.
   Mark helper caps reached on a positive exact exhaustion as well as clipping.
3. After each positive globally capped reward, compare the checked new total
   to the cap. Emit `monthly_total` cap information for equality and clipping,
   set the category bucket state, and preserve rollback only for the clipped
   portion.
4. Make report/terminal cap copy distinguish an exact reached cap from a
   positive lost-reward case by comparing actual and applied rewards.

## Tests

- Helper/main parity for 0.7%, 4.1%, 0.033%, exact/fractional products,
  capped totals, scientific notation, and safe-integer boundaries.
- Single and cumulative exact global hits, one below, clipping, zero cap, and
  interaction with an exact rule-level cap.
- Optimizer, terminal, and standalone-report disclosure for exact versus
  clipped cap outcomes.

## Acceptance

- [x] 0.7% of 10,000 Won is 70 through every exported helper.
- [x] No helper accepts a silently noisy fractional-rate contract.
- [x] Exact global exhaustion sets `capReached` and appears in `capsHit`.
- [x] Exact exhaustion copy never claims that zero reward was lost.

## Completion evidence

- Public helpers now accept authored percentage points and share the main
  engine's checked decimal-to-rational product.
- Exact single/cumulative global-cap hits propagate through calculator and
  optimizer state; terminal and report copy distinguishes equality from
  clipped reward.
- Focused core/viz verification passed 241 tests, including 18 new exact
  helper/cap cases and the cap-disclosure regressions.

## Execution note

`ralph` is unavailable; Prompt 3 uses checked arithmetic tables and a manual
boundary loop.
