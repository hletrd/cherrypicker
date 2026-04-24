# Cycle 4 — Designer (UI/UX Review)

**Date:** 2026-04-24
**Reviewer:** designer
**Scope:** Web frontend (apps/web/)

---

## C4-U01: SavingsComparison.svelte empty-state link still uses raw BASE_URL

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/SavingsComparison.svelte:321`
- **Description:** Same as C4-CR01. The "else" branch empty-state "명세서 올리러 가기" link uses `import.meta.env.BASE_URL` directly instead of `buildPageUrl()`. This creates a navigation inconsistency: FileDropzone and CardDetail use the helper, but this component does not. If the app is deployed under a subpath (e.g., `/cherrypicker/`), the raw BASE_URL may produce a link that lacks a trailing slash, while `buildPageUrl()` normalizes this. Not a visual issue but a navigation reliability concern.
- **Fix:** Use `buildPageUrl('')` for consistent URL construction.

## C4-U02: SpendingSummary.svelte empty-state link still uses raw BASE_URL

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/SpendingSummary.svelte:180`
- **Description:** Same as C4-CR02. Identical pattern — raw BASE_URL instead of `buildPageUrl()`.
- **Fix:** Use `buildPageUrl('')` for consistent URL construction.

## C4-U03: TransactionReview.svelte table headers missing `scope="col"` (WCAG 1.3.1)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:276-280`
- **Description:** Same as C4-CR03. The TransactionReview table has 5 `<th>` elements without `scope="col"`. C3-04 added scope to other tables but missed this one. This is a WCAG 1.3.1 failure — screen readers cannot programmatically determine the column association for data cells.
- **Fix:** Add `scope="col"` to all 5 `<th>` elements.

## C4-U04: ReportContent summary table uses `<td>` instead of `<th scope="row">`

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/report/ReportContent.svelte:36-59`
- **Description:** Same as C4-CR04. The summary table's left-column label cells use `<td>` with font-medium styling instead of `<th scope="row">`. This is a WCAG 1.3.1 structural accessibility issue for row headers.
- **Fix:** Change the 6 left-column `<td>` elements to `<th scope="row" class="text-left ...">`.

---

## Final Sweep

Reviewed all Svelte components and Astro pages in `apps/web/src/`. The responsive layout, dark mode support, loading states, and error states are well-handled. The main remaining issues are incomplete fixes from C3-04 (scope="col") and C3-05 (buildPageUrl), plus a newly discovered structural accessibility issue in the ReportContent summary table.
