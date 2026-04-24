# Cycle 8 Implementation Plan

**Date:** 2026-04-24
**Based on:** `.context/reviews/c8-aggregate.md` (cycle 8 multi-agent review)

---

## Task 1: Reorder `calculateRewards` bucket registration for defensive correctness [LOW]

- **Finding:** C8-02 (code-reviewer C8-CR01, architect C8-A02)
- **File:** `packages/core/src/calculator/reward.ts:232-248`
- **Current behavior:** The `categoryRewards.get(categoryKey) ?? { ... }` pattern creates a mutable bucket object before it is registered in the Map via `.set()`. The bucket is then mutated (spending, reward, etc.) before `.set()` is called. This works correctly in JS's single-threaded execution but is fragile during future maintenance.
- **Fix:** Move the `categoryRewards.set(categoryKey, bucket)` call to immediately after bucket creation (before any mutations), so the bucket is always registered in the Map before being modified.
- **Steps:**
  1. After line 242 (the `?? { ... }` block), add `categoryRewards.set(categoryKey, bucket);`
  2. Remove the later `.set()` calls at lines 248 and 348 that are now redundant (the bucket is already in the Map and mutations are reflected by reference)
  3. Verify that the `continue` at line 248 (when `!rule`) no longer needs the `.set()` because it's already registered
- **Verification:** `bun run test` passes. `npm run typecheck` passes. `npm run lint` passes.
- **Status:** DONE

---

## Task 2: Add FALLBACK_GROUPS to deferred taxonomy-duplicate tracking [LOW — DEFERRED]

- **Finding:** C8-01 (code-reviewer C8-CR02, architect C8-A01, critic C8-CT01)
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:27-42`
- **Current behavior:** `FALLBACK_GROUPS` is a third hardcoded duplicate of the YAML taxonomy, subject to the same drift risk as C7-01 and C7-02. The critic notes this is the fifth recurrence of the pattern.
- **Reason for deferral:** Same class as C7-01/C7-02. Fixing any one instance without a build-time generation step would not solve the systemic issue. The recommended fix (build-time generation from `categories.yaml`) would resolve C7-01, C7-02, and C8-01 together.
- **Exit criterion:** When a build-time generation step produces fallback data from the YAML source (the same exit criterion as C7-01/C7-02).

---

## Prior deferred items (carried forward, no changes)

All deferred items from `.context/plans/00-deferred-items.md` remain unchanged, including:
- C7-01 (CATEGORY_NAMES_KO drift) — MEDIUM
- C7-02 (FALLBACK_CATEGORY_LABELS drift) — LOW
- C7-04 (entertainment.subscription inconsistency) — LOW
- All D-01 through D-111 items
- All D7-M1 through D7-M14 items
