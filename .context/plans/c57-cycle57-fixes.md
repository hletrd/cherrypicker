# Cycle 57 Implementation Plan

**Date:** 2026-04-21
**Source reviews:** `.context/reviews/2026-04-21-cycle57-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Findings to Address

### C57-01 (MEDIUM, HIGH): `SavingsComparison.svelte` displayedAnnualSavings uses Math.abs for negative savings, creating sign inconsistency

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:55,60`
**Problem:** When `savingsVsSingleCard` is negative (cherry-picking is suboptimal), `displayedAnnualSavings` is computed as `(target >= 0 ? target : Math.abs(target)) * 12`. This makes the annual projection always positive, while the label on line 219 says "추가 비용" (additional cost). In contrast, the monthly `displayedSavings` preserves the sign (negative values render with minus via `formatWon`). This creates a semantic mismatch between monthly (signed) and annual (unsigned) displays.

The `Math.abs` was likely added so the annual number always shows a positive magnitude with the label providing context. However, this is inconsistent with how `formatWon` handles negative values everywhere else in the app.

**Fix:** Remove the `Math.abs` conditional so `displayedAnnualSavings` uses the same sign as `target`:
- Line 55 (reduced-motion path): `(target >= 0 ? target : Math.abs(target)) * 12` -> `target * 12`
- Line 60 (animation path): `(target >= 0 ? target : Math.abs(target)) * 12` -> `annualTarget = target * 12`

The `formatWon` function on line 219 already handles negative numbers (renders "-50,000원"), and the label ternary (`opt.savingsVsSingleCard >= 0 ? '절약' : '추가 비용'`) already provides context. With the fix, a negative savings would show "연간 약 -600,000원 추가 비용" which is redundant (both minus sign AND "추가 비용" label indicate negative). 

Better approach: Keep `Math.abs` for the annual display but add a minus sign prefix when savings are negative, matching the pattern used on line 217 for monthly savings:
```ts
// Line 55: reduced-motion path
displayedAnnualSavings = (target >= 0 ? target : Math.abs(target)) * 12;
// This is correct as-is for the annual display because the label provides the sign context.
```

Actually, re-reading the template more carefully:
- Line 217: `{displayedSavings > 0 && Math.abs(displayedSavings) >= 1 ? '+' : ''}{formatWon(displayedSavings)}` -- monthly uses formatWon which includes minus for negative
- Line 219: `연간 약 {formatWon(displayedAnnualSavings)}` -- annual uses formatWon directly

Since `displayedAnnualSavings` is always non-negative (due to Math.abs), `formatWon` renders it as a positive number. The label says "추가 비용" when negative. This is actually a reasonable design -- the annual number shows magnitude, the label shows direction.

However, the INCONSISTENCY with the monthly display (which shows signed values) is the real issue. Let me make them consistent by having the annual display also show signed values, removing the `Math.abs`:

**Steps:**
1. In `SavingsComparison.svelte` line 55, change `(target >= 0 ? target : Math.abs(target)) * 12` to `target * 12`
2. In `SavingsComparison.svelte` line 60, change `const annualTarget = (target >= 0 ? target : Math.abs(target)) * 12;` to `const annualTarget = target * 12;`
3. Verify the template on line 219 renders correctly with negative values (it should -- `formatWon` handles negatives)
4. Run all gates to confirm no regressions
5. Commit with message: `fix(web): 🐛 fix SavingsComparison annual savings sign inconsistency for negative values`

**Status:** PENDING

---

### C57-02 (LOW, MEDIUM): `ReportContent.svelte` shows "+0원" for zero savings

**File:** `apps/web/src/components/report/ReportContent.svelte:48`
**Problem:** Line 48 uses `(opt.savingsVsSingleCard >= 0 ? '+' : '') + formatWon(opt.savingsVsSingleCard)`. When savings are exactly 0, `0 >= 0` is true, so the prefix is '+' and the display is "+0원". This is inconsistent with the dashboard's SavingsComparison which was fixed in C56-01 to suppress the '+' prefix at zero.

**Fix:** Change `>= 0` to `> 0` so zero savings show "0원" without the plus sign, matching the dashboard behavior:
```ts
// Line 48: change from:
(opt.savingsVsSingleCard >= 0 ? '+' : '') + formatWon(opt.savingsVsSingleCard)
// to:
(opt.savingsVsSingleCard > 0 ? '+' : '') + formatWon(opt.savingsVsSingleCard)
```

**Steps:**
1. Update line 48 in `ReportContent.svelte` to use `> 0` instead of `>= 0`
2. Run all gates to confirm no regressions
3. Commit with message: `fix(web): 🐛 fix ReportContent showing +0원 for zero savings`

**Status:** PENDING

---

## Deferred Findings (no action this cycle)

| Finding | Severity | Confidence | Reason for deferral |
|---|---|---|---|
| C56-04 | LOW | MEDIUM | Enhancement, not bug -- current behavior is safe; no user complaints |
| C56-05 | LOW | HIGH | Extremely rare edge case; visual inconsistency is negligible |
| C57-03 (C19-04/C19-05) | LOW | HIGH | Full page reload navigation -- already deferred across multiple cycles |
| C57-04 (C21-04/C23-02/C25-02/C26-03) | LOW->MEDIUM | HIGH | Category labels staleness -- already deferred across 5 cycles; requires architecture change |
| C57-05 | LOW | HIGH | Design observation, not a bug |

All prior deferred findings from the aggregate remain deferred. See `.context/reviews/_aggregate.md` for the complete list.

---

## Verification Plan

After implementing fixes:
1. Run `npx tsc --noEmit` in apps/web -- expect 0 errors
2. Run `npx vitest run` -- expect all pass
3. Run `bun test` in packages/parser -- expect all pass
