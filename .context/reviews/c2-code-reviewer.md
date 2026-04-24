# Code Reviewer — Cycle 2 Deep Review (2026-04-24)

Reviewed all source files across `packages/core/`, `packages/parser/`, `packages/rules/`, `apps/web/`, and `tools/`.

## New Findings

### C2-CR01: `FALLBACK_CATEGORY_LABELS` and `CATEGORY_NAMES_KO` can silently diverge from each other
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/category-labels.ts:32-111` vs `packages/core/src/optimizer/greedy.ts:11-89`
- **Description:** Both `FALLBACK_CATEGORY_LABELS` (web) and `CATEGORY_NAMES_KO` (core) are hardcoded maps that must be kept in sync with `categories.yaml`. Cycle 1 added `FALLBACK_CATEGORY_LABELS` but did NOT remove the existing `CATEGORY_NAMES_KO` — they now have TWO independent hardcoded copies that can silently diverge from each other AND from the YAML source. The cycle 1 plan (A1-01) partially addressed this by adding `buildCategoryNamesKo()` in the rules package, but `CATEGORY_NAMES_KO` in greedy.ts was NOT replaced and `FALLBACK_CATEGORY_LABELS` in category-labels.ts was NOT sourced from it.
- **Failure scenario:** If a new category is added to `categories.yaml`, both hardcoded maps must be manually updated. Missing one produces either raw IDs in the UI or wrong Korean labels in the optimizer output.
- **Fix:** Replace `FALLBACK_CATEGORY_LABELS` with a call to `buildCategoryNamesKo()` at build time or app init. For `CATEGORY_NAMES_KO`, either import from `@cherrypicker/rules` or add a build-time validation that compares keys.

### C2-CR02: `FALLBACK_CATEGORY_LABELS` includes `subscription.general` but `CATEGORY_NAMES_KO` does not
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/category-labels.ts:106` vs `packages/core/src/optimizer/greedy.ts:11-89`
- **Description:** The web fallback map has `['subscription.general', '전체']` (line 106) and `['entertainment.subscription', '구독']` (line 101), but `CATEGORY_NAMES_KO` in greedy.ts only has `subscription: '구독'` (line 46) and no `subscription.general` entry. This is an existing divergence between the two hardcoded maps — the core optimizer would show the raw key `subscription.general` instead of `전체`.
- **Fix:** Add `subscription.general` and `entertainment.subscription` to `CATEGORY_NAMES_KO` in greedy.ts, or better yet, merge the maps via the shared `buildCategoryNamesKo()` function per C2-CR01.

### C2-CR03: `grocery` label mismatch — `식료품/마트` in core vs `식료품` in web fallback
- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/optimizer/greedy.ts:18` says `'식료품/마트'` while `apps/web/src/lib/category-labels.ts:39` says `'식료품'`
- **Description:** The same category `grocery` has different Korean labels in the two hardcoded maps. When the optimizer runs standalone (CLI), it shows `식료품/마트`; when it runs via the web with fallback labels, it shows `식료품`. The `categories.yaml` taxonomy likely has one canonical label.
- **Fix:** Unify to the canonical label from `categories.yaml`.

### C2-CR04: `loadFromStorage` migration loop runs off-by-one — skips the last migration
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/store.svelte.ts:248`
- **Description:** The migration loop `for (let v = storedVersion; v < STORAGE_VERSION; v++)` starts at `storedVersion` and runs while `v < STORAGE_VERSION`. When `storedVersion === 0` and `STORAGE_VERSION === 1`, the loop runs for `v=0` and checks `MIGRATIONS[0]`, which is undefined. This is correct behavior (no migrations defined yet). However, when `STORAGE_VERSION` becomes 2 and `storedVersion` is 1, the loop runs for `v=1` only, which correctly runs `MIGRATIONS[1]`. The loop is actually correct — it runs migrations from `storedVersion` to `STORAGE_VERSION - 1` inclusive, which is the right range. Retracting this finding.

### C2-CR05: `CategoryBreakdown.svelte` `CATEGORY_COLORS` missing `travel_agency` standalone entry
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-84`
- **Description:** The `CATEGORY_COLORS` map has `travel.travel_agency` (dot-notation, line 80) but no standalone `travel_agency` entry. If the optimizer assigns a transaction to category `travel_agency` without the `travel.` prefix (which shouldn't happen given `buildCategoryKey`, but is a defensive gap), the fallback to gray would be triggered. This extends D-42/D-46/D-64/D-78 but is specifically about the standalone key.
- **Fix:** Add `travel_agency: '#0ea5e9'` to `CATEGORY_COLORS` alongside the existing `travel: '#0ea5e9'` entry.

## Previously Known (Acknowledged, Not Re-reported)

All 111 deferred items in `.context/plans/00-deferred-items.md` remain valid. No regression found.

## Final Sweep

Examined all source files in `apps/web/src/`, `packages/core/src/`, `packages/parser/src/`, `packages/rules/src/`. No additional new findings beyond those listed above. The codebase is in good shape — most issues are maintenance concerns around hardcoded data maps that can silently drift.
