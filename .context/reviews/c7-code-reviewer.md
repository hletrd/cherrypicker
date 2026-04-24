# Cycle 7 — Code Reviewer

**Date:** 2026-04-24
**Reviewer:** code-reviewer
**Scope:** Full repository (apps/web/src/, packages/)

---

## C7-CR01: CATEGORY_NAMES_KO hardcoded map can silently drift from YAML taxonomy

- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/greedy.ts:11-90`
- **Description:** `CATEGORY_NAMES_KO` is a 90-line hardcoded Record that duplicates the category labels from `packages/rules/data/categories.yaml`. The code even has a TODO (C64-03) acknowledging this drift risk. When the YAML taxonomy is updated (categories added, renamed, or removed), this map must be manually updated in lockstep. The web app already solved this by loading labels dynamically via `buildCategoryLabelMap()`, but the core optimizer still uses the static map as a fallback. This means the CLI and standalone usage paths show stale/missing labels when the taxonomy changes.

- **Failure scenario:** A new category is added to categories.yaml (e.g., `pet_care`). The optimizer's `buildAssignments()` falls through all lookups in `categoryLabels` (undefined from the Map) and `CATEGORY_NAMES_KO` (also undefined), displaying the raw English key `pet_care` instead of Korean label `반려동물`.

- **Fix:** Import category labels from the rules package at CLI startup instead of maintaining a duplicate map. The `categoryLabels` Map parameter in `buildAssignments()` and `buildCardResults()` already provides the correct path — the static `CATEGORY_NAMES_KO` is only used when `categoryLabels` is not provided (CLI path). The CLI entry point should load labels and pass them through.

## C7-CR02: FALLBACK_CATEGORY_LABELS is another hardcoded duplicate of the YAML taxonomy

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/category-labels.ts:32-110`
- **Description:** `FALLBACK_CATEGORY_LABELS` is a 78-entry ReadonlyMap that duplicates the category labels from `categories.yaml`. It is used as a fallback when the categories.json fetch fails (AbortError during View Transition). Same drift risk as C7-CR01 but with lower impact because it's only used as a fallback, not the primary path. The `entertainment.subscription` entry at line 101 even has a NOTE acknowledging an inconsistency with the taxonomy.

- **Failure scenario:** Same as C7-CR01 but only when categories.json fails to load. Lower probability but same symptom.

- **Fix:** Generate the fallback map at build time from the same YAML source, or remove the fallback entirely and show a "categories unavailable" message instead of potentially stale labels.

## C7-CR03: UploadResult legacy type exported but never consumed

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/api.ts:7-18`
- **Description:** `UploadResult` is marked "Legacy type kept for any remaining references" but has no remaining references. No component imports it. The `getCards` and `getCardDetail` functions are thin wrappers that could be removed in favor of direct imports from `cards.js`, but that's a separate issue.

- **Failure scenario:** No functional impact. Dead code that could confuse future contributors.

- **Fix:** Remove the `UploadResult` interface and its export.

## C7-CR04: `entertainment.subscription` key in FALLBACK_CATEGORY_LABELS inconsistent with taxonomy

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/category-labels.ts:101`
- **Description:** The comment says "subscription is a top-level category, not under entertainment" but the key `entertainment.subscription` is kept for backward compatibility. The same label `'구독'` appears twice in the map: once as `subscription` (top-level) and once as `entertainment.subscription` (legacy). If any stored optimization results used the legacy key, they would still match, but the duplicate creates confusion about which key is canonical.

- **Failure scenario:** No functional impact — the duplicate key correctly maps both paths. However, the inconsistency suggests the taxonomy migration from `entertainment.subscription` to `subscription` may be incomplete.

- **Fix:** When the next STORAGE_VERSION bump occurs, add a migration that rewrites `entertainment.subscription` to `subscription` in persisted data, then remove the legacy key from the fallback map.

---

## Final Sweep

Reviewed all source files in:
- `packages/core/src/` (optimizer, calculator, categorizer, models)
- `packages/parser/src/` (csv, pdf, xlsx, detect, date-utils)
- `packages/rules/src/` (schema, loader, category-names)
- `packages/viz/src/` (report, terminal)
- `apps/web/src/` (store, analyzer, formatters, cards, category-labels, parser, all components, all pages, layout)
- `tools/cli/src/` and `tools/scraper/src/`

No security, correctness, or data-loss findings beyond what is reported above and in prior deferred items. The Layout.astro BASE_URL migration from C6-01 is confirmed complete.
