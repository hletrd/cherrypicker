# Cycle 73 Comprehensive Code Review

**Date:** 2026-04-22
**Reviewer:** Single-agent deep review (all perspectives)
**Scope:** Full re-read of all source files, fix verification, cross-file interaction analysis

---

## Verification of Prior Cycle Fixes

All prior cycle 1-72 findings confirmed fixed except as noted below.

| Finding | Status | Evidence |
|---|---|---|
| C72-01 | **FIXED** | `handleRetry()` now clears `navigateTimeout` at line 266. |
| C72-02 | **FIXED** | `optimizeFromTransactions()` guards `transformed.length > 0` before caching (lines 189-191). |
| C72-03 | **FIXED** | `getCategoryLabels()` guards `nodes.length > 0` before caching (lines 341-343). |
| C72-04 | **FIXED** | `addFiles()` now accumulates all error types into `errorParts[]` (lines 162-175). |
| C72-05 | **FIXED** | `loadCardsData()` and `loadCategories()` both retry on undefined/aborted promise (lines 237-240, 276-278). |
| C70-02 | OPEN (LOW) | `cachedCategoryLabels` not invalidated on Astro View Transitions. |
| C70-03 | OPEN (LOW) | `parseDateStringToISO` warns but returns raw input. Partially addressed. |
| C70-04 | OPEN (LOW) | csv.ts reimplements shared.ts. NOTE comment added but not migrated. |
| C70-05 | OPEN (LOW) | BANK_SIGNATURES duplicated between web and server. |
| C69-01 | OPEN (LOW) | Tiny savings animation flicker. |
| C67-01 | OPEN (MEDIUM) | Greedy optimizer O(m*n*k) quadratic behavior unchanged. |
| C66-02 | OPEN (MEDIUM) | `cachedCategoryLabels` stale across redeployments. 15+ cycles agree. |
| C66-03 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction. 12+ cycles agree. |

---

## New Findings (This Cycle)

### C73-01: MEDIUM / HIGH -- SavingsComparison annual projection uses stale displayedAnnualSavings after store reset

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:46-76`

**Description:** The `$effect` that drives the count-up animation reads `opt?.savingsVsSingleCard` as its target. When `analysisStore.reset()` is called, `opt` becomes `null`, so `target` is 0. The effect then animates `displayedSavings` and `displayedAnnualSavings` toward 0. However, `displayedAnnualSavings` is computed as `target * 12` (line 60). When the effect runs with `target === 0` and the previous `displayedAnnualSavings` was, say, 600,000, the animation correctly counts down to 0. The problem is that when the user subsequently uploads a new file and `opt` becomes a new non-null value, `displayedAnnualSavings` is still 0 from the reset, and the `startAnnual` variable captures 0 as the start value. The annual projection then animates from 0 to the new target*12, which is correct behavior. This is NOT a bug -- the animation correctly transitions.

However, there IS a subtle issue: when `opt` is null (no data), the `{:else}` branch at line 286 renders the empty state, but `displayedSavings` and `displayedAnnualSavings` may still be non-zero from the previous animation if the effect hasn't run yet. The `$effect` only fires when `opt?.savingsVsSingleCard` changes, but the empty state renders immediately when `opt` is null. The `opt` check at line 136 (`{:else if opt}`) correctly hides the savings values, so this is cosmetic only.

**Revised severity:** LOW -- cosmetic only, the values are hidden behind the `{:else if opt}` branch.

### C73-02: MEDIUM / HIGH -- TransactionReview.onMount loadCategories() doesn't pass AbortSignal

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:43-69`

**Description:** `onMount` calls `loadCategories()` without passing an `AbortSignal`. If the component unmounts during the fetch (e.g., Astro View Transition away from the dashboard page), the fetch continues in the background and resolves successfully. The `try` block then attempts to set `categoryOptions`, `subcategoryToParent`, and `categoryMap` on an unmounted component. In Svelte 5, setting `$state` on an unmounted component may be a no-op or may cause a console warning, but it's not a crash.

More importantly, this orphaned fetch holds the `categoriesPromise` cache, preventing a subsequent `loadCategories()` call from starting a fresh fetch if the cached promise is still pending. However, since the fetch succeeds, the cache is correctly populated and the next call reuses it. The real risk is that `loadCategories()` returns `[]` on AbortError only when a signal is passed -- without a signal, it never returns `[]` from an abort. So this is actually safe from the C72-03 cache-poisoning angle.

**Revised severity:** LOW -- no functional impact, only a theoretical resource waste from the orphaned fetch.

### C73-03: MEDIUM / HIGH -- ReportContent shows savingsVsSingleCard with + sign for zero value

