# Architect — Cycle 2 Deep Review (2026-04-24)

Reviewed for architectural/design risks, coupling, layering, and structural issues.

## New Findings

### C2-A01: `buildCategoryNamesKo` in rules package is unused by core optimizer
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/rules/src/category-names.ts` (new, added in cycle 1) vs `packages/core/src/optimizer/greedy.ts:11-89`
- **Description:** Cycle 1 added `buildCategoryNamesKo()` to the rules package (A1-01) but the core optimizer's `CATEGORY_NAMES_KO` in greedy.ts was NOT replaced with a call to this function. The TODO at greedy.ts:7-10 acknowledges the drift risk but the new `buildCategoryNamesKo()` function is effectively dead code — it's exported but never imported by the core package. The intent of A1-01 was to make the core package use the authoritative taxonomy, but the implementation was incomplete: only the function was added, not the integration.
- **Fix:** Either (a) have `greedyOptimize` call `buildCategoryNamesKo()` from `@cherrypicker/rules` when `categoryLabels` is not provided, or (b) add a build-time validation script that compares `CATEGORY_NAMES_KO` keys against the YAML taxonomy and fails the build on divergence.

### C2-A02: `FALLBACK_CATEGORY_LABELS` duplicates data from `categories.yaml` without a validation step
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/category-labels.ts:32-111`
- **Description:** The web-side `FALLBACK_CATEGORY_LABELS` is a hardcoded map of 77 entries that must be manually updated whenever `categories.yaml` changes. Unlike `CATEGORY_NAMES_KO` (which has a TODO acknowledging the risk), `FALLBACK_CATEGORY_LABELS` has no TODO and no validation mechanism. The comment at line 31 says "Must be updated in lockstep with categories.yaml taxonomy" but there is no enforcement — no build-time check, no runtime comparison.
- **Fix:** Add a build-time script (or Astro integration) that compares `FALLBACK_CATEGORY_LABELS` keys against the categories loaded from `categories.json` and warns/errors on any mismatch. Alternatively, generate `FALLBACK_CATEGORY_LABELS` from the taxonomy at build time.

## Previously Known

D-01 (duplicate parsers), D-34 (analyzer mixing concerns), D-42/D-64/D-78 (hardcoded colors) — all unchanged.
