# Plan 126 — Cycle 11 Merchant Boundary Performance

**Findings:** C11-002 (Medium/High)
**Status:** planned
**Deploy mode:** none

## Evidence

- A unique full miss invokes the normalized merchant-term helper about 25,066
  times across static and taxonomy scans.
- The helper currently derives two immutable ASCII-edge flags with regular
  expressions before its first `indexOf`, producing about 50,132 up-front
  tests per complete miss.
- Independent same-result differentials measured the current predicate
  between 2.17× and 4.48× slower than precompiled/index-first controls.
- Deferred item `D-C1-041` owns the older full-corpus scan architecture. This
  plan addresses only the newer constant-factor boundary regression.

## Outcome

Authored merchant terms compile their immutable boundary metadata once.
Matching performs no edge work for a miss and uses character-code boundary
checks only after an occurrence is found, while preserving Cycle 10's
short-alias correctness.

## Implementation

1. Add focused red/contract tests for a compiled normalized-term
   representation and the existing CU/KT/SKT positive and near-collision
   matrix.
2. Introduce a small compiled term record containing normalized text plus
   leading/trailing ASCII-boundary flags.
3. Make the matcher and taxonomy store compiled terms during construction.
   Compile the normalized merchant once per match for reverse-direction
   checks.
4. Change the shared predicate to call `indexOf` before boundary inspection
   and use character codes instead of per-comparison regular expressions.
   Retain the string-call API for small calculator allowlists.
5. Add a deterministic differential corpus or operation-ownership assertion
   that protects compile-once behavior without a brittle tight timing limit.
6. Re-run the Cycle 10 boundary suite, categorizer/calculator tests, typecheck,
   and a host-reported unique-miss benchmark. Leave `D-C1-041` open.

## Acceptance

- [ ] Authored static and taxonomy terms compile edge metadata once.
- [ ] A no-occurrence comparison performs no boundary regular-expression
      work.
- [ ] Reverse matching reuses one compiled merchant representation.
- [ ] CU/KT/SKT intended variants still match, and unrelated Latin
      near-collisions remain rejected.
- [ ] Korean/descriptive substring and repeated-occurrence behavior remains
      unchanged.
- [ ] The unique-miss benchmark materially improves without claiming the
      deferred full-scan architecture is closed.

## Execution note

The requested `ralph` skill is unavailable. Prompt 3 will use the approved
manual test-first fallback with focused semantic tests, an equal-output
operation/performance probe, and then the repository-wide gates. No deployment
is part of this plan.