**File:** `apps/web/src/components/report/ReportContent.svelte:48`

**Description:** In the "추가 절약/추가 비용" row, the code renders:
```
{opt.savingsVsSingleCard > 0 ? '+' : ''}{formatWon(opt.savingsVsSingleCard)}
```
This correctly adds a `+` prefix for positive savings and omits it for zero or negative. However, `formatWon()` normalizes `-0` to `0` (line 8 of formatters.ts: `if (amount === 0) amount = 0`). So `savingsVsSingleCard === 0` renders as "0원" without a `+` prefix, which is correct.

But compare with SavingsComparison.svelte line 217 which has the more sophisticated guard:
```
{displayedSavings > 0 && Math.abs(displayedSavings) >= 1 ? '+' : ''}{formatWon(displayedSavings)}
```
The ReportContent lacks the `Math.abs(...) >= 1` guard, but since it doesn't use an animated intermediate value, this is not an issue -- `savingsVsSingleCard` is always the exact final value, never an animation intermediate.

**Revised severity:** LOW -- no functional impact, just an inconsistency in the sign-prefix pattern between components.

### C73-04: MEDIUM / HIGH -- parseFile() reads file.arrayBuffer() separately for CSV encoding detection, then passes decoded string to parseCSV which also strips BOM

**File:** `apps/web/src/lib/parser/index.ts:17-47` and `apps/web/src/lib/parser/csv.ts:922-928`

**Description:** `parseFile()` for CSV files reads the ArrayBuffer, decodes with encoding detection, then passes the decoded string to `parseCSV()`. Inside `parseCSV()`, the first line is `content.replace(/^\uFEFF/, '')` to strip BOM. However, the BOM was already stripped during TextDecoder decoding (TextDecoder('utf-8') automatically handles BOM in the decoded output on some platforms but not all). Additionally, `parseGenericCSV()` ALSO strips BOM at line 134: `content.replace(/^\uFEFF/, '')`.

