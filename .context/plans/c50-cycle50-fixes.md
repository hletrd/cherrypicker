# Plan: Cycle 50 Fixes

**Date:** 2026-04-21
**Source reviews:** `.context/reviews/2026-04-21-cycle50-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Tasks

### 1. [LOW] Fix CategoryBreakdown `maxPercentage` initial value (C50-01 / C41-04 / C42-03 / C43-03 / C49-03)

- **Finding:** C50-01 (converged across 5 cycles)
- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:129`
- **Description:** `maxPercentage` uses `reduce(..., 1)` where the initial value of `1` (1%) distorts bar widths when all categories have percentages below 1%. Bars fill 100% width because the max is clamped to 1%.
- **Fix:** Change the `maxPercentage` derivation to use `0` as the initial value and add a division-by-zero guard in the bar width template:
  ```ts
  // Line 129: change initial value from 1 to 0
  let maxPercentage = $derived(categories.length > 0 ? categories.reduce((max, c) => Math.max(max, c.percentage), 0) || 1 : 100);
  ```
  The `|| 1` fallback ensures we never divide by zero when all percentages are 0.
- **Verification:** Open dashboard with a dataset that has only tiny categories (< 1% each). Bars should be proportionally small, not filling 100% width. Run `bun test` and `vitest` to ensure no regressions.
- **Status:** PENDING

---

### 2. [LOW] Fix `savingsPct` numeric Infinity for accessibility (C50-02)

- **Finding:** C50-02
- **Severity:** LOW
- **Confidence:** MEDIUM
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:108-109, 231-235`
- **Description:** `savingsPct` returns the numeric `Infinity` value when the best single card has 0 reward but cherry-picking earns more. This could confuse screen readers or assistive technologies that interpret the value as a number. The badge text "최적 조합만 혜택" is fine, but the underlying value should be a string sentinel.
- **Fix:** Change `savingsPct` to return a discriminated union. Replace `return Infinity` with a sentinel and update the template:
  ```ts
  // Change the return type and value
  if (opt.bestSingleCard.totalReward === 0 && opt.savingsVsSingleCard > 0) {
    return Infinity; // Keep as numeric sentinel — the template checks `=== Infinity` exactly
  }
  ```
  Actually, since the template already checks `savingsPct === Infinity` and only the badge text is rendered, and the branch is currently unreachable per C28-04, the risk is theoretical. The simplest fix is to add a comment documenting that `Infinity` is intentionally used as a sentinel and should not be consumed as a numeric value by other code paths.
- **Revised fix:** Add documentation comment. The actual `Infinity` value is only compared via `===` and never rendered as text, so the accessibility risk is minimal. If a future code path needs to announce `savingsPct`, it should check for `Infinity` first.
- **Verification:** Run `vitest` to ensure no regressions.
- **Status:** PENDING

---

### 3. [LOW] Simplify `cardBreakdown` derivation in SavingsComparison (C50-05 / D-53)

- **Finding:** C50-05
- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:24-45`
- **Description:** `cardBreakdown` manually aggregates `assignments` by card ID to compute per-card spending, reward, and rate. The same data is already available in `analysisStore.cardResults` from the optimizer's `buildCardResults` function. The re-derivation is redundant and could diverge if the optimizer's computation changes.
- **Fix:** Replace the `cardBreakdown` derivation with a simple mapping from `analysisStore.cardResults`:
  ```ts
  let cardBreakdown = $derived.by((): CardBreakdown[] => {
    const results = analysisStore.cardResults;
    if (!results.length) return [];
    return results.map(cr => ({
      cardId: cr.cardId,
      cardName: cr.cardName,
      spending: cr.totalSpending,
      reward: cr.totalReward,
      rate: cr.effectiveRate,
    })).sort((a, b) => b.reward - a.reward);
  });
  ```
  This eliminates the `CardBreakdown` interface (use inline types or the existing `CardRewardResult` shape) and the manual aggregation loop.
- **Verification:** Run `vitest` to ensure no regressions. Visually verify that the "카드별 상세 보기" breakdown table shows the same values as before.
- **Status:** PENDING

---

### 4. [LOW] Fix XLSX parser to select best sheet instead of first (C50-07)

- **Finding:** C50-07
- **Severity:** LOW
- **Confidence:** MEDIUM
- **File:** `apps/web/src/lib/parser/xlsx.ts:282-293`
- **Description:** When iterating workbook sheets, the parser returns the first sheet that yields transactions. If a multi-sheet workbook has a summary sheet with few transactions and a detail sheet with many, the summary could be returned first. This is unlikely for Korean credit card XLSX exports (typically single-sheet) but is a robustness improvement.
- **Fix:** Track the best result (most transactions) across all sheets instead of early-returning:
  ```ts
  let bestResult: ParseResult | null = null;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const result = parseXLSXSheet(sheet, bank, htmlBankHint);
    if (result.transactions.length > 0) {
      if (!bestResult || result.transactions.length > bestResult.transactions.length) {
        bestResult = result;
      }
    }
  }
  return bestResult ?? { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [{ message: '시트 데이터를 읽을 수 없습니다.' }] };
  ```
- **Verification:** Run `vitest` to ensure no regressions. Test with a single-sheet XLSX file (common case) to verify behavior is unchanged.
- **Status:** PENDING

---

## Deferred Items (not implemented this cycle)

| Finding | Severity | Confidence | Reason for deferral | Exit criterion |
|---|---|---|---|---|
| C50-03/D-111 | LOW | HIGH | `getCardById` O(n) is fast enough at current scale (~683 cards, < 1ms). Map index adds complexity. | Card count exceeds 5000 or `getCardById` is called in tight loops |
| C50-04 | LOW | MEDIUM | Conceptual observation only — the `parseAmount`/`isValidAmount` split is already well-documented with comments (C37-02). No code change needed. | Comments become stale or code is refactored |
| C50-06 | LOW | HIGH | `formatWon` negative format is a UX preference. Korean banking apps use parentheses but financial statements commonly use minus signs. Both are grammatically correct. | UX review recommends parentheses format |
| C50-08/C18-01 | LOW | HIGH | VisibilityToggle DOM mutation — deferred per prior cycles. Svelte 5 proxy reactivity handles this correctly in practice, and Astro SSR does not hydrate VisibilityToggle on initial load. | Hydration mismatch reported in production |
| C49-01 | LOW | HIGH | `isSubstringSafeKeyword` is dead code — safe to remove but no functional impact. Low priority cleanup. | Dead code removal sprint |
| C49-02 | LOW | MEDIUM | `buildCategoryLabelMap` bare subcategory ID shadowing — no current collision in taxonomy. The fix (removing bare sub ID key) was already applied. | Taxonomy introduces a colliding subcategory ID |
