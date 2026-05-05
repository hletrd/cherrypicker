# Cycle 9 Implementation Plan

**Date:** 2026-04-24
**Based on:** `.context/reviews/c9-aggregate.md` (cycle 9 multi-agent review)

---

## Task 1: Remove unnecessary shallow copy in buildConstraints [LOW]

- **Finding:** C9-06 (code-reviewer C9-CR05)
- **File:** `packages/core/src/optimizer/constraints.ts:16`
- **Current behavior:** `const preservedTransactions = [...transactions]` creates a shallow copy that is never needed because the greedy optimizer only reads from the array, never mutates it. The comment says "keep the original transactions intact" but this is defensive code with no actual mutation risk.
- **Fix:** Remove the spread and use the original array directly. Add a clarifying comment that the optimizer is read-only on the transactions array. If a future optimizer needs to mutate, the copy can be restored at that point.
- **Steps:**
  1. Change line 16 from `const preservedTransactions = [...transactions]` to `const preservedTransactions = transactions`
  2. Add a comment explaining that greedyOptimize only reads from the array
  3. Verify `bun run test` passes
- **Verification:** `bun run test`, `npm run typecheck`, `npm run lint`
- **Status:** DONE

---

## Task 2: Skip redundant re-sort in CategoryBreakdown when sortKey is 'spending' [LOW — RESOLVED AS COMMENT]

- **Finding:** C9-07 (perf-reviewer C9-P01)
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:120`
- **Current behavior:** `const sorted = [...assignments].sort(...)` re-sorts on every render. The optimizer's `buildAssignments` already returns assignments sorted by spending (descending). When `sortKey === 'spending'`, the re-sort is redundant.
- **Fix:** After analysis, the sort is actually needed for the "other" grouping logic (which requires spending-sorted data to determine which categories fall below the 2% threshold). Rather than removing the sort and creating a hidden dependency on the optimizer's sort order, added a clarifying comment documenting the intentional redundancy.
- **Steps:**
  1. Added comment explaining the sort is technically redundant with the optimizer but needed for the grouping logic
  2. Verified typecheck and lint pass
- **Verification:** `npm run typecheck`, `npm run lint`
- **Status:** DONE

---

## Task 3: Add C9-01 through C9-05 to deferred taxonomy-duplicate tracking [LOW — DEFERRED]

- **Finding:** C9-01 (CATEGORY_COLORS), C9-02 (ALL_BANKS), C9-03 (formatIssuerNameKo), C9-04 (getIssuerColor), C9-05 (getCategoryIconName)
- **Description:** These 5 findings are all instances of the systemic hardcoded-taxonomy-duplicate pattern. They share the same exit criterion as C7-01/C7-02/C8-01: build-time generation from YAML/JSON source data.
- **Reason for deferral:** Same class as C7-01/C7-02/C8-01. Fixing any one instance without a build-time generation step would not solve the systemic issue. The recommended fix (build-time generation from `categories.yaml` and `cards.json`) would resolve all 7 instances together.
- **Exit criterion:** When a build-time generation step produces all fallback data, color maps, icon maps, and issuer maps from the YAML/JSON source (the same exit criterion as C7-01/C7-02/C8-01).

---

## Task 4: Add C9-08, C9-09, C9-10 to deferred test coverage items [LOW — DEFERRED]

- **Finding:** C9-08 (buildCategoryLabelMap tests), C9-09 (sessionStorage persistence tests), C9-10 (build-stats fallback staleness)
- **Reason for deferral:** Test coverage gaps are LOW severity. The functions work correctly in production. Adding tests is valuable but not blocking.
- **Exit criterion:** When a dedicated test coverage improvement cycle is scheduled.

---

## Prior deferred items (carried forward, no changes)

All deferred items from `.context/plans/00-deferred-items.md` remain unchanged, including:
- C7-01 (CATEGORY_NAMES_KO drift) — MEDIUM
- C7-02 (FALLBACK_CATEGORY_LABELS drift) — MEDIUM
- C7-04 (entertainment.subscription inconsistency) — LOW
- C8-01 (FALLBACK_GROUPS third duplicate) — LOW, deferred
- All D-01 through D-111 items
- All D7-M1 through D7-M14 items
