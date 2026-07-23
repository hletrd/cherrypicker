# Plan 110 — Cycle 8 Executable Benefits and Exact Rule Caps

**Findings:** C8-005 (Medium/High), C8-006 (Medium/High)
**Status:** archived (completed)
**Deploy mode:** none

## Evidence

- Recommendation eligibility checks catalog metadata but not whether a card
  has any supported executable reward. Unsupported-only cards receive zero
  scores and can win deterministic tie-breaking.
- Transactions with no positive modeled benefit are assigned to an arbitrary
  first card, making a recommendation look meaningful when every score is
  zero.
- Rule-level monthly cap state uses strict clipping to emit `capsHit`. A
  positive reward that exactly reaches the cap sets the bucket state but
  produces no downstream cap event.

## Outcome

Catalog visibility remains broad, optimizer recommendations contain only
cards and assignments with a positive supported benefit, unmodeled spending
is explicit, and exact rule-cap exhaustion is disclosed without claiming a
lost reward.

## Implementation

1. Separate catalog recommendation visibility from optimizer executability.
   An executable card must contain at least one supported reward, while
   unsupported-only products remain visible in the catalog with their
   disclosure.
2. Assign a transaction only when the best executable card yields a positive
   checked reward. Record zero-benefit input explicitly as unassigned spending
   and transaction count; include it in total analyzed spending but never in a
   card assignment or recommendation result.
3. Make the best-single-card result nullable when no card yields a positive
   benefit. Define total spending, reward, effective-rate, and savings
   invariants across assigned and unassigned spending, then update web,
   persistence, terminal, and report consumers with an honest no-benefit
   state.
4. Emit a rule-level cap event when a positive reward either clips at or lands
   exactly on the monthly cap. For equality, keep actual and applied reward
   equal so terminal/report copy says the cap was reached rather than reward
   was lost.

## Tests

- Full-artifact unsupported-only card sets, cards with supported rules that do
  not match the input, one-Won/rounds-to-zero rewards, mixed positive and zero
  categories, and deterministic card-order permutations.
- Invariants for empty assignments, explicit unassigned spend/count, nullable
  best-single results, total spending, rates, and persistence round trips.
- Exact single and cumulative rule-cap hits, one below, clipping, zero cap,
  global-cap interaction, and terminal/report disclosures.
- Catalog tests prove unsupported-only cards remain browseable but never
  recommendation winners.

## Acceptance

- [x] Unsupported-only cards cannot enter optimizer scoring.
- [x] No zero-benefit transaction is assigned to an arbitrary card.
- [x] Unassigned spending and no-benefit output are explicit on every sink.
- [x] Exact positive rule-cap exhaustion appears once in `capsHit` and never
      claims a nonzero loss when actual equals applied reward.

## Completion evidence

- Catalog visibility and optimizer executability are separate predicates.
  Unsupported-only cards remain browseable, while only supported executable
  benefits enter scoring.
- Zero-benefit purchases remain explicitly unassigned; totals, nullable
  best-single output, web panels, terminal output, reports, and persistence
  all expose the same contract.
- Exact positive rule-cap equality emits one accurate cap event without
  inventing a loss, including cumulative/global-cap interactions.
- Core/rules/viz verification passed 385 tests, CLI passed 96, and the final
  direct-core E2E fixture passed with the explicit support contract.

## Execution note

`ralph` is unavailable. Prompt 3 will use a manual optimizer truth-table loop,
cross-sink contract checks, and focused persistence integration tests.
