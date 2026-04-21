# Cycle 78 Comprehensive Code Review

**Date:** 2026-04-22
**Reviewer:** Multi-perspective deep review (all angles)
**Scope:** Full re-read of all source files, fix verification, cross-file interaction analysis

---

## Verification of Prior Cycle Fixes

All prior cycle 1-77 findings confirmed fixed except as noted below.

| Finding | Status | Evidence |
|---|---|---|
| C76-01 | **FIXED** | `loadFromStorage` migration loop now treats `_v ?? 0` as version 0, runs migrations from storedVersion. Lines 234-251 of store.svelte.ts. |
| C75-01 | **FIXED** | `isHTMLContent` reverted to boolean return; `prefix` dead code removed. |
| C75-02 | **FIXED** | `FALLBACK_CATEGORIES` now includes 29 subcategory entries with corrected labels. |
| C75-03 | **FIXED** | `MIGRATIONS` map added; migration loop added in `loadFromStorage`. |
| C77-03 | **FIXED** | `parseGenericCSV` header detection now validates candidate rows against `HEADER_KEYWORDS` list before accepting. Lines 149-168 of csv.ts. |
| C70-02 | OPEN (LOW) | `cachedCategoryLabels` not invalidated on Astro View Transitions. |
| C70-03 | OPEN (LOW) | `parseDateStringToISO` warns but returns raw input. Partially addressed. |
| C70-04 | OPEN (LOW) | csv.ts reimplements shared.ts. NOTE comment added but not migrated. |
| C70-05 | OPEN (LOW) | BANK_SIGNATURES duplicated between web and server. |
| C69-01 | OPEN (LOW) | Tiny savings animation flicker. |
| C67-01 | OPEN (MEDIUM) | Greedy optimizer O(m*n*k) quadratic behavior unchanged. |
| C66-02 | OPEN (MEDIUM) | `cachedCategoryLabels` stale across redeployments. 18+ cycles agree. |
| C66-03 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction. 15+ cycles agree. |

---

## New Findings (This Cycle)

### C78-01: MEDIUM / HIGH -- `SpendingSummary.dismissed` state not reset on `analysisStore.reset()`

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:7-8`

**Description:** The `dismissed` state variable (line 7) controls whether the data-loss warning banner is hidden. When `analysisStore.reset()` is called (user re-analyzes), the store clears its data, but the `dismissed` state in SpendingSummary remains `true` because it is local component state initialized only on mount via `sessionStorage.getItem('cherrypicker:dismissed-warning')`. This means that after a reset and re-upload, the warning banner stays hidden even though there is a fresh analysis result that could also be lost if the tab is closed.

While this was previously noted as C76-03 in the aggregate, the finding has been consistently classified as LOW because "the dismissal is intentionally persisted across sessions." However, the actual bug is subtler: the dismissal persists via `sessionStorage`, but `analysisStore.reset()` calls `clearStorage()` which removes `cherrypicker:analysis` but does NOT remove `cherrypicker:dismissed-warning`. So after reset+re-upload, the user gets a new analysis result but the warning stays dismissed. This is a minor data-safety issue since the user should be reminded that the new analysis result can also be lost.

**Failure scenario:**
1. User uploads a statement, sees warning "tab close loses data"
2. User dismisses the warning
3. User clicks "reset" or uploads a new statement
4. New analysis completes, but the warning is still dismissed
5. User closes the tab, losing the new analysis result without having been warned

**Suggested fix:** In the `$effect` that syncs with `analysisStore.generation`, also reset `dismissed = false` when the generation changes (indicating a new analysis). Alternatively, clear `cherrypicker:dismissed-warning` from sessionStorage in `analysisStore.reset()`.

**Revised severity:** MEDIUM -- while the data-safety impact is limited (the user already saw the warning once), the warning is meant to remind about the *current* analysis result, and a new result deserves a fresh warning. The fix is trivial.

### C78-02: LOW / HIGH -- `FALLBACK_CATEGORIES` subcategory labels have leading spaces that cause inconsistent dropdown rendering

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:36-65`

**Description:** The `FALLBACK_CATEGORIES` array uses leading spaces (`'  카페'`, `'  대형마트'`, etc.) as a visual indentation hack for subcategory items in the `<select>` dropdown. This was previously noted as C75-02/C76-02 in the aggregate, carried as a LOW finding about "browser-inconsistent dropdown rendering." However, on closer inspection the issue is more concrete: the `categoryMap` built from `FALLBACK_CATEGORIES` (line 67) maps subcategory IDs like `'dining.cafe'` to labels like `'  카페'` (with leading spaces). These labels are used in the search filtering logic (lines 156-160) where `categoryMap.get(...)?.toLowerCase()` is compared against the search query. A user searching for "카페" would NOT match the label `'  카페'` because `includes('카페')` on `'  카페'` actually WOULD match (since `'  카페'.includes('카페')` is true). However, if a user types a space before their search term, it could create unexpected matching behavior.

Actually, `String.prototype.includes` does match substrings within strings with leading spaces, so the search would work correctly. The leading spaces only affect the visual rendering of the `<select>` dropdown and the category label display elsewhere.

**Revised severity:** LOW -- the search works correctly despite leading spaces. The visual rendering is intentional (indentation for subcategories). The only issue is that if `categoryMap` labels are ever used in non-dropdown contexts, the leading spaces would look wrong. Currently they are only used in the `<select>` options and the search filter.

### C78-03: LOW / MEDIUM -- `parseGenericCSV` header detection can still fail if no row contains both Korean text AND header keywords

**File:** `apps/web/src/lib/parser/csv.ts:145-168`

