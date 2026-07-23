# Plan 120 — Cycle 10 Category Matching and Alternative Determinism

**Findings:** C10-001 (Medium/High), C10-002 (Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- Static and taxonomy category matchers accept unrestricted substring
  containment for two-character Latin aliases. `SECURITY SERVICE` and
  `CULTURE CENTER` become convenience-store transactions through `cu`, while
  `SKTECH` and `BOOKTOWN` become telecom transactions and can receive real
  category-only rewards.
- Cycle 9 Plan 114 closed the equivalent merchant-allowlist path but left the
  categorizer paths outside the shared boundary.
- The main optimizer input uses the canonical reward-fact comparator, while an
  alternative counterfactual appends the proposed group after already-won
  transactions. Stateful `maxUses`, fixed-per-day rewards, category caps, and
  global caps can therefore omit or misstate an alternative.

## Outcome

One normalized merchant-term contract protects every category and reward
matching path, and every reward calculation in optimization receives the same
canonical fact ordering.

## Implementation

1. Extract a pure normalized merchant-term predicate that preserves exact
   matches and intended Korean/descriptive containment while requiring ASCII
   token boundaries for short Latin aliases.
2. Use the predicate in `MerchantMatcher`, taxonomy matching, and
   `merchantAllowlistMatches`; remove divergent private containment logic.
3. Add positive brand-variant and negative near-collision tests that carry
   categorization through a category-only reward calculation.
4. Centralize canonical reward-input construction in the greedy optimizer and
   use it for final card totals and every alternative counterfactual.
5. Calculate alternative differences as signed safe integers, discard values
   at or below zero, and only then create an alternative record.
6. Cover proposed groups inserted before, between, and after already-won rows
   for max-use, fixed-per-day, monthly-category-cap, and global-cap rules.

## Acceptance

- [x] `cu`, `kt`, and `skt` still match intended statement variants but not
      unrelated Latin words containing those character sequences.
- [x] Static categorization, taxonomy categorization, and specific-merchant
      matching share one boundary policy.
- [x] Category-only card rules cannot reward the reproduced false merchants.
- [x] Main assignments and alternatives use one canonical transaction order.
- [x] Non-positive counterfactual deltas are omitted without unsafe arithmetic.
- [x] Stateful alternative tests cover hypothetical insertion on both sides
      of the candidate's existing transactions.

## Completion evidence

- `packages/core/src/categorizer/normalize.ts` now owns the pure normalized
  merchant-term predicate. Static matching, taxonomy matching, reverse fuzzy
  matching, and calculator merchant allowlists all consume it.
- `packages/core/src/optimizer/greedy.ts` now builds main, final-card, and
  alternative calculator inputs with the canonical reward-fact comparator.
  Alternative deltas validate both totals as safe non-negative integers,
  preserve the signed difference, and omit values at or below zero before
  constructing output records.
- The initial focused regression run was red as expected: 12 passed and 5
  failed across the two new Cycle 10 suites, exposing both unrestricted
  category paths and the before/between max-use counterfactuals.
- Focused red-green result:
  `bun test packages/core/__tests__/cycle10-merchant-boundaries.test.ts
  packages/core/__tests__/cycle10-alternative-determinism.test.ts`
  — 17 passed, 0 failed.
- Existing contract compatibility:
  focused categorizer/calculator/optimizer suites — 198 passed, 0 failed;
  `bun run --cwd packages/core typecheck` — passed.
- Full core verification on the completed shared-tree snapshot:
  `bun test packages/core` — 262 passed, 0 failed.

## Execution note

The requested `ralph` skill is not registered in the available skill roots.
Prompt 3 will use a manual red-green loop with focused core tests before the
repository-wide gates. Changes remain fine-grained, signed, no-deploy, and
limited to the exact working branch.
