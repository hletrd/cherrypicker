# Cycle 77 Comprehensive Code Review

**Date:** 2026-04-22
**Reviewer:** Multi-perspective deep review (all angles)
**Scope:** Full re-read of all source files, fix verification, cross-file interaction analysis

---

## Verification of Prior Cycle Fixes

All prior cycle 1-76 findings confirmed fixed except as noted below.

| Finding | Status | Evidence |
|---|---|---|
| C76-01 | **FIXED** | `loadFromStorage` now treats `_v ?? 0` as version 0, runs migrations from storedVersion up. Lines 234-251 of store.svelte.ts. |
| C75-01 | **FIXED** | `isHTMLContent` reverted to boolean return; `prefix` dead code removed. |
| C75-02 | **FIXED** | `FALLBACK_CATEGORIES` now includes 29 subcategory entries with corrected labels. |
| C75-03 | **FIXED** | `MIGRATIONS` map added; migration loop added in `loadFromStorage`. |
| C74-01 | **FIXED** | Superseded by C75-02. |
| C74-02 | **FIXED** | Superseded by C75-03. |
| C74-03 | **FIXED** | Superseded by C75-01. |
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

### C77-01: MEDIUM / HIGH -- `loadFromStorage` migration loop runs migrations from storedVersion inclusive, but MIGRATIONS keys should map FROM version

**File:** `apps/web/src/lib/store.svelte.ts:248-251`

**Description:** The migration loop runs `for (let v = storedVersion; v < STORAGE_VERSION; v++)`, accessing `MIGRATIONS[v]`. The doc comment at line 105-108 says "keyed by source version" with example `1: (data) => ({ ...data, newField: ... })` for STORAGE_VERSION=2.

However, when legacy data has `storedVersion=0` and STORAGE_VERSION=1, the loop runs `v=0`, accessing `MIGRATIONS[0]`. Since MIGRATIONS is currently empty (no key `0`), this is a no-op and correct. But the **design intent** is that `MIGRATIONS[1]` is the migration FROM v1 TO v2. When `storedVersion=1` and `STORAGE_VERSION=2`, the loop runs `v=1`, accessing `MIGRATIONS[1]`, which is correct.

The real issue: when `storedVersion=0` and `STORAGE_VERSION=2` in a future version, the loop runs `v=0` (accessing `MIGRATIONS[0]`) and `v=1` (accessing `MIGRATIONS[1]`). But `MIGRATIONS[0]` represents "migrate FROM v0 to v1" -- there is no such migration defined because v0 data was the pre-versioning format and v1 was the first versioned schema. The `MIGRATIONS[1]` entry (v1 to v2) would be correctly applied. But if someone adds `MIGRATIONS[0]` expecting it to mean "v0-to-v1 transformation", the loop would work correctly.

Actually, on closer inspection this is **correct by design** -- the loop runs all migrations from the stored version to the current version. `MIGRATIONS[v]` represents "transform data at version v to version v+1". When `storedVersion=0`, the loop tries `MIGRATIONS[0]` (v0 to v1) and `MIGRATIONS[1]` (v1 to v2). If no v0-to-v1 migration is needed (pre-versioning data is already v1-compatible), `MIGRATIONS[0]` is simply absent.

**Revised severity:** NOT A BUG -- the design is correct. The loop correctly iterates from storedVersion to STORAGE_VERSION, applying each migration step. Removing this finding.

