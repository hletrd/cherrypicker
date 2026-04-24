# Cycle 2 — LOW Priority Fixes

Source: `.context/reviews/_aggregate.md` findings C2-03 through C2-10.

## Task 1: Add missing `travel_agency` color to CategoryBreakdown (C2-03)

**Finding:** `CATEGORY_COLORS` in `CategoryBreakdown.svelte` has `travel.travel_agency` (dot-notation) but no standalone `travel_agency` entry.

**Fix:** Add `travel_agency: '#0ea5e9'` to `CATEGORY_COLORS`.

```ts
travel_agency: '#0ea5e9',
```

## Task 2: Add `scope="col"` to CardDetail rewards table headers (C2-04)

**Finding:** `<th>` elements in the rewards table lack `scope="col"` for WCAG 1.3.1.

**Fix:** Add `scope="col"` to each `<th>` in the rewards table header (lines 224-227).

## Task 3: Add `aria-label` to TransactionReview search input (C2-05)

**Finding:** Search input has `placeholder="가맹점 검색"` but no `aria-label`.

**Fix:** Add `aria-label="가맹점 검색"` to the search `<input>` at line 243.

## Task 4: Add CSS to hide number input stepper arrows (C2-06 / U1-02 incomplete)

**Finding:** The cycle 1 plan (U1-02) specified adding CSS to hide stepper arrows on `<input type="number">`, but only `inputmode="numeric"` was added. The CSS rules were not applied.

**Fix:** Add CSS to `apps/web/src/app.css`:

```css
/* Hide number input stepper arrows — Korean Won amounts don't need +/- 1 */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
```

## Task 5: Add test for `buildCategoryNamesKo()` (C2-07)

**Finding:** The function added in cycle 1 has no unit test.

**Fix:** Create `packages/rules/__tests__/category-names.test.ts` with tests for:
- Parent categories are included
- Subcategories use dot-notation keys
- Empty input returns `{}`
- Deeply nested structures handled correctly

## Task 6: Add taxonomy sync test for `FALLBACK_CATEGORY_LABELS` (C2-08)

**Finding:** No automated test verifying fallback map matches taxonomy.

**Fix:** Add a test in `apps/web/__tests__/` that loads categories data and verifies all IDs are present in `FALLBACK_CATEGORY_LABELS`.

## Task 7: Fix `buildCategoryNamesKo` JSDoc (C2-09)

**Finding:** JSDoc says "authoritative source" but function is unused.

**Fix:** Update JSDoc to reflect current state: function can generate the authoritative mapping but is not yet integrated into consumers.

## Task 8: Add clarifying comment for `previousMonthSpendingOption` conditional (C2-10)

**Finding:** The conditional assignment in `analyze()` is subtle.

**Fix:** Add a comment in `reoptimize()` at line 545 explaining that `previousMonthSpendingOption` is only set when the user explicitly provides a value during analysis.
