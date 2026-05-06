# Cycle 33 Test Engineering Review — CherryPicker

**Agent:** c33-test-engineer  
**Date:** 2026-05-06  
**Status:** Agent spawn failed; review performed by orchestrator

---

## Finding 1: No tests for `getCalcFn` default/unknown type case [MEDIUM / High confidence]

**File:** `packages/core/src/calculator/reward.ts:98-112`

**Problem:** The default case in `getCalcFn` returns `calculateDiscount` for any unknown type. There are no tests verifying this behavior or ensuring it doesn't mask config errors.

**Suggested test:**
```typescript
expect(() => getCalcFn('unknown')).toThrow(); // or test the fallback behavior
```

**Confidence:** High

---

## Finding 2: No property-based or randomized tests for amount parsing [MEDIUM / High confidence]

**Files:** `apps/web/src/lib/parser/amount.ts`, `packages/parser/src/amount.ts`

**Problem:** Amount parsing tests cover known formats but don't fuzz-test with random inputs. Edge cases like very large numbers (> Number.MAX_SAFE_INTEGER), Unicode whitespace, or malformed patterns may not be covered.

**Suggested fix:** Add property-based tests using a library like `fast-check` to verify that `parseAmountString` never throws and always returns `number | null`.

**Confidence:** High

---

## Finding 3: Missing tests for sessionStorage migration paths [MEDIUM / Medium confidence]

**File:** `apps/web/src/lib/store.svelte.ts:238-250`

**Problem:** The migration framework (`MIGRATIONS` record) has no tests. If a future migration is added incorrectly, it could corrupt user data on load.

**Suggested fix:** Add tests for the migration loop, including:
- v0 → v1 migration
- v1 → v2 migration (when added)
- Corrupted data handling

**Confidence:** Medium

---

## Finding 4: No tests for `calculateFixedReward` with `won_per_liter` unit [LOW / Medium confidence]

**File:** `packages/core/src/calculator/reward.ts:162-166`

**Problem:** The `won_per_liter` unit returns `fixedAmount` unconditionally (no volume data). There are no tests verifying this behavior.

**Suggested fix:** Add a test case for fuel transactions with `won_per_liter` unit.

**Confidence:** Medium

---

## Finding 5: Vitest config expanded but no verification that all tests run under vitest [LOW / Medium confidence]

**File:** `vitest.config.ts` (C32-INFRA01)

**Problem:** The vitest config was expanded in C32 to include more test files, but there's no CI verification that `npx vitest` and `bun test` produce the same results. They use different test runners and may have subtle differences.

**Suggested fix:** Add a CI step that runs both and compares pass counts.

**Confidence:** Medium

---

## Final Sweep

- 213 tests passing, 0 failing — good baseline.
- Core package tests are comprehensive.
- Web parser tests exist but mostly cover happy paths.
- No e2e tests for the full upload→optimize→display flow.
