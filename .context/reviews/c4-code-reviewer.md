# Cycle 4 — Code Reviewer

**Date:** 2026-04-24
**Reviewer:** code-reviewer
**Scope:** Full repository

---

## C4-CR01: SavingsComparison.svelte still uses raw `import.meta.env.BASE_URL` (C3-05 incomplete fix)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/SavingsComparison.svelte:321`
- **Description:** C3-05 claimed to replace all raw `import.meta.env.BASE_URL` usage with `buildPageUrl()` in SavingsComparison, CategoryBreakdown, and ReportContent. However, the "else" branch of SavingsComparison (the empty state link at line 321) still uses `href={import.meta.env.BASE_URL ?? '/'}` directly. The breakdown table headers were fixed (scope="col" added, line 280-283) but the navigation link was missed. This is the exact same class of inconsistency that C3-05 was meant to resolve.
- **Failure scenario:** If BASE_URL is `/cherrypicker` (no trailing slash), the link becomes `/cherrypicker` which works. But if BASE_URL changes format, this link breaks while FileDropzone and CardDetail links (which use `buildPageUrl()`) remain correct.
- **Fix:** Import `buildPageUrl` from `../../lib/formatters.js`, add `const homeUrl = buildPageUrl('');` in the script block, and replace `href={import.meta.env.BASE_URL ?? '/'}` with `href={homeUrl}` at line 321.

## C4-CR02: SpendingSummary.svelte uses raw `import.meta.env.BASE_URL` (missed by C3-05)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/SpendingSummary.svelte:180`
- **Description:** The empty state link in SpendingSummary uses `href={import.meta.env.BASE_URL ?? '/'}` instead of `buildPageUrl()`. This was not listed in C3-05's scope at all — C3-05 only mentioned ReportContent, CategoryBreakdown, and OptimalCardMap. SpendingSummary was missed entirely. The inconsistency is the same as C4-CR01.
- **Failure scenario:** Same as C4-CR01 — if BASE_URL format changes, this link breaks while others remain correct.
- **Fix:** Import `buildPageUrl`, add `const homeUrl = buildPageUrl('');`, replace raw BASE_URL usage at line 180.

## C4-CR03: TransactionReview.svelte table headers missing `scope="col"` (C3-04 incomplete fix)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:276-280`
- **Description:** C3-04 added `scope="col"` to OptimalCardMap, SavingsComparison breakdown, and ReportContent tables. However, TransactionReview's table headers (lines 276-280) were NOT fixed — all five `<th>` elements still lack the `scope="col"` attribute. This is the same WCAG 1.3.1 accessibility issue.
- **Failure scenario:** Screen reader users navigating the TransactionReview table cannot determine which column a cell belongs to, since the headers are not programmatically associated.
- **Fix:** Add `scope="col"` to all five `<th>` elements in TransactionReview (lines 276-280).

## C4-CR04: ReportContent summary table uses `<td>` instead of `<th scope="row">` for label cells

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/report/ReportContent.svelte:36-59`
- **Description:** The summary key-value table in ReportContent (lines 33-62) uses `<td class="px-4 py-3 font-medium ...">` for the label cells in the left column. Per WCAG 1.3.1, cells that serve as row headers in a data table should use `<th scope="row">` rather than `<td>` with visual styling. This is a structural accessibility issue — screen readers cannot programmatically associate the label cells as row headers.
- **Failure scenario:** A screen reader navigating the summary table announces each row as six data cells rather than structured label-value pairs, making it harder for visually impaired users to understand the data relationships.
- **Fix:** Change the left-column `<td>` elements (lines 36, 40, 44, 48, 54, 58) to `<th scope="row">` and add `text-left` to maintain alignment.

---

## Final Sweep

Reviewed all source files in:
- `packages/core/src/` (optimizer, calculator, categorizer, models)
- `packages/parser/src/` (csv, pdf, xlsx, detect)
- `packages/rules/src/` (schema, loader, category-names)
- `packages/viz/src/` (report, terminal)
- `apps/web/src/` (store, analyzer, formatters, cards, category-labels, parser, all components)
- `tools/cli/src/` and `tools/scraper/src/`

No security, correctness, or data-loss findings in this cycle.
