# Cycle 2 — HIGH/MEDIUM Priority Fixes

Source: `.context/reviews/_aggregate.md` findings C2-01 and C2-02.

## Task 1: Unify category label maps — eliminate three-way divergence (C2-01)

**Finding:** Three independent hardcoded category label maps exist:
1. `CATEGORY_NAMES_KO` in `packages/core/src/optimizer/greedy.ts:11-89` (core optimizer fallback)
2. `FALLBACK_CATEGORY_LABELS` in `apps/web/src/lib/category-labels.ts:32-111` (web fallback)
3. `buildCategoryNamesKo()` in `packages/rules/src/category-names.ts` (unused authoritative source)

The cycle 1 fix (A1-01) added `buildCategoryNamesKo()` but did not integrate it. The situation is now worse than before because there are three copies instead of two.

**Approach:** Since adding a `@cherrypicker/rules` dependency to `@cherrypicker/core` risks circular dependencies (as noted in the cycle 1 plan), we will take the validation approach:

1. **Add a build-time validation script** (`packages/rules/scripts/validate-category-maps.ts`) that:
   - Reads `categories.yaml` taxonomy
   - Reads `CATEGORY_NAMES_KO` from greedy.ts
   - Reads `FALLBACK_CATEGORY_LABELS` from category-labels.ts
   - Compares all keys between the three sources
   - Reports missing entries, extra entries, and label mismatches
   - Exits with error code on any divergence

2. **Fix the concrete divergences** (C2-02):
   - In `CATEGORY_NAMES_KO`: Change `grocery: '식료품/마트'` to `grocery: '식료품'` to match the taxonomy and web fallback
   - In `CATEGORY_NAMES_KO`: Add `subscription.general: '전체'` entry
   - In `CATEGORY_NAMES_KO`: Add `entertainment.subscription: '구독'` entry (or verify it's already there)
   - In `FALLBACK_CATEGORY_LABELS`: Remove standalone `cafe` entry (line 36) since it's a subcategory, not a top-level category, and `buildCategoryLabelMap()` deliberately excludes bare subcategory IDs

3. **Add the validation script to the build pipeline** so future divergences are caught automatically.

**Specific changes:**
- `packages/core/src/optimizer/greedy.ts`: Fix `grocery` label, add missing `subscription.general` and `entertainment.subscription` entries
- `apps/web/src/lib/category-labels.ts`: Remove standalone `cafe` entry
- `packages/rules/scripts/validate-category-maps.ts`: New validation script
- `packages/rules/package.json`: Add `validate:category-maps` script entry
- `package.json` (root): Add `validate:category-maps` to the verify/lint workflow

**Risk:** Removing the standalone `cafe` from `FALLBACK_CATEGORY_LABELS` could cause "cafe" to show as a raw ID if a transaction is categorized as `cafe` without the `dining.` prefix. However, the categorizer always produces dot-notation keys (`dining.cafe`) for subcategories, so this should not happen in practice. If it does, the `categoryLabels.get(row.category) ?? row.category` fallback in CardDetail (line 243) will show the raw ID, which is the same behavior as `buildCategoryLabelMap()`.

**Status:** Not yet implemented.

## Task 2: Verify and fix remaining divergences (C2-02)

**Finding:** Concrete divergences between the two hardcoded maps.

**Fix:**
1. Cross-reference both maps against `categories.yaml` taxonomy
2. Unify labels to match the canonical taxonomy
3. Add any missing entries to both maps

This task is part of Task 1's validation script — the script will identify all divergences, and we fix them as they're found.

**Status:** Not yet implemented.
