# Cycle 7 — Architect

**Date:** 2026-04-24
**Reviewer:** architect
**Scope:** Full repository architecture

---

## C7-A01: Three separate category label duplicates violate DRY across the monorepo

- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/greedy.ts:11-90`, `apps/web/src/lib/category-labels.ts:32-110`, `apps/web/src/components/dashboard/TransactionReview.svelte:26-42` (FALLBACK_GROUPS)
- **Description:** Confirms C7-CR01 and C7-CR02 from architectural perspective. Three separate locations maintain hardcoded copies of the category taxonomy: (1) `CATEGORY_NAMES_KO` in the core optimizer (90 entries), (2) `FALLBACK_CATEGORY_LABELS` in the web category-labels module (78 entries), and (3) `FALLBACK_GROUPS` in TransactionReview (42 entries). All three must be updated in lockstep when the YAML taxonomy changes. The web app's primary path correctly loads labels dynamically, but the fallback/static paths create a maintenance surface that scales O(n) with each new category.

- **Architectural risk:** Each new category added to the YAML taxonomy requires updating 3+ locations across 2 packages and 1 component. Missing any one of them causes silent label degradation rather than a build failure.

- **Fix:** Single source of truth: generate fallback data at build time from the YAML taxonomy (e.g., via a `bun run generate-fallbacks` script), or make the core optimizer accept a required `categoryLabels` parameter (removing the static fallback entirely).

---

## Final Sweep

Architecture is stable. The monorepo structure remains well-organized. The D-01 deferred item (duplicate parser implementations web vs packages) remains the largest architectural debt but is appropriately deferred. The category label duplication (C7-A01) is the second-largest and is actionable now.
