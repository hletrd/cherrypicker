# Plan 44: Server-side PDF parseAmount NaN Safety (Cycle 37)

**Finding:** C37-01
**Severity:** LOW
**Confidence:** High
**File:** `packages/parser/src/pdf/index.ts:98`

## Problem

The server-side PDF parser's `parseAmount` returns `NaN` when `parseInt` fails:

```typescript
function parseAmount(raw: string): number {
  const n = parseInt(raw.replace(/원$/, '').replace(/,/g, ''), 10);
  return Number.isNaN(n) ? NaN : n;
}
```

The web-side equivalent at `apps/web/src/lib/parser/pdf.ts:207-213` explicitly returns `0` instead:

```typescript
function parseAmount(raw: string): number {
  const n = parseInt(raw.replace(/원$/, '').replace(/,/g, ''), 10);
  // Return 0 instead of NaN so callers never have to guard against NaN
  // propagation. Amounts of 0 are correctly filtered out by the > 0
  // checks in both the structured and fallback parsing paths.
  return Number.isNaN(n) ? 0 : n;
}
```

The server-side `tryStructuredParse` at line 142 checks `Number.isNaN(amount)` so NaN values ARE caught currently. However, the web-side design is safer for future maintenance -- if a developer adds a new code path without an explicit NaN guard, NaN could propagate into `RawTransaction.amount` and through the reward calculator, where `NaN <= 0` evaluates to `false` (NaN comparisons always return false), causing the transaction to NOT be skipped and corrupting category reward buckets.

This is the ONLY `parseAmount` in the entire codebase that returns NaN. All other implementations return null, 0, or a valid number.

## Tasks

### Task 1: Change server-side PDF parseAmount to return 0 instead of NaN

- **File:** `packages/parser/src/pdf/index.ts:98`
- **Change:** Replace `return Number.isNaN(n) ? NaN : n;` with `return Number.isNaN(n) ? 0 : n;`
- **Add comment:** Explain why 0 is returned instead of NaN (same rationale as web-side)
- **Verify:** Run `bun test` to confirm all 266 tests still pass

## Exit Criteria

- `parseAmount` in `packages/parser/src/pdf/index.ts` returns 0 for unparseable values
- The comment explains the design rationale
- All tests pass

## Progress

### Task 1: DONE

- **Status:** COMPLETED
- **Date:** 2026-04-19
- **Changes:** Changed `return Number.isNaN(n) ? NaN : n;` to `return Number.isNaN(n) ? 0 : n;` at `packages/parser/src/pdf/index.ts:98-101` with explanatory comment matching the web-side rationale
- **Verification:** All 266 tests pass
