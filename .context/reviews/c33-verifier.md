# Cycle 33 Verifier Review — CherryPicker

**Agent:** c33-verifier  
**Date:** 2026-05-06  
**Status:** Agent spawn failed; review performed by orchestrator

---

## Finding 1: `getCalcFn` default case masks config errors silently [MEDIUM / High confidence]

**File:** `packages/core/src/calculator/reward.ts:108-111`

**Problem:** Unknown reward types fall back to `calculateDiscount`. This means a typo in a card rule's `type` field produces silently wrong rewards. The verifier expects explicit handling or validation.

**Counter-example:** A rule with `type: 'mileag'` (typo) would be treated as discount. For a 20,000 Won transaction at 1% rate:
- Expected (mileage/points): floor(20000 * 0.01) = 200 Won
- Actual (discount): floor(20000 * 0.01) = 200 Won

In this case the math coincides, but for `type: 'cashbak'`:
- Expected (cashback): 200 Won (same math)
- All types currently use the same calculation function family

Actually, re-reading: `calculateDiscount`, `calculatePoints`, and `calculateCashback` may all use the same underlying math (rate * amount). If they do, the default is harmless. Need to verify.

**Verification needed:** Check if `calculateDiscount`, `calculatePoints`, `calculateCashback` have different rounding or cap behaviors.

**Confidence:** Medium (pending verification of calc function differences)

---

## Finding 2: `calculateFixedReward` returns 0 for unsupported units without warning [LOW / Medium confidence]

**File:** `packages/core/src/calculator/reward.ts:162-176`

**Problem:** Units like `won_per_liter` return `fixedAmount` as a per-transaction discount (line 166 comment), but other unknown units return 0. No warning is logged or returned to indicate the unit is unsupported.

**Counter-example:** A card rule has `unit: 'won_per_km'` for a mileage card. The calculator silently returns 0 reward. The user sees "0 reward" with no indication why.

**Suggested fix:** Return a warning in the `CalculationOutput` when unsupported units are encountered.

**Confidence:** Medium

---

## Finding 3: Web-side and server-side JSON parsers have parity [VERIFIED / High confidence]

**Files:** `apps/web/src/lib/parser/json.ts` vs `packages/parser/src/json/index.ts`

**Verification:** Both use identical `findField` implementation with alias-outer/key-inner loop (C32-V09 fix). Both use identical `normalizeAmount` and `parseTransactionObject`. Wrapper key handling matches.

**Result:** PARITY CONFIRMED.

---

## Finding 4: Web-side and server-side HTML parsers have parity [VERIFIED / High confidence]

**Files:** `apps/web/src/lib/parser/html.ts` vs `packages/parser/src/html/index.ts`

**Verification:** Both implement forward-fill reset on blank rows (C32-F1). Both use `normalizeHTML`. Both use identical column matching patterns.

**Result:** PARITY CONFIRMED.

**Note:** Web-side uses `new TextEncoder().encode()` while server-side uses `Buffer.from()`. This is expected given environment differences.

---

## Finding 5: `previousMonthSpending` negative value not rejected [LOW / Medium confidence]

**File:** `apps/web/src/lib/store.svelte.ts:567`

**Problem:** The `Number.isFinite` check added in C32-BUG-3 rejects `NaN` and `Infinity`, but does NOT reject negative values. A negative `previousMonthSpending` would produce unexpected tier selection behavior.

**Counter-example:** `previousMonthSpending = -1000` passes the check. In `selectTier`, this would match tiers with `minSpending <= -1000`, potentially selecting a high tier incorrectly.

**Suggested fix:** Add `options.previousMonthSpending >= 0` validation.

**Confidence:** Medium

---

## Final Sweep

- All C32 mathematical fixes verified: perTxCap (line 264), global cap rollback (line 303), sort stability (greedy.ts).
- No off-by-one errors in date slicing (store.svelte.ts uses `slice(0, 7)` correctly for YYYY-MM).
- No rounding bugs detected in amount parsing.
