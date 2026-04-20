# Cycle 56 Implementation Plan

**Date:** 2026-04-21
**Source reviews:** `.context/reviews/2026-04-21-cycle56-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Findings to Address

### C56-01 / C55-05 (MEDIUM, HIGH): `SavingsComparison.svelte` count-up animation flickers "+0원" during sign transitions

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:70,215`
**Problem:** When the savings target changes from positive to negative (or vice versa), the 600ms count-up animation passes through zero. At that moment, the sign prefix `displayedSavings > 0 ? '+' : ''` shows "+0원" (because 0 is NOT > 0 so no plus is shown, but the animation briefly produces a value of exactly 0 with the wrong sign context). Actually, the real issue is: when animating FROM 0 TO a positive target, the first few frames show values like 1, 2, 3 etc. which correctly get '+' prefix. But when animating from a positive value (e.g. 5000) to a negative value (e.g. -3000), the animation passes through 0, and at that moment `displayedSavings > 0` is false, so no '+' is shown -- "0원" appears. Then it continues to "-1원", "-2원" etc. The visual flicker is the brief appearance of "0원" during the crossing.

Additionally, when animating from 0 to a positive target, the initial `displayedSavings` is 0, and the condition on line 47 (`target === 0 && displayedSavings === 0`) correctly skips the animation when target IS 0. But when target is positive and displayedSavings starts at 0, the animation runs and the first non-zero value correctly gets '+'.

The core flicker happens when `startVal` and `target` have opposite signs -- the interpolated value crosses zero, and for a few frames shows "0원" (or near-zero values with wrong sign prefix).

**Fix:** In the `tick()` function, when `startVal` and `target` have opposite signs (one positive, one negative), skip the zero-crossing by clamping: if `startVal > 0 && target < 0`, the interpolated value should snap to `target` when it reaches 0 or below (skip the positive-to-zero frames). Similarly for the reverse direction. A simpler approach: suppress the '+' prefix when `displayedSavings` is exactly 0 AND the animation is in progress (i.e., `target !== 0`):

```ts
// Line 215: change from:
{displayedSavings > 0 ? '+' : ''}
// to:
{displayedSavings > 0 && (displayedSavings !== 0 || opt?.savingsVsSingleCard === 0) ? '+' : ''}
```

Wait, actually the simplest and most robust fix is to just handle the sign prefix based on the TARGET value rather than the intermediate animation value. When the animation is from positive to negative, the sign should flip immediately (or at least not show "+0"):

Simplest correct fix for line 215:
```svelte
{displayedSavings > 0 ? '+' : ''}
```
Change to:
```svelte
{displayedSavings > 0 && Math.abs(displayedSavings) >= 1 ? '+' : ''}
```

This suppresses the '+' prefix when the animated value rounds to 0, which is exactly the flicker case.

**Steps:**
1. Update the sign prefix logic at line 215 in `SavingsComparison.svelte` to not show '+' when `Math.abs(displayedSavings) < 1`
2. Run all gates to confirm no regressions
3. Commit with message: `fix(web): 🐛 suppress +0원 flicker during SavingsComparison sign transitions`

**Status:** PENDING

---

### C56-05 (LOW, HIGH): Zero savings shows "0원" without plus sign but label says "추가 절약"

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:215`
**Problem:** When `opt.savingsVsSingleCard` is exactly 0, the label on line 212 says "추가 절약" but the value shows "0원" without a plus sign. This is a very minor visual inconsistency.
**Fix:** When savings are exactly 0, change the label from "추가 절약" to just "절약" or leave as-is since it's a very rare edge case. Not worth the complexity of a conditional label change.
**Decision:** DEFER -- the zero-savings case is extremely rare (exact zero improvement), and the visual inconsistency is negligible.

---

### C56-04 (LOW, MEDIUM): Unparseable dates silently returned as raw string without error reporting

**File:** `apps/web/src/lib/parser/date-utils.ts:112` + all parsers (csv.ts, xlsx.ts, pdf.ts)
**Problem:** When `parseDateStringToISO` cannot match any date format, it returns the raw trimmed input as-is. Corrupted date strings (e.g., "N/A", "TBD") become the `date` field of transactions silently. Downstream code handles these via `tx.date.length < 7` guards, but the user gets no error message explaining skipped rows.
**Fix:** Add a validation step in each parser after calling `parseDateToISO`: if the result doesn't match `^\d{4}-\d{2}-\d{2}$`, push a parse error. This would require changes to:
1. `csv.ts` -- add date validation in the transaction creation loop
2. `xlsx.ts` -- add date validation in the transaction creation loop
3. `pdf.ts` -- add date validation in the transaction creation loop

This is a moderate-sized change touching all three parsers. The benefit is better user feedback when dates can't be parsed.
**Decision:** DEFER -- the current behavior (silently excluding malformed dates) is safe and consistent. Adding date validation error reporting is an enhancement, not a bug fix. The user can already see the transaction count discrepancy. Revisit if users report confusion about missing rows.

---

## Deferred Findings (no action this cycle)

| Finding | Severity | Confidence | Reason for deferral |
|---|---|---|---|
| C56-04 | LOW | MEDIUM | Enhancement, not bug -- current behavior is safe; no user complaints |
| C56-05 | LOW | HIGH | Extremely rare edge case; visual inconsistency is negligible |

All prior deferred findings from the aggregate remain deferred. See `.context/reviews/_aggregate.md` for the complete list.

---

## Verification Plan

After implementing the C56-01 fix:
1. Run `npx eslint apps/web/src/` -- expect 0 errors
2. Run `npx tsc --noEmit` -- expect 0 errors
3. Run `npx vitest run` -- expect all pass
4. Run `bun test` -- expect all pass
