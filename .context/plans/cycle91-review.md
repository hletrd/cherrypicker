# Cycle 91 Plan

**Date:** 2026-04-22
**Source:** `.context/reviews/2026-04-22-cycle91-comprehensive.md`

---

## Review Summary

One new MEDIUM severity finding identified in cycle 91: C91-01 (SavingsComparison animated display sign contradicts direction label during negative-to-positive transition). This is a remaining edge case from the C82-C90 series of sign-prefix fixes.

---

## Implementation Tasks

### Task 1: Fix SavingsComparison animated display sign contradiction (C91-01)

**Severity:** MEDIUM | **Confidence:** HIGH | **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:238,240`

**Problem:**
When `opt.savingsVsSingleCard` (final target) is positive but `displayedSavings` (animated intermediate) is still negative during a negative-to-positive transition, `formatWon()` renders "-X원" under the "추가 절약" label for ~60ms. The conditional `Math.abs` on lines 238 and 240 only applies when the final target is negative, missing the transition window.

**Fix:**
Since the direction is always communicated by the label ("추가 절약" vs "추가 비용"), the displayed number should always show the magnitude (absolute value). This makes the display consistent with the label regardless of animation state.

Line 238 change:
```
// Before:
{opt.savingsVsSingleCard < 0 ? Math.abs(displayedSavings) : displayedSavings}
// After:
{Math.abs(displayedSavings)}
```

Line 240 change:
```
// Before:
{opt.savingsVsSingleCard < 0 ? Math.abs(displayedAnnualSavings) : displayedAnnualSavings}
// After:
{Math.abs(displayedAnnualSavings)}
```

**Why this is safe:**
- When final is positive and animation is positive-to-positive: abs is a no-op (positive stays positive)
- When final is negative and animation is negative-to-negative: abs shows magnitude, label says "추가 비용" (correct)
- When transitioning from negative to positive: abs prevents the brief "-X원" flash under "추가 절약"
- When transitioning from positive to negative: abs prevents a brief "+X원" flash under "추가 비용"

**Status:** DONE

---

## New Findings Disposition

| ID | Severity | Disposition | Rationale |
|---|---|---|---|
| C91-01 | MEDIUM | SCHEDULED | Animated display sign contradicts label during transition -- actionable fix identified |

---

## Status of Prior Plans

All prior cycle plans are DONE or archived. The C90 plan had no implementation tasks. This plan has one task.

---

## Deferred Items (Active, carried forward)

All prior deferred items from the C90 aggregate remain in effect. No new deferred items this cycle. The following remain the highest-priority deferred items by severity:

| ID | Severity | Description |
|---|---|---|
| C86-16/C88-09 | MEDIUM | No integration test for multi-file upload |
| C67-01/C74-06 | MEDIUM | Greedy optimizer O(m*n*k) quadratic behavior |
| C33-01/C66-02/C86-12 | MEDIUM | MerchantMatcher substring scan O(n) per transaction |
| C21-02/C33-02/C86-11 | MEDIUM | cachedCategoryLabels stale across redeployments |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