### C77-02: LOW / MEDIUM -- `SavingsComparison` annual projection uses simple `* 12` multiplication without month-length adjustment

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:60-71`

**Description:** The annual savings projection is calculated as `target * 12` (line 60) and displayed as `formatWon(displayedAnnualSavings)` (line 219). This is a simple linear projection that assumes the latest month's savings repeat uniformly across all 12 months. This is a known issue flagged by 15+ prior cycles (C7-C76 in the aggregate).

The label says "최근 월 기준 단순 연환산" (simple annual projection based on latest month), which accurately describes the calculation. The label makes the limitation transparent.

**Revised severity:** LOW -- known issue with transparent labeling. The "단순 연환산" qualifier makes it clear this is an approximation.

### C77-03: MEDIUM / HIGH -- `parseGenericCSV` header detection can misidentify a data row as header when it contains Korean text

**File:** `apps/web/src/lib/parser/csv.ts:146-154`

**Description:** The generic CSV parser's header detection (lines 147-154) searches the first 20 lines for the first row containing non-numeric cells (cells matching `/[가-힣a-zA-Z]/`). This heuristic assumes the header is the first row with text content. However, some bank statements have metadata rows before the header (e.g., bank name, statement period) that also contain Korean text. If such a metadata row appears before the header, it would be incorrectly identified as the header row, causing all subsequent data rows to fail column matching.

In practice, the bank-specific adapters (which check for known header keywords like '이용일', '가맹점명') are tried first, and the generic parser is only used as a fallback for unrecognized banks. The risk is limited to generic CSV files from unknown banks that have Korean metadata rows above the actual header.

**Failure scenario:** A CSV from an unknown bank starts with:
```
"카드명: 우리 체크카드"
"조회기간: 2024.01.01 ~ 2024.01.31"
거래일,가맹점,금액
2024-01-15,스타벅스,5000
```
The generic parser would identify row 0 ("카드명: 우리 체크카드") as the header because it contains Korean text, and then fail to find date/merchant/amount columns in the data rows.

**Suggested fix:** After identifying a candidate header row, validate that it contains at least one known header keyword (from the `allHeaderKeywords` set used in the XLSX parser). If the candidate doesn't match, continue searching.

### C77-04: LOW / HIGH -- `formatIssuerNameKo` and `getIssuerColor` maps are 7th/8th copies of the bank list that must be kept in sync

**File:** `apps/web/src/lib/formatters.ts:51-79` and `apps/web/src/lib/formatters.ts:115-143`

**Description:** The `formatIssuerNameKo` map (24 entries), `getIssuerColor` map (24 entries), `BANK_SIGNATURES` array (24 entries), `BANK_COLUMN_CONFIGS` record (24 entries), `ALL_BANKS` array (24 entries), and `BANK_SIGNATURES` in `detect.ts` are all independent copies of the same bank list. A new bank added to any one of these must be added to all others. This is a known issue (C66-08/C74-04/C76 aggregate) flagged by many prior cycles.

All are currently in sync. The risk is future drift.

**Revised severity:** LOW -- known issue, all currently in sync.

### C77-05: LOW / MEDIUM -- `TransactionReview.searchQuery` filtering uses `toLowerCase()` on Korean text which is a no-op

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:149-166`

**Description:** The search filtering logic converts both the query and the category labels to lowercase before comparison (lines 150, 157, 159). For Korean text, `toLowerCase()` is a no-op because Hangul characters don't have case variants. This isn't a bug -- it's just unnecessary work for Korean text. For English merchant names (e.g., "STARBUCKS"), the case conversion is correct and useful.

No functional impact -- the search works correctly. The unnecessary `toLowerCase()` calls on Korean strings are negligible overhead.

**Revised severity:** NOT A BUG -- `toLowerCase()` is harmless on Korean text and correct for English text.

---

## Verified Not-a-Bug Patterns

1. **`loadFromStorage` migration loop correctness for v0 data** -- When `storedVersion=0` and `STORAGE_VERSION=1`, the loop runs `v=0` which accesses `MIGRATIONS[0]` (undefined). The `if (migrator)` check skips it. Data is then validated by the existing structure check. Correct.

2. **`loadFromStorage` migration loop correctness for v1 data** -- When `storedVersion=1` and `STORAGE_VERSION=1`, the condition `storedVersion < STORAGE_VERSION` is false, so the loop is skipped entirely. Correct -- no migration needed.

3. **`SavingsComparison` animation sync** -- The parallel animation for monthly and annual values uses shared `start`, `duration`, and `eased` variables. The `prefers-reduced-motion` check skips animation correctly.

4. **`TransactionReview` AbortController cleanup** -- Verified correct. `onMount` creates AbortController, passes signal to `loadCategories`, returns cleanup function that calls `controller.abort()`.

5. **`CategoryBreakdown` getCategoryColor** -- The function correctly handles dot-notation subcategory keys by splitting on `.` and trying the leaf ID.

6. **`isHTMLContent` simplification** -- The C75-01 fix correctly simplified the function back to returning `boolean`. The known limitation (double-decode overhead) is documented.

7. **`FALLBACK_CATEGORIES` subcategory coverage** -- The 29 dot-notation entries cover common subcategories matching the YAML taxonomy.

8. **`MIGRATIONS` map structure** -- The C75-03 migration framework is correctly structured with an empty map for v1 and a documented pattern for future migrations.

9. **CSV/XLSX/PDF parseAmount null-return pattern** -- All three parsers correctly return null for unparseable amounts and skip zero/negative amounts.

10. **SessionStorage persistence flow** -- `persistToStorage` handles quota exceeded, truncation, and unexpected errors. `loadFromStorage` validates the optimization structure, filters invalid cardResults, validates transactions via `isOptimizableTx`, and tracks truncation/corruption status.

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

---

## Previously Deferred Findings (carried forward, not new)

All findings from the cycle 76 aggregate still apply. No previously deferred findings have been resolved by code changes since the last cycle.

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
