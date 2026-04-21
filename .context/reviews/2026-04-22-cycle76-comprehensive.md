# Cycle 76 Comprehensive Code Review

**Date:** 2026-04-22
**Reviewer:** Multi-perspective deep review (all angles)
**Scope:** Full re-read of all source files, fix verification, cross-file interaction analysis

---

## Verification of Prior Cycle Fixes

All prior cycle 1-75 findings confirmed fixed except as noted below.

| Finding | Status | Evidence |
|---|---|---|
| C75-01 | **FIXED** | `isHTMLContent` reverted to boolean return; `prefix` dead code removed. Function at xlsx.ts:266-275 now returns `boolean`. |
| C75-02 | **FIXED** | `FALLBACK_CATEGORIES` now includes 29 subcategory entries with corrected labels matching YAML taxonomy (lines 36-65 of TransactionReview.svelte). |
| C75-03 | **FIXED** | `MIGRATIONS` map added at store.svelte.ts:110-112; migration loop added at lines 238-241. |
| C74-01 | **FIXED** | Superseded by C75-02 (full subcategory coverage). |
| C74-02 | **FIXED** | Superseded by C75-03 (migration framework). |
| C74-03 | **FIXED** | Superseded by C75-01 (simplified back to boolean). |
| C72-01 | **FIXED** | `handleRetry()` clears `navigateTimeout`. |
| C72-02 | **FIXED** | `optimizeFromTransactions()` guards `transformed.length > 0` before caching. |
| C72-03 | **FIXED** | `getCategoryLabels()` guards `nodes.length > 0` before caching. |
| C72-04 | **FIXED** | `addFiles()` accumulates all error types into `errorParts[]`. |
| C72-05 | **FIXED** | `loadCardsData()` and `loadCategories()` retry on undefined/aborted promise. |
| C73-02 | **FIXED** | TransactionReview uses AbortController in onMount with cleanup. |
| C70-01 | **FIXED** | `detectBank` caps confidence at 0.5 for single-pattern banks. |
| C69-02 | **FIXED** | `parseCSVAmount`/`parseAmount` handle parenthesized negatives. |
| C68-01 | **FIXED** | Server-side PDF `isValidShortDate` uses `MAX_DAYS_PER_MONTH` table. |
| C68-02 | **FIXED** | `scoreCardsForTransaction` uses push/pop instead of spread array. |
| C70-02 | OPEN (LOW) | `cachedCategoryLabels` not invalidated on Astro View Transitions. |
| C70-03 | OPEN (LOW) | `parseDateStringToISO` warns but returns raw input. Partially addressed. |
| C70-04 | OPEN (LOW) | csv.ts reimplements shared.ts. NOTE comment added but not migrated. |
| C70-05 | OPEN (LOW) | BANK_SIGNATURES duplicated between web and server. |
| C69-01 | OPEN (LOW) | Tiny savings animation flicker. |
| C67-01 | OPEN (MEDIUM) | Greedy optimizer O(m*n*k) quadratic behavior unchanged. |
| C66-02 | OPEN (MEDIUM) | `cachedCategoryLabels` stale across redeployments. 17+ cycles agree. |
| C66-03 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction. 14+ cycles agree. |

---

## New Findings (This Cycle)

### C76-01: MEDIUM / HIGH -- `loadFromStorage` migration loop runs on version mismatch but skips when `_v` is undefined

**File:** `apps/web/src/lib/store.svelte.ts:231-242`

**Description:** The migration loop at lines 238-241 only runs when `parsed._v !== undefined && parsed._v !== STORAGE_VERSION`. However, data persisted before the C74-02 versioning fix has no `_v` field at all. When such legacy data is loaded, `parsed._v` is `undefined`, so the condition `parsed._v !== undefined` is false, and the migration loop is skipped entirely.

This is currently safe because `MIGRATIONS` is empty (v1 has no migrations). But when STORAGE_VERSION becomes 2 and a migration function is added at key `1`, the migration from v1 to v2 will correctly run for data with `_v: 1`. However, legacy data without a `_v` field will NOT be migrated, even though it logically represents v0 (pre-versioning) data that also needs migration.

**Failure scenario:** A user who last used the app before C74-02 (no `_v` field in their sessionStorage data) returns after a v2 schema change. Their data loads without migration because `_v` is undefined, potentially causing the same crash that the migration was meant to prevent (e.g., a new required field is `undefined`).

**Suggested fix:** Treat `_v: undefined` as version 0 (pre-versioning), and run migrations from version 0:
```typescript
const storedVersion = parsed._v ?? 0;
if (storedVersion < STORAGE_VERSION) {
  // warn and run migrations from storedVersion to STORAGE_VERSION
}
```

