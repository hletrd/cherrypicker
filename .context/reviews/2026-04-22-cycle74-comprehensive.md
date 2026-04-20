# Cycle 74 Comprehensive Code Review

**Date:** 2026-04-22
**Reviewer:** Multi-perspective deep review (all angles)
**Scope:** Full re-read of all source files, fix verification, cross-file interaction analysis

---

## Verification of Prior Cycle Fixes

All prior cycle 1-73 findings confirmed fixed except as noted below.

| Finding | Status | Evidence |
|---|---|---|
| C72-01 | **FIXED** | `handleRetry()` clears `navigateTimeout` at line 266. |
| C72-02 | **FIXED** | `optimizeFromTransactions()` guards `transformed.length > 0` before caching. |
| C72-03 | **FIXED** | `getCategoryLabels()` guards `nodes.length > 0` before caching. |
| C72-04 | **FIXED** | `addFiles()` accumulates all error types into `errorParts[]`. |
| C72-05 | **FIXED** | `loadCardsData()` and `loadCategories()` retry on undefined/aborted promise. |
| C73-02 | **FIXED** | TransactionReview now uses AbortController in onMount with cleanup. |
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
| C66-02 | OPEN (MEDIUM) | `cachedCategoryLabels` stale across redeployments. 15+ cycles agree. |
| C66-03 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction. 12+ cycles agree. |

---

## New Findings (This Cycle)

