# Review Aggregate -- 2026-04-22 (Cycle 73)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-22-cycle73-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-72 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-72 findings are confirmed fixed except as noted below.

| Finding | Status | Evidence |
|---|---|---|
| C72-01 | **FIXED** | `handleRetry()` now clears `navigateTimeout` at line 266. |
| C72-02 | **FIXED** | `optimizeFromTransactions()` guards `transformed.length > 0` before caching (lines 189-191). |
| C72-03 | **FIXED** | `getCategoryLabels()` guards `nodes.length > 0` before caching (lines 341-343). |
| C72-04 | **FIXED** | `addFiles()` now accumulates all error types into `errorParts[]` (lines 162-175). |
| C72-05 | **FIXED** | `loadCardsData()` and `loadCategories()` both retry on undefined/aborted promise (lines 237-240, 276-278). |
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

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C73-01 | LOW | HIGH | `apps/web/src/components/dashboard/SavingsComparison.svelte:46-76` | Annual projection animation state (`displayedAnnualSavings`) may be stale briefly after store reset, but hidden by conditional rendering. Cosmetic only. |
| C73-02 | LOW | MEDIUM | `apps/web/src/components/dashboard/TransactionReview.svelte:43-69` | `onMount` calls `loadCategories()` without AbortSignal, allowing orphaned fetch on unmount. No cache-poisoning risk (no signal = no AbortError return), but wastes network resources. |
| C73-03 | LOW | HIGH | `apps/web/src/components/report/ReportContent.svelte:48` | Sign-prefix pattern inconsistency with SavingsComparison.svelte -- no `Math.abs(...) >= 1` guard, but unnecessary since ReportContent shows final (not animated) values. |
| C73-04 | LOW | MEDIUM | `apps/web/src/lib/parser/index.ts:17-47` + `csv.ts:928,134` | BOM stripping happens redundantly up to 3 times (TextDecoder, parseCSV, parseGenericCSV). Harmless but unclear responsibility. |
| C73-05 | N/A | N/A | `apps/web/src/components/upload/FileDropzone.svelte:229-263` | NOT A BUG -- verified handleUpload/uploadStatus state machine correctly prevents stale navigateTimeout. |
| C73-06 | LOW | MEDIUM | `apps/web/src/lib/parser/xlsx.ts:283-287` | HTML-as-XLS files decoded then re-encoded, doubling memory for large files. Bounded by 10MB file limit (~20MB total). |
| C73-07 | LOW | HIGH | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-49` | CATEGORY_COLORS dark mode contrast issue persists (re-confirmation of C8-05/C4-09). |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16-C73 | OPEN (MEDIUM) -- 13 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21-C73 | OPEN (MEDIUM) -- 16 cycles agree |
| persistToStorage bare catch / error handling | C62-C73 | PARTIALLY FIXED (C69 added 'error' kind) |
| Annual savings simple *12 projection | C7-C73 | OPEN (LOW) -- 12 cycles agree |
| date-utils unparseable passthrough | C56-C73 | PARTIALLY FIXED (C70 added warn) |
| CSV DATE_PATTERNS divergence risk | C20-C73 | OPEN (LOW) -- 11 cycles agree |
| Hardcoded fallback drift | C8-C73 | OPEN (LOW) -- 9 cycles agree |
| BANK_SIGNATURES duplication | C7-C73 | OPEN (LOW) -- 8 cycles agree |
| inferYear() timezone dependence | C8-C73 | OPEN (LOW) -- 6 cycles agree (60+ cycles deferred) |
| Greedy optimizer O(m*n*k) quadratic | C67-C73 | OPEN (MEDIUM) -- 6 cycles agree |
| CATEGORY_COLORS dark mode contrast | C4-C73 | OPEN (LOW) -- many cycles agree |
| BOM handling redundancy | C73 | NEW (LOW) -- first cycle |
| TransactionReview orphaned fetch | C73 | NEW (LOW) -- first cycle |

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
| C73-01 | LOW | SavingsComparison annual projection stale briefly after reset (cosmetic) |
| C73-02 | LOW | TransactionReview loadCategories() without AbortSignal |
| C73-04 | LOW | BOM stripping redundancy across parser chain |
| C73-06 | LOW | XLSX HTML-as-XLS double memory for re-encoded buffer |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
