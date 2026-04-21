# Review Aggregate -- 2026-04-22 (Cycle 75)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-22-cycle75-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-74 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-74 findings are confirmed fixed except as noted below.

| Finding | Status | Evidence |
|---|---|---|
| C74-01 | **FIXED** | `FALLBACK_CATEGORIES` now includes 25 dot-notation subcategory entries. |
| C74-02 | **FIXED** | `STORAGE_VERSION = 1`; `persistToStorage` writes `_v`; `loadFromStorage` checks version and warns on mismatch. |
| C74-03 | **FIXED** | `isHTMLContent` refactored to `checkHTMLContent` returning `{ isHTML, prefix }`. |
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
| C66-02 | OPEN (MEDIUM) | `cachedCategoryLabels` stale across redeployments. 16+ cycles agree. |
| C66-03 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction. 13+ cycles agree. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C75-01 | LOW | HIGH | `apps/web/src/lib/parser/xlsx.ts:262-297` | `checkHTMLContent` returns `prefix` but the caller does not use it to avoid re-decoding. The C74-03 refactor added the return field but the caller was not updated to consume it. The `prefix` is computed but dead. Full buffer is still decoded unconditionally. |
| C75-02 | LOW | HIGH | `apps/web/src/components/dashboard/TransactionReview.svelte:16-57` | `FALLBACK_CATEGORIES` does not include all subcategories present in the YAML taxonomy. Missing entries: `offline_shopping.department_store`, `grocery.traditional_market`, `grocery.online_grocery`, `insurance.*`, and others. The 25 dot-notation entries cover the most common subcategories. |
| C75-03 | LOW | MEDIUM | `apps/web/src/lib/store.svelte.ts:219-225` | `loadFromStorage` version check warns but does not attempt migration. If a future schema adds a required field, old data would pass current validation but components accessing the new field would get `undefined`. Foundation is correct for v1 but migration logic is needed when the schema actually changes. |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16-C75 | OPEN (MEDIUM) -- 15 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21-C75 | OPEN (MEDIUM) -- 18 cycles agree |
| persistToStorage bare catch / error handling | C62-C75 | PARTIALLY FIXED (C69 added 'error' kind) |
| Annual savings simple *12 projection | C7-C75 | OPEN (LOW) -- 14 cycles agree |
| date-utils unparseable passthrough | C56-C75 | PARTIALLY FIXED (C70 added warn) |
| CSV DATE_PATTERNS divergence risk | C20-C75 | OPEN (LOW) -- 13 cycles agree |
| Hardcoded fallback drift | C8-C75 | OPEN (LOW) -- 11 cycles agree |
| BANK_SIGNATURES duplication | C7-C75 | OPEN (LOW) -- 10 cycles agree |
| inferYear() timezone dependence | C8-C75 | OPEN (LOW) -- 8 cycles agree (60+ cycles deferred) |
| Greedy optimizer O(m*n*k) quadratic | C67-C75 | OPEN (MEDIUM) -- 8 cycles agree |
| CATEGORY_COLORS dark mode contrast | C4-C75 | OPEN (LOW) -- many cycles agree |
| Multi-location bank data sync | C74-C75 | OPEN (LOW) -- 2 cycles noting all 5 locations |
| BOM handling redundancy | C73-C75 | OPEN (LOW) -- 3 cycles |
| XLSX HTML-as-XLS double decode | C73-C75 | OPEN (LOW) -- 3 cycles (C75-01 refines: prefix dead code) |
| FALLBACK_CATEGORIES incomplete subcategory coverage | C75 | NEW (LOW) -- first cycle noting incompleteness |
| loadFromStorage version check lacks migration | C75 | NEW (LOW) -- first cycle noting this gap |

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
| C8-07/C4-14/C66-07 | LOW | build-stats.ts fallback values will drift |
| C8-08/C67-02 | LOW | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | LOW | Test duplicates production code instead of testing it directly |
| C18-01/C50-08 | LOW | VisibilityToggle $effect directly mutates DOM |
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
| C73-06/C74-03/C75-01 | LOW | XLSX HTML-as-XLS: checkHTMLContent returns unused prefix; full buffer still decoded twice |
| C74-01/C75-02 | LOW | TransactionReview FALLBACK_CATEGORIES incomplete subcategory coverage |
| C74-02/C75-03 | LOW | loadFromStorage version check lacks migration path for future schema changes |
| C74-05 | LOW | ALL_BANKS in FileDropzone is 5th copy of bank list needing sync |
| C74-07 | LOW | AbortError vs genuine fetch failure not distinguished in error message |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
