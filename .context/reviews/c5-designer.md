# Cycle 5 — Designer (UI/UX)

**Date:** 2026-04-24
**Reviewer:** designer
**Scope:** Web frontend (apps/web/src/)

---

## C5-D01: Astro page navigation links inconsistent with Svelte component pattern

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/pages/dashboard.astro:15,39,113`, `apps/web/src/pages/results.astro:12,36,89,108,117`, `apps/web/src/pages/report.astro:13,44`
- **Description:** The Astro page navigation links use raw `import.meta.env.BASE_URL` concatenation while the Svelte components use `buildPageUrl()`. From a UX perspective, if BASE_URL is misconfigured, users would see broken navigation links on some pages but working links on others. The inconsistency means the user experience varies by which page they're on.

- **Fix:** Migrate Astro page links to `buildPageUrl()` for consistency.

## C5-D02: Results page stat cards show "—" until VisibilityToggle effect runs

- **Severity:** LOW
- **Confidence:** Low
- **File+line:** `apps/web/src/pages/results.astro:52-60`
- **Description:** The results page stat cards (total spending, savings, cards needed) are defined as empty `<p>` elements with "—" text and only populated when VisibilityToggle's `$effect` runs. This creates a brief flash of "—" before the actual values appear. The flash is typically very short (< 16ms) because the effect runs synchronously on mount, but on slower devices or with Astro View Transitions, it could be noticeable.

- **Fix:** Move the stat display into a Svelte component with reactive bindings so the values are rendered immediately when the component mounts with store data.

---

## Final Sweep

No new accessibility findings beyond C5-D01 (already covered by code-reviewer). All `<th>` elements now have `scope="col"` or `scope="row"`, all `<a>` elements in Svelte components use `buildPageUrl()`, and loading/empty/error states are properly handled across all dashboard components.
