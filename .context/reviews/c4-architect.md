# Cycle 4 — Architect Review

**Date:** 2026-04-24
**Reviewer:** architect
**Scope:** Full repository

---

## C4-A01: Incomplete C3-05 fix — 3 additional components still use raw BASE_URL

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/SavingsComparison.svelte:321`, `apps/web/src/components/dashboard/SpendingSummary.svelte:180`, `apps/web/src/components/cards/CardPage.svelte:8`
- **Description:** C3-05 fixed ReportContent, CategoryBreakdown, and OptimalCardMap, but missed SavingsComparison (empty-state branch), SpendingSummary (empty-state link), and CardPage. There are also Astro pages (dashboard.astro, results.astro, report.astro) using raw BASE_URL, but those are acceptable since Astro templates build URLs differently. The Svelte components should use `buildPageUrl()` consistently. The pattern of partial fixes across multiple cycles suggests a deeper issue: there is no lint rule or automated check to enforce `buildPageUrl()` usage over raw `import.meta.env.BASE_URL` in Svelte components.
- **Failure scenario:** A developer adds a new navigation link and copies the raw BASE_URL pattern from one of the unfixed components, perpetuating the inconsistency.
- **Fix:** Fix the 2 Svelte components (SavingsComparison, SpendingSummary) to use `buildPageUrl()`. CardPage uses it as a base for string concatenation rather than a direct href, so it may warrant a different approach. Consider adding an ESLint rule to flag raw `import.meta.env.BASE_URL` in Svelte files outside of formatters.ts.

## C4-A02: Incomplete C3-04 fix — TransactionReview table headers still lack scope="col"

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:276-280`
- **Description:** C3-04 added `scope="col"` to OptimalCardMap, SavingsComparison, and ReportContent but missed TransactionReview. This is the same class of partial fix as C4-A01. The pattern suggests the review cycle identified the issue type but the implementation plan did not enumerate all affected tables comprehensively.
- **Fix:** Add `scope="col"` to all 5 `<th>` elements in TransactionReview.

---

## Final Sweep

The architecture remains sound. The core/web/tools split is well-defined. The main takeaway is that previous fixes (C3-04, C3-05) were incomplete — they fixed the reported instances but missed additional components with the same pattern. Future fixes should use `grep` to find ALL instances before closing the issue.
