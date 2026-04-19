# Plan -- Cycle 41: Fix NaN Amount Propagation in Server-Side CSV Bank Adapters

**Date:** 2026-04-19
**Origin:** C41-01 (cycle 41 comprehensive review)
**Severity:** HIGH
**Status:** COMPLETED

---

## Problem

All 10 server-side CSV bank adapters (`packages/parser/src/csv/{hyundai,samsung,shinhan,kb,lotte,hana,woori,nh,ibk,bc}.ts`) define a local `parseAmount` function that returns `NaN` for unparseable values. However, none of them check whether `parseAmount` returned NaN before pushing the transaction into the results array. This allows NaN amounts to propagate into the optimizer where `NaN <= 0` evaluates to `false` (bypassing the amount filter), causing NaN reward calculations that corrupt the entire output.

## Tasks

### Task 1: Add NaN guard to all 10 server-side CSV bank adapters

**Files to modify:**
- `packages/parser/src/csv/hyundai.ts`
- `packages/parser/src/csv/samsung.ts`
- `packages/parser/src/csv/shinhan.ts`
- `packages/parser/src/csv/kb.ts`
- `packages/parser/src/csv/lotte.ts`
- `packages/parser/src/csv/hana.ts`
- `packages/parser/src/csv/woori.ts`
- `packages/parser/src/csv/nh.ts`
- `packages/parser/src/csv/ibk.ts`
- `packages/parser/src/csv/bc.ts`

**Change:** After `const amount = parseAmount(amountRaw);`, add a NaN check before the transaction object creation:

```typescript
const amount = parseAmount(amountRaw);
if (isNaN(amount)) {
  if (amountRaw.trim()) {
    errors.push({ line: i + 1, message: `금액을 해석할 수 없습니다: ${amountRaw}`, raw: line });
  }
  continue;
}
```

This matches the pattern used by:
- `packages/parser/src/csv/generic.ts` (returns `null`, checks `amount === null`)
- `apps/web/src/lib/parser/csv.ts` (uses `isValidAmount()` helper)

### Task 2: Run tests to verify no regressions

Run `bun test` and confirm 266 pass, 0 fail.

### Task 3: Commit and push

Fine-grained commit for the NaN guard fix across all 10 adapters.
