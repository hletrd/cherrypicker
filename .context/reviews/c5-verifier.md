# Cycle 5 — Verifier

**Date:** 2026-04-24
**Reviewer:** verifier
**Scope:** Evidence-based correctness check

---

## C5-V01: Astro page hrefs produce incorrect URLs when BASE_URL lacks trailing slash

- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `apps/web/src/pages/dashboard.astro:15,39,113`, `apps/web/src/pages/results.astro:12,36,89,108,117`, `apps/web/src/pages/report.astro:13,44`
- **Description:** Evidence: grep for `import.meta.env.BASE_URL` in `.astro` files returns 9 matches across 3 page files. Each uses template-literal concatenation like `${import.meta.env.BASE_URL}dashboard` which produces `/cherrypickerdashboard` if BASE_URL is `/cherrypicker` (no trailing slash). The `buildPageUrl()` function in `formatters.ts:237-241` explicitly handles this by inserting a `/` between base and path when the base doesn't end with one.

  Verification: Astro guarantees BASE_URL ends with `/` at build time (per Astro docs), so in production this works correctly. However, the codebase already has a defensive `buildPageUrl()` helper specifically for this edge case, and using raw concatenation creates an inconsistency where some links are protected and others are not.

- **Fix:** Replace all raw `import.meta.env.BASE_URL` concatenation in Astro pages with `buildPageUrl()` calls.

## C5-V02: All prior-cycle fixes verified as applied

- **Severity:** N/A
- **Confidence:** High
- **Description:** Verified that all findings from cycle 4 have been addressed:
  - C4-CR01/C4-CR02: SavingsComparison and SpendingSummary now use `buildPageUrl()` and `homeUrl` variable.
  - C4-CR03: TransactionReview table headers now have `scope="col"` on all 5 `<th>` elements.
  - C4-CR04: ReportContent summary table now uses `<th scope="row">` for left-column label cells.
  - No remaining raw `import.meta.env.BASE_URL` usage in Svelte component files.

---

## Final Sweep

The only unverified pattern is the Astro page template files, which were not included in the prior fix scope. All Svelte component fixes from cycles 3-4 are confirmed applied.
