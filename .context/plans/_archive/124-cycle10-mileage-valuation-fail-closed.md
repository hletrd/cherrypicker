# Plan 124 — Cycle 10 Mileage Valuation Fail-Closed

**Finding:** C10-005 (Medium/High; reopened/strengthened C14-09)
**Status:** completed (archived)
**Deploy mode:** none

## Evidence

- Twenty-seven currently supported `type: mileage` rules across seventeen
  cards omit a unit. Schema normalization treats their numeric rate as a
  generic percentage.
- Calculation aggregates that number into the scalar contractually named
  total Won, optimization ranks it with cash rewards, and every public
  renderer appends `원`.
- Adjacent unit-tagged mileage rules already state that mileage valuation is
  not modeled and fail closed, contradicting the supported unitless path.

## Outcome

No mileage-denominated benefit enters a Won total or card ranking without an
explicit, program-aware valuation contract. Until that larger contract exists,
all mileage rules remain browseable but optimizer-ineligible and clearly
disclosed.

## Implementation

1. Make semantic validation reject optimizer support for every
   `type: mileage` rule, regardless of whether its legacy authored unit is
   missing.
2. Add a calculator defense that treats mileage as unsupported even if
   malformed or stale data bypasses publication validation.
3. Change the exact 27 authored unitless mileage rules from `supported` to an
   explicit unsupported valuation reason; preserve their labels, raw rates,
   and catalog visibility.
4. Regenerate all canonical catalog projections and issuer documentation with
   `bun run data:build`; never hand-edit generated artifacts.
5. Add semantic-validation, calculator, optimizer, publication, and
   renderer/disclosure regressions proving raw miles are never formatted as
   Won or compared with monetary rewards.
6. Update documentation/count assertions only through their owning generation
   path. Do not invent a fixed miles-to-Won rate.

## Acceptance

- [x] No supported mileage rule reaches `totalReward`, effective rate,
      best-card ranking, savings, or any `formatWon` consumer.
- [x] All 27 affected authored rules fail closed with one explicit valuation
      reason while remaining visible in catalog detail.
- [x] Direct calculator input cannot bypass the fail-closed mileage contract.
- [x] Generated catalogs, executable counts, source identity, and issuer docs
      are current after regeneration.
- [x] Tests distinguish raw mileage promises from monetary reward outputs.

## Execution note

The requested `ralph` skill is unavailable. Prompt 3 will use a manual
schema-to-calculator-to-publication red-green loop and the repository's owned
data generator. No external valuation research or deployment is authorized.

## Completion evidence

- Catalog validation now rejects every supported `type: mileage` rule, and the
  calculator independently reports `unsupported_reward_unit` before mileage
  can affect occurrence state or monetary totals.
- The 27 formerly supported unitless rules join the five existing Samsung
  rules under the same explicit valuation reason. No supported mileage rule
  remains; the affected cards and labels stay in detail artifacts.
- Card detail translates that exact reason into a user-facing explanation that
  miles have no Won conversion basis, rather than misclassifying the exclusion
  as a generic unverifiable condition.
- `bun run data:build` regenerated canonical data and documentation at 683
  catalog cards and 551 optimizer-executable cards. `data:check` and
  `docs:check` passed.
- Focused schema, calculator, optimizer, publication-display, and existing
  calculator/catalog suites passed with 127 tests and zero failures. A final
  presentation regression additionally passed 10 focused card-detail tests
  after the reason-aware disclosure was wired.
