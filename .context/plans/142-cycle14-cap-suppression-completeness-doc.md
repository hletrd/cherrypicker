# Plan 142: Cycle 14 Cap Suppression Completeness Documentation

**Finding:** C14-002 (`C14-DOC-001`, Low/High)
**Status:** planned
**Deploy mode:** none

## Evidence

- Public `CalculationOutput.capSuppressionsComplete` is documented as false
  only when an exact diagnostic exceeds safe-integer arithmetic.
- The calculator also returns false for ordered stateful negative offsets and
  other reconciliation failures that cannot be represented as independent
  positive suppression rows.
- The array may already contain valid earlier rows when the boolean becomes
  false. The existing deterministic test returns a safe 9,000-Won reward, one
  suppression row, and `capSuppressionsComplete: false`.
- Both the field comment and the broader behavior arrived in the post-review
  Cycle 13 telemetry commit. No historical plan owns this public-field
  mismatch.

## Outcome

The exported type describes the stable semantic consequence: when
`capSuppressionsComplete` is false, `capSuppressions` is a partial,
non-authoritative diagnostic and must not be interpreted as a complete
suppression total. The comment names unsafe arithmetic and ordered effects as
examples without making either cause exhaustive. Runtime behavior and
user-facing copy remain unchanged.

## Implementation

1. Replace the cause-specific one-line comment in
   `packages/core/src/calculator/types.ts` with consequence-based TSDoc.
2. State explicitly that rows may still be present when completeness is false
   and that callers must not total the array as an exact result in that state.
3. Keep the existing negative-stateful-offset and maximum-safe-integer tests
   as executable controls for both major causes.
4. Do not change calculator behavior, the optimizer's
   `portfolioCapLosses` unknown/known contract, browser copy, README text,
   persistence schema, or worker transport.
5. Give Plan 141's new private optimizer claim its own internal precondition
   comment; do not add a user-facing performance or benchmark promise.

## Acceptance

- [ ] The public field comment defines false as an incomplete/partial exact
      diagnostic rather than overflow alone.
- [ ] The wording covers ordered stateful effects and unsafe arithmetic
      without claiming an exhaustive cause list.
- [ ] The comment warns that a false result may still contain rows.
- [ ] Existing negative-offset and overflow controls remain green.
- [ ] No runtime, schema, presentation, README, or generated-document behavior
      changes.

## Verification

Run the focused cap-loss and prepared-card tests, documentation/data checks,
lint, typecheck, build, all unit-test gates, full verification, and E2E with
the same exact cleanup checks as Plan 141.

## Execution note

The requested `ralph` capability is unavailable. Prompt 3 will use the
approved manual disciplined fallback: update the smallest public TSDoc
surface, verify both existing behavioral controls, then run every repository
gate. No deployment is permitted.
