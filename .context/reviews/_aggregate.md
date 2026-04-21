# Review Aggregate -- 2026-04-22 (Cycle 79)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-22-cycle79-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-78 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-78 findings are confirmed fixed except as noted below.

| Finding | Status | Evidence |
|---|---|---|
| C78-01 | **FIXED** | `SpendingSummary.svelte` lines 13-20: `$effect` resets `dismissed = false` when generation changes. `clearStorage()` line 338 also removes `cherrypicker:dismissed-warning` from sessionStorage. |
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
| C66-02 | OPEN (MEDIUM) | `cachedCategoryLabels` stale across redeployments. 18+ cycles agree. |
| C66-03 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction. 15+ cycles agree. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C79-01 | MEDIUM | MEDIUM | `apps/web/src/components/dashboard/TransactionReview.svelte:172-195` | `changeCategory()` does not clear `rawCategory` when user manually changes category. The stale `rawCategory` (bank-provided category string) no longer matches the new category/subcategory assignment. Currently unused by optimizer, but persists in sessionStorage and could mislead future code. |
| C79-02 | LOW | HIGH | `apps/web/src/components/ui/VisibilityToggle.svelte:70-126` | `$effect` directly mutates DOM classList and textContent instead of using Svelte reactive bindings. Known issue (C18-01/C50-08/C76-04). Functional but non-idiomatic. |
| C79-03 | LOW | MEDIUM | `apps/web/src/components/dashboard/SavingsComparison.svelte:43-76` | `displayedAnnualSavings` initializes to 0, causing brief "0원" flash before count-up animation starts. Known cosmetic issue (C69-01/C73-01). |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16-C79 | OPEN (MEDIUM) -- 19 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21-C79 | OPEN (MEDIUM) -- 22 cycles agree |
| persistToStorage bare catch / error handling | C62-C79 | PARTIALLY FIXED (C69 added 'error' kind) |
| Annual savings simple *12 projection | C7-C79 | OPEN (LOW) -- 18 cycles agree |
| date-utils unparseable passthrough | C56-C79 | PARTIALLY FIXED (C70 added warn) |
| CSV DATE_PATTERNS divergence risk | C20-C79 | OPEN (LOW) -- 17 cycles agree |
| Hardcoded fallback drift | C8-C79 | OPEN (LOW) -- 15 cycles agree (C76-05) |
| BANK_SIGNATURES duplication | C7-C79 | OPEN (LOW) -- 14 cycles agree |
| inferYear() timezone dependence | C8-C79 | OPEN (LOW) -- 12 cycles agree (60+ cycles deferred) |
| Greedy optimizer O(m*n*k) quadratic | C67-C79 | OPEN (MEDIUM) -- 12 cycles agree |
| CATEGORY_COLORS dark mode contrast | C4-C79 | OPEN (LOW) -- many cycles agree |
| Multi-location bank data sync | C74-C79 | OPEN (LOW) -- 6 cycles noting all 5+ locations |
| BOM handling redundancy | C73-C79 | OPEN (LOW) -- 7 cycles |
| XLSX HTML-as-XLS double decode | C73-C79 | OPEN (LOW) -- 7 cycles (C75-01 simplified to boolean) |
| FALLBACK_CATEGORIES incomplete subcategory coverage | C75-C79 | FIXED (C75-02 added missing entries) |
| loadFromStorage version check lacks migration | C75-C79 | FIXED (C75-03 added framework; C76-01 fixed undefined-_v gap) |
| VisibilityToggle direct DOM mutation | C18-C79 | OPEN (LOW) -- many cycles agree (C76-04/C79-02) |
| Generic CSV header detection can misidentify metadata rows | C77-C79 | FIXED (C77-03 added keyword validation; C78-03 defaults to -1) |
| SpendingSummary dismissed not reset on store.reset() | C76-C79 | FIXED (C78-01 added generation-based reset + clearStorage cleanup) |
| TransactionReview changeCategory stale rawCategory | C79 | NEW (MEDIUM) |

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
| C18-01/C50-08/C76-04/C79-02 | LOW | VisibilityToggle $effect directly mutates DOM |
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
| C66-08/C74-04/C77-04 | LOW | formatIssuerNameKo and CATEGORY_COLORS hardcoded maps will drift |
| C67-01/C74-06 | MEDIUM | Greedy optimizer O(m*n*k) quadratic behavior |
| C69-01/C73-01/C79-03 | LOW | SavingsComparison tiny savings animation flicker (informational) |
| C70-02 | LOW | cachedCategoryLabels not invalidated on Astro View Transitions |
| C70-04 | LOW | csv.ts reimplements shared.ts instead of importing from it |
| C71-05 | LOW | BANK_SIGNATURES array order affects detection accuracy for overlapping patterns |
| C73-04 | LOW | BOM stripping redundancy across parser chain |
| C73-06/C74-03/C75-01 | LOW | XLSX HTML-as-XLS: double-decode overhead remains (prefix dead code fixed) |
| C74-05 | LOW | ALL_BANKS in FileDropzone is 5th copy of bank list needing sync |
| C74-07 | LOW | AbortError vs genuine fetch failure not distinguished in error message |
| C75-02/C76-02/C78-02 | LOW | FALLBACK_CATEGORIES leading-space labels cause browser-inconsistent dropdown rendering |
| C76-03/C78-01 | FIXED | SpendingSummary dismissal not reset on store.reset() -- NOW FIXED |
| C77-02 | LOW | Annual savings projection uses simple *12 multiplication (labeled transparently) |
| C78-03 | FIXED | parseGenericCSV defaults headerIdx=0 when no header keywords found -- NOW FIXED (defaults to -1) |
| C79-01 | MEDIUM | TransactionReview changeCategory does not clear stale rawCategory on manual override |
| C79-02 | LOW | VisibilityToggle $effect directly mutates DOM (same as C18-01/C76-04) |
| C79-03 | LOW | SavingsComparison annual savings 0 flash before animation (same as C69-01/C73-01) |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
