# Plan 73 — Cycle 2 Domain and Catalog Correctness

**Findings:** C2-001, C2-002, C2-003, C2-004, C2-010, C2-027
**Deploy mode:** none
**Status:** completed
**Archived:** 2026-07-23 after Cycle 2 closure

## Outcome

Make every published “supported” reward executable from a product input, keep
catalog normalization at the trust boundary, match merchants consistently, and
preserve card identity in calculation limitations.

## Tasks

- [x] Reorder reward applicability so category/merchant matching happens
  before unsupported status is emitted. Normalize both allowlist entries and
  transaction merchants with the canonical merchant normalizer.
- [x] Add real-card regressions proving unrelated merchant rules do not emit
  issues and mixed-case `CGV`, `AliExpress`, `S-OIL`, and `PAYCO` forms match.
- [x] Mark the five unsupported Samsung `rate + unit:miles` rules fail-closed
  until a valuation contract exists, and add a catalog validator that rejects
  any `support.status: supported` tier shape the calculator cannot execute.
- [x] Return `safeParse(...).data` from browser catalog readers. Replace the
  object-identity assertion with normalization/finite-output tests.
- [x] Extend the shared raw transaction contract with validated `paymentType`,
  `channel`, `fuelVolumeLiters`, provenance, and performance-exclusion tags.
  Preserve those facts through JSON parsing, browser/server adapters,
  categorization, web persistence/reoptimization, and CLI mappings.
- [x] Give `CalculationIssue`/`UnsupportedRule` an explicit `cardId`, populate it
  at calculator/optimizer boundaries, and include it in deduplication,
  disclosure counts, CLI output, persistence, and tests.

## Acceptance

- [x] Every supported catalog tier shape is executable and finite.
- [x] A supported typed-condition fixture reaches both web and CLI optimization
  with source provenance intact.
- [x] Same-named rules from two cards remain two aggregate issues.
- [x] Full core/rules/web/CLI tests and `data:check` pass.

## Coverage

| Finding | Completion evidence |
|---|---|
| C2-001 | applicability-first issue test and catalog-wide unrelated-issue assertion |
| C2-002 | five rules fail closed plus executable-shape validator |
| C2-003 | normalized reader output and finite calculator regression |
| C2-004 | shared typed-fact input and end-to-end fixtures |
| C2-010 | canonical mixed-case merchant tests |
| C2-027 | `cardId` propagation and cross-card dedup regression |