This means BOM stripping happens redundantly up to 3 times for the generic CSV path: once in TextDecoder (sometimes), once in `parseCSV()`, and once in `parseGenericCSV()`. While this is harmless (replacing a BOM that isn't there is a no-op), it's a code smell that suggests the BOM handling logic is not clearly assigned to a single responsibility.

**Revised severity:** LOW -- no functional impact, only code clarity.

### C73-05: MEDIUM / HIGH -- FileDropzone handleUpload doesn't clear navigateTimeout on new upload attempt

**File:** `apps/web/src/components/upload/FileDropzone.svelte:229-263`

**Description:** When a user clicks "분석 시작" (handleUpload), if there's a lingering `navigateTimeout` from a previous successful upload that was then retried, the new upload starts without clearing the old timeout. Wait -- `handleRetry()` at line 266 DOES clear `navigateTimeout`. And `handleUpload()` sets `uploadStatus = 'uploading'` which changes the UI to show the uploading state. The old `navigateTimeout` would fire during the upload, attempting to navigate to the dashboard while analysis is still in progress.

**Failure scenario:** User uploads file, analysis succeeds, success animation shows. User clicks retry within 1.2s. `handleRetry()` clears the timeout. User uploads again. Analysis succeeds again. New `navigateTimeout` is set. This is correct behavior.

But what if the user clicks the upload button (not retry) while a navigateTimeout is still pending? This can't happen because the upload button is only shown when `uploadStatus !== 'success'`, and the navigateTimeout is only set when `uploadStatus === 'success'`. The only way to go from success back to idle is via `handleRetry()`, which clears the timeout.

**Revised severity:** NOT A BUG -- the flow is correctly guarded by the uploadStatus state machine.

### C73-06: LOW / MEDIUM -- XLSX parser reads ArrayBuffer twice for HTML-as-XLS files

**File:** `apps/web/src/lib/parser/xlsx.ts:283-287`

**Description:** When `isHTMLContent(buffer)` returns true, the code decodes the entire buffer as UTF-8 (`new TextDecoder('utf-8').decode(buffer)`), then re-encodes it with `new TextEncoder().encode(html)`, creating a new ArrayBuffer/Uint8Array that is then passed to `XLSX.read()`. For large files (up to 10MB), this means the entire file content exists in memory twice simultaneously: once as the original buffer and once as the re-encoded Uint8Array. The re-encoding is needed because `XLSX.read()` with `type: 'array'` expects a Uint8Array, and the `normalizeHTML()` function operates on the string.

This is a performance concern for large HTML-as-XLS files but is bounded by the 10MB per-file limit in the FileDropzone. Total memory usage would be ~20MB for a max-size file, which is acceptable for modern browsers.

**Revised severity:** LOW -- bounded by file size limit, not a practical issue.

### C73-07: LOW / HIGH -- CategoryBreakdown CATEGORY_COLORS dark mode contrast issue persists

**File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-49`

**Description:** The CATEGORY_COLORS map assigns colors that are used for both the legend dots and the bar backgrounds. In dark mode, several colors have poor contrast against the dark surface:
- `cafe: '#92400e'` (dark brown) -- very low contrast on dark backgrounds
- `utilities: '#6b7280'` (gray) -- low contrast on dark backgrounds
- `parking: '#78716c'` (warm gray) -- low contrast on dark backgrounds
- `toll: '#a8a29e'` (light warm gray) -- moderate but could be better

These colors are used for small dots (2.5x2.5) and bar backgrounds (with 0.8 opacity), making the contrast issue more pronounced. The bars at line 196 apply `opacity: 0.8` which further reduces contrast.

This is a known finding (C8-05/C4-09) that has been deferred for many cycles. I'm re-confirming it still exists.

**Revised severity:** LOW -- cosmetic, already known.

---

## Verified Not-a-Bug Patterns

1. **SavingsComparison animation sync** -- The parallel animation for monthly and annual values is correctly implemented with shared `start`, `duration`, and `eased` variables. No drift between monthly and annual during animation.

2. **loadCardsData/loadCategories abort retry** -- The C72-05 fix correctly handles the case where a promise resolves to undefined on AbortError by checking if a new promise has been set and retrying. The pattern at lines 237-240 and 276-278 is sound.

3. **cachedCoreRules empty-array guard** -- The C72-02 fix correctly prevents caching empty arrays by checking `transformed.length > 0` before setting `cachedCoreRules`.

4. **addFiles error accumulation** -- The C72-04 fix correctly builds an array of all error messages before joining them.

5. **handleRetry navigateTimeout clear** -- The C72-01 fix correctly clears the timeout in handleRetry.

---

## Cross-File Interaction Analysis

### Data flow: Upload -> Parse -> Categorize -> Optimize -> Display

The data flow is:
1. `FileDropzone.handleUpload()` -> `analysisStore.analyze()` -> `analyzeMultipleFiles()`
2. `analyzeMultipleFiles()` calls `loadCategories()` and `parseAndCategorize()` for each file
3. `parseAndCategorize()` calls `parseFile()` then `MerchantMatcher.match()` for each transaction
4. `optimizeFromTransactions()` calls `getAllCardRules()` -> `loadCardsData()` then `greedyOptimize()`
5. Results stored in `analysisStore.result` and persisted to sessionStorage
6. Dashboard components read from `analysisStore` via `$derived` bindings

This flow is well-structured. The AbortError guards at steps 2-4 prevent cache poisoning. The only remaining concern is the `cachedCategoryLabels` staleness across Astro View Transitions (C70-02), which is cosmetic.

### Redundant BOM handling chain

UTF-8 BOM is handled at multiple levels:
1. `TextDecoder('utf-8')` -- may or may not strip BOM (implementation-dependent)
2. `parseCSV()` line 928 -- `content.replace(/^\uFEFF/, '')`
3. `parseGenericCSV()` line 134 -- `content.replace(/^\uFEFF/, '')`
4. `isHTMLContent()` in xlsx.ts line 265 -- `raw.replace(/^\uFEFF/, '')`

This defensive redundancy is harmless but could be simplified by having BOM stripping happen exactly once at the entry point.

---

## Previously Deferred Findings (carried forward, not new)

All findings from the cycle 72 aggregate still apply. No previously deferred findings have been resolved by code changes since the last cycle.

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
- `apps/web/src/lib/parser/xlsx.ts` -- full review
- `apps/web/src/lib/parser/index.ts` -- full review
- `apps/web/src/components/dashboard/SavingsComparison.svelte` -- full review
- `apps/web/src/components/dashboard/TransactionReview.svelte` -- full review
- `apps/web/src/components/dashboard/CategoryBreakdown.svelte` -- full review
- `apps/web/src/components/dashboard/OptimalCardMap.svelte` -- full review
- `apps/web/src/components/dashboard/SpendingSummary.svelte` -- full review
- `apps/web/src/components/ui/VisibilityToggle.svelte` -- full review
- `apps/web/src/components/report/ReportContent.svelte` -- full review
- `apps/web/src/lib/formatters.ts` -- full review
- `apps/web/src/lib/category-labels.ts` -- full review
- `apps/web/src/lib/api.ts` -- full review
- `apps/web/src/pages/dashboard.astro` -- full review
- `packages/core/src/categorizer/matcher.ts` -- full review
- `packages/core/src/optimizer/greedy.ts` -- full review
