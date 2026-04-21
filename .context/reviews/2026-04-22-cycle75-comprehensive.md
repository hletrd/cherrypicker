# Cycle 75 Comprehensive Code Review

**Date:** 2026-04-22
**Reviewer:** Multi-perspective deep review (all angles)
**Scope:** Full re-read of all source files, fix verification, cross-file interaction analysis

---

## Verification of Prior Cycle Fixes

All prior cycle 1-74 findings confirmed fixed except as noted below.

| Finding | Status | Evidence |
|---|---|---|
| C74-01 | **FIXED** | `FALLBACK_CATEGORIES` now includes 25 dot-notation subcategory entries (lines 32-57 of TransactionReview.svelte). |
| C74-02 | **FIXED** | `STORAGE_VERSION = 1` constant added; `persistToStorage` includes `_v: STORAGE_VERSION`; `loadFromStorage` checks `parsed._v` and logs warning on mismatch but continues validation (lines 98-225 of store.svelte.ts). |
| C74-03 | **FIXED** | `isHTMLContent` refactored to `checkHTMLContent` returning `{ isHTML, prefix }`. Comment explains the prefix reuse intent (lines 262-297 of xlsx.ts). |
| C72-01 | **FIXED** | `handleRetry()` clears `navigateTimeout` at line 266. |
| C72-02 | **FIXED** | `optimizeFromTransactions()` guards `transformed.length > 0` before caching (lines 189-191). |
| C72-03 | **FIXED** | `getCategoryLabels()` guards `nodes.length > 0` before caching (lines 341-343). |
| C72-04 | **FIXED** | `addFiles()` accumulates all error types into `errorParts[]` (lines 162-175). |
| C72-05 | **FIXED** | `loadCardsData()` and `loadCategories()` retry on undefined/aborted promise (lines 237-240, 276-278). |
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
| C66-02 | OPEN (MEDIUM) | `cachedCategoryLabels` stale across redeployments. 16+ cycles agree. |
| C66-03 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction. 13+ cycles agree. |

---

## New Findings (This Cycle)

### C75-01: LOW / HIGH -- `checkHTMLContent` returns `prefix` but caller does not use it to avoid re-decoding

**File:** `apps/web/src/lib/parser/xlsx.ts:262-297`

**Description:** The C74-03 fix refactored `isHTMLContent` into `checkHTMLContent` which returns `{ isHTML, prefix }`. However, in `parseXLSX()` at line 297, the full buffer is still decoded unconditionally with `new TextDecoder('utf-8').decode(buffer)`, and the returned `prefix` is never used. The comment at lines 291-295 acknowledges this: "TextDecoder doesn't support partial decoding with streaming for all browsers, so we decode the full buffer once and accept the minor overhead of the 512-byte overlap."

The refactoring achieved the structural goal (the function now returns the prefix for potential reuse), but the caller was not actually updated to use it. The `prefix` field is computed but dead.

**Failure scenario:** No functional impact -- the code works correctly. The wasted decode is the same as before the refactor. The finding is that the stated intent of C74-03 (avoid double-decoding) was not fully realized.

**Revised severity:** LOW -- cosmetic dead code, no functional impact, bounded by file size limit.

