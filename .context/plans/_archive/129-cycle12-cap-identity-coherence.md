# Plan 129 — Cycle 12 Cap Identity and Coherence

**Finding:** C12-001 (`C12-CR-001`, Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- `buildRuleKey` prefers `capGroup` and the calculator uses that value both as
  the monthly-cap bucket and as the identity for daily occurrence state.
- Two schema-valid rules with different caps in one group produce 200 or 100
  Won after transaction-order reversal.
- Two independent same-day fixed rewards in one coherent group suppress each
  other and produce 100 or 200 Won instead of 300 Won.
- Catalog validation checks rules individually and accepts both fixtures.

## Outcome

Shared cap state and rule execution state have separate identities. Shared
groups are validated for tier/cap coherence, calculation is transaction-order
invariant, and independent fixed rewards remain independent.

## Implementation

1. Add red calculator regressions for reversed transactions with inconsistent
   shared caps and for two independent `fixed_per_day` rules in one group.
2. Split the current key into a stable rule key and a cap-group key. Use the
   rule key for occurrence/day identity and the cap-group key only for shared
   monthly accumulation and cap telemetry.
3. Extend card-rule validation to reject a shared group whose participating
   rules disagree about a performance tier's monthly cap.
4. Keep rule-scoped `ruleId` and `capGroup` telemetry from Plan 127, including
   legacy persistence compatibility.
5. Add schema/browser export and current-catalog validation coverage. Confirm
   existing authored cards remain valid and deterministic.

## Acceptance

- [x] Reversing transactions cannot change a shared-group reward total.
- [x] Independent same-day fixed rewards do not suppress one another.
- [x] Incoherent shared monthly caps fail validation with an actionable path.
- [x] Coherent shared groups and distinct groups preserve current behavior.
- [x] Cap telemetry retains stable rule and group identity.

## Execution note

The requested `ralph` skill is unavailable. Prompt 3 will use the approved
manual test-first fallback: add focused red regressions, implement the smallest
shared-kernel/validator repair, run focused green checks, then run all required
repository gates. No deployment is permitted.

## Completion evidence

- Red: the new calculator/validator regressions initially reported three
  failures, then the direct calculator subset reported two remaining failures.
- Green: the full core/rules matrix passed 410 tests, including catalog
  validation and direct-core fail-fast coverage.
- Commit:
  `2812cea6bcbf568d5caf3b89bc00a71d01171095`
  (`🐛 fix(core): separate rule and cap identities`).
