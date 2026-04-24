# Cycle 6 — Code Reviewer

**Date:** 2026-04-24
**Reviewer:** code-reviewer
**Scope:** Full repository (apps/web/src/, packages/)

---

## C6-CR01: Layout.astro uses raw `import.meta.env.BASE_URL` for nav links instead of `buildPageUrl()`

- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `apps/web/src/layouts/Layout.astro:11,17,44,54,64,68,72,76,128,131,136,140,144,173,174,175,176,177`
- **Description:** Cycles 3-5 migrated all Astro *page* files from raw `import.meta.env.BASE_URL` to `buildPageUrl()`. However, `Layout.astro` still uses the raw `import.meta.env.BASE_URL` value (stored as `const base = import.meta.env.BASE_URL`) for ALL navigation links (desktop nav, mobile nav, footer links, favicon, script src). This is the same inconsistency that was flagged in C5-CR01 for the page files. If `BASE_URL` lacks a trailing slash, all navigation in the entire layout produces malformed URLs. While Astro guarantees a trailing slash for `BASE_URL`, the inconsistency with the Svelte components that use `buildPageUrl()` (which is defensive about trailing slashes) remains. The Layout has 17+ raw `BASE_URL` references vs the 9 that were fixed in pages.

- **Failure scenario:** Same as C5-CR01: if BASE_URL is configured without a trailing slash, all layout navigation links break.
- **Fix:** Import `buildPageUrl` in Layout.astro's frontmatter and use it for all href attributes, or at minimum create helper constants using `buildPageUrl()` for each navigation target.

## C6-CR02: `getBaseUrl()` in cards.ts duplicates the trailing-slash logic already in `buildPageUrl()`

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/cards.ts:170-172,205,255`
- **Description:** `getBaseUrl()` returns `import.meta.env.BASE_URL ?? '/'` and is used for `fetch()` URLs to load `data/cards.json` and `data/categories.json`. Meanwhile, `buildPageUrl()` in formatters.ts handles the trailing-slash edge case defensively. The two functions solve the same problem differently: `getBaseUrl()` assumes the trailing slash is always present (Astro guarantee), while `buildPageUrl()` is defensive. If the data-fetch URLs ever need the same defensive behavior (e.g., if the static data path changes), this duplication could lead to inconsistencies.

- **Failure scenario:** Currently low risk because Astro guarantees the trailing slash for data fetches. However, if the site is ever served outside Astro (e.g., static export without the Astro server), data fetches could fail while page navigation works.
- **Fix:** Use `buildPageUrl('data/cards.json')` and `buildPageUrl('data/categories.json')` instead of `${getBaseUrl()}data/cards.json`, and remove `getBaseUrl()`.

## C6-CR03: `getOrRefreshElement` and `getOrRefreshStatElement` are identical functions

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/ui/VisibilityToggle.svelte:24-34,36-42`
- **Description:** `getOrRefreshElement` and `getOrRefreshStatElement` have the exact same implementation. The only difference is the function name. This is a trivial code quality issue — one should be removed in favor of the other.

- **Failure scenario:** No functional impact. A future change to one but not the other could cause subtle behavioral divergence.
- **Fix:** Remove `getOrRefreshStatElement` and use `getOrRefreshElement` for all element lookups.

---

## Final Sweep

Reviewed all source files in:
- `packages/core/src/` (optimizer, calculator, categorizer, models)
- `packages/parser/src/` (csv, pdf, xlsx, detect, date-utils)
- `packages/rules/src/` (schema, loader, category-names)
- `packages/viz/src/` (report, terminal)
- `apps/web/src/` (store, analyzer, formatters, cards, category-labels, parser, all components, all pages, layout)
- `tools/cli/src/` and `tools/scraper/src/`

No security, correctness, or data-loss findings beyond what is reported above and in prior deferred items.
