# Cycle 6 Implementation Plan

**Date:** 2026-04-24
**Based on:** `.context/reviews/_aggregate.md` (cycle 6 re-review)

---

## Task 1: Migrate Layout.astro from raw BASE_URL to buildPageUrl() [MEDIUM]

- **Finding:** C6-01 (6-agent convergence: code-reviewer, architect, designer, verifier, tracer, critic)
- **File:** `apps/web/src/layouts/Layout.astro`
- **Current behavior:** Layout uses `const base = import.meta.env.BASE_URL` and then concatenates `base` directly in 17+ href attributes (nav links, footer links, favicon, script src). This bypasses the `buildPageUrl()` helper that handles trailing-slash edge cases.
- **Fix:** Import `buildPageUrl` in Layout.astro's frontmatter and create URL constants for each navigation target. Replace all raw `base` variable usages in href attributes with the appropriate `buildPageUrl()` calls.
- **Steps:**
  1. Add `import { buildPageUrl } from '../lib/formatters.js';` in frontmatter
  2. Replace `const base = import.meta.env.BASE_URL;` with `const base = import.meta.env.BASE_URL;` (keep for `<base>` tag and CSP which need the raw value) plus `buildPageUrl` constants for all navigation targets
  3. Create URL constants: `const homeUrl = buildPageUrl('');`, `const dashboardUrl = buildPageUrl('dashboard');`, `const cardsUrl = buildPageUrl('cards');`, `const resultsUrl = buildPageUrl('results');`, `const reportUrl = buildPageUrl('report');`
  4. Replace all navigation `href={`${base}dashboard`}` with `href={dashboardUrl}`, etc.
  5. Replace `href={base}` with `href={homeUrl}` for home links
  6. Keep `const base` for `<base href={base} />` and CSP meta tag and `src={`${base}scripts/layout.js`}` and `href={`${base}favicon.svg`}` (these are asset paths, not navigation)
  7. Update `isActive()` function to use the new URL constants
- **Verification:** Grep for `import.meta.env.BASE_URL` in `.astro` files should only show `formatters.ts` (buildPageUrl itself), `cards.ts` (getBaseUrl), and the `const base` in Layout.astro (kept for asset paths). Navigation hrefs should all use `buildPageUrl()`. Run `npm run typecheck` and `npm run lint`.
- **Status:** DONE

---

## Deferred Items (new from this cycle)

### C6-02: `getBaseUrl()` in cards.ts duplicates trailing-slash logic from `buildPageUrl()`
- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/cards.ts:170-172,205,255`
- **Reason for deferral:** `getBaseUrl()` is used for data-fetch URLs (`data/cards.json`, `data/categories.json`) which are not navigation links. Astro guarantees the trailing slash for `BASE_URL` in server-rendered contexts, making this purely defensive duplication with no current failure scenario. Refactoring would require changing the fetch URL construction pattern.
- **Exit criterion:** When `buildPageUrl()` is extended to handle asset/data paths, or when the site is served outside Astro.

### C6-03: Duplicate `getOrRefreshElement` / `getOrRefreshStatElement` in VisibilityToggle
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/ui/VisibilityToggle.svelte:24-34,36-42`
- **Reason for deferral:** Pure code quality issue with no functional impact. Same as C5-02/C5-03 deferral — the VisibilityToggle component has known separation-of-concerns issues that should be addressed holistically when the stat population is extracted into a dedicated component.
- **Exit criterion:** When VisibilityToggle is refactored per C5-02/C5-03.

### C6-04: No test for Layout.astro buildPageUrl migration
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/layouts/Layout.astro`
- **Reason for deferral:** The migration itself is verifiable by grep. A unit test for `buildPageUrl()` was already deferred in C5-T01. Adding a Layout-specific test requires integration testing infrastructure (Astro component testing).
- **Exit criterion:** If new raw BASE_URL usage appears in future commits, add a grep-based CI check or ESLint rule.

---

## Prior deferred items (carried forward, no changes)

All deferred items from `.context/plans/00-deferred-items.md` remain unchanged.
