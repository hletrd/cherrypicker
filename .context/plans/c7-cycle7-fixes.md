# Cycle 7 Implementation Plan

**Date:** 2026-04-24
**Based on:** `.context/reviews/_aggregate.md` (cycle 7 re-review)

---

## Task 1: Remove dead `UploadResult` type from api.ts [LOW]

- **Finding:** C7-03 (code-reviewer C7-CR03, verifier C7-V02)
- **File:** `apps/web/src/lib/api.ts`
- **Current behavior:** `UploadResult` is exported as "Legacy type kept for any remaining references" but has no remaining references or consumers.
- **Fix:** Remove the `UploadResult` interface and its export comment.
- **Steps:**
  1. Remove lines 7-18 (the `UploadResult` interface and its comment)
  2. Verify no imports of `UploadResult` exist anywhere
- **Verification:** `npm run typecheck` passes. `grep -r UploadResult apps/web/src/` returns only the deleted definition.
- **Status:** TODO

---

## Task 2: Remove duplicate `getOrRefreshStatElement` in VisibilityToggle [LOW]

- **Finding:** C6-03 (code-reviewer C6-CR03, confirmed still present in cycle 7)
- **File:** `apps/web/src/components/ui/VisibilityToggle.svelte:36-42`
- **Current behavior:** `getOrRefreshStatElement` is identical to `getOrRefreshElement`. Both have the same implementation.
- **Fix:** Remove `getOrRefreshStatElement` and replace all calls with `getOrRefreshElement`.
- **Steps:**
  1. Remove the `getOrRefreshStatElement` function definition (lines 36-42)
  2. Replace all 4 calls to `getOrRefreshStatElement` with `getOrRefreshElement` (lines 77, 79, 82, 85)
- **Verification:** `npm run typecheck` passes. App loads and works correctly.
- **Status:** TODO

---

## Deferred Items (new from this cycle)

### C7-01: CATEGORY_NAMES_KO hardcoded map can silently drift from YAML taxonomy
- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/greedy.ts:11-90`
- **Reason for deferral:** The CLI entry point (`tools/cli/src/`) currently does not load category labels from the rules package. Fixing this requires modifying the CLI pipeline to load labels and pass them through to the optimizer — a multi-file change that affects the CLI's startup flow and the core package's public API. The TODO (C64-03) has existed since cycle 64 of the original review loop without causing a user-facing issue, because category labels are cosmetic (the optimizer's correctness depends on category IDs, not labels). The web app is unaffected because it passes `categoryLabels` dynamically.
- **Exit criterion:** When the CLI is refactored to load labels dynamically, or when a build-time generation step produces the fallback data from the YAML source.

### C7-02: FALLBACK_CATEGORY_LABELS is another hardcoded duplicate of the YAML taxonomy
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/category-labels.ts:32-110`
- **Reason for deferral:** Same class as C7-01. The fallback is only used when `loadCategories()` returns empty (AbortError during View Transition). The dynamic path is correct. Generating the fallback at build time would solve both C7-01 and C7-02 together.
- **Exit criterion:** When a build-time generation step produces fallback data from the YAML source, or when the fallback is removed entirely with a "categories unavailable" message.

### C7-04: `entertainment.subscription` key in FALLBACK_CATEGORY_LABELS inconsistent with taxonomy
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/category-labels.ts:101`
- **Reason for deferral:** The duplicate key works correctly for backward compatibility. The comment acknowledges the inconsistency. Fixing it requires a STORAGE_VERSION migration that rewrites persisted data, which is a breaking change for users with existing sessionStorage data.
- **Exit criterion:** When STORAGE_VERSION is next incremented (for an unrelated schema change), add a migration that rewrites `entertainment.subscription` to `subscription` in persisted data, then remove the legacy key from the fallback map.

---

## Prior deferred items (carried forward, no changes)

All deferred items from `.context/plans/00-deferred-items.md` remain unchanged.
