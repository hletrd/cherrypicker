# Cycle 4 — Tracer (Causal Tracing)

**Date:** 2026-04-24
**Reviewer:** tracer
**Scope:** Full repository

---

## C4-TR01: Causal trace of incomplete C3-05 fix (buildPageUrl migration)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/SavingsComparison.svelte:321`, `apps/web/src/components/dashboard/SpendingSummary.svelte:180`
- **Description:** Tracing the causal chain: C3-05 identified raw BASE_URL usage in ReportContent, CategoryBreakdown, and OptimalCardMap. The plan enumerated these three components and the fix was applied to them. However, the plan did not include a step to search for ALL instances of the same pattern. Two components (SavingsComparison, SpendingSummary) with the same pattern were missed because:
  1. SavingsComparison has TWO navigation links: one in the breakdown section (fixed) and one in the empty-state else branch (missed). The reviewer likely inspected the breakdown section and missed the else branch.
  2. SpendingSummary was not in the reviewer's mental model of "components with navigation links" because its empty-state link was not flagged in the initial review.

  The root cause is the review-to-fix workflow: the review identifies specific instances, the plan lists those instances, and the fix only addresses the listed instances. There is no step to verify completeness via grep.

- **Fix:** Add a verification step to the fix workflow: after identifying a pattern, grep for all instances before creating the plan.

---

## Final Sweep

The causal trace confirms that the incomplete fixes are a process issue (missing grep verification) rather than a code design issue.
