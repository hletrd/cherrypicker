# Cycle 4 — Test Engineer

**Date:** 2026-04-24
**Reviewer:** test-engineer
**Scope:** Full repository

---

## C4-T01: No test coverage for TransactionReview `scope="col"` accessibility attributes

- **Severity:** LOW
- **Confidence:** Low
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:276-280`
- **Description:** The TransactionReview table headers currently lack `scope="col"` (C4-CR03). Once fixed, there is no automated test to prevent regression. However, testing DOM attributes in Svelte components requires a DOM testing library (e.g., Testing Library + jsdom or Playwright), and the current test infrastructure (Vitest + Bun) does not have component-level DOM testing set up. The e2e tests in `e2e/` could cover this, but they are not currently configured for accessibility assertions.
- **Failure scenario:** A future refactor removes `scope="col"` from TransactionReview table headers, and no test catches it.
- **Fix:** Consider adding a Playwright accessibility audit step (e.g., axe-core) to the e2e test suite to catch WCAG 1.3.1 violations. This is a longer-term investment.

## C4-T02: No test for `buildPageUrl()` consistency across Svelte components

- **Severity:** LOW
- **Confidence:** Low
- **File+line:** `apps/web/src/lib/formatters.ts` (buildPageUrl), Svelte components
- **Description:** C4-CR01 and C4-CR02 identify components that still use raw `import.meta.env.BASE_URL` instead of `buildPageUrl()`. There is no lint rule or test to enforce consistency. A grep-based check could be added to CI.
- **Failure scenario:** A developer adds a new Svelte component with a navigation link using raw BASE_URL, and no automated check catches it.
- **Fix:** Add a script or lint rule that fails if `import.meta.env.BASE_URL` appears in `.svelte` files outside of `formatters.ts`.

---

## Final Sweep

The existing test suite (197 tests) covers the core optimization, calculator, categorizer, parser, and rules packages well. The main gap is in UI-level testing for accessibility and navigation consistency — this is a known limitation of the current test infrastructure.
