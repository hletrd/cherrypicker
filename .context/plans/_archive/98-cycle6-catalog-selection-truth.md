# Plan 98 — Cycle 6 Catalog and Selection Truth

**Findings:** C6-008 (Medium/High), C6-009 (Medium/High), C6-010 (Medium/High)  
**Status:** complete  
**Deploy mode:** none

## Evidence

- `apps/web/src/lib/analyzer.ts:213-226` and
  `analyzer-helpers.ts:66-72` validate only that at least one requested card
  resolved.
- `packages/rules/src/schema.ts:231-244`,
  `catalog-validation.ts:74-101,230-270`, and
  `packages/core/src/calculator/reward.ts:51-53` accept duplicate tier
  references and then take the first.
- Shared schema/catalog validation and the custom CLI accept future
  `lastUpdated` dates, while publication and scraper boundaries carry separate
  stricter checks.

## Outcome

Explicit card selection resolves completely, every reward tier reference is
unique, and one clock-aware freshness invariant governs schema consumers,
custom CLI catalogs, scraper output, and publication.

## Implementation

1. Change the selection guard to compare deduplicated requested IDs with the
   actual resolved eligible card IDs. Fail closed with the stable list of
   missing/ineligible IDs; duplicate requests must not cause a false failure.
2. Add a schema refinement and a matching semantic issue code for duplicate
   `reward.tiers[*].performanceTier` values, including the duplicate index and
   rule identity. Keep a defensive calculator assertion so direct unvalidated
   callers do not inherit first-entry-wins behavior.
3. Add one clock-injected shared freshness validator for real ISO dates not
   after the current UTC calendar day. Invoke it from shared catalog
   validation and delegate publication, scraper, and custom CLI boundaries to
   it; remove duplicated date comparisons.
4. Keep generated catalog behavior deterministic and avoid reading the wall
   clock multiple times within one validation/publication operation.

## Tests

- Web adapter tests for partial resolution, duplicates, all missing,
  recommendation-ineligible IDs, and exact missing-ID diagnostics.
- Schema, semantic-validator, loader, custom CLI, scraper, publication, and
  calculator tests for duplicate tier references and order independence.
- Clock-injected tables for today, past, future, leap day, invalid clock, and
  one-clock consistency across all authoring boundaries.
- Rules, scraper, CLI, web, data generation/check, type, lint, unit/Vitest,
  build, and final browser gates.

## Acceptance

- [x] Optimization never silently drops one member of an explicit card set.
- [x] Duplicate tier references fail every authoring boundary before reward
  calculation.
- [x] Future freshness dates have one shared diagnostic and injected-clock
  behavior everywhere.
- [x] Current 683-card catalog generation remains byte-stable.

## Completion evidence

- Explicit selections now fail with the complete stable set of missing or
  ineligible IDs, while duplicate requests remain idempotent.
- Schema, semantic, calculator, CLI, scraper, and publication boundaries
  reject duplicate tier references and use the shared injected-clock
  freshness validator.
- `bun run data:build` followed by `bun run data:check` preserved the
  683-card, 24-issuer generated catalog byte-for-byte.

## Execution note

`ralph` is not installed. Prompt 3 will use a bounded manual loop with
cross-boundary contract tests before generated artifacts are accepted.
