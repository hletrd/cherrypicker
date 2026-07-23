# Plan 118 — Cycle 9 Verification and Catalog Documentation Truth

**Findings:** C9-009 (Medium/High), C9-010 (Medium/High)
**Status:** completed (archived)
**Deploy mode:** none

## Evidence

- README calls `bun run verify` equivalent to CI, while the workflow separately
  installs Playwright and runs `bun run test:e2e`.
- The 683-card and issuer counts are catalog counts. Unsupported-only active
  cards remain browseable but are filtered from optimizer execution.
- Hyundai representative copy highlights ZERO Edition3 benefits without
  disclosing that both shown rule sets are currently catalog-only.

## Outcome

Contributor verification instructions name the browser gate explicitly, and
card documentation exposes catalog visibility separately from optimizer
eligibility at root and issuer-index levels.

## Implementation

1. Describe `bun run verify` as static/unit/data/build verification and list
   `bun run test:e2e` as the additional CI browser gate with its Playwright
   prerequisite. Bind README and workflow commands in consistency tests.
2. Extend README catalog metadata with optimizer-executable counts and a short
   explanation of catalog-only cards/rewards.
3. Extend generated issuer indexes with a recommendation-calculation status
   derived from `isOptimizationExecutableCard`, not hand-maintained prose.
4. Mark unsupported-only representative Hyundai entries and claims as
   catalog-only or remove unqualified recommendation wording.
5. Extend `docs:check` tests so catalog existence/count and current executable
   status cannot drift independently.

## Acceptance

- [x] Local instructions no longer call a gate CI-equivalent while omitting
      E2E.
- [x] Root totals distinguish catalog cards from optimizer-executable cards.
- [x] Every issuer index exposes executable versus catalog-only status.
- [x] Unsupported-only representative cards are not described as current
      recommendation capability.

## Execution note

`ralph` is not registered. Prompt 3 will use generated-doc snapshot checks,
workflow consistency tests, and `data:check` as the manual fallback.

## Completion evidence

- Contributor documentation now separates static, unit, data, and build
  verification from the required Playwright CI browser gate.
- Generated root and issuer documentation distinguishes all 683 catalog cards
  from 566 optimizer-executable cards, including catalog-only Hyundai examples.
  Generated-doc and workflow consistency tests passed with the full gates.
