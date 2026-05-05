# Cycle 2 — LOW Priority Fixes

Source: `.context/reviews/_aggregate.md` findings C2-03 through C2-10.

## Task 1: Add missing `travel_agency` color to CategoryBreakdown (C2-03) -- DONE

## Task 2: Add `scope="col"` to CardDetail rewards table headers (C2-04) -- DONE

## Task 3: Add `aria-label` to TransactionReview search input (C2-05) -- DONE

## Task 4: Add CSS to hide number input stepper arrows (C2-06 / U1-02 incomplete) -- NOT NEEDED

Verifier finding was INCORRECT: CSS already present in `apps/web/src/app.css` lines 109-117. Only `inputmode` was the cycle 1 addition, which is correct.

## Task 5: Add test for `buildCategoryNamesKo()` (C2-07) -- DONE

6 test cases added in `packages/rules/__tests__/category-names.test.ts`.

## Task 6: Add taxonomy sync test for `FALLBACK_CATEGORY_LABELS` (C2-08) -- DEFERRED

Requires cross-package test setup (rules package data consumed by web tests). Deferred to future cycle alongside build-time validation script (C2-01 Task 1).

## Task 7: Fix `buildCategoryNamesKo` JSDoc (C2-09) -- DONE

## Task 8: Add clarifying comment for `previousMonthSpendingOption` conditional (C2-10) -- DONE
