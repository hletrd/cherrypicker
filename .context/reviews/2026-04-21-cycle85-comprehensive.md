# Cycle 85 Comprehensive Review — 2026-04-21

**Scope:** Full re-read of all source files under `apps/web/src/`, cross-file interaction analysis, and verification of prior cycle fixes.

---

## Verification of Prior Cycle Fixes

All prior cycle 1-84 findings are confirmed fixed except as noted in the aggregate. Cycle 84 findings verified:

| Finding | Status | Evidence |
|---|---|---|
| C84-01 | **FIXED** | `VisibilityToggle.svelte:93` uses `>= 100` threshold. |
| C84-02 | **FIXED** | `VisibilityToggle.svelte:93` uses `Math.abs()` for negative values. |
| C84-03 | FALSE POSITIVE | Confirmed — `Number.isFinite(obj.amount)` already present at `store.svelte.ts:206`. |

---

## New Findings (This Cycle)

### C85-01: SavingsComparison annual projection shows redundant minus for negative values (MEDIUM)

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:237`

**Description:** The C83-03 fix applied `Math.abs()` to the monthly savings display (line 235) to avoid the redundant minus sign under the "추가 비용" label, but the annual projection line on line 237 was NOT updated to match:

```svelte
<!-- Line 235 (MONTHLY — fixed in C83-03) -->
{displayedSavings >= 100 ? '+' : ''}{formatWon(displayedSavings < 0 ? Math.abs(displayedSavings) : displayedSavings)}

<!-- Line 237 (ANNUAL — NOT fixed) -->
연간 약 {formatWon(displayedAnnualSavings)} {opt.savingsVsSingleCard >= 0 ? '절약' : '추가 비용'}
```

When `savingsVsSingleCard` is negative (cherry-picking is worse), `displayedAnnualSavings` is also negative (it animates from the monthly target * 12). The annual line renders as "연간 약 -60,000원 추가 비용" — a redundant minus sign under a label that already communicates the negative direction. This is the exact same inconsistency that C83-03 fixed for the monthly display.

**Confidence:** HIGH — directly observable in the source code; the C83-03 fix is present on line 235 but absent on line 237.

**Fix:** Apply `Math.abs()` to `displayedAnnualSavings` when it is negative, matching line 235:
```svelte
연간 약 {formatWon(displayedAnnualSavings < 0 ? Math.abs(displayedAnnualSavings) : displayedAnnualSavings)}
```

---

### C85-02: SavingsComparison annual projection missing `+` prefix threshold (LOW)

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:237`

**Description:** The C82-03 fix applied the `>= 100` threshold for the `+` prefix to the monthly savings display (line 235), but the annual projection line on line 237 does not show a `+` prefix at all. When savings is positive and the annual projection is meaningful (>= 100 won, which it always is when monthly >= 100 since annual = monthly * 12), the annual line should also show a `+` prefix for consistency with the monthly display.

**Confidence:** MEDIUM — The annual display might intentionally omit the `+` prefix for stylistic reasons ("연간 약" already frames it as a projection), but consistency with the monthly display suggests it should match.

**Fix:** If consistency is desired, add the same `+` prefix:
```svelte
연간 약 {displayedAnnualSavings >= 100 ? '+' : ''}{formatWon(displayedAnnualSavings < 0 ? Math.abs(displayedAnnualSavings) : displayedAnnualSavings)}
```

---

### C85-03: CardDetail loadCategories() not cancelled on unmount (LOW)

**File:** `apps/web/src/components/cards/CardDetail.svelte:24-32`

**Description:** The `onMount` callback calls `loadCategories()` without an AbortSignal and has no cleanup function to cancel the fetch. During Astro View Transitions, the component may unmount while the fetch is in-flight. `loadCategories()` internally catches AbortError and returns `[]`, but since no signal was passed, it will complete the fetch and update `categoryLabels` and `categoryLabelsReady` on a dead component instance. This is a minor memory leak pattern (the promise keeps the component alive via closure) and wasted network work, but it doesn't cause visible bugs because the state update targets a component instance that is no longer in the DOM.

Compare with TransactionReview.svelte (lines 84-122) which properly uses an AbortController with cleanup.

**Confidence:** MEDIUM — The impact is limited to wasted work and a minor memory leak during navigation. No user-visible bug.

**Fix:** Pass an AbortSignal to `loadCategories()` and return a cleanup function from `onMount`:
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

---

## Cross-File Interaction Analysis

No new cross-file interaction issues found beyond what is already tracked in the aggregate. The prior findings around multi-location bank data sync (C74-05), BANK_SIGNATURES duplication (C7-07), and csv/shared.ts code duplication (C70-04) remain the most significant cross-file concerns.

## Final Sweep

All source files under `apps/web/src/` were re-examined this cycle. No files were skipped. The most significant new finding (C85-01) is a missed fix from a prior cycle that was applied to one display line but not its sibling line in the same component.
