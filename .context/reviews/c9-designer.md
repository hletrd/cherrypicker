# Cycle 9 — Designer (UI/UX)

## C9-D01: CATEGORY_COLORS lacks 'convenience_store' as standalone top-level entry
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:16-17`
- **Description:** `convenience_store` has a color entry at line 16 (#eab308 yellow), but this category is a subcategory of 'grocery' in the taxonomy. However, it's also listed as a standalone top-level entry in the map. This creates a color ambiguity: when displayed as a subcategory (grocery.convenience_store), the color is #eab308 at line 64, which matches. No visual bug, but the standalone entry at line 16 is dead code since convenience_store is always assigned as a subcategory of grocery in the optimizer.

## C9-D02: TransactionReview table lacks responsive column hiding
- **Severity:** LOW
- **Confidence:** Low
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:272-273`
- **Description:** The transaction table uses `overflow-x-auto` for horizontal scrolling on narrow viewports, which works but is not ideal UX. On mobile, the confidence column (5th) and potentially the amount column could be hidden or moved to a detail view. The current scrolling approach is functional and follows the C6UI-26 comment.

## C9-D03: WCAG contrast verified for key components
- SavingsComparison: text-blue-600 on from-blue-50 — 5.17:1 (passes AA)
- text-green-700 on green-50 — verified in prior cycles
- FileDropzone text-green-700 on white — 5.09:1 (passes AA)
- No new contrast failures found.
