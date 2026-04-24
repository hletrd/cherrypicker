# Designer — Cycle 2 Deep Review (2026-04-24)

Reviewed UI/UX for accessibility, responsiveness, information architecture, and perceived performance.

## New Findings

### C2-U01: CardDetail rewards table lacks `scope` attributes on `<th>` elements
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/cards/CardDetail.svelte:222-228`
- **Description:** The rewards table header cells use `<th>` without `scope="col"`. While assistive technologies can often infer the scope from context, explicit `scope` attributes improve screen reader accuracy for complex tables. The performance tier header row (line 233) uses `colspan="4"` which is correct, but the column headers should have `scope="col"` for full WCAG 1.3.1 compliance.
- **Fix:** Add `scope="col"` to each `<th>` in the rewards table header.

### C2-U02: TransactionReview search input has no `aria-label` for screen readers
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:241-245`
- **Description:** The search input uses `placeholder="가맹점 검색"` but no `aria-label`. When the placeholder disappears (user types), screen readers have no label for the field. The `placeholder` attribute is not a substitute for a programmatic label per WCAG 1.3.1.
- **Fix:** Add `aria-label="가맹점 검색"` to the search input.

## Previously Known

D7-M8 (no axe-core gate), D7-M10 (submit spinner aria-busy — resolved in C8-03), D8-01/D8-02 (reduced motion, region roles) — all acknowledged.
