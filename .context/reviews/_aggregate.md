# Review Aggregate -- 2026-04-21 (Cycle 72)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-21-cycle72-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-71 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-71 findings are confirmed fixed except as noted below.

| Finding | Status | Evidence |
|---|---|---|
| C71-01 | **FIXED** | `clearAllFiles()` and `removeFile()` (when last file) now reset `bank` and `previousSpending`. |
| C71-02 | **FIXED** | `analyzeMultipleFiles` and `parseAndCategorize` guard `categoryNodes.length === 0` and throw. |
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
| C66-02 | OPEN (MEDIUM) | `cachedCategoryLabels` stale across redeployments. 14+ cycles agree. |
| C66-03 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction. 11+ cycles agree. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C72-01 | MEDIUM | HIGH | `apps/web/src/components/upload/FileDropzone.svelte:259-262` | `handleRetry()` doesn't clear `navigateTimeout`, causing unexpected dashboard navigation if retry is clicked within 1200ms of success. |
| C72-02 | MEDIUM | HIGH | `apps/web/src/lib/analyzer.ts:181-184` | `cachedCoreRules` is permanently set to `[]` when `getAllCardRules()` returns empty on AbortError. All subsequent optimizations produce 0 rewards until manual reset. |
| C72-03 | LOW | MEDIUM | `apps/web/src/lib/store.svelte.ts:332-337` | `getCategoryLabels()` caches empty Map on AbortError, causing all subsequent reoptimizations to show raw English keys instead of Korean labels. |
| C72-04 | LOW | HIGH | `apps/web/src/components/upload/FileDropzone.svelte:160-169` | `addFiles()` shows only the first error category when multiple error types occur (oversized, invalid format, duplicate). User must retry multiple times to discover all issues. |
| C72-05 | LOW | MEDIUM | `apps/web/src/lib/cards.ts:193-233` | `loadCategories()`/`loadCardsData()` have an AbortController race: when an in-flight fetch is aborted and a new one starts, the second caller awaiting the old promise receives `[]` instead of the new fetch result. |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16-C72 | OPEN (MEDIUM) -- 12 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21-C72 | OPEN (MEDIUM) -- 15 cycles agree |
| persistToStorage bare catch / error handling | C62-C72 | PARTIALLY FIXED (C69 added 'error' kind) |
| Annual savings simple *12 projection | C7-C72 | OPEN (LOW) -- 11 cycles agree |
| date-utils unparseable passthrough | C56-C72 | PARTIALLY FIXED (C70 added warn) |
| CSV DATE_PATTERNS divergence risk | C20-C72 | OPEN (LOW) -- 10 cycles agree |
| Hardcoded fallback drift | C8-C72 | OPEN (LOW) -- 8 cycles agree |
| BANK_SIGNATURES duplication | C7-C72 | OPEN (LOW) -- 7 cycles agree |
| inferYear() timezone dependence | C8-C72 | OPEN (LOW) -- 5 cycles agree (60+ cycles deferred) |
| Greedy optimizer O(m*n*k) quadratic | C67-C72 | OPEN (MEDIUM) -- 5 cycles agree |
| AbortError cache poisoning | C72 | NEW (MEDIUM) -- first cycle, cross-file pattern |

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
| C8-05/C4-09 | LOW | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast |
| C8-07/C4-14/C66-07 | LOW | build-stats.ts fallback values will drift |
| C8-08/C67-02 | LOW | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | LOW | Test duplicates production code instead of testing it directly |
| C18-01/C50-08 | LOW | VisibilityToggle $effect directly mutates DOM |
| C18-02 | LOW | Results page stat elements queried every effect run even on dashboard page |
| C18-04 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C20-02/C25-03 | LOW | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04/C25-10 | LOW | pdf.ts module-level regex constants divergence risk with date-utils.ts |
| C21-02 | LOW | cards.ts shared fetch AbortSignal race |
| C22-04 | LOW | CSV adapter registry only covers 10 of 24 detected banks |
| C33-01/C66-03 | MEDIUM | MerchantMatcher substring scan O(n) per transaction |
| C33-02/C66-02 | MEDIUM | cachedCategoryLabels stale across redeployments |
| C41-05/C42-04/C71-02 | MEDIUM | loadCategories returns empty array on AbortError -- silently wrong results -- NOW PARTIALLY FIXED by C71-02 guard |
| C56-04/C70-03/C71-04 | LOW | date-utils.ts returns raw input for unparseable dates without error reporting |
| C56-05 | LOW | Zero savings shows "0원" without plus sign |
| C62-11/C66-04 | LOW | persistToStorage returns 'corrupted' for non-quota errors -- PARTIALLY FIXED |
| C64-03/C66-05/C67-03 | LOW | CATEGORY_NAMES_KO hardcoded map can drift from YAML taxonomy |
| C66-08 | LOW | formatIssuerNameKo and CATEGORY_COLORS hardcoded maps will drift |
| C67-01 | MEDIUM | Greedy optimizer O(m*n*k) quadratic behavior |
| C69-01 | LOW | SavingsComparison tiny savings animation flicker (informational) |
| C70-02 | LOW | cachedCategoryLabels not invalidated on Astro View Transitions |
| C70-04 | LOW | csv.ts reimplements shared.ts instead of importing from it |
| C71-05 | LOW | BANK_SIGNATURES array order affects detection accuracy for overlapping patterns |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
