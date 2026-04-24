# Cycle 5 — Code Reviewer

**Date:** 2026-04-24
**Reviewer:** code-reviewer
**Scope:** Full repository

---

## C5-CR01: Astro pages use raw `import.meta.env.BASE_URL` instead of `buildPageUrl()`

- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:**
  - `apps/web/src/pages/dashboard.astro:15,39,113`
  - `apps/web/src/pages/results.astro:12,36,89,108,117`
  - `apps/web/src/pages/report.astro:13,44`
- **Description:** Cycles 3 and 4 fixed raw `import.meta.env.BASE_URL` usage in Svelte components by migrating to `buildPageUrl()`. However, the Astro page files were never included in the fix scope. The dashboard, results, and report pages all use template-literal `href` attributes with `${import.meta.env.BASE_URL}` directly. This is the exact same class of inconsistency that C3-05 and C4-CR01/CR02 were meant to resolve — if `BASE_URL` changes format (e.g., missing trailing slash), these navigation links break while the Svelte component links remain correct.

  Note: Astro pages are server-rendered templates where `import.meta.env.BASE_URL` is resolved at build time. The risk is lower than in client-side Svelte code because the value is baked into static HTML. However, the inconsistency with the Svelte component pattern remains — the `buildPageUrl()` helper handles trailing-slash edge cases that raw concatenation does not. For example, `${import.meta.env.BASE_URL}results` produces `/cherrypickerresults` if BASE_URL lacks a trailing slash, while `buildPageUrl('results')` correctly produces `/cherrypicker/results`.

- **Failure scenario:** If Astro's BASE_URL is configured without a trailing slash (e.g., `/cherrypicker` instead of `/cherrypicker/`), all navigation links in the Astro pages produce malformed URLs like `/cherrypickerdashboard` instead of `/cherrypicker/dashboard`.
- **Fix:** In each Astro page, import `buildPageUrl` from the formatters module and replace all raw `import.meta.env.BASE_URL` href references with `buildPageUrl()` calls. Since Astro pages use frontmatter scripts, the import would go in the frontmatter and the function would be called there to produce constants used in the template.

## C5-CR02: `results.astro` stat elements populated by DOM manipulation instead of reactive binding

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/pages/results.astro:52-60` (stat element definitions), `apps/web/src/components/ui/VisibilityToggle.svelte:89-103` (DOM population)
- **Description:** The results page stats (total spending, savings, cards needed) are defined as empty `<p>` elements with IDs in results.astro and populated via direct DOM manipulation in VisibilityToggle.svelte's `$effect`. This is a fragile pattern: it relies on element IDs matching between the Astro template and the Svelte component, it bypasses Svelte's reactive system, and it duplicates the formatting logic that already exists in the Svelte components (SavingsComparison, SpendingSummary). If either side changes (element ID, data shape, formatting), the other side silently breaks.

- **Failure scenario:** If the stat element IDs in results.astro are renamed or removed during a refactor, the VisibilityToggle effect silently fails to populate them and the page shows "—" permanently.
- **Fix:** Move the stat display into a Svelte component that reads from analysisStore directly, replacing the Astro-template `<p id="stat-...">` elements. This would use Svelte's reactive binding instead of DOM manipulation.

## C5-CR03: `VisibilityToggle` caches stat element refs for a different page

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/ui/VisibilityToggle.svelte:18-22,76-87`
- **Description:** VisibilityToggle is a shared component used on both the dashboard and results pages. However, it caches stat element references (`cachedStatTotalSpending`, etc.) that only exist on the results page. When used on the dashboard page, these cached refs are always null and the conditional stat population code runs to no effect on every store change. This is a separation-of-concerns issue: a generic visibility toggle component should not contain results-page-specific logic.

- **Failure scenario:** Adding new stat elements on a different page would require modifying VisibilityToggle, coupling it to multiple pages.
- **Fix:** Extract the results-page stat population into a dedicated ResultsStats Svelte component, or move it into SavingsComparison which already displays the same data.

---

## Final Sweep

Reviewed all source files in:
- `packages/core/src/` (optimizer, calculator, categorizer, models)
- `packages/parser/src/` (csv, pdf, xlsx, detect)
- `packages/rules/src/` (schema, loader, category-names)
- `packages/viz/src/` (report, terminal)
- `apps/web/src/` (store, analyzer, formatters, cards, category-labels, parser, all components, all pages, layout)
- `tools/cli/src/` and `tools/scraper/src/`

No security, correctness, or data-loss findings in this cycle beyond what is reported above and in prior deferred items.
