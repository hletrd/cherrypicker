# Cycle 72 Comprehensive Code Review

**Date:** 2026-04-21
**Reviewer:** Single-agent deep review (all perspectives)
**Scope:** Full re-read of all source files, fix verification, cross-file interaction analysis

---

## Verification of Prior Cycle Fixes

All prior cycle 1-71 findings confirmed fixed except as noted below.

| Finding | Status | Evidence |
|---|---|---|
| C71-01 | **FIXED** | `clearAllFiles()` (line 188-189) and `removeFile()` when last file (line 177-178) now reset `bank` and `previousSpending`. |
| C71-02 | **FIXED** | `analyzeMultipleFiles` and `parseAndCategorize` both guard `categoryNodes.length === 0` and throw descriptive error. |
| C70-01 | **FIXED** | `detectBank` caps confidence at 0.5 for single-pattern banks. |
| C69-02 | **FIXED** | `parseCSVAmount` / `parseAmount` handle parenthesized negatives in all parsers. |
| C68-01 | **FIXED** | Server-side PDF `isValidShortDate` uses `MAX_DAYS_PER_MONTH` table. |
| C68-02 | **FIXED** | `scoreCardsForTransaction` uses push/pop instead of spread array. |
| C70-02 | OPEN (LOW) | `cachedCategoryLabels` not invalidated on Astro View Transitions. |
| C70-03 | OPEN (LOW) | `parseDateStringToISO` warns but returns raw input. Partially addressed. |
| C70-04 | OPEN (LOW) | csv.ts reimplements shared.ts. NOTE comment added but not migrated. |
| C70-05 | OPEN (LOW) | BANK_SIGNATURES duplicated between web and server. |
| C69-01 | OPEN (LOW) | Tiny savings animation flicker. |
| C67-01 | OPEN (MEDIUM) | Greedy optimizer O(m*n*k) quadratic behavior unchanged. |
| C66-02 | OPEN (MEDIUM) | `cachedCategoryLabels` stale across redeployments. 14+ cycles agree. |
| C66-03 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction. 11+ cycles agree. |

---

## New Findings (This Cycle)

### C72-01: MEDIUM / HIGH -- handleRetry() doesn't clear navigateTimeout

**File:** `apps/web/src/components/upload/FileDropzone.svelte:259-262`

**Description:** After a successful analysis, `handleUpload()` sets `uploadStatus = 'success'` and starts a 1200ms `setTimeout` to navigate to the dashboard. If the user clicks "다시 시도" (retry) within that 1200ms window, `handleRetry()` resets `uploadStatus` to `'idle'` but does NOT clear `navigateTimeout`. The timeout then fires and navigates the user to the dashboard unexpectedly, even though they just retried and are still on the upload page.

**Failure scenario:** User uploads file, analysis succeeds, success animation shows. User clicks retry within 1.2s. Upload page resets to idle state. 1200ms after the original success, user is unexpectedly navigated to dashboard.

**Fix:** Add `if (navigateTimeout) { clearTimeout(navigateTimeout); navigateTimeout = null; }` to `handleRetry()`.

---

### C72-02: MEDIUM / HIGH -- cachedCoreRules permanently empty on AbortError

**File:** `apps/web/src/lib/analyzer.ts:181-184`

**Description:** `optimizeFromTransactions()` calls `getAllCardRules()`, which calls `loadCardsData()`. If the fetch is aborted (AbortError from component unmount), `loadCardsData()` returns `undefined`, and `getAllCardRules()` returns `[]`. The empty array is then passed to `toCoreCardRuleSets([])`, which returns `[]`, and this empty array is cached in `cachedCoreRules` at module scope. Since `cachedCoreRules` is only cleared by `invalidateAnalyzerCaches()` (called from `reset()`), ALL subsequent optimizations will use empty rules and produce 0 rewards until the user explicitly resets.

**Failure scenario:** User starts analysis, navigates away during the cards.json fetch (AbortError). Comes back, starts analysis again. `cachedCoreRules` is already set to `[]`, so the optimizer receives no card rules and returns 0 total reward. User sees no savings even though cards.json would load fine on a retry.

**Fix:** Guard `cachedCoreRules` assignment: if `allCardRules.length === 0`, don't cache (set `cachedCoreRules = null` instead of `[]`), or add a minimum-size check before caching.

---

### C72-03: LOW / MEDIUM -- getCategoryLabels() caches empty Map on AbortError

**File:** `apps/web/src/lib/store.svelte.ts:332-337`

**Description:** `getCategoryLabels()` calls `loadCategories()` and caches the result in `cachedCategoryLabels`. If `loadCategories()` returns `[]` due to an AbortError, `buildCategoryLabelMap([])` returns an empty Map, which gets cached permanently. All subsequent `reoptimize()` calls will use empty category labels, showing raw English category keys (e.g., "dining.cafe") instead of Korean labels ("카페") in the dashboard.

