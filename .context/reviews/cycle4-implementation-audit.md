# Cycle 4 Implementation Audit

**Date:** 2026-07-23
**Baseline:** Cycle 4 implementation before final root gates
**Scope:** Plan 84 schema, calculator, persistence, and dashboard consumers
**Method:** read-only independent code and contract audit

## Findings

### C4-IA-001 - Fractional mileage rewards are schema-valid but not executable

- **Severity:** Medium
- **Confidence:** High
- **Aggregate ID:** C4-023
- **Evidence:** `packages/rules/src/schema.ts` permits a fractional
  `fixedAmount` for `mile_per_1500won` and derives
  `mileage_per_spend`. `packages/core/src/calculator/reward.ts` rejects
  every non-integer amount before reaching the mileage calculation. A valid
  rate of 0.5 mile per 1,500 won therefore returns zero with
  `unsupported_reward_unit` instead of one mile on 3,000 won of spending.
- **Required closure:** Let the calculator execute finite positive fractional
  mileage rates without weakening integer won-value validation. Add a
  schema-to-calculator contract regression.

### C4-IA-002 - Malformed persisted optimization can restore crashable state

- **Severity:** Medium
- **Confidence:** High
- **Aggregate ID:** C4-024
- **Evidence:** `apps/web/src/lib/persistence.ts` does not require
  `optimization.cardResults` to be an array and accepts partially shaped
  alternatives and category rewards. Invalid nested entries can be filtered
  without declaring the payload corrupt. The restored value reaches
  `SavingsComparison.svelte`, which calls `.map()` on `cardResults`.
- **Required closure:** Validate complete optimization container and item
  shapes. Reject the optimization atomically when any nested member is
  malformed, record a corruption warning, and cover non-array and partial
  nested payloads.

## Result

Both findings are new and above the Cycle 4 reporting threshold. They extend
Plan 84 and raise the aggregate from 22 to 24 unique findings. They are not
deferred.

## Implementation closure

- C4-IA-001 was fixed by validating mileage rates in their own unit branch and
  flooring the earned miles after complete 1,500-won blocks. The
  schema-to-calculator regression passed with the 124-test focused gate.
- C4-IA-002 was fixed by requiring complete optimization containers and nested
  entries, then rejecting the optimization atomically when any member is
  malformed. Persistence and replacement regressions passed with the 47-test
  focused gate.
- Both findings were covered by the final workspace lint, type, build, Bun,
  Vitest, and browser gates. No finding was deferred or deployed.