### C76-02: LOW / HIGH -- `FALLBACK_CATEGORIES` labels have leading whitespace for subcategories that appears in the dropdown

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:36-64`

**Description:** The `FALLBACK_CATEGORIES` subcategory entries use leading double-space indentation in their `label` field (e.g., `{ id: 'dining.restaurant', label: '  일반음식점' }`). This matches the dynamic loading path (line 107: `` label: `  ${sub.labelKo}` ``), where the leading spaces provide visual indentation in the `<select>` dropdown to indicate subcategory hierarchy.

However, the `categoryMap` (line 67) also stores these leading-space labels, and the `categoryMap` is used for search matching (lines 156-161). When a user types a search query like "일반음식점" (without leading spaces), the `categoryMap.get(tx.category)?.toLowerCase()` returns `"  일반음식점"` (with leading spaces). The `includes()` check still works because `"  일반음식점".includes("일반음식점")` is true. So there is no functional bug.

But the leading spaces ARE displayed in the category dropdown `<option>` text. While this is intentional for visual hierarchy, the leading spaces can cause minor rendering inconsistencies across browsers (some browsers trim leading spaces in `<option>` elements, others preserve them). This is an aesthetic inconsistency, not a functional bug.

**Revised severity:** LOW -- cosmetic rendering inconsistency across browsers for dropdown indentation.

### C76-03: LOW / MEDIUM -- `SpendingSummary` uses `onMount` to read dismissal state but never clears it on store reset

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:17-27`

**Description:** The `dismissed` state is read from sessionStorage on mount and stored in `$state`. When the user clicks "닫기" (line 141), `dismissed` is set to `true` and persisted to sessionStorage. However, when `analysisStore.reset()` is called, the `dismissed` state is NOT reset -- the warning banner stays hidden even after a new analysis. This is arguably correct behavior (the user already dismissed the warning), but it means the user will never see the warning again in the current browser session, even after starting a fresh analysis.

The dismissal state is stored in `sessionStorage` under `cherrypicker:dismissed-warning`, which persists across page loads within the same tab but clears on tab close. This is an acceptable UX tradeoff -- the warning is informational ("tab close will lose data"), and once dismissed, re-showing it after each re-analysis would be annoying.

**Revised severity:** LOW -- intentional UX behavior; the warning is informational and re-showing it would be disruptive.

### C76-04: LOW / HIGH -- `OptimalCardMap` $effect directly mutates DOM element textContent and classList

