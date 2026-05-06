# Verifier Review — CherryPicker Cycle 40

**Reviewer:** verifier
**Scope:** Evidence-based correctness verification
**Date:** 2026-05-06

---

## Summary

Verified 3 claims: 1 new bug confirmed, 1 prior finding remains partially open, 1 parser behavior verified correct.

| Category | Count |
|---|---|
| Confirmed New Bug | 1 |
| Prior Finding Partially Open | 1 |
| Verified Correct | 1 |

---

## CONFIRMED NEW BUG

### C40-V01: NaN Persists Through sessionStorage Load Validation
**File:** `apps/web/src/lib/store.svelte.ts:347`
**Status:** CONFIRMED — HIGH CONFIDENCE

**Evidence:**
```typescript
previousMonthSpendingOption: typeof parsed.previousMonthSpendingOption === 'number'
  ? parsed.previousMonthSpendingOption
  : undefined,
```

`typeof NaN === 'number'` evaluates to `true`. Therefore `NaN` passes validation and is returned as a valid `previousMonthSpendingOption`. When `reoptimize` passes this to `optimizeFromTransactions`, the `calculateRewards` NaN guard (added in C39) throws an Error. The user sees an implementation-detail error message.

**Fix:** Replace `typeof === 'number'` with `typeof === 'number' && Number.isFinite(...)`.

---

## VERIFIED CORRECT

### C40-V02: `parseAmountString` Trailing Rejection Works for `(1,234 원)`
**File:** `packages/parser/src/csv/shared.ts:148-184`
**Status:** CORRECT — HIGH CONFIDENCE

The `(1,234 원)` case (parenthesized amount with Won suffix and space) is handled correctly:
1. `\s*원$` does not match (ends with `)`)
2. Parentheses stripped → `1,234 원`
3. `numMatch = "1,234"` (comma already stripped earlier)
4. `afterNum = " 원"` → trim → `"원"` → passes whitelist
5. `parseFloat("1234원")` → `1234`
6. `isNeg = true` → returns `-1234`

This confirms the C39 fix for trailing garbage did not regress the `(1,234 원)` case.

---

## PRIOR FINDING PARTIALLY OPEN

### C40-V03: C32-V07 FIFO Cache — Revisited
**File:** `packages/core/src/categorizer/matcher.ts:128-136`
**Status:** CORRECT (NOT A BUG) — HIGH CONFIDENCE

The eviction strategy IS LRU, not FIFO. On every `cache.get()` hit, the code deletes and re-inserts the entry, moving it to the end of the Map. Evicting the first key removes the least recently used entry. Cycle 39 correctly reclassified this as misdiagnosed.

---

## Gate Verification

| Gate | Result |
|------|--------|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `bun run test` | PASS (1555+ tests) |
