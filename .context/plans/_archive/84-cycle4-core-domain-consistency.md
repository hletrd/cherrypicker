# Plan 84 - Cycle 4 Core Domain Consistency

**Findings:** C4-001, C4-002, C4-003, C4-004, C4-005, C4-023, C4-024, C4-025
**Status:** completed
**Archived:** 2026-07-23 during Cycle 5 planning
**Deploy mode:** none

## Outcome

Keep exact-money values safe through every aggregate, give reward shape one
canonical interpretation, and make optimizer identity, occurrence, and
transaction eligibility agree with the calculator.

## Tasks

- [x] Replace unchecked monthly, eligible-performance, and previous-spending
  additions with the shared safe non-negative integer accumulator. Validate
  direct previous-spending inputs as non-negative safe integers before tier
  selection or optimization.
- [x] Tighten persisted analysis validation so monetary aggregates and count
  fields cannot restore finite-but-unsafe or fractional values. Preserve
  ordinary legacy data that satisfies the canonical bounds.
- [x] Require complete persisted optimization container and item shapes.
  Reject the optimization atomically with a corruption warning if any nested
  result, alternative, or category reward is malformed.
- [x] Resolve the `rate: 0` plus positive `fixedAmount` legacy shape at the
  schema boundary. Migrate LOCA 365 to the canonical fixed-value form and make
  generated summaries/indexes and the calculator consume the same reward
  discriminant or precedence rule.
- [x] Run `bun run data:build` after the authored YAML/schema change. Do not
  hand-edit generated rule or web artifacts. Check all generated identity,
  summary, optimizer, detail, and README projections for deterministic drift.
- [x] Execute finite positive fractional mileage rates admitted by the schema
  without weakening integer won-value validation. Add a direct
  schema-to-calculator contract regression.
- [x] Multiply fractional mileage rates with decimal-safe arithmetic before
  flooring whole miles so binary floating-point error cannot under-credit an
  exact decimal boundary.
- [x] Count a reward occurrence only when its executable uncapped reward is
  positive. Keep counting an originally positive reward when a transaction,
  monthly, or global cap later clips the payable value to zero.
- [x] Initialize `bestSingleCard` from the first evaluated card and retain
  deterministic first-card tie behavior. Reject a truly empty card catalog at
  the public optimizer boundary with a clear error.
- [x] Define one calculator/optimizer transaction-eligibility predicate. Exclude
  non-KRW rows before scoring, assignment, and total-spending accumulation so
  all result views agree on the same transaction set.
- [x] Add focused regressions for every boundary and consumer named below.

## Acceptance

- [x] Two individually valid `Number.MAX_SAFE_INTEGER` rows fail closed at the
  first aggregate that cannot represent their sum exactly.
- [x] `Number.MAX_SAFE_INTEGER + 1`, fractional, negative, and non-finite
  previous-spending inputs are rejected by direct calculator, optimizer, and
  persistence boundaries.
- [x] The LOCA 365 authored rule, generated artifact, calculator result, and
  displayed derived reward all represent the same 1,500-won fixed benefit.
- [x] A schema-valid 0.5-mile-per-1,500-won rule earns one mile on 3,000 won
  and does not emit `unsupported_reward_unit`.
- [x] A schema-valid 0.29-mile-per-1,500-won rule earns 28 miles below the
  100-block boundary and exactly 29 miles at 150,000 won.
- [x] A non-array `cardResults`, a partial alternative, or any malformed
  nested optimization entry rejects the whole optimization with a corruption
  warning and cannot reach dashboard consumers.
- [x] Rate-floor, sub-1,500-won mileage, and fractional fuel zero rewards do not
  consume `maxUses`; a positive reward clipped by a cap still does.
- [x] All-zero and tied-zero optimization returns a real deterministic card
  identity, while an empty catalog is rejected.
- [x] KRW rows remain eligible and non-KRW rows appear in no assignment or
  spending total. Optimization total spending equals assignment and card-result
  spending for the admitted rows.
- [x] Core, rules, web persistence, data build/check, type, and unit gates pass.

## Progress evidence

- `bun test packages/core/__tests__`: 168 passed, 0 failed.
- `bun test packages/rules/__tests__/schema.test.ts scripts/__tests__/catalog-publication.test.ts`:
  61 passed, 0 failed.
- `bun test apps/web/__tests__/store-persistence.test.ts`: 23 passed, 0 failed.
- Core, rules, and web typechecks pass with zero diagnostics.
- `bun run data:build`: 683 cards across 24 issuers; canonical rule and web
  projections regenerated.
- `bun run data:check`: passed, including README and issuer index checks for
  the same 683-card, 24-issuer catalog.
- `bun test packages/core/__tests__/calculator.test.ts
  packages/rules/__tests__/schema.test.ts`: 125 passed, 0 failed, including
  0.5-mile accumulation and the decimal-sensitive 0.29 rate at both sides of
  the 100-block boundary.
- Strict persisted optimization shapes and replacement runtime: 47 focused
  tests passed.
- Final root lint and typecheck completed with zero diagnostics. The full
  workspace tests, 1,684-test Bun compatibility gate, 2,394-test Vitest gate,
  warning-free build, and dependency/data checks passed.

## Coverage

| Finding | Required evidence |
|---|---|
| C4-001 | safe aggregate helpers plus maximum-row/direct-input/persistence tests |
| C4-002 | schema migration and schema-to-artifact-to-calculator contract test |
| C4-003 | zero-yield and positive-cap-clipped occurrence matrix |
| C4-004 | all-zero, tied-zero, consumer identity, and empty-catalog tests |
| C4-005 | shared currency eligibility and spending-equality tests |
| C4-023 | fractional schema-to-calculator mileage contract test |
| C4-024 | malformed optimization container and nested-entry persistence tests |
| C4-025 | decimal-safe fractional mileage multiplication and floor-boundary tests |

## Expected implementation surface

- `packages/core/src/analysis/context.ts`
- `packages/core/src/analysis/performance.ts`
- `packages/core/src/calculator/reward.ts`
- `packages/core/src/optimizer/greedy.ts`
- core calculator/optimizer/analysis tests
- `packages/rules/src/schema.ts`
- `packages/rules/data/cards/lotte/loca-365.yaml`
- rule schema, generator, and publication tests
- generated rule/web catalog artifacts produced only by `bun run data:build`
- `apps/web/src/lib/persistence.ts` and focused persistence tests
- this plan for completion evidence

No CLI, browser component, parser-worker, E2E, deploy, commit, or push work
belongs to this plan.
