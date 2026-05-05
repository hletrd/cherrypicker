# Cycle 85 Implementation Plan

**Date:** 2026-04-21
**Source:** `.context/reviews/2026-04-21-cycle85-comprehensive.md`

---

## Review Summary

Three new findings identified in cycle 85. The most significant (C85-01) is a missed fix from C83-03 that was applied to the monthly savings display but not the annual projection line.

---

## Task 1: Fix annual projection redundant minus under "추가 비용" (C85-01)

- **Finding:** C85-01 (MEDIUM, HIGH confidence)
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:237`
- **Problem:** C83-03 applied `Math.abs()` to the monthly savings display (line 235) to avoid the redundant minus sign under the "추가 비용" label, but the annual projection line (line 237) was NOT updated. When savings is negative, the annual line renders "연간 약 -60,000원 추가 비용" — redundant minus under a label that already communicates the negative direction.
- **Fix:** Apply `Math.abs()` to `displayedAnnualSavings` when negative, matching line 235:
  ```svelte
  연간 약 {formatWon(displayedAnnualSavings < 0 ? Math.abs(displayedAnnualSavings) : displayedAnnualSavings)} {opt.savingsVsSingleCard >= 0 ? '절약' : '추가 비용'} (최근 월 기준 단순 연환산)
  ```
- **Verification:** When `savingsVsSingleCard < 0`, the annual line should show "연간 약 60,000원 추가 비용" (no redundant minus), matching the monthly display behavior.
- **Status:** DONE

---

## Task 2: Add `+` prefix to annual projection for consistency (C85-02)

- **Finding:** C85-02 (LOW, MEDIUM confidence)
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:237`
- **Problem:** The monthly display uses `displayedSavings >= 100 ? '+' : ''` before `formatWon()` (C82-03), but the annual projection line shows no `+` prefix. When savings is positive, the annual line should also show `+` for consistency.
- **Fix:** Add the same `+` prefix threshold to the annual display:
  ```svelte
  연간 약 {displayedAnnualSavings >= 100 ? '+' : ''}{formatWon(displayedAnnualSavings < 0 ? Math.abs(displayedAnnualSavings) : displayedAnnualSavings)} {opt.savingsVsSingleCard >= 0 ? '절약' : '추가 비용'} (최근 월 기준 단순 연환산)
  ```
- **Verification:** When savings is positive and `displayedAnnualSavings >= 100`, the annual line should show "연간 약 +60,000원 절약". When savings is zero or negative, no `+` prefix.
- **Status:** DONE

---

## Task 3: Add AbortSignal to CardDetail loadCategories (C85-03)

- **Finding:** C85-03 (LOW, MEDIUM confidence)
- **File:** `apps/web/src/components/cards/CardDetail.svelte:24-32`
- **Problem:** `loadCategories()` is called without an AbortSignal and has no cleanup function. During Astro View Transitions, the component may unmount while the fetch is in-flight, causing wasted work and a minor memory leak.
- **Fix:** Pass an AbortSignal and return a cleanup function from `onMount`:
  ```typescript
  onMount(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const nodes = await loadCategories(controller.signal);
        if (!controller.signal.aborted) {
          categoryLabels = buildCategoryLabelMap(nodes);
        }
      } catch {
        // Fall back to showing raw IDs — non-critical
      }
      if (!controller.signal.aborted) {
        categoryLabelsReady = true;
      }
    })();
    return () => controller.abort();
  });
  ```
- **Verification:** Navigate away from the card detail page while categories are loading — no console errors, and the fetch is properly cancelled.
- **Status:** DONE

---

## Deferred Items (carried forward, no changes)

All prior deferred findings from the aggregate remain unchanged. No new deferred items this cycle.

---

## Status of Prior Plans

All prior cycle plans (1-84) are DONE or archived. No prior plans have outstanding implementation tasks.
