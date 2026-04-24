# Cycle 1 — HIGH/MEDIUM Priority Fixes

Source: `.context/reviews/_aggregate.md` findings C1-01 and A1-01.

## Task 1: CardDetail abort-then-labels fallback (C1-01)

**Finding:** When `loadCategories()` is aborted during an Astro View Transition, it returns `[]`. CardDetail builds an empty `categoryLabels` map and sets `categoryLabelsReady = true`, causing the rewards table to show raw English category IDs (e.g., "dining.cafe") instead of Korean labels. TransactionReview already handles this with `FALLBACK_CATEGORIES`.

**File:** `apps/web/src/components/cards/CardDetail.svelte:28-38`

**Fix:**
1. Import `FALLBACK_CATEGORIES` from a shared location, or inline a minimal fallback map in CardDetail.
2. After `loadCategories()` returns, check if `nodes.length === 0`. If so, build `categoryLabels` from the fallback instead of from empty nodes.
3. Always set `categoryLabelsReady = true` (so the table renders), but with correct fallback labels.

**Implementation approach:** Extract the flat `FALLBACK_CATEGORIES` array (id→label pairs) from TransactionReview into `apps/web/src/lib/category-labels.ts` as a shared constant `FALLBACK_CATEGORY_LABELS: Map<string, string>`. Both CardDetail and TransactionReview will import from there.

**Specific changes:**
- `apps/web/src/lib/category-labels.ts`: Add `FALLBACK_CATEGORY_LABELS` map built from the same data as TransactionReview's `FALLBACK_CATEGORIES`.
- `apps/web/src/components/cards/CardDetail.svelte`: In the `onMount` async IIFE, after `loadCategories()` returns `[]`, use `FALLBACK_CATEGORY_LABELS` instead of an empty map. Remove the local import of `buildCategoryLabelMap` if it becomes unused (it won't — we still use it for the success path).
- `apps/web/src/components/dashboard/TransactionReview.svelte`: Replace the inline `FALLBACK_GROUPS`/`FALLBACK_CATEGORIES` with the shared constant for the flat label map. Keep `FALLBACK_GROUPS` local since it's specific to the optgroup rendering.

## Task 2: Replace CATEGORY_NAMES_KO with taxonomy import (A1-01)

**Finding:** `CATEGORY_NAMES_KO` in `packages/core/src/optimizer/greedy.ts:11-86` is a hardcoded duplicate of category labels from `packages/rules/data/categories.yaml`. It can silently drift and is missing newer entries (`travel_agency`, `apartment_mgmt`).

**File:** `packages/core/src/optimizer/greedy.ts:11-86`

**Fix:**
1. Add a build step or runtime import that reads category labels from `@cherrypicker/rules`.
2. The `greedyOptimize` function already accepts `categoryLabels?: Map<string, string>` in its constraints. When provided, `CATEGORY_NAMES_KO` is not used.
3. The constant is only used as a fallback when `categoryLabels` is NOT provided (CLI/standalone usage).

**Implementation approach:**
- Add `getCategoryNamesKo()` function to `packages/rules/src/index.ts` that reads the YAML taxonomy and returns a `Record<string, string>`.
- In `packages/core/src/optimizer/greedy.ts`, replace the hardcoded `CATEGORY_NAMES_KO` with a lazy-initialized constant that calls `getCategoryNamesKo()` from `@cherrypicker/rules`.
- This ensures the core package always uses the latest taxonomy data without manual sync.

**Risk:** Adding a `@cherrypicker/rules` dependency to `@cherrypicker/core` could create circular dependencies. Verify the dependency graph first.

**Fallback if circular:** Keep the hardcoded map but add a build-time validation script that compares `CATEGORY_NAMES_KO` keys against the YAML taxonomy and fails the build if they diverge.
