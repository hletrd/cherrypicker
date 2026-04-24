# Cycle 4 — Critic (Multi-Perspective Critique)

**Date:** 2026-04-24
**Reviewer:** critic
**Scope:** Full repository

---

## C4-CT01: Incomplete fixes from cycle 3 — systemic pattern

- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** Multiple (see C4-CR01 through C4-CR04)
- **Description:** Cycle 3 identified two fix categories (raw BASE_URL usage, missing scope="col") and implemented fixes for a subset of components. However, the fixes were incomplete: SavingsComparison (empty-state link), SpendingSummary (empty-state link), and TransactionReview (5 table headers) were missed. This is not a novel finding but rather a critique of the review-then-fix workflow: the review identified the *issue type* but the fix plan enumerated only the *reported instances* rather than performing a comprehensive search for all instances of the same pattern.

  The deeper concern is that this same pattern could recur in future cycles: a reviewer identifies a pattern in components A, B, C and the fix plan addresses A, B, C without verifying whether D, E, F also have the same issue. The mitigation is to always `grep` for the pattern before closing the issue.

- **Failure scenario:** Future reviews continue to produce partial fixes, requiring multiple cycles to address the same class of issue across different components.
- **Fix:** Before closing any pattern-based fix, run `grep -rn 'import.meta.env.BASE_URL' apps/web/src/**/*.svelte` and `grep -rn '<th ' apps/web/src/**/*.svelte` to verify all instances are addressed.

## C4-CT02: ReportContent summary table structural accessibility gap

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/report/ReportContent.svelte:36-59`
- **Description:** The summary table uses `<td>` for row-label cells instead of `<th scope="row">`. This is a genuine WCAG 1.3.1 issue that has not been identified in any previous cycle. The table has 6 rows of key-value pairs where the left column serves as row headers. While `scope="col"` was added to column headers, the row headers were overlooked because the review focus was on column headers only.
- **Fix:** Change left-column `<td>` elements to `<th scope="row">` with appropriate text-left styling.

---

## Final Sweep

The main critique is procedural: partial fixes from cycle 3 suggest a need for more systematic pattern-searching before closing issues. The substantive new finding is the ReportContent summary table row-header accessibility issue.
