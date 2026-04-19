# UI/UX Designer Review — Cycle 3 (2026-04-19)

**Reviewer:** designer
**Scope:** Information architecture, accessibility, responsive design, interaction patterns

---

## Findings

### C3-U01: `SpendingSummary.svelte` uses `new Date()` with UTC/local mismatch for period display

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:15-21`
- **Description:** (Same as C3-04.) The `formatPeriod` function creates `new Date(period.start)` which is parsed as UTC midnight, but `getMonth()` returns local-time values. In timezones behind UTC, the displayed month would be wrong. This was fixed in `formatters.ts` (C2-04) but not in this component.
- **Fix:** Use manual date parsing (split on `-` and `parseInt`) instead of `new Date()`.

### C3-U02: Bank selector in FileDropzone creates excessive DOM nodes

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:324-346`
- **Description:** The bank selector renders 25 buttons (24 banks + auto-detect) in a flex-wrap layout. On mobile, these buttons wrap to multiple lines, creating a visually overwhelming list. There is no search/filter capability for the bank list, making it hard to find a specific bank quickly.
- **Failure scenario:** On a 375px-wide mobile screen, 25 small buttons wrap to 5-6 rows, taking up significant vertical space and requiring scrolling past them to reach the "analyze" button.
- **Fix:** Use a searchable dropdown or a compact grid with a search input above it. Alternatively, show the top 6 banks and a "more" button.

### C3-U03: Transaction category select has no optgroup or visual hierarchy

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:267-270`
- **Description:** (Already noted as C2-U02/D-21.) Category options are loaded as a flat list with leading spaces for subcategories. The `<select>` element does not use `<optgroup>`, and the leading spaces may be collapsed by some browsers. A screen reader would not distinguish between parent categories and subcategories.
- **Fix:** (Already deferred as D-21.)

### C3-U04: Dashboard page shows both empty state and data content divs

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/pages/dashboard.astro:31-119`
- **Description:** The dashboard page renders both `#dashboard-empty-state` and `#dashboard-data-content` in the HTML. The `dashboard.js` script toggles visibility by adding/removing `hidden` class. This means the data content div (with all its Svelte components) is in the DOM even when empty, and the Svelte components may render and make API calls (e.g. `loadCategories`) even when no data is available. The Svelte components handle empty state internally, but this still triggers unnecessary network requests.
- **Fix:** Consider using `client:visible` instead of `client:load` for the dashboard Svelte components, or conditionally render them based on store state.

### C3-U05: No loading skeleton for card list page

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/pages/cards/index.astro`, `apps/web/src/components/cards/CardGrid.svelte`
- **Description:** The cards page loads card data from `cards.json` and renders a grid of cards. While the data is loading, there is no loading skeleton or spinner — the page shows a blank card grid area. Other pages (dashboard, results) have proper loading skeletons.
- **Failure scenario:** On a slow connection, the cards page shows a blank area for 2-3 seconds before cards appear, creating a perceived performance issue.
- **Fix:** Add a loading skeleton (similar to the dashboard's `animate-pulse` pattern) that shows placeholder cards while data is being fetched.