This is related to C70-02 (cachedCategoryLabels not invalidated on View Transitions) but has a distinct root cause: the cache is poisoned with an empty Map on the first call, rather than becoming stale after a navigation.

**Failure scenario:** Component mounts, `getCategoryLabels()` is called, `loadCategories()` fetch is aborted. Empty Map cached. User re-analyzes or reoptimizes -- all category labels are English keys instead of Korean.

**Fix:** Don't cache the result if the categories array is empty: `if (nodes.length > 0) cachedCategoryLabels = buildCategoryLabelMap(nodes);`

---

### C72-04: LOW / HIGH -- addFiles() shows only first error category when multiple occur

**File:** `apps/web/src/components/upload/FileDropzone.svelte:160-169`

**Description:** When `addFiles()` processes a batch of files with multiple error types (e.g., one oversized, one invalid format, one duplicate name), only the first-matched error is shown to the user. The if/else if chain at lines 160-169 checks oversized first, then invalid, then duplicate. If all three types exist, only the oversized message is displayed; the user is unaware that some files were excluded for other reasons.

**Failure scenario:** User drags 3 files: one 15MB PDF (oversized), one .docx (invalid format), one with a duplicate name. Only the oversized error is shown. After removing the oversized file, the user sees the invalid format error. After removing that, they see the duplicate error. This is confusing because the errors are revealed one at a time.

**Fix:** Accumulate all error messages and show them together, or display a combined error message listing all validation issues.

---

### C72-05: LOW / MEDIUM -- loadCategories() and loadCardsData() share AbortController race pattern

**File:** `apps/web/src/lib/cards.ts:193-233, 235-268`

**Description:** Both `loadCardsData()` and `loadCategories()` have the same pattern: if an in-flight fetch was aborted, reset the cache and re-fetch. However, there's a subtle race: if two components call `loadCategories()` simultaneously before the first fetch resolves, both get the same `categoriesPromise`. If the first caller's signal aborts, the `categoriesAbortController?.signal.aborted` check on the next call will reset the cache and start a new fetch. But the second caller is still awaiting the original (now-aborted) promise, which resolves to `undefined`. The second caller receives `[]` from `loadCategories()` line 266 even though a new fetch is in progress.

**Failure scenario:** Two components mount simultaneously. Component A passes an AbortSignal that immediately aborts. Component B has no signal. Component A's abort resets the cache, starts a new fetch. Component B was awaiting the original promise, which resolves to `undefined` (AbortError), so it gets `[]`. The new fetch resolves later, but Component B already has an empty result.

**Fix:** After detecting an aborted cache and resetting, the function should return the new `categoriesPromise` instead of the old one. Currently `return categoriesPromise` at line 232 returns whatever was cached at the start, which may be the old (aborted) promise.

---

## Cross-File Interaction Analysis

### AbortError propagation chain
The AbortError handling chain is:
1. `loadCardsData()` / `loadCategories()` return `undefined` / `[]` on AbortError
2. Callers like `analyzeMultipleFiles()` now guard against empty categories (C71-02 fix)
3. But `optimizeFromTransactions()` does NOT guard against empty card rules (C72-02)
4. And `getCategoryLabels()` does NOT guard against empty categories (C72-03)

The pattern is: every caller of `loadCardsData()` or `loadCategories()` must individually guard against the empty result. This is fragile -- adding a new caller requires remembering to add the guard. A better pattern would be to have these functions throw on AbortError (distinguishing expected from unexpected) or to have a wrapper that retries.

### Stale cache cascade
`cachedCoreRules` (in analyzer.ts) and `cachedCategoryLabels` (in store.svelte.ts) are both module-level caches that can be poisoned with empty values on AbortError. The `invalidateAnalyzerCaches()` function only clears `cachedCoreRules`, not `cachedCategoryLabels` (which is in a different file). The two caches are invalidated in different places (`reset()` for `cachedCategoryLabels`, `invalidateAnalyzerCaches()` for `cachedCoreRules`), creating inconsistency.

---

## Previously Deferred Findings (carried forward, not new)

All findings from the cycle 71 aggregate still apply. No previously deferred findings have been resolved by code changes since the last cycle.

---

## Files Reviewed

- `apps/web/src/components/upload/FileDropzone.svelte` -- full review
- `apps/web/src/lib/cards.ts` -- full review
- `apps/web/src/lib/analyzer.ts` -- full review
- `apps/web/src/lib/store.svelte.ts` -- full review
- `apps/web/src/lib/parser/date-utils.ts` -- full review
- `apps/web/src/lib/parser/detect.ts` -- full review
- `apps/web/src/lib/parser/csv.ts` -- full review
- `apps/web/src/lib/parser/pdf.ts` -- full review
- `apps/web/src/components/dashboard/SavingsComparison.svelte` -- full review
- `apps/web/src/components/dashboard/TransactionReview.svelte` -- full review
- `packages/core/src/optimizer/greedy.ts` -- full review
- `packages/core/src/categorizer/matcher.ts` -- full review
