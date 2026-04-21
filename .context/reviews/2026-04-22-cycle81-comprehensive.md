# Cycle 81 Comprehensive Code Review

**Date:** 2026-04-22
**Reviewer:** Single comprehensive pass (all source files re-read)

---

## Verification of Prior Cycle Fixes

All prior cycle 1-80 findings verified against current code state.

| Finding | Status | Evidence |
|---|---|---|
| C80-01 | **FIXED** | `FileDropzone.svelte:141` now uses `existing.name === f.name && existing.size === f.size` for dedup (name+size instead of name-only). |
| C80-02 | **FIXED** | `TransactionReview.svelte:289` now has `disabled={reoptimizing}` on the category `<select>`. |
| C80-03 | **FIXED** | `csv.ts:158` now uses `Math.min(30, lines.length)` for generic header scan (was 20). |
| C79-01 | **FIXED** | `TransactionReview.svelte:185` sets `rawCategory: undefined` on manual category override. |
| C78-02 | OPEN (LOW) | FALLBACK_CATEGORIES leading-space labels in categoryMap (same as C75-02/C76-02). Search works correctly via `includes()`. |
| C78-03 | **FIXED** | `parseGenericCSV` defaults `headerIdx = -1` and returns error when no header found. |
| C77-03 | **FIXED** | `parseGenericCSV` header detection validates candidate rows against `HEADER_KEYWORDS` list. |
| C76-01 | **FIXED** | `loadFromStorage` migration loop treats `_v ?? 0` as version 0. |
| C75-01 | **FIXED** | `isHTMLContent` reverted to boolean return. |
| C75-02 | **FIXED** | `FALLBACK_CATEGORIES` now includes 29 subcategory entries. |
| C75-03 | **FIXED** | `MIGRATIONS` map added; migration loop added in `loadFromStorage`. |
| C72-01 | **FIXED** | `handleRetry()` clears `navigateTimeout`. |
| C72-02 | **FIXED** | `optimizeFromTransactions()` guards `transformed.length > 0` before caching. |
| C72-03 | **FIXED** | `getCategoryLabels()` guards `nodes.length > 0` before caching. |
| C72-04 | **FIXED** | `addFiles()` accumulates all error types into `errorParts[]`. |
| C72-05 | **FIXED** | `loadCardsData()` and `loadCategories()` retry on undefined/aborted promise. |
| C73-02 | **FIXED** | TransactionReview uses AbortController in onMount with cleanup. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C81-01 | MEDIUM | MEDIUM | `apps/web/src/lib/store.svelte.ts:558` | `reoptimize()` uses `...result!` spread at line 558, which reads the **current** reactive `$state` value, not a snapshot captured at function entry. If `result` changes between the initial null guard (line 489) and the final assignment (line 558) -- for example, if `analyze()` is called concurrently during the `await` at line 495 or 551 -- the spread would mix data from two different analysis runs. Practical risk is low because `loading=true` disables UI, but the pattern is unsafe. A snapshot (`const snapshot = result;` after the null guard) would be safer. |
| C81-02 | LOW | HIGH | `apps/web/src/lib/parser/csv.ts` bank adapters | Bank-specific CSV adapters (samsung line 288, shinhan line 355, kb line 421, hyundai line 487, lotte line 552, hana line 617, woori line 683, nh line 748, ibk line 814, bc line 879) scan only `Math.min(10, lines.length)` rows for header detection, while the generic parser (line 158) scans `Math.min(30, lines.length)`. If a bank export has 10+ metadata rows before the header, the bank-specific adapter fails with a "헤더 행을 찾을 수 없습니다" error, then falls through to the generic parser which succeeds. The adapter's failure message is prepended to the result, which may confuse users who see an error message despite successful parsing. |
| C81-03 | LOW | HIGH | `apps/web/src/lib/analyzer.ts:106` | `parseAndCategorize()` calls `loadCategories()` at line 106 even when a `MerchantMatcher` is provided (indicating the caller already loaded categories). In `analyzeMultipleFiles()` (line 266), the caller already fetched categories and built the matcher. The redundant `loadCategories()` call returns from cache (not a network request), but creates an unnecessary `await` and makes the data flow unclear. The caller's `categoryNodes` could be passed through as a parameter instead of being re-fetched inside the function. |
| C81-04 | LOW | MEDIUM | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:56-61` | `getCategoryColor()` tries dot-notation key, then leaf ID, then uncategorized fallback. But `CATEGORY_COLORS` (lines 7-49) does not include dot-notation subcategory keys like `"utilities.apartment_mgmt"` or `"dining.delivery"`. For `utilities.apartment_mgmt`, the function tries `CATEGORY_COLORS["utilities.apartment_mgmt"]` (not found), then `CATEGORY_COLORS["apartment_mgmt"]` (not found), then falls back to `CATEGORY_COLORS.uncategorized` = `#d1d5db` (gray). This makes apartment management expenses appear as uncategorized gray in the chart, even though they have a valid category. Same issue for any subcategory whose leaf ID is not in the hardcoded map. |

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C33-01/C66-03 | MEDIUM | MerchantMatcher substring scan O(n) per transaction |
| C33-02/C66-02 | MEDIUM | cachedCategoryLabels stale across redeployments |
| C67-01/C74-06 | MEDIUM | Greedy optimizer O(m*n*k) quadratic behavior |
| C4-06/C52-03/C9-02/D-40/D-82/C9R-04/C18-03/C39-06/C71-03 | LOW | Annual savings projection label unchanged |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13/C9-08/D-43/D-74 | LOW | Small-percentage bars nearly invisible |
| C7-04 | LOW | TransactionReview $effect re-sync fragile |
| C7-06 | LOW | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07/C66-10/C70-05 | LOW | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-11 | LOW | persistWarning message misleading for data corruption vs size truncation |
| C8-05/C4-09/C73-07 | LOW | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast |
| C8-07/C4-14/C66-07/C76-05 | LOW | build-stats.ts fallback values will drift |
| C8-08/C67-02 | LOW | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | LOW | Test duplicates production code instead of testing it directly |
| C18-01/C50-08/C76-04/C79-02 | LOW | VisibilityToggle $effect directly mutates DOM |
| C18-02 | LOW | Results page stat elements queried every effect run even on dashboard page |
| C18-04 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C20-02/C25-03 | LOW | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04/C25-10 | LOW | pdf.ts module-level regex constants divergence risk with date-utils.ts |
| C21-02 | LOW | cards.ts shared fetch AbortSignal race |
| C22-04/C74-08 | LOW | CSV adapter registry only covers 10 of 24 detected banks |
| C41-05/C42-04/C71-02 | MEDIUM | loadCategories returns empty array on AbortError -- silently wrong results -- NOW PARTIALLY FIXED by C71-02 guard |
| C56-04/C70-03/C71-04 | LOW | date-utils.ts returns raw input for unparseable dates without error reporting |
| C56-05 | LOW | Zero savings shows "0원" without plus sign |
| C62-11/C66-04 | LOW | persistToStorage returns 'corrupted' for non-quota errors -- PARTIALLY FIXED |
| C64-03/C66-05/C67-03 | LOW | CATEGORY_NAMES_KO hardcoded map can drift from YAML taxonomy |
| C66-08/C74-04/C77-04 | LOW | formatIssuerNameKo and CATEGORY_COLORS hardcoded maps will drift |
| C69-01/C73-01/C79-03 | LOW | SavingsComparison tiny savings animation flicker (informational) |
| C70-02 | LOW | cachedCategoryLabels not invalidated on Astro View Transitions |
| C70-04 | LOW | csv.ts reimplements shared.ts instead of importing from it |
| C71-05 | LOW | BANK_SIGNATURES array order affects detection accuracy for overlapping patterns |
| C73-04 | LOW | BOM stripping redundancy across parser chain |
| C73-06/C74-03/C75-01 | LOW | XLSX HTML-as-XLS: double-decode overhead remains |
| C74-05 | LOW | ALL_BANKS in FileDropzone is 5th copy of bank list needing sync |
| C74-07 | LOW | AbortError vs genuine fetch failure not distinguished in error message |
| C75-02/C76-02/C78-02 | LOW | FALLBACK_CATEGORIES leading-space labels cause browser-inconsistent dropdown rendering |
| C77-02 | LOW | Annual savings projection uses simple *12 multiplication (labeled transparently) |
| C80-01 | **FIXED** | FileDropzone filename-only dedup (now uses name+size) |
| C80-02 | **FIXED** | TransactionReview category select not disabled during reoptimization |
| C80-03 | **FIXED** | CSV header scan limit 20 vs XLSX 30 (both now 30) |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
