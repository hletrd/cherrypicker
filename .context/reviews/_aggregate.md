# Review Aggregate -- 2026-04-22 (Cycle 74)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-22-cycle74-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-73 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-73 findings are confirmed fixed except as noted below.

| Finding | Status | Evidence |
|---|---|---|
| C72-01 | **FIXED** | `handleRetry()` now clears `navigateTimeout` at line 266. |
| C72-02 | **FIXED** | `optimizeFromTransactions()` guards `transformed.length > 0` before caching (lines 189-191). |
| C72-03 | **FIXED** | `getCategoryLabels()` guards `nodes.length > 0` before caching (lines 341-343). |
| C72-04 | **FIXED** | `addFiles()` now accumulates all error types into `errorParts[]` (lines 162-175). |
| C72-05 | **FIXED** | `loadCardsData()` and `loadCategories()` both retry on undefined/aborted promise (lines 237-240, 276-278). |
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
| C74-01 | LOW | HIGH | `apps/web/src/components/dashboard/TransactionReview.svelte:76` | `categoryMap` fallback (FALLBACK_CATEGORIES) lacks dot-notation subcategory keys, so subcategory label search fails when categories.json fetch fails. Rare edge case. |
| C74-02 | LOW | MEDIUM | `apps/web/src/lib/store.svelte.ts:271` | `loadFromStorage` removes sessionStorage on ANY malformed data without migration path or version check. Version-breaking schema changes cause silent data loss. |
| C74-03 | LOW | HIGH | `apps/web/src/lib/parser/xlsx.ts:283-287` | Re-confirmation of C73-06: HTML-as-XLS files decoded twice (isHTMLContent + main path). Minor memory overhead bounded by 10MB limit. |
| C74-04 | LOW | HIGH | `apps/web/src/lib/formatters.ts:51-78,115-143` | Re-confirmation of C66-08: `formatIssuerNameKo` and `getIssuerColor` hardcoded maps will drift from BANK_SIGNATURES. Currently in sync. |
| C74-05 | LOW | MEDIUM | `apps/web/src/components/upload/FileDropzone.svelte:80-105` | `ALL_BANKS` array is yet another copy of the bank list (5th location) that must sync with BANK_SIGNATURES, formatters, and xlsx BANK_COLUMN_CONFIGS. |
| C74-06 | LOW | MEDIUM | `packages/core/src/optimizer/greedy.ts:329-340` | `bestSingleCard` calculation redundantly calls `calculateCardOutput` for cards already computed in `buildCardResults`. Constant-factor (2x) overhead on already-quadratic algorithm. |
| C74-07 | LOW | HIGH | `apps/web/src/lib/cards.ts:281` + `apps/web/src/lib/analyzer.ts:271-273` | Error message "카테고리 데이터를 불러올 수 없어요" does not distinguish abort-from-navigation vs genuine fetch failure. |
| C74-08 | LOW | MEDIUM | `apps/web/src/lib/parser/csv.ts:910-921` | Re-confirmation of C22-04: CSV adapter registry covers 10 of 24 banks; remaining 14 fall to generic parser. Intentional design tradeoff. |
| C74-09 | LOW | HIGH | `apps/web/src/lib/store.svelte.ts:127-171` | `persistToStorage` does not validate per-field sizes before serialization. Bounded by practical data sizes. |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16-C74 | OPEN (MEDIUM) -- 14 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21-C74 | OPEN (MEDIUM) -- 17 cycles agree |
| persistToStorage bare catch / error handling | C62-C74 | PARTIALLY FIXED (C69 added 'error' kind) |
| Annual savings simple *12 projection | C7-C74 | OPEN (LOW) -- 13 cycles agree |
| date-utils unparseable passthrough | C56-C74 | PARTIALLY FIXED (C70 added warn) |
| CSV DATE_PATTERNS divergence risk | C20-C74 | OPEN (LOW) -- 12 cycles agree |
| Hardcoded fallback drift | C8-C74 | OPEN (LOW) -- 10 cycles agree |
| BANK_SIGNATURES duplication | C7-C74 | OPEN (LOW) -- 9 cycles agree |
| inferYear() timezone dependence | C8-C74 | OPEN (LOW) -- 7 cycles agree (60+ cycles deferred) |
| Greedy optimizer O(m*n*k) quadratic | C67-C74 | OPEN (MEDIUM) -- 7 cycles agree |
| CATEGORY_COLORS dark mode contrast | C4-C74 | OPEN (LOW) -- many cycles agree |
| Multi-location bank data sync | C74 | NEW (LOW) -- first cycle noting all 5 locations |
| BOM handling redundancy | C73-C74 | OPEN (LOW) -- 2 cycles |
| TransactionReview orphaned fetch | C73 | **FIXED** (C73-02 / C74 verified AbortController) |
| XLSX HTML-as-XLS double decode | C73-C74 | OPEN (LOW) -- 2 cycles |

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
| C73-06/C74-03 | LOW | XLSX HTML-as-XLS double memory for re-encoded buffer |
| C74-01 | LOW | TransactionReview categoryMap fallback lacks dot-notation subcategory keys |
| C74-02 | LOW | loadFromStorage removes sessionStorage on any malformed data without migration |
| C74-05 | LOW | ALL_BANKS in FileDropzone is 5th copy of bank list needing sync |
| C74-07 | LOW | AbortError vs genuine fetch failure not distinguished in error message |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
