# Review Aggregate -- 2026-04-22 (Cycle 83)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-22-cycle83-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-82 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-81 findings are confirmed fixed except as noted below. C82 findings verified this cycle:

| Finding | Status | Evidence |
|---|---|---|
| C82-01 | **FIXED** | `TransactionReview.svelte:133-148` reads `analysisStore.result` once into `currentResult` and derives both `gen` and `txs` from the snapshot. |
| C82-02 | **FIXED** | `SavingsComparison.svelte:46-47` tracks `lastTargetSavings`/`lastTargetAnnual`; animation starts from last target value. |
| C82-03 | **FIXED** | `SavingsComparison.svelte:230` uses `displayedSavings >= 100` threshold for `+` prefix. |
| C82-04 | OPEN (LOW) | Deferred -- encoding detection requires ArrayBuffer. |
| C82-05 | OPEN (LOW) | Re-confirmed -- VisibilityToggle direct DOM mutation. |
| C81-01 | **FIXED** | `store.svelte.ts:501` captures `const snapshot = result;` after null guard. |
| C81-02 | **FIXED** | All 10 bank adapters scan `Math.min(30, lines.length)` for header detection. |
| C81-03 | **FIXED** | `analyzer.ts:110` uses `categoryNodes ??` with nullish coalescing. |
| C81-04 | **FIXED** | `CategoryBreakdown.svelte:51-84` includes dot-notation subcategory keys. |
| C80-01 | **FIXED** | `FileDropzone.svelte:141` uses name+size dedup. |
| C80-02 | **FIXED** | `TransactionReview.svelte:289` has `disabled={reoptimizing}`. |
| C80-03 | **FIXED** | `csv.ts:158` uses `Math.min(30, lines.length)` for generic header scan. |
| C79-01 | **FIXED** | `TransactionReview.svelte:185` sets `rawCategory: undefined` on manual override. |
| C78-02 | OPEN (LOW) | FALLBACK_CATEGORIES leading-space labels (same as C75-02/C76-02). |
| C78-03 | **FIXED** | `parseGenericCSV` defaults `headerIdx = -1` and returns error when no header found. |
| C77-03 | **FIXED** | `parseGenericCSV` header detection validates against `HEADER_KEYWORDS` list. |
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
| C70-01 | **FIXED** | `detectBank` caps confidence at 0.5 for single-pattern banks. |
| C69-02 | **FIXED** | `parseCSVAmount`/`parseAmount` handle parenthesized negatives. |
| C68-01 | **FIXED** | Server-side PDF `isValidShortDate` uses `MAX_DAYS_PER_MONTH` table. |
| C68-02 | **FIXED** | `scoreCardsForTransaction` uses push/pop instead of spread array. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C83-01 | MEDIUM | HIGH | `apps/web/src/components/report/ReportContent.svelte:48` | Sign-prefix threshold inconsistent with SavingsComparison. ReportContent uses `> 0` while SavingsComparison uses `>= 100` (C82-03 fix). For small savings (1-99 won), report shows "+1원" while dashboard shows "1원". Same 100-won threshold should apply. |
| C83-02 | LOW | MEDIUM | `apps/web/src/components/dashboard/SavingsComparison.svelte:46-47` | `lastTargetSavings`/`lastTargetAnnual` are `$state` but only read/written within the same `$effect`. No other binding depends on them. Plain `let` would be semantically correct and avoid unnecessary reactivity tracking. |
| C83-03 | LOW | MEDIUM | `apps/web/src/components/report/ReportContent.svelte:46-49` + `SavingsComparison.svelte:230` | When cherry-picking is worse, "추가 비용" label already indicates negative direction but the amount still shows a minus sign (e.g., "추가 비용: -5,000원"). Showing the absolute value under "추가 비용" would be less redundant. |
| C83-04 | LOW | MEDIUM | `apps/web/src/components/dashboard/SpendingSummary.svelte:13` | Same pattern as C83-02: `lastWarningGeneration` is `$state` but only used within the same `$effect`. Plain `let` would suffice. |
| C83-05 | LOW | MEDIUM | `apps/web/src/lib/parser/detect.ts:171-188` | `detectCSVDelimiter` scans all lines without a limit. For large files, sampling first 30 lines (matching header scan limit) would be sufficient and significantly faster. |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16-C83 | OPEN (MEDIUM) -- 23 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21-C83 | OPEN (MEDIUM) -- 26 cycles agree |
| persistToStorage bare catch / error handling | C62-C83 | PARTIALLY FIXED (C69 added 'error' kind) |
| Annual savings simple *12 projection | C7-C83 | OPEN (LOW) -- 22 cycles agree |
| date-utils unparseable passthrough | C56-C83 | PARTIALLY FIXED (C70 added warn) |
| CSV DATE_PATTERNS divergence risk | C20-C83 | OPEN (LOW) -- 21 cycles agree |
| Hardcoded fallback drift | C8-C83 | OPEN (LOW) -- 19 cycles agree (C76-05) |
| BANK_SIGNATURES duplication | C7-C83 | OPEN (LOW) -- 18 cycles agree |
| inferYear() timezone dependence | C8-C83 | OPEN (LOW) -- 16 cycles agree (60+ cycles deferred) |
| Greedy optimizer O(m*n*k) quadratic | C67-C83 | OPEN (MEDIUM) -- 16 cycles agree |
| CATEGORY_COLORS dark mode contrast | C4-C83 | OPEN (LOW) -- many cycles agree |
| Multi-location bank data sync | C74-C83 | OPEN (LOW) -- 10 cycles noting all 5+ locations |
| BOM handling redundancy | C73-C83 | OPEN (LOW) -- 11 cycles |
| XLSX HTML-as-XLS double decode | C73-C83 | OPEN (LOW) -- 11 cycles (C75-01 simplified to boolean) |
| FALLBACK_CATEGORIES incomplete subcategory coverage | C75-C83 | FIXED (C75-02 added missing entries) |
| loadFromStorage version check lacks migration | C75-C83 | FIXED (C75-03 added framework; C76-01 fixed undefined-_v gap) |
| VisibilityToggle direct DOM mutation | C18-C83 | OPEN (LOW) -- many cycles agree (C76-04/C79-02/C82-05) |
| Generic CSV header detection can misidentify metadata rows | C77-C83 | FIXED (C77-03 added keyword validation; C78-03 defaults to -1) |
| SpendingSummary dismissed not reset on store.reset() | C76-C83 | FIXED (C78-01 added generation-based reset + clearStorage cleanup) |
| TransactionReview changeCategory stale rawCategory | C79-C83 | FIXED (C79-01 added rawCategory: undefined on manual override) |
| FileDropzone filename-only dedup | C80-C83 | FIXED (C80-01 now uses name+size) |
| TransactionReview select not disabled during reoptimizing | C80-C83 | FIXED (C80-02 added disabled={reoptimizing}) |
| CSV header scan limit (20) vs XLSX (30) | C80-C83 | FIXED (C80-03 both now 30) |
| CATEGORY_COLORS missing subcategory keys | C81-C83 | FIXED (C81-04 added dot-notation keys) |
| Bank adapter header scan limit (10) vs generic (30) | C81-C83 | FIXED (C81-02 all adapters now use 30) |
| reoptimize() result! spread without snapshot | C81-C83 | FIXED (C81-01 now uses snapshot) |
| parseAndCategorize redundant loadCategories | C81-C83 | FIXED (C81-03 passes categoryNodes from caller) |
| SavingsComparison animation mid-value start | C82-C83 | FIXED (C82-02 tracks lastTargetSavings) |
| SavingsComparison "+1원" flash at zero | C82-C83 | FIXED (C82-03 uses >= 100 threshold) |
| TransactionReview $effect non-atomic reads | C82-C83 | FIXED (C82-01 reads result once into snapshot) |
| parseFile double memory for CSV | C82-C83 | DEFERRED (C82-04 encoding detection requires ArrayBuffer) |
| ReportContent sign-prefix inconsistency with SavingsComparison | C83 | NEW (MEDIUM) |
| Unnecessary $state for effect-local variables | C83 | NEW (LOW) |
| Negative savings shows redundant minus under "추가 비용" | C83 | NEW (LOW) |
| detectCSVDelimiter scans all lines without limit | C83 | NEW (LOW) |

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02/D-40/D-82/C9R-04/C18-03/C39-06/C71-03 | LOW | Annual savings projection label unchanged / visual inconsistency |
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
| C18-01/C50-08/C76-04/C79-02/C82-05 | LOW | VisibilityToggle $effect directly mutates DOM |
| C18-02 | LOW | Results page stat elements queried every effect run even on dashboard page |
| C18-04 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C20-02/C25-03 | LOW | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04/C25-10 | LOW | pdf.ts module-level regex constants divergence risk with date-utils.ts |
| C21-02 | LOW | cards.ts shared fetch AbortSignal race |
| C22-04/C74-08 | LOW | CSV adapter registry only covers 10 of 24 detected banks |
| C33-01/C66-02 | MEDIUM | MerchantMatcher substring scan O(n) per transaction |
| C33-02/C66-02 | MEDIUM | cachedCategoryLabels stale across redeployments |
| C41-05/C42-04/C71-02 | MEDIUM | loadCategories returns empty array on AbortError -- silently wrong results -- NOW PARTIALLY FIXED by C71-02 guard |
| C56-04/C70-03/C71-04 | LOW | date-utils.ts returns raw input for unparseable dates without error reporting |
| C56-05 | LOW | Zero savings shows "0원" without plus sign |
| C62-11/C66-04 | LOW | persistToStorage returns 'corrupted' for non-quota errors -- PARTIALLY FIXED |
| C64-03/C66-05/C67-03 | LOW | CATEGORY_NAMES_KO hardcoded map can drift from YAML taxonomy |
| C66-08/C74-04/C77-04 | LOW | formatIssuerNameKo and CATEGORY_COLORS hardcoded maps will drift |
| C67-01/C74-06 | MEDIUM | Greedy optimizer O(m*n*k) quadratic behavior |
| C69-01/C73-01/C79-03/C82-02 | LOW | SavingsComparison animation flicker / mid-value start |
| C70-02 | LOW | cachedCategoryLabels not invalidated on Astro View Transitions |
| C70-04 | LOW | csv.ts reimplements shared.ts instead of importing from it |
| C71-05 | LOW | BANK_SIGNATURES array order affects detection accuracy for overlapping patterns |
| C73-04 | LOW | BOM stripping redundancy across parser chain |
| C73-06/C74-03/C75-01 | LOW | XLSX HTML-as-XLS: double-decode overhead remains (prefix dead code fixed) |
| C74-05 | LOW | ALL_BANKS in FileDropzone is 5th copy of bank list needing sync |
| C74-07 | LOW | AbortError vs genuine fetch failure not distinguished in error message |
| C75-02/C76-02/C78-02 | LOW | FALLBACK_CATEGORIES leading-space labels cause browser-inconsistent dropdown rendering |
| C77-02 | LOW | Annual savings projection uses simple *12 multiplication (labeled transparently) |
| C82-01 | MEDIUM | TransactionReview $effect non-atomic reactive reads -- NOW FIXED by C82-01 |
| C82-04 | LOW | parseFile double memory for CSV (ArrayBuffer + decoded string) |
| C83-01 | MEDIUM | ReportContent sign-prefix threshold inconsistent with SavingsComparison |
| C83-02 | LOW | SavingsComparison lastTargetSavings/lastTargetAnnual unnecessarily $state |
| C83-03 | LOW | Negative savings shows redundant minus under "추가 비용" label |
| C83-04 | LOW | SpendingSummary lastWarningGeneration unnecessarily $state |
| C83-05 | LOW | detectCSVDelimiter scans all lines without limit |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
