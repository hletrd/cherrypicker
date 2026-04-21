# Review Aggregate -- 2026-04-22 (Cycle 76)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-22-cycle76-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-75 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-75 findings are confirmed fixed except as noted below.

| Finding | Status | Evidence |
|---|---|---|
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

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C76-01 | MEDIUM | HIGH | `apps/web/src/lib/store.svelte.ts:231-242` | `loadFromStorage` migration loop skips when `_v` is undefined (legacy pre-versioning data). When STORAGE_VERSION becomes 2, data without `_v` field will not be migrated because the condition `parsed._v !== undefined` is false. Treat `_v: undefined` as version 0 and run migrations from version 0. |
| C76-02 | LOW | HIGH | `apps/web/src/components/dashboard/TransactionReview.svelte:36-64` | `FALLBACK_CATEGORIES` subcategory labels have leading double-space indentation for dropdown hierarchy. Browser rendering of leading spaces in `<option>` elements is inconsistent -- some trim, some preserve. No functional impact (search still works because `includes()` matches regardless of leading spaces). |
| C76-03 | LOW | MEDIUM | `apps/web/src/components/dashboard/SpendingSummary.svelte:17-27` | `dismissed` state read from sessionStorage on mount is not reset on `analysisStore.reset()`. The warning banner stays hidden even after a new analysis. This is arguably correct UX (re-showing would be disruptive) but could be unexpected for users who want the reminder. |
| C76-04 | LOW | HIGH | `apps/web/src/components/dashboard/OptimalCardMap.svelte:62-127` | `VisibilityToggle` $effect directly mutates DOM via classList and textContent. Known Svelte anti-pattern (C18-01/C50-08) but architecturally necessary for Astro-managed elements. All edge cases handled correctly via isConnected checks and cleanup. |
| C76-05 | LOW | MEDIUM | `apps/web/src/lib/build-stats.ts:17-19` | Hardcoded fallback values (683/24/45) will silently drift from actual cards.json data. Known issue (C8-07/C67-02) flagged by many prior cycles. Fallback only used when cards.json unavailable at build time. |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16-C76 | OPEN (MEDIUM) -- 16 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21-C76 | OPEN (MEDIUM) -- 19 cycles agree |
| persistToStorage bare catch / error handling | C62-C76 | PARTIALLY FIXED (C69 added 'error' kind) |
| Annual savings simple *12 projection | C7-C76 | OPEN (LOW) -- 15 cycles agree |
| date-utils unparseable passthrough | C56-C76 | PARTIALLY FIXED (C70 added warn) |
| CSV DATE_PATTERNS divergence risk | C20-C76 | OPEN (LOW) -- 14 cycles agree |
| Hardcoded fallback drift | C8-C76 | OPEN (LOW) -- 12 cycles agree (C76-05) |
| BANK_SIGNATURES duplication | C7-C76 | OPEN (LOW) -- 11 cycles agree |
| inferYear() timezone dependence | C8-C76 | OPEN (LOW) -- 9 cycles agree (60+ cycles deferred) |
| Greedy optimizer O(m*n*k) quadratic | C67-C76 | OPEN (MEDIUM) -- 9 cycles agree |
| CATEGORY_COLORS dark mode contrast | C4-C76 | OPEN (LOW) -- many cycles agree |
| Multi-location bank data sync | C74-C76 | OPEN (LOW) -- 3 cycles noting all 5 locations |
| BOM handling redundancy | C73-C76 | OPEN (LOW) -- 4 cycles |
| XLSX HTML-as-XLS double decode | C73-C76 | OPEN (LOW) -- 4 cycles (C75-01 simplified to boolean) |
| FALLBACK_CATEGORIES incomplete subcategory coverage | C75-C76 | FIXED (C75-02 added missing entries) |
| loadFromStorage version check lacks migration | C75-C76 | PARTIALLY FIXED (C75-03 added framework; C76-01 flags undefined-_v gap) |
| VisibilityToggle direct DOM mutation | C18-C76 | OPEN (LOW) -- many cycles agree (C76-04) |
| loadFromStorage migration skips pre-versioning data | C76 | NEW (MEDIUM) -- first cycle flagging the undefined-_v gap |
| FALLBACK_CATEGORIES leading-space labels | C76 | NEW (LOW) -- first cycle noting browser inconsistency |

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
| C18-01/C50-08/C76-04 | LOW | VisibilityToggle $effect directly mutates DOM |
| C18-02 | LOW | Results page stat elements queried every effect run even on dashboard page |
| C18-04 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C20-02/C25-03 | LOW | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04/C25-10 | LOW | pdf.ts module-level regex constants divergence risk with date-utils.ts |
| C21-02 | LOW | cards.ts shared fetch AbortSignal race |
| C22-04/C74-08 | LOW | CSV adapter registry only covers 10 of 24 detected banks |
| C33-01/C66-03 | MEDIUM | MerchantMatcher substring scan O(n) per transaction |
| C33-02/C66-02 | MEDIUM | cachedCategoryLabels stale across redeployments |
| C41-05/C42-04/C71-02 | MEDIUM | loadCategories returns empty array on AbortError -- silently wrong results -- NOW PARTIALLY FIXED by C71-02 guard |
| C56-04/C70-03/C71-04 | LOW | date-utils.ts returns raw input for unparseable dates without error reporting |
| C56-05 | LOW | Zero savings shows "0원" without plus sign |
| C62-11/C66-04 | LOW | persistToStorage returns 'corrupted' for non-quota errors -- PARTIALLY FIXED |
| C64-03/C66-05/C67-03 | LOW | CATEGORY_NAMES_KO hardcoded map can drift from YAML taxonomy |
| C66-08/C74-04 | LOW | formatIssuerNameKo and CATEGORY_COLORS hardcoded maps will drift |
| C67-01/C74-06 | MEDIUM | Greedy optimizer O(m*n*k) quadratic behavior |
| C69-01 | LOW | SavingsComparison tiny savings animation flicker (informational) |
| C70-02 | LOW | cachedCategoryLabels not invalidated on Astro View Transitions |
| C70-04 | LOW | csv.ts reimplements shared.ts instead of importing from it |
| C71-05 | LOW | BANK_SIGNATURES array order affects detection accuracy for overlapping patterns |
| C73-01 | LOW | SavingsComparison annual projection stale briefly after reset (cosmetic) |
| C73-04 | LOW | BOM stripping redundancy across parser chain |
| C73-06/C74-03/C75-01 | LOW | XLSX HTML-as-XLS: double-decode overhead remains (prefix dead code fixed) |
| C74-05 | LOW | ALL_BANKS in FileDropzone is 5th copy of bank list needing sync |
| C74-07 | LOW | AbortError vs genuine fetch failure not distinguished in error message |
| C75-02/C76-02 | LOW | FALLBACK_CATEGORIES leading-space labels cause browser-inconsistent dropdown rendering |
| C76-01 | MEDIUM | loadFromStorage migration loop skips pre-versioning data (_v undefined) |
| C76-03 | LOW | SpendingSummary dismissal not reset on store.reset() |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
