# Designer (UI/UX) — Cycle 1 (Fresh Review 2026-04-24)

## Inventory of Reviewed Files

- `apps/web/src/components/upload/FileDropzone.svelte` — Upload form
- `apps/web/src/components/dashboard/SavingsComparison.svelte` — Savings display
- `apps/web/src/components/dashboard/CategoryBreakdown.svelte` — Category chart
- `apps/web/src/components/dashboard/OptimalCardMap.svelte` — Card map table
- `apps/web/src/components/dashboard/SpendingSummary.svelte` — Summary cards
- `apps/web/src/components/dashboard/TransactionReview.svelte` — Category editing
- `apps/web/src/components/cards/CardDetail.svelte` — Card detail page
- `apps/web/src/app.css` — Global styles

## New Findings

### U1-01: CardDetail shows raw category IDs when categories fetch is aborted
- **File:** `apps/web/src/components/cards/CardDetail.svelte:28-38`
- **Severity:** MEDIUM
- **Confidence:** High
- **Description:** UX impact of C1-01. When `loadCategories` returns `[]` (AbortError during View Transition), the rewards table shows raw English category IDs like "dining.cafe" instead of Korean labels. Confusing for Korean users. TransactionReview has a hardcoded fallback; CardDetail should too.
- **Fix:** Add a fallback category label map (same as TransactionReview's `FALLBACK_CATEGORIES`) or skip rendering the rewards table until labels are loaded.

### U1-02: FileDropzone `<input type="number">` shows stepper arrows on mobile
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:494-503`
- **Severity:** LOW
- **Confidence:** High
- **Description:** The previous month spending input uses `<input type="number">` which shows native stepper arrows on mobile. For Korean Won amounts, stepper arrows are useless (incrementing by 1 won is meaningless). The `parsePreviousSpending` function handles edge cases like scientific notation, but the mobile UX is confusing.
- **Fix:** Add CSS to hide stepper arrows (`appearance: textfield`) and consider using `inputmode="numeric"` with `type="text"` for better mobile keyboard control.

## Previously Deferred (Acknowledged)

D7-M8 (no axe-core gate), D8-01 (no prefers-reduced-motion for spinner), D8-02 (dashboard cards lack role="region"), C6UI-04/C6UI-05 (WCAG 1.4.11 non-text contrast), C6UI-23 (target size), D-38/D-104 (dashboard empty state + data divs), D-39 (loading skeleton for card list).
