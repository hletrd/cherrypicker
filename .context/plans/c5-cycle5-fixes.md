# Cycle 5 Implementation Plan

**Date:** 2026-04-20
**Based on:** `.context/reviews/2026-04-20-cycle5-comprehensive.md`

---

## Task 1: Add NaN guard to SpendingSummary prevLabel computation (C5-01)

- **Finding:** C5-01 (LOW/MEDIUM)
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:119`
- **Current behavior:** The template expression uses `parseInt(latestMonth.month.slice(5, 7) ?? '0', 10)` to compute month difference. If a malformed `month` field (shorter than 7 chars) is present, `slice(5, 7)` returns `''`, and `parseInt('', 10)` returns `NaN`. The `?? '0'` nullish coalescing doesn't help because `''` is not nullish. This causes `Math.abs(NaN - NaN) = NaN`, which fails the `<= 1` check, producing the wrong label.
- **Fix:** Extract the month parsing into a local variable with a `Number.isFinite` guard, falling back to a sensible default:
  ```svelte
  {@const m1 = parseInt(latestMonth.month.slice(5, 7), 10)}
  {@const m2 = parseInt(prevMonth.month.slice(5, 7), 10)}
  {@const prevLabel = (Number.isFinite(m1) && Number.isFinite(m2) && Math.abs(m1 - m2) <= 1) ? '전월실적' : '이전 달 실적'}
  ```
- **Risk:** Very low -- this is a display-only label that defaults to a reasonable value even with corrupted data.
- **Status:** DONE

---

## Deferred Items (carried forward, no changes)

All deferred items from `.context/plans/00-deferred-items.md` remain unchanged. No new deferred items this cycle.
