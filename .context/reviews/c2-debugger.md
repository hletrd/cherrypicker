# Debugger — Cycle 2 Deep Review (2026-04-24)

Reviewed for latent bugs, failure modes, edge cases, and regression risks.

## New Findings

### C2-D01: `FALLBACK_CATEGORY_LABELS` includes `cafe` as both parent and subcategory key
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/category-labels.ts:36,80`
- **Description:** Line 36 has `['cafe', '카페']` (standalone) and line 80 has `['dining.cafe', '카페']` (dot-notation). The standalone `cafe` entry means that if a transaction is categorized as just `cafe` (without the `dining.` prefix), it gets the label `카페` from the fallback. But in `buildCategoryLabelMap()` (line 21), only dot-notation keys are set for subcategories, and the bare sub ID is deliberately NOT set (per comment at line 19). So `FALLBACK_CATEGORY_LABELS` and `buildCategoryLabelMap()` handle the bare `cafe` differently — the fallback returns `카페` while the built map would not have a `cafe` key at all (only `dining.cafe`). This inconsistency means the UI could show different labels depending on whether the fallback or the live data was used.
- **Fix:** Remove the standalone `cafe` entry from `FALLBACK_CATEGORY_LABELS` (line 36) to match `buildCategoryLabelMap()` behavior, or document the intentional difference. The `cafe` standalone entry is a subcategory that should not appear as a top-level key.

### C2-D02: `reoptimize` reads `snapshot.previousMonthSpendingOption` but `analyze` only sets it conditionally
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/store.svelte.ts:461-463,545`
- **Description:** In `analyze()` (line 461-463), `previousMonthSpendingOption` is only set when `options?.previousMonthSpending !== undefined`. In `reoptimize()` (line 545), it reads `snapshot.previousMonthSpendingOption`. This is correct — when the user doesn't provide a value, the option stays undefined and reoptimize falls back to computing from monthly breakdown. No bug here, but the conditional assignment is subtle and could confuse future maintainers.
- **Fix:** Add a comment in `reoptimize()` explaining the conditional assignment pattern.

## Previously Known

D-29 (marginal reward 0 when cap hit), D-30 (reoptimize stale state), D-67 (parseInt vs parseFloat) — all unchanged.
