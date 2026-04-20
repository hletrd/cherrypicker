# Review Aggregate -- 2026-04-21 (Cycle 50)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-21-cycle50-comprehensive.md` (full re-read of all source files, gate verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-49 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-49 findings are confirmed fixed except as noted below:

| Finding | Status | Evidence |
|---|---|---|
| C53-01 | **FIXED** | `TransactionReview.svelte:131` uses spread-copy `{ ...tx, ... }` + index assignment instead of in-place mutation |
| C53-02 | **FIXED** | Both `index.astro` and `Layout.astro` now use shared `readCardStats()` from `build-stats.ts` |
| C53-03 | **FIXED** | `CardDetail.svelte:217` now has `dark:text-blue-300` on performance tier header |
| D-106 | **FIXED** | `pdf.ts:270-276` no longer uses bare `catch {}` -- now logs diagnostic `console.warn` on structured parse failure |
| C45-01 | **FIXED** | `store.svelte.ts:420-424` early null guard before `result.previousMonthSpendingOption` access |
| C45-02 | **FIXED** | Same early null guard eliminates wasted computation |
| C44-03 | **FIXED** | CardGrid.svelte:125 has `aria-live="polite"` on filter result count |
| C44-01 | **FIXED** | `previousMonthSpendingOption` now stored in `AnalysisResult` and forwarded during `reoptimize()` |
| C43-01 | FIXED | `isOptimizableTx` at `store.svelte.ts:168` uses `obj.amount > 0` |
| C43-02 | FIXED | `analyzer.ts:210` uses `tx.amount` directly |
| C42-01 | FIXED | All parsers now use `amount <= 0` |
| C42-02 | FIXED | `analyzer.ts:290` and `store.svelte.ts:425` use `tx.amount` |
| C7-04 | OPEN (LOW) | TransactionReview $effect re-sync fragile |
| C7-06 | OPEN (LOW) | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07 | OPEN (LOW) | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-11 | OPEN (LOW) | persistWarning message misleading for data corruption vs size truncation |
| C8-05/C4-09 | OPEN (LOW) | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast -- non-utility entries |
| C8-07/C4-14 | OPEN (LOW) | build-stats.ts fallback values will drift |
| C8-08 | OPEN (LOW) | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | OPEN (LOW) | Test duplicates production code instead of testing it directly |
| C18-01/C50-08 | OPEN (LOW) | VisibilityToggle $effect directly mutates DOM |
| C18-02 | OPEN (LOW) | Results page stat elements queried every effect run even on dashboard page |
| C18-03 | OPEN (LOW) | Annual savings projection simply multiplies monthly by 12 without seasonal adjustment |
| C18-04 | OPEN (LOW) | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C19-04 | OPEN (LOW) | FileDropzone navigation uses full page reload |
| C19-05 | OPEN (LOW) | CardDetail navigation uses full page reload |
| C21-02 | OPEN (LOW) | cards.ts shared fetch AbortSignal race |
| C21-04/C23-02/C25-02/C26-03 | OPEN (LOW->MEDIUM) | cachedCategoryLabels/cachedCoreRules invalidated on explicit reset but stale across long-lived tabs |
| C22-04 | OPEN (LOW) | CSV adapter registry only covers 10 of 24 detected banks |
| C33-01 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction -- partially fixed |
| C33-02 | OPEN (MEDIUM) | cachedCategoryLabels stale across redeployments |
| C34-04 | OPEN (LOW) | Server-side PDF has no fallback line scanner |
| C41-04/C42-03/C43-03/C49-03/C50-01 | OPEN (LOW) | CategoryBreakdown maxPercentage initial value 1 |
| C41-05/C42-04 | OPEN (LOW) | cards.ts loadCategories returns empty array on AbortError |
| C49-01 | OPEN (LOW) | `isSubstringSafeKeyword` is dead code superseded by SUBSTRING_SAFE_ENTRIES |
| C49-02 | OPEN (LOW) | `buildCategoryLabelMap` bare subcategory ID shadowing risk (no current collision) |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C50-01 | LOW | HIGH | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:129` | `maxPercentage` initial value 1 distorts small-dataset bars (same as C41-04/C42-03/C43-03/C49-03) |
| C50-02 | LOW | MEDIUM | `apps/web/src/components/dashboard/SavingsComparison.svelte:108` | `savingsPct` returns numeric `Infinity` instead of string sentinel -- could confuse screen readers |
| C50-03 | LOW | HIGH | `apps/web/src/lib/cards.ts:280-307` | `getCardById` O(n) linear scan (same as D-111) |
| C50-04 | LOW | MEDIUM | `apps/web/src/lib/parser/csv.ts:38-74` | `parseAmount`/`isValidAmount` split is conceptually confusing but well-documented -- no code change needed |
| C50-05 | LOW | HIGH | `apps/web/src/components/dashboard/SavingsComparison.svelte:24-45` | `cardBreakdown` re-derives from assignments instead of using `cardResults` -- redundant computation |
| C50-06 | LOW | HIGH | `apps/web/src/lib/formatters.ts:5-10` | `formatWon` uses minus sign for negatives instead of Korean banking convention (parentheses) |
| C50-07 | LOW | MEDIUM | `apps/web/src/lib/parser/xlsx.ts:282-293` | XLSX parser returns first sheet with transactions, not the one with the most |
| C50-08 | LOW | HIGH | `apps/web/src/components/ui/VisibilityToggle.svelte` | $effect directly mutates DOM (same as C18-01, still open) |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

The following findings have been flagged by multiple cycles, indicating high signal:

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| CategoryBreakdown maxPercentage=1 | C41, C42, C43, C49, C50 | OPEN (LOW) -- 5 cycles agree |
| VisibilityToggle DOM mutation | C18, C50 | OPEN (LOW) -- 2 cycles agree |
| getCardById O(n) | C3 (D-111), C50 | OPEN (LOW) -- 2 cycles agree |
| cardBreakdown redundant derivation | C6 (D-53), C50 | OPEN (LOW) -- 2 cycles agree |
| MerchantMatcher O(n) scan | C16 (D-100), C33, C50 | OPEN (MEDIUM) -- 3 cycles agree |
| cachedCategoryLabels staleness | C21, C23, C25, C26, C33 | OPEN (MEDIUM) -- 5 cycles agree |

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02/D-40/D-82/C9R-04/C18-03/C39-06 | LOW | Annual savings projection label unchanged / visual inconsistency |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13/C9-08/D-43/D-74 | LOW | Small-percentage bars nearly invisible |
| C20-02/C25-03 | LOW | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04/C25-10 | LOW | pdf.ts module-level regex constants divergence risk with date-utils.ts |
| C34-04 | LOW | Server-side PDF has no fallback line scanner |
| D-01 through D-111 | Various | See deferred items file for full list |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
