# Cycle 3 — Test Engineer

**Date:** 2026-04-24
**Reviewer:** test-engineer
**Scope:** Full repository

---

## C3-T01: No test for duplicate keyword detection across keyword files

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `packages/core/src/categorizer/keywords.ts`, `packages/core/src/categorizer/keywords-english.ts`
- **Description:** The duplicate `SHAKE SHACK KOREA` entry across MERCHANT_KEYWORDS and ENGLISH_KEYWORDS (C3-CR01) was not caught by any automated test. Adding a test that verifies no duplicate keys exist across the merged `ALL_KEYWORDS` map would prevent future duplicates from being silently introduced.
- **Failure scenario:** Another duplicate keyword is added across files with different category values, silently changing categorization behavior.
- **Fix:** Add a test in `packages/core/__tests__/categorizer.test.ts` that checks `ALL_KEYWORDS` construction produces no key collisions (i.e., that no key appears in more than one source file with a different value).

## C3-T02: No test verifying FALLBACK_GROUPS and FALLBACK_CATEGORY_LABELS consistency

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:27-46`, `apps/web/src/lib/category-labels.ts:32-110`
- **Description:** Similar to C2-T02/C2-T08 which addressed CATEGORY_NAMES_KO and FALLBACK_CATEGORY_LABELS consistency, there's no test verifying that FALLBACK_GROUPS in TransactionReview matches the taxonomy. This is the fourth independent hardcoded map (C3-A01).
- **Failure scenario:** FALLBACK_GROUPS is updated but FALLBACK_CATEGORY_LABELS is not (or vice versa), causing inconsistent UI when the taxonomy fetch fails.
- **Fix:** Add a test that verifies every category ID in FALLBACK_GROUPS has a corresponding entry in FALLBACK_CATEGORY_LABELS with the same Korean label.

---

## Final Sweep

Test coverage is solid for the core packages (197 tests across 7 packages). The main gaps are in cross-map consistency (C3-T01, C3-T02). E2E tests (74 green) cover the critical upload-analyze-reoptimize flow. No flaky test patterns detected.
