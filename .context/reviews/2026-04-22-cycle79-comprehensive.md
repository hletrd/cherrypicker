# Cycle 79 Comprehensive Code Review

**Date:** 2026-04-22
**Reviewer:** Multi-perspective deep review (all angles)
**Scope:** Full re-read of all source files, fix verification, cross-file interaction analysis

---

## Verification of Prior Cycle Fixes

All prior cycle 1-78 findings confirmed fixed except as noted below.

| Finding | Status | Evidence |
|---|---|---|
| C78-01 | **FIXED** | `SpendingSummary.svelte` lines 13-20: `$effect` resets `dismissed = false` when generation changes. `clearStorage()` line 338 also removes `cherrypicker:dismissed-warning` from sessionStorage. |
| C78-03 | **FIXED** | `parseGenericCSV` in `csv.ts` lines 154-178: defaults `headerIdx = -1` and returns error `{ message: '헤더 행을 찾을 수 없습니다.' }` when no header found. |
| C78-02 | OPEN (LOW) | `FALLBACK_CATEGORIES` leading-space labels in categoryMap. Same as C75-02/C76-02. Search works correctly via `includes()`. |

---

## New Findings (This Cycle)

### C79-01: MEDIUM / MEDIUM -- `TransactionReview` `changeCategory` does not clear `rawCategory` when user changes category

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:172-195`

**Description:** When the user manually changes a transaction's category via the dropdown, `changeCategory()` updates `category`, `subcategory`, and `confidence`, but leaves `rawCategory` unchanged. The `rawCategory` field stores the original bank-provided category string from the CSV/XLSX/PDF. When the user changes the category, the stale `rawCategory` no longer corresponds to the new category/subcategory assignment. While `rawCategory` is not currently used by the optimizer (it's carried through but not referenced in reward calculation), it IS persisted to sessionStorage and could mislead future code that inspects it.

More importantly, the `reoptimize()` path in `store.svelte.ts` passes `rawCategory` to the core optimizer (via `optimizeFromTransactions` -> `toCoreCardRuleSets`). The core `CategorizedTransaction` type includes `rawCategory`. If any future optimizer logic uses `rawCategory` for anything (e.g., re-categorization heuristics, reporting), stale `rawCategory` would produce incorrect results.

**Failure scenario:**
1. User uploads a Samsung card statement with rawCategory "음식점" -> category auto-matched to "dining"
2. User manually changes category from "dining" to "transportation"
3. The transaction now has category="transportation", subcategory=undefined, rawCategory="음식점"
4. If any reporting or future code groups by rawCategory, this transaction appears in the wrong group

**Suggested fix:** In `changeCategory()`, set `rawCategory` to `undefined` or to the new category ID when the user manually overrides, since the original bank-provided category is no longer relevant.

**Severity:** MEDIUM -- currently no active code path that reads `rawCategory` for decision-making, but the data inconsistency is a latent bug that could surface if the optimizer or reporting logic changes.

### C79-02: LOW / HIGH -- `VisibilityToggle` $effect directly mutates DOM classList and textContent

**File:** `apps/web/src/components/ui/VisibilityToggle.svelte:70-126`

**Description:** This is a known long-standing issue (C18-01/C50-08/C76-04) carried from previous cycles. The `$effect` in VisibilityToggle directly mutates `classList` and `textContent` on DOM elements instead of using Svelte's reactive template bindings. While the component uses cached element references and `isConnected` guards to avoid stale mutations, this pattern bypasses Svelte's reactivity system and could lead to issues with SSR hydration mismatches.

This finding is not new but is confirmed as still open. No code changes since C78.

**Status:** OPEN (LOW) -- many cycles agree, pattern is functional but non-idiomatic.

### C79-03: LOW / MEDIUM -- `OptimalCardMap` and `SavingsComparison` have no loading skeleton for `displayedAnnualSavings` during initial render

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:43-76`

**Description:** The `displayedAnnualSavings` state initializes to 0 and is only updated via the `$effect` animation. When the component first renders with data (after analysis completes), there's a brief moment where `displayedSavings` and `displayedAnnualSavings` are both 0 before the animation starts. This causes the "연간 약 0원" text to flash briefly before the count-up animation begins.

This is a known cosmetic issue (C69-01 / C73-01). The animation smoothly transitions from 0 to the target value, but the initial 0 is briefly visible. The `prefers-reduced-motion` path correctly sets the value immediately.

