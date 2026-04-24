# Cycle 5 — Architect

**Date:** 2026-04-24
**Reviewer:** architect
**Scope:** Full repository

---

## C5-A01: Astro pages bypass the `buildPageUrl()` abstraction

- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `apps/web/src/pages/dashboard.astro`, `apps/web/src/pages/results.astro`, `apps/web/src/pages/report.astro`
- **Description:** The codebase established `buildPageUrl()` in `formatters.ts` as the single point of truth for URL construction with BASE_URL handling. All Svelte components were migrated to use it. However, the Astro page templates were not included in the migration, leaving 9 raw `import.meta.env.BASE_URL` references across 3 page files. This violates the DRY principle and creates an abstraction leak: any future change to URL construction logic (e.g., adding query parameter handling, locale prefixing) must be applied in both the `buildPageUrl()` function AND scattered across Astro templates.

  The architectural risk is that the Astro pages form a separate "layer" that was not considered in the previous fix scope, indicating that the URL construction pattern was only partially adopted.

- **Fix:** Refactor the Astro pages to use `buildPageUrl()` by importing it in the frontmatter script section and generating URL constants there.

## C5-A02: VisibilityToggle has dual responsibilities (visibility + stat population)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/ui/VisibilityToggle.svelte`
- **Description:** VisibilityToggle does two things: (1) toggles visibility of data/empty state containers, and (2) populates results-page stat elements via direct DOM manipulation. These are separate concerns. The stat population logic should be in a dedicated component that renders the stats using Svelte's reactive system rather than bypassing it with `textContent` assignments.

- **Fix:** Extract the stat population into a ResultsStats component that reads from analysisStore and renders the stats with reactive bindings.

---

## Final Sweep

No additional architectural risks beyond the above and previously deferred items. The codebase remains well-structured with clear package boundaries and good separation between the core optimization engine, parser, rules, and web app layers.