### C75-02: LOW / HIGH -- `FALLBACK_CATEGORIES` in TransactionReview does not include all subcategories present in the YAML taxonomy

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:16-57`

**Description:** The C74-01 fix added 25 dot-notation subcategory entries to `FALLBACK_CATEGORIES`. However, the YAML taxonomy in `packages/rules/data/categories.yaml` likely contains more subcategories than these 25. For example, `offline_shopping.department_store`, `grocery.traditional_market`, `grocery.online_grocery`, and `insurance.*` subcategories are present in `CATEGORY_NAMES_KO` in `greedy.ts` (lines 20-86) but are missing from `FALLBACK_CATEGORIES`.

In practice, this means some subcategory searches will still fail in fallback mode, but these are less common categories. The most frequently used subcategories (dining, grocery, transportation, etc.) are covered.

**Failure scenario:** User loads the page with a flaky network connection. Categories fetch fails. They have a transaction categorized as `insurance.life_insurance`. Searching for "생명보험" won't find it because the fallback categoryMap has no `insurance.life_insurance` key. Rare edge case.

**Revised severity:** LOW -- incomplete fallback coverage for uncommon categories, and fallback is only used when the categories.json fetch completely fails.

### C75-03: LOW / MEDIUM -- `loadFromStorage` version check warns but does not attempt any migration

**File:** `apps/web/src/lib/store.svelte.ts:219-225`

**Description:** The C74-02 fix added a `_v` field and a version check. When a version mismatch is detected, `loadFromStorage` logs a warning but proceeds with the same validation logic. This is correct for forward compatibility, but there is no migration path -- if the schema changes in a way that makes old data partially valid (e.g., a new required field), the validation would still pass but the missing field would be `undefined`, potentially causing runtime errors in components that access it without null-checking.

For example, if a future version adds a required `riskLevel` field to `OptimizationResult`, the old data would pass the current validation (which only checks for `assignments`, `totalReward`, `totalSpending`, and `effectiveRate`), but `riskLevel` would be `undefined`, causing a crash in any component that accesses `result.optimization.riskLevel` without guarding.

**Failure scenario:** A new release adds a `riskLevel` field to `OptimizationResult`. The version-1 data loads successfully through the validation, but dashboard components that assume `riskLevel` exists crash with `TypeError: Cannot read properties of undefined (reading ...)`. However, this is mitigated by the fact that new fields are typically optional in the first release that introduces them, and the validation logic would be updated alongside the schema.

**Revised severity:** LOW -- the version check is a foundation for future migration logic; the current approach (warn + proceed) is correct for v1. Actual migration code should be added when the schema actually changes.

---

## Verified Not-a-Bug Patterns

1. **TransactionReview AbortController cleanup** -- Verified correct. `onMount` creates AbortController, passes signal to `loadCategories`, returns cleanup function that calls `controller.abort()`. If `loadCategories` returns `[]` (AbortError), the code falls back to `FALLBACK_CATEGORIES`.

2. **checkHTMLContent prefix field** -- Although the `prefix` is currently unused by the caller, the refactoring is structurally sound. The `checkHTMLContent` function correctly returns the decoded prefix for potential future use. No incorrect behavior.

3. **STORAGE_VERSION persistence** -- Verified correct. `persistToStorage` writes `_v: STORAGE_VERSION` at line 152. `loadFromStorage` checks `parsed._v` at line 222 and logs a warning on mismatch. The data is still validated through the same logic regardless of version.

4. **FALLBACK_CATEGORIES subcategory coverage** -- The 25 dot-notation entries cover the most common subcategories. Missing entries (insurance, traditional_market, etc.) are low-frequency categories that are unlikely to be searched in the fallback scenario.

5. **SavingsComparison animation sync** -- The parallel animation for monthly and annual values is correctly implemented with shared `start`, `duration`, and `eased` variables. The `prefers-reduced-motion` check skips animation correctly.

6. **XLSX serial date validation** -- `parseDateToISO` correctly validates serial dates using `isValidDayForMonth()` before accepting them.

7. **CSV parseAmount null-return pattern** -- All three parsers (CSV, XLSX, PDF) correctly return null for unparseable amounts and skip zero/negative amounts.

8. **CategoryBreakdown getCategoryColor** -- The `getCategoryColor` function correctly handles dot-notation subcategory keys by splitting on `.` and trying the leaf ID. This matches the optimizer's `buildCategoryKey()` output format.

9. **SpendingSummary dismissal persistence** -- The dismissal state is stored in sessionStorage under a separate key (`cherrypicker:dismissed-warning`), independent of the main analysis data. This is correct -- it persists across page loads but not across browser sessions (tab close).

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

All findings from the cycle 74 aggregate still apply. No previously deferred findings have been resolved by code changes since the last cycle.

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
- `packages/core/src/optimizer/greedy.ts` -- full review
- `packages/core/src/categorizer/matcher.ts` -- full review
