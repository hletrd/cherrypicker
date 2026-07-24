# Debugger Review — Cycle 42

## BUG-42-01: Web-side parseAmount double-negative (HIGH)
**File:** `apps/web/src/lib/parser/amount.ts:36-37`
**Confidence:** High

The web-side amount parser is missing the double-negative fix applied in cycle 41 to the server-side parser (`packages/parser/src/csv/shared.ts:165-173`).

Server-side (fixed in C41):
```typescript
let isNeg = (cleaned.startsWith('(') && cleaned.endsWith(')')) || isManeuners || hasTrailingMinus;
if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
  cleaned = cleaned.slice(1, -1);
  if (cleaned.startsWith('-')) { isNeg = false; }
}
```

Web-side (still broken):
```typescript
const isNegative = (cleaned.startsWith('(') && cleaned.endsWith(')')) || isManeuners || hasTrailingMinus;
if (cleaned.startsWith('(') && cleaned.endsWith(')')) cleaned = cleaned.slice(1, -1);
```

**Failure scenario:** A bank export contains `(-1234)` for a refund. The web parser strips parentheses, `isNegative` remains true, then `-parsed` is applied to the already-negative `-1234`, producing `+1234`. The transaction is recorded as a purchase instead of a refund.

**Fix:** Apply the same fix as server-side: use `let isNegative`, check for inner `-` after stripping parentheses, and set `isNegative = false`.

---

## BUG-42-02: optimization scalar fields lack finiteness validation (Medium)
**File:** `apps/web/src/lib/store.svelte.ts:270-272`
**Confidence:** High

`loadFromStorage` validates `optimization.totalReward`, `totalSpending`, and `effectiveRate` with only `typeof === 'number'`, missing `Number.isFinite()`. Corrupted sessionStorage containing `NaN` or `Infinity` for these fields passes validation and propagates to UI components.

This is the same validation gap pattern as BUG-40-01 (previousMonthSpending) and CR-41-05 (cardResults.totalReward), now appearing on a different set of fields.

**Fix:** Add `Number.isFinite()` guards for all three fields.

---

## BUG-42-03: monthlyBreakdown entries not finite-checked (Medium)
**File:** `apps/web/src/lib/store.svelte.ts:345-346`
**Confidence:** High

`monthlyBreakdown` entry `spending` and `transactionCount` use `typeof === 'number'` without `Number.isFinite()`. Corrupted data can propagate NaN into the monthly breakdown chart.

**Fix:** Add `Number.isFinite()` guards matching the pattern used for `transactionCount` at line 334.

---

## BUG-42-04: monthlyBreakdown month accepts empty strings (Low)
**File:** `apps/web/src/lib/store.svelte.ts:344`
**Confidence:** Medium

`entry.month` validation accepts any string, including empty string `''`. An empty month label would produce a malformed chart axis.

**Fix:** Validate month as non-empty and matching ISO month pattern `YYYY-MM`.
