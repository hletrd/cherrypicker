# Plan 96 — Cycle 6 Reward and Optimizer Correctness

**Findings:** C6-001 (High/High), C6-002 (Medium/High), C6-003 (Medium/High)  
**Status:** complete  
**Deploy mode:** none

## Evidence

- `packages/core/src/calculator/reward.ts:181-288,313-320,588-689`
  selects exclusive rules before evaluating the qualified tier and converts
  percentage points through `rate / 100`.
- `packages/rules/data/cards/shinhan/deep-dream.yaml:31-70` reproduces both
  zero-specific suppression and the 0.7% floating-point undercount.
- `packages/core/src/optimizer/greedy.ts:66-118,137-210,310-366` stores
  per-transaction losing-card scores and sums them after grouping, even though
  each score was calculated against the same unchanged candidate state.

## Outcome

Rule selection falls back to an executable positive benefit when a more
specific exclusive candidate is zero or exhausted, authored percentage points
are evaluated exactly, and every grouped alternative reflects one
counterfactual assignment of the whole displayed group.

## Implementation

1. Make exclusive-rule selection tier- and state-aware. Determine the
   qualified tier value before choosing a member of a stacking group and
   exclude zero, unavailable, condition-exhausted, rule-cap-exhausted, or
   global-cap-exhausted candidates from displacing a lower-specificity
   executable member. Preserve additive semantics and deterministic
   specificity/priority/ID ordering.
2. Keep unsupported-rule disclosures when a candidate cannot be evaluated;
   distinguish an inapplicable zero/exhausted candidate from an explicitly
   unsupported one. Do not infer an intentional zero override without an
   authored contract.
3. Reuse/generalize the existing decimal-to-rational `BigInt` helper so a
   percentage reward is `floor(amount × authoredPercentagePoints / 100)`
   without an intermediate binary `rate / 100`. Retain checked safe-integer
   and cap behavior and preserve public normalized-rate helpers where their
   API contract requires them.
4. Rebuild grouped alternatives after final greedy assignment. For each
   category/winner group and alternative card, calculate the candidate's
   reward for its final actually assigned transactions, then calculate it once
   more after adding the entire displayed group. Use the checked nonnegative
   delta as the alternative reward and derive the displayed rate from group
   spending.

## Tests

- Calculator regressions for positive wildcard plus zero specific tier,
  exhausted specific monthly/global caps, `maxUses`, fixed-per-day state,
  additive groups, and deterministic tie order.
- Exact percentage-point tables for 0.7%, 1.3%, 0.033%, exact and fractional
  products, zero, scientific notation, caps, and safe-integer overflow.
- Optimizer alternative regressions for monthly/global caps, use counts,
  fixed-per-day rewards, and an alternative card that already won a different
  group.
- Full core tests, typecheck, lint, data validation, unit/Vitest, build, and
  final browser gates.

## Acceptance

- [x] A zero or exhausted specific exclusive rule cannot hide an executable
  positive wildcard rule.
- [x] 0.7% of 10,000 Won is exactly 70 Won and no epsilon is used.
- [x] Grouped alternatives equal a whole-group counterfactual delta under all
  stateful limits.
- [x] Existing supported stacking, cap, and unsupported-disclosure behavior
  remains deterministic.

## Completion evidence

- Exact decimal percentage-point evaluation, state-aware exclusive fallback,
  additive shared-cap projection, and whole-group optimizer alternatives are
  covered by the calculator and Cycle 6 core regressions.
- The closing integration audit fixed three in-plan edge cases: unsupported
  disclosure before cap exit, unknown-type validation before a tiny percentage
  floors to zero, and additive same-transaction cap projection.
- The focused core tests passed 137 tests, the full core suite passed 200
  tests, and core/root type checking passed.

## Execution note

The requested `ralph` skill is not installed in either available skill root.
Prompt 3 will use the review-plan-fix skill's disciplined manual iterative
fallback: implement one bounded change, run focused regressions, inspect the
diff, and repeat until every acceptance item is proved.