**Status:** OPEN (LOW) -- cosmetic flicker during count-up animation.

---

## Verified Not-a-Bug Patterns

1. **`SpendingSummary` dismissal lifecycle** -- The C78-01 fix is correctly implemented in two places: (a) the `$effect` at lines 14-19 resets `dismissed = false` when generation changes, and (b) `clearStorage()` at line 338 removes the sessionStorage key. The dual approach ensures both the component state and the persistent storage are cleared.

2. **`parseGenericCSV` header detection** -- The C78-03 fix is correctly implemented. The default `headerIdx = -1` and the error return at lines 176-178 match the behavior of bank-specific adapters.

3. **`loadFromStorage` migration loop** -- Correct for all version transitions. The `storedVersion ?? 0` handles legacy unversioned data. The `MIGRATIONS` map is empty for v1 (no migrations needed yet).

4. **`SavingsComparison` animation sync** -- The parallel animation for monthly and annual values uses shared `start`, `duration`, and `eased` variables, keeping them in sync during the count-up.

5. **`TransactionReview` AbortController cleanup** -- `onMount` creates AbortController, passes signal to `loadCategories`, returns cleanup function that calls `controller.abort()`.

6. **CSV/XLSX/PDF parseAmount null-return pattern** -- All three parsers correctly return null for unparseable amounts and skip zero/negative amounts.

7. **SessionStorage persistence flow** -- `persistToStorage` handles quota exceeded, truncation, and unexpected errors. `loadFromStorage` validates structure, filters invalid entries, and tracks truncation/corruption status.

8. **`scoreCardsForTransaction` push/pop optimization** -- The C68-02 fix correctly uses push/pop instead of spread array, and the pop happens before the next iteration of the outer loop.

9. **`cards.ts` AbortError retry logic** -- The C72-05 fix correctly retries the fetch when the awaited promise resolves to undefined due to AbortError but a new fetch has already started.

10. **`analyzer.ts` empty category guard** -- The C71-02 fix throws an error with a user-visible message when `loadCategories()` returns an empty array due to AbortError.

---

## Cross-File Interaction Analysis

### Data flow: Upload -> Parse -> Categorize -> Optimize -> Display

The data flow is well-structured and all prior fixes are intact:
1. `FileDropzone.handleUpload()` -> `analysisStore.analyze()` -> `analyzeMultipleFiles()`
2. `analyzeMultipleFiles()` calls `loadCategories()` and `parseAndCategorize()` for each file
3. `parseAndCategorize()` calls `parseFile()` then `MerchantMatcher.match()` for each transaction
4. `optimizeFromTransactions()` calls `getAllCardRules()` -> `loadCardsData()` then `greedyOptimize()`
5. Results stored in `analysisStore.result` and persisted to sessionStorage

The AbortError guards at steps 2-4 prevent cache poisoning. The empty-category guards prevent silently wrong results.

### Multi-location bank data synchronization

There are five independent copies of the bank list that must be kept in sync:
1. `BANK_SIGNATURES` in `detect.ts` (24 banks)
2. `BANK_COLUMN_CONFIGS` in `xlsx.ts` (24 banks)
3. `ALL_BANKS` in `FileDropzone.svelte` (24 banks)
4. `formatIssuerNameKo` in `formatters.ts` (24 banks)
5. `getIssuerColor` in `formatters.ts` (24 banks)

All five are currently in sync.

### SpendingSummary dismissal lifecycle

The `dismissed` state is correctly managed via two mechanisms: (a) `$effect` reset on generation change, and (b) `clearStorage()` removing the sessionStorage key. The C78-01 fix is complete.

### rawCategory data flow

`rawCategory` flows from the parser (csv.ts, xlsx.ts, pdf.ts) through `parseAndCategorize()` -> `CategorizedTx.rawCategory` -> `optimizeFromTransactions()` -> core `CategorizedTransaction.rawCategory` -> optimizer (unused in current calculation). The stale rawCategory issue (C79-01) only matters if future code reads this field.

---

## Previously Deferred Findings (carried forward, not new)

All findings from the cycle 78 aggregate still apply. No previously deferred findings have been resolved by code changes since the last cycle.

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
- `apps/web/src/components/report/ReportContent.svelte` -- full review
- `apps/web/src/components/ui/VisibilityToggle.svelte` -- full review
- `packages/core/src/optimizer/greedy.ts` -- full review
- `apps/web/src/pages/dashboard.astro` -- full review
