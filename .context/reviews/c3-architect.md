# Cycle 3 — Architect Review

**Date:** 2026-04-24
**Reviewer:** architect
**Scope:** Full repository

---

## C3-A01: Four independent hardcoded category maps can silently diverge (extends C2-01)

- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/greedy.ts:11-90` (CATEGORY_NAMES_KO), `apps/web/src/lib/category-labels.ts:32-110` (FALLBACK_CATEGORY_LABELS), `apps/web/src/components/dashboard/TransactionReview.svelte:27-46` (FALLBACK_GROUPS), `packages/rules/src/category-names.ts:12-23` (buildCategoryNamesKo)
- **Description:** C2-01 identified three independent maps and partially fixed the divergence between CATEGORY_NAMES_KO and FALLBACK_CATEGORY_LABELS. However, TransactionReview's FALLBACK_GROUPS is a FOURTH independent map that was not addressed. The `buildCategoryNamesKo()` function in rules could generate the authoritative mapping from the taxonomy, but it remains unused dead code. The correct architectural fix is to: (1) make `buildCategoryNamesKo()` the single source of truth for the CLI/standalone path, (2) make `buildCategoryLabelMap()` the single source of truth for the web path, and (3) derive all fallback maps from the same taxonomy data or from each other rather than maintaining independent hardcoded copies.
- **Failure scenario:** The taxonomy adds a new category. Four different files must be updated in lockstep. Any missed file produces incorrect labels in that code path. FALLBACK_GROUPS already has `convenience_store` as a standalone group while FALLBACK_CATEGORY_LABELS has it as a subcategory of `grocery`.
- **Fix:** Derive FALLBACK_GROUPS from FALLBACK_CATEGORY_LABELS (or vice versa) in TransactionReview.svelte, ensuring both are always in sync. For the CLI path, use `buildCategoryNamesKo()` instead of the hardcoded CATEGORY_NAMES_KO in greedy.ts.

## C3-A02: `buildCategoryKey` is exported from `@cherrypicker/core` but `buildCategoryNamesKo` is not exported from `@cherrypicker/rules`

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `packages/rules/src/index.ts`, `packages/rules/src/category-names.ts`
- **Description:** `buildCategoryNamesKo()` is a public function in the rules package that could replace the hardcoded CATEGORY_NAMES_KO map in greedy.ts. However, it's not re-exported from `packages/rules/src/index.ts`, making it inaccessible to consumers. This is part of the broader C2-01/C64-03 issue.
- **Failure scenario:** A consumer of `@cherrypicker/rules` who needs category label mappings cannot use the authoritative function and must duplicate the mapping.
- **Fix:** Add `export { buildCategoryNamesKo } from './category-names.js';` to `packages/rules/src/index.ts`.

---

## Final Sweep

The architecture is clean for a monorepo of this size. The core/web/tools split is well-defined. The main architectural debt (D-01 duplicate parser implementations) remains deferred with a valid exit criterion. The category map divergence (C3-A01) is the most actionable architectural issue this cycle.