**Description:** The C77-03 fix added validation that candidate header rows must contain at least one known header keyword. However, the loop still defaults `headerIdx = 0` (line 154), which means if NO row in the first 20 lines passes the header keyword check, the parser falls through with `headerIdx = 0` -- treating the first line as the header regardless. For a CSV file that starts with metadata rows and has no known header keywords anywhere in the first 20 lines, the parser would incorrectly identify the first metadata row as the header.

This is a narrow edge case: the bank-specific adapters handle all known banks, and the generic parser is only used for unknown banks. For unknown banks, the CSV is unlikely to use completely different header keywords. However, the fallback behavior (defaulting to row 0) is less robust than reporting "header not found" and returning an empty result with an error.

**Failure scenario:** A CSV from an unknown bank uses non-standard header keywords like "거래날짜" instead of "거래일" or "이용일". No row passes the header keyword check. The parser defaults to row 0 (which might be a metadata row), and column detection fails.

**Suggested fix:** Change the default `headerIdx` to `-1` instead of `0`. After the loop, if `headerIdx` is still `-1`, return an error result indicating that the header could not be found, matching the behavior of bank-specific adapters.

### C78-04: NOT A BUG -- `loadFromStorage` migration loop for `storedVersion = 0`

**File:** `apps/web/src/lib/store.svelte.ts:248-251`

**Description:** When `storedVersion = 0` (legacy pre-versioning data) and `STORAGE_VERSION = 1`, the loop runs `v = 0`, accessing `MIGRATIONS[0]` which is `undefined`. The `if (migrator)` check at line 250 correctly skips it. The data is then validated by the existing structure check. This is correct behavior, confirmed by C77-01 and C76-01.

### C78-05: NOT A BUG -- `TransactionReview` search `toLowerCase()` on Korean text

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:149-166`

**Description:** `toLowerCase()` on Korean text is a no-op but harmless. Correct for English merchant names. Not a bug, confirmed by C77-05.

---

## Verified Not-a-Bug Patterns

1. **`loadFromStorage` migration loop correctness** -- Verified for all version transitions (v0->v1, v1->v1, v0->v2 in future). The loop and `if (migrator)` guard handle all cases correctly.

2. **`SavingsComparison` animation sync** -- Parallel animation for monthly and annual values uses shared `start`, `duration`, and `eased` variables. `prefers-reduced-motion` check skips animation correctly.

3. **`TransactionReview` AbortController cleanup** -- Verified correct. `onMount` creates AbortController, passes signal to `loadCategories`, returns cleanup function that calls `controller.abort()`.

4. **`CategoryBreakdown` getCategoryColor** -- The function correctly handles dot-notation subcategory keys by splitting on `.` and trying the leaf ID.

5. **`isHTMLContent` simplification** -- The C75-01 fix correctly simplified the function back to returning `boolean`. Known limitation (double-decode overhead) is documented.

6. **`FALLBACK_CATEGORIES` subcategory coverage** -- The 29 dot-notation entries cover common subcategories matching the YAML taxonomy.

7. **`MIGRATIONS` map structure** -- The C75-03 migration framework is correctly structured with an empty map for v1 and a documented pattern for future migrations.

8. **CSV/XLSX/PDF parseAmount null-return pattern** -- All three parsers correctly return null for unparseable amounts and skip zero/negative amounts.

9. **SessionStorage persistence flow** -- `persistToStorage` handles quota exceeded, truncation, and unexpected errors. `loadFromStorage` validates the optimization structure, filters invalid cardResults, validates transactions via `isOptimizableTx`, and tracks truncation/corruption status.

10. **`parseGenericCSV` header keyword validation (C77-03 fix)** -- The fix correctly validates candidate header rows against a `HEADER_KEYWORDS` list before accepting. The implementation is sound.

---

## Cross-File Interaction Analysis

### Data flow: Upload -> Parse -> Categorize -> Optimize -> Display

The data flow is well-structured and all prior fixes are intact:
1. `FileDropzone.handleUpload()` -> `analysisStore.analyze()` -> `analyzeMultipleFiles()`
2. `analyzeMultipleFiles()` calls `loadCategories()` and `parseAndCategorize()` for each file
3. `parseAndCategorize()` calls `parseFile()` then `MerchantMatcher.match()` for each transaction
4. `optimizeFromTransactions()` calls `getAllCardRules()` -> `loadCardsData()` then `greedyOptimize()`
5. Results stored in `analysisStore.result` and persisted to sessionStorage

The AbortError guards at steps 2-4 prevent cache poisoning. The empty-category guards in `analyzeMultipleFiles` and `parseAndCategorize` prevent silently wrong results.

### Multi-location bank data synchronization

There are five independent copies of the bank list that must be kept in sync:
1. `BANK_SIGNATURES` in `detect.ts` (24 banks)
2. `BANK_COLUMN_CONFIGS` in `xlsx.ts` (24 banks)
3. `ALL_BANKS` in `FileDropzone.svelte` (24 banks)
4. `formatIssuerNameKo` in `formatters.ts` (24 banks)
5. `getIssuerColor` in `formatters.ts` (24 banks)

All five are currently in sync.

### sessionStorage persistence flow

The `persistToStorage` -> `loadFromStorage` round-trip is well-tested and the C76-01 fix (treat `_v: undefined` as version 0) is correctly implemented.

### SpendingSummary dismissal lifecycle

The `dismissed` state in `SpendingSummary` is initialized from `sessionStorage('cherrypicker:dismissed-warning')` on mount. `analysisStore.reset()` clears `cherrypicker:analysis` but not `cherrypicker:dismissed-warning`, leading to C78-01.

---

## Previously Deferred Findings (carried forward, not new)

All findings from the cycle 77 aggregate still apply. No previously deferred findings have been resolved by code changes since the last cycle.

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
- `packages/core/src/optimizer/greedy.ts` -- full review