**File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:62-127`

**Description:** The `VisibilityToggle` component uses a `$effect` to directly mutate DOM elements via `classList.toggle()`, `classList.add()`, `classList.remove()`, and `.textContent = ...`. This is a known Svelte anti-pattern (C18-01/C50-08) that was flagged in prior cycles and remains open. The component does not use Svelte's declarative rendering for these elements because they are Astro-managed DOM nodes outside Svelte's control.

The current implementation is correct -- it properly handles stale element references via `isConnected` checks, provides cleanup that restores the empty state, and uses cached references to avoid repeated DOM queries. The direct DOM mutation is architecturally necessary because the managed elements belong to Astro's DOM tree, not Svelte's.

**Revised severity:** LOW -- known architectural limitation; all edge cases are handled correctly.

### C76-05: LOW / MEDIUM -- `build-stats.ts` fallback values will silently drift from actual data

**File:** `apps/web/src/lib/build-stats.ts:17-19`

**Description:** The fallback values (totalCards=683, totalIssuers=24, totalCategories=45) are hardcoded and will drift from the actual cards.json data as cards are added/removed. This is a known issue (C8-07/C67-02) flagged by multiple prior cycles. The fallback is only used when cards.json is unavailable at build time, which is an unusual scenario (the file is always built as part of the CI pipeline).

**Revised severity:** LOW -- fallback is only used in degraded build scenarios; prior cycles agree on deferral.

---

## Verified Not-a-Bug Patterns

1. **`loadFromStorage` migration loop correctness for v1 data** -- Data persisted with `_v: 1` correctly passes the version check (`parsed._v !== STORAGE_VERSION` is false) and skips the migration loop. This is correct because v1 is the current version and needs no migration.

2. **`SavingsComparison` animation sync** -- The parallel animation for monthly and annual values is correctly implemented with shared `start`, `duration`, and `eased` variables. The `prefers-reduced-motion` check skips animation correctly.

3. **`TransactionReview` AbortController cleanup** -- Verified correct. `onMount` creates AbortController, passes signal to `loadCategories`, returns cleanup function that calls `controller.abort()`.

4. **`CategoryBreakdown` getCategoryColor** -- The `getCategoryColor` function correctly handles dot-notation subcategory keys by splitting on `.` and trying the leaf ID.

5. **`isHTMLContent` simplification** -- The C75-01 fix correctly simplified the function back to returning `boolean`. The known limitation (double-decode overhead) is documented in the comment.

6. **`FALLBACK_CATEGORIES` subcategory coverage** -- The 29 dot-notation entries now cover the most common subcategories matching the YAML taxonomy, including the previously missing `offline_shopping.department_store`, `grocery.traditional_market`, `grocery.online_grocery`, `travel.travel_agency`, and `utilities.apartment_mgmt`.

7. **`MIGRATIONS` map structure** -- The C75-03 migration framework is correctly structured with an empty map for v1 and a documented pattern for future migrations.

8. **CSV/XLSX/PDF parseAmount null-return pattern** -- All three parsers correctly return null for unparseable amounts and skip zero/negative amounts.

9. **SessionStorage persistence flow** -- `persistToStorage` handles quota exceeded, truncation, and unexpected errors. `loadFromStorage` validates the optimization structure, filters invalid cardResults, validates transactions via `isOptimizableTx`, and tracks truncation/corruption status.

10. **XLSX serial date validation** -- `parseDateToISO` correctly validates serial dates using `isValidDayForMonth()` before accepting them.

---

## Cross-File Interaction Analysis

### Data flow: Upload -> Parse -> Categorize -> Optimize -> Display

The data flow is well-structured:
1. `FileDropzone.handleUpload()` -> `analysisStore.analyze()` -> `analyzeMultipleFiles()`
2. `analyzeMultipleFiles()` calls `loadCategories()` and `parseAndCategorize()` for each file
3. `parseAndCategorize()` calls `parseFile()` then `MerchantMatcher.match()` for each transaction
4. `optimizeFromTransactions()` calls `getAllCardRules()` -> `loadCardsData()` then `greedyOptimize()`
5. Results stored in `analysisStore.result` and persisted to sessionStorage
6. Dashboard components read from `analysisStore` via `$derived` bindings

The AbortError guards at steps 2-4 prevent cache poisoning. The empty-category guards in `analyzeMultipleFiles` and `parseAndCategorize` prevent silently wrong results.

### Multi-location bank data synchronization

There are five independent copies of the bank list that must be kept in sync:
1. `BANK_SIGNATURES` in `detect.ts` (24 banks)
2. `BANK_COLUMN_CONFIGS` in `xlsx.ts` (24 banks)
3. `ALL_BANKS` in `FileDropzone.svelte` (24 banks)
4. `formatIssuerNameKo` in `formatters.ts` (24 banks)
5. `getIssuerColor` in `formatters.ts` (24 banks)

All five are currently in sync. The `CATEGORY_NAMES_KO` map in `greedy.ts` is a sixth map that could drift from the YAML taxonomy, also currently in sync.

### sessionStorage persistence flow

The `persistToStorage` -> `loadFromStorage` round-trip is well-tested:
- `persistToStorage` handles quota exceeded, truncation, and unexpected errors
- `loadFromStorage` validates the optimization structure, filters invalid cardResults, validates transactions via `isOptimizableTx`, and tracks truncation/corruption status
- The `persistWarningKind` state is correctly reset on new successful saves
- The `_v` version field is persisted and checked on load

---

## Previously Deferred Findings (carried forward, not new)

All findings from the cycle 75 aggregate still apply. No previously deferred findings have been resolved by code changes since the last cycle.

---

## Files Reviewed

- `apps/web/src/lib/store.svelte.ts` -- full review
- `apps/web/src/lib/analyzer.ts` -- full review
- `apps/web/src/lib/cards.ts` -- full review
- `apps/web/src/lib/api.ts` -- full review
- `apps/web/src/lib/parser/index.ts` -- full review
- `apps/web/src/lib/parser/csv.ts` -- full review
- `apps/web/src/lib/parser/xlsx.ts` -- full review
- `apps/web/src/lib/parser/pdf.ts` -- full review
- `apps/web/src/lib/parser/date-utils.ts` -- full review
- `apps/web/src/lib/parser/detect.ts` -- full review
- `apps/web/src/lib/formatters.ts` -- full review
- `apps/web/src/lib/category-labels.ts` -- full review
- `apps/web/src/lib/build-stats.ts` -- full review
- `apps/web/src/components/upload/FileDropzone.svelte` -- full review
- `apps/web/src/components/dashboard/SavingsComparison.svelte` -- full review
- `apps/web/src/components/dashboard/TransactionReview.svelte` -- full review
- `apps/web/src/components/dashboard/CategoryBreakdown.svelte` -- full review
- `apps/web/src/components/dashboard/SpendingSummary.svelte` -- full review
- `apps/web/src/components/dashboard/OptimalCardMap.svelte` -- full review
- `apps/web/src/components/ui/VisibilityToggle.svelte` -- full review
- `packages/core/src/optimizer/greedy.ts` -- full review
- `packages/core/src/categorizer/matcher.ts` -- full review
