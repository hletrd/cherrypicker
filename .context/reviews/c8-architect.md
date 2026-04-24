# Cycle 8 — Architect

**Date:** 2026-04-24
**Reviewer:** architect
**Scope:** System architecture, layering, coupling

---

## C8-A01: Third instance of hardcoded taxonomy duplication (TransactionReview FALLBACK_GROUPS)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:27-42`
- **Description:** This is the architectural recurrence noted by the critic in cycle 7 (C7-CT01). The pattern now appears in three locations: (1) `packages/core/src/optimizer/greedy.ts:11-90` (CATEGORY_NAMES_KO), (2) `apps/web/src/lib/category-labels.ts:32-110` (FALLBACK_CATEGORY_LABELS), and (3) `apps/web/src/components/dashboard/TransactionReview.svelte:27-42` (FALLBACK_GROUPS). All three must be updated in lockstep when the YAML taxonomy changes. The root cause is that no build-time generation step exists to produce these fallbacks from the single source of truth (`categories.yaml`).

- **Fix:** Create a build-time script that reads `categories.yaml` and generates: (a) a `category-names-ko.ts` file for the core optimizer, (b) a `fallback-labels.ts` for the web app, and (c) a `fallback-groups.ts` for TransactionReview. This consolidates the taxonomy into a single generation pipeline.

## C8-A02: `calculateRewards` bucket creation-before-registration pattern is fragile

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `packages/core/src/calculator/reward.ts:232-248`
- **Description:** Same as C8-CR01. The `?? { ... }` pattern creates a mutable bucket that is not immediately registered in the Map. The architectural concern is that this pattern makes the function's correctness dependent on the ordering of subsequent statements. A defensive restructuring (registering the bucket immediately after creation) would make the code more resilient to future modifications.

---

No HIGH or MEDIUM architectural findings. All prior HIGH/MEDIUM items are either fixed or properly deferred.