### C74-01: MEDIUM / HIGH -- TransactionReview `categoryMap` does not include dot-notation subcategory keys

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:76`

**Description:** After the C73-02 fix added AbortSignal support, the `categoryMap` is rebuilt from `options` array at line 76:
```typescript
categoryMap = new Map(options.map(c => [c.id, c.label]));
```
However, `options` contains dot-notation IDs for subcategories (e.g., `"dining.cafe"` with label `"  카페"`), and the map correctly stores these. But the `FALLBACK_CATEGORIES` list used when categories fail to load does NOT include any subcategory entries. This means if the fetch fails, the search functionality (line 120-122) cannot match subcategory labels because `categoryMap.get(\`${tx.category}.${tx.subcategory}\`)` returns undefined for fallback categories.

**Failure scenario:** User loads the page with a flaky network connection. Categories fetch fails. They see a transaction categorized as `dining/cafe`. Searching for "카페" won't find it because the fallback categoryMap has no `"dining.cafe"` key. The search by `categoryMap.get("dining.cafe")` returns undefined, so the subcategory label match at line 122 fails.

**Revised severity:** LOW -- the fallback is rarely used (only when the categories.json fetch completely fails), and the primary search path (merchant name match) still works.

### C74-02: MEDIUM / MEDIUM -- `loadFromStorage` removes sessionStorage on ANY malformed data without distinguishing parse failure from version mismatch

**File:** `apps/web/src/lib/store.svelte.ts:271`

**Description:** When `loadFromStorage()` parses the stored JSON and it fails the validation check at line 211-215, the code falls through to `sessionStorage.removeItem(STORAGE_KEY)` at line 271. This means if the data structure changes in a new version (e.g., a new required field is added to `OptimizationResult`), all existing user session data is silently deleted on the next page load. There is no migration path or version check.

**Failure scenario:** A new release adds a required `OptimizationResult` field (e.g., `riskLevel`). Users who had an active session from the previous version lose their analysis results on page reload because the old data fails the new validation check. The `sessionStorage.removeItem(STORAGE_KEY)` call makes this loss irreversible.

**Revised severity:** LOW -- the app is designed for single-session use (analysis is re-runnable), and version-breaking changes to the storage schema are rare. But the silent data loss without any user notification or migration attempt is a design gap.

### C74-03: LOW / HIGH -- `parseXLSX` decodes the entire buffer twice for HTML-as-XLS files

**File:** `apps/web/src/lib/parser/xlsx.ts:283-287`

**Description:** This is a re-confirmation of C73-06. When `isHTMLContent(buffer)` returns true, the code calls `new TextDecoder('utf-8').decode(buffer)` at line 284. But `isHTMLContent()` at line 264 already decoded the first 512 bytes with `new TextDecoder('utf-8').decode(buffer.slice(0, 512))`. The second decode at line 284 processes the entire buffer, creating a full string. Then `normalizeHTML()` operates on the string, and `new TextEncoder().encode(html)` creates a second full copy as a Uint8Array.

The `isHTMLContent` function could be refactored to return the decoded prefix string so the caller can avoid re-decoding, but this is a minor optimization bounded by the 10MB file limit.

**Revised severity:** LOW -- bounded by file size limit, cosmetic improvement.

### C74-04: LOW / HIGH -- `formatIssuerNameKo` and `getIssuerColor` in formatters.ts will drift from BANK_SIGNATURES

**File:** `apps/web/src/lib/formatters.ts:51-78` and `apps/web/src/lib/formatters.ts:115-143`

**Description:** Re-confirmation of C66-08. These hardcoded maps must be kept in sync with the BANK_SIGNATURES array in `detect.ts` and the issuers in `cards.json`. When a new issuer is added to the system (as recently happened with cu, kdb, epost), all three locations must be updated in lockstep. The `formatIssuerNameKo` map currently includes all 24 issuers matching BANK_SIGNATURES, so there is no drift at this time, but the risk remains.

**Revised severity:** LOW -- currently in sync, but structural drift risk.

### C74-05: LOW / MEDIUM -- `ALL_BANKS` in FileDropzone.svelte must also be kept in sync with BANK_SIGNATURES

**File:** `apps/web/src/components/upload/FileDropzone.svelte:80-105`

**Description:** The `ALL_BANKS` array is yet another copy of the bank list that must be kept in sync with `BANK_SIGNATURES` in detect.ts, `formatIssuerNameKo` in formatters.ts, `getIssuerColor` in formatters.ts, and `BANK_COLUMN_CONFIGS` in xlsx.ts. Currently all five are in sync (24 banks), but each is maintained independently. When a new bank is added, all five must be updated.

**Revised severity:** LOW -- currently in sync, but multi-location drift risk.

### C74-06: LOW / MEDIUM -- `greedyOptimize` recalculates `calculateCardOutput` for bestSingleCard even when cardResults already computed it

**File:** `packages/core/src/optimizer/greedy.ts:329-340`

**Description:** The `greedyOptimize` function computes `bestSingleCard` by iterating over all card rules and calling `calculateCardOutput(sortedTransactions, ...)` for each. However, `buildCardResults` at line 322 already calls `calculateCardOutput` for cards that have assigned transactions. For cards with no assigned transactions, the single-card calculation is still needed. But for the many cards that DO have assigned transactions, the calculation is redundant -- the `totalReward` from `buildCardResults` could be reused.

The total wasted computation is O(cards * transactions) for the redundant calls. In practice this is a constant-factor overhead (2x) on an already quadratic algorithm (C67-01), so it doesn't change the asymptotic complexity.

**Revised severity:** LOW -- constant factor overhead on already-quadratic algorithm.

### C74-07: LOW / HIGH -- `loadCategories` returns `[]` on AbortError, but `analyzeMultipleFiles` throws on empty categories

**File:** `apps/web/src/lib/cards.ts:281` and `apps/web/src/lib/analyzer.ts:271-273`

**Description:** `loadCategories()` returns `[]` when the fetch is aborted. `analyzeMultipleFiles()` checks `categoryNodes.length === 0` and throws a user-visible error: "카테고리 데이터를 불러올 수 없어요. 다시 시도해 보세요." This is correct behavior -- it prevents silently wrong results. However, the error message does not distinguish between "the fetch was aborted because you navigated away" and "the fetch genuinely failed." When a user starts analysis and immediately navigates away (e.g., via browser back button), they see an error toast that says the categories couldn't be loaded, even though the real cause is that they cancelled the operation.

**Revised severity:** LOW -- edge case, error message is not misleading (just not precise about the cause).

### C74-08: LOW / MEDIUM -- CSV adapter registry covers 10 of 24 detected banks

**File:** `apps/web/src/lib/parser/csv.ts:910-921`

**Description:** Re-confirmation of C22-04. The `ADAPTERS` array contains 10 bank-specific adapters (hyundai, kb, ibk, woori, samsung, shinhan, lotte, hana, nh, bc). The remaining 14 banks (kakao, toss, kbank, bnk, dgb, suhyup, jb, kwangju, jeju, sc, mg, cu, kdb, epost) fall through to `parseGenericCSV`. The generic parser uses header-keyword heuristics which work for most formats but may miss bank-specific quirks (e.g., non-standard date formats, unusual column names).

This is an intentional design tradeoff -- the top 10 banks cover the vast majority of Korean credit card statements, and the generic parser provides reasonable fallback coverage.

**Revised severity:** LOW -- intentional design choice, generic parser provides reasonable fallback.

### C74-09: LOW / HIGH -- `persistToStorage` does not validate `optimization.cardResults` before serialization

**File:** `apps/web/src/lib/store.svelte.ts:127-171`

**Description:** `persistToStorage()` serializes the entire `AnalysisResult` including `optimization.cardResults` without any size check on individual fields. While there is a total size check (`MAX_PERSIST_SIZE = 4MB`), there is no per-field size check. If `cardResults` is very large (many cards with many category entries), the serialized JSON could exceed 4MB, causing transactions to be truncated. In extreme cases, even the truncated version (without transactions) could be close to the limit if `cardResults` alone is very large.

In practice, `cardResults` is bounded by the number of card rules (currently ~683 cards), each with a small `byCategory` array. The serialized size is typically well under 1MB.

**Revised severity:** LOW -- bounded by practical data sizes.

---

## Verified Not-a-Bug Patterns

1. **TransactionReview AbortController cleanup** -- The C73-02 fix correctly creates an AbortController, passes its signal to `loadCategories`, and returns a cleanup function from `onMount` that aborts the controller. The `loadCategories` catch handler returns undefined on AbortError, which the async IIFE handles by falling back to FALLBACK_CATEGORIES.

2. **cachedCategoryLabels empty-array guard** -- The C72-03 fix correctly prevents caching empty Maps by checking `nodes.length > 0` before setting `cachedCategoryLabels`.

3. **addFiles error accumulation** -- The C72-04 fix correctly builds an array of all error messages before joining them.

4. **loadCardsData/loadCategories abort retry** -- The C72-05 fix correctly handles the case where a promise resolves to undefined on AbortError by checking if a new promise has been set and retrying.

5. **SavingsComparison animation sync** -- The parallel animation for monthly and annual values is correctly implemented with shared `start`, `duration`, and `eased` variables.

6. **XLSX serial date validation** -- The `parseDateToISO` function in xlsx.ts correctly validates serial dates using `isValidDayForMonth()` before accepting them (C67-04).

7. **CSV parseAmount null-return pattern** -- All three parsers (CSV, XLSX, PDF) correctly return null for unparseable amounts and skip zero/negative amounts, matching the `isValidAmount()` / `amount <= 0` patterns.

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

All five are currently in sync. The `CATEGORY_NAMES_KO` map in `greedy.ts` is a sixth map that could drift from the YAML taxonomy (C64-03), also currently in sync.

### sessionStorage persistence flow

The `persistToStorage` -> `loadFromStorage` round-trip is well-tested:
- `persistToStorage` handles quota exceeded, truncation, and unexpected errors
- `loadFromStorage` validates the optimization structure, filters invalid cardResults, validates transactions via `isOptimizableTx`, and tracks truncation/corruption status
- The `persistWarningKind` state is correctly reset on new successful saves

---

## Previously Deferred Findings (carried forward, not new)

All findings from the cycle 73 aggregate still apply. No previously deferred findings have been resolved by code changes since the last cycle.

---

## Files Reviewed

- `apps/web/src/lib/store.svelte.ts` -- full review
- `apps/web/src/lib/analyzer.ts` -- full review
- `apps/web/src/lib/cards.ts` -- full review
- `apps/web/src/lib/parser/index.ts` -- full review
- `apps/web/src/lib/parser/csv.ts` -- full review
- `apps/web/src/lib/parser/xlsx.ts` -- full review
- `apps/web/src/lib/parser/pdf.ts` -- full review
- `apps/web/src/lib/parser/date-utils.ts` -- full review
- `apps/web/src/lib/parser/detect.ts` -- full review
- `apps/web/src/lib/formatters.ts` -- full review
- `apps/web/src/lib/category-labels.ts` -- full review
- `apps/web/src/lib/api.ts` -- full review
- `apps/web/src/lib/build-stats.ts` -- full review
- `apps/web/src/components/upload/FileDropzone.svelte` -- full review
- `apps/web/src/components/dashboard/SavingsComparison.svelte` -- full review
- `apps/web/src/components/dashboard/TransactionReview.svelte` -- full review
- `apps/web/src/components/dashboard/CategoryBreakdown.svelte` -- full review
- `packages/core/src/optimizer/greedy.ts` -- full review
- `packages/core/src/categorizer/matcher.ts` -- full review
