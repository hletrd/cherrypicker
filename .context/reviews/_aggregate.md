# Review Aggregate -- 2026-04-21 (Cycle 44)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-21-cycle44-comprehensive.md` (full re-read of all source files, gate verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-43 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-43 findings are confirmed fixed except as noted below:

| Finding | Status | Evidence |
|---|---|---|
| C43-01 | FIXED | `isOptimizableTx` at `store.svelte.ts:168` now uses `obj.amount > 0` |
| C43-02 | FIXED | `analyzer.ts:210` now uses `tx.amount` directly (not `Math.abs(tx.amount)`) |
| C42-01 | FIXED | All parsers now use `amount <= 0`: web-side PDF, CSV, XLSX, all 10 server-side CSV adapters, server-side generic |
| C42-02 | FIXED | `analyzer.ts:290` and `store.svelte.ts:425` now use `tx.amount` instead of `Math.abs(tx.amount)` |
| C53-01 | FIXED | `TransactionReview.svelte:131` now uses `editedTxs[idx] = updated` (spread-copy + index assignment) |
| C53-03 | FIXED | `CardDetail.svelte:217` now has `dark:text-blue-300` on performance tier header row |
| C7-04 | OPEN (LOW) | TransactionReview $effect re-sync fragile -- no change since cycle 7 |
| C7-06 | OPEN (LOW) | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07 | OPEN (LOW) | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-11 | OPEN (LOW) | persistWarning message misleading for data corruption vs size truncation |
| C8-05/C4-09 | OPEN (LOW) | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast -- ONLY for non-utility entries now; utility entries fixed via C29-01 |
| C8-07/C4-14 | OPEN (LOW) | build-stats.ts fallback values will drift |
| C8-08 | OPEN (LOW) | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | OPEN (LOW) | Test duplicates production code instead of testing it directly |
| C18-01 | OPEN (LOW) | VisibilityToggle $effect directly mutates DOM; now uses cached refs with isConnected check (C21-01 fix) but pattern remains fragile |
| C18-02 | OPEN (LOW) | Results page stat elements queried every effect run even on dashboard page |
| C18-03 | OPEN (LOW) | Annual savings projection simply multiplies monthly by 12 without seasonal adjustment |
| C18-04 | OPEN (LOW) | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C19-04 | OPEN (LOW) | FileDropzone navigation uses full page reload (deferred: requires ClientRouter) |
| C19-05 | OPEN (LOW) | CardDetail navigation uses full page reload (deferred: requires ClientRouter) |
| C21-02 | OPEN (LOW) | cards.ts shared fetch AbortSignal race (deferred) |
| C21-04/C23-02/C25-02/C26-03 | OPEN (LOW->MEDIUM) | cachedCategoryLabels/cachedCoreRules invalidated on explicit reset but stale across long-lived tabs |
| C22-04 | OPEN (LOW) | CSV adapter registry only covers 10 of 24 detected banks |
| C33-01 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction -- partially fixed with SUBSTRING_SAFE_ENTRIES |
| C33-02 | OPEN (MEDIUM) | cachedCategoryLabels stale across redeployments |
| C34-04 | OPEN (LOW) | Server-side PDF has no fallback line scanner -- architectural gap |
| C41-04/C42-03/C43-03 | OPEN (LOW) | CategoryBreakdown maxPercentage initial value 1 -- theoretical edge case |
| C41-05/C42-04 | OPEN (LOW) | cards.ts loadCategories returns empty array on AbortError -- reasonable fallback |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | Description | File+line |
|---|---|---|---|---|
| C44-01 | LOW | Medium | `reoptimize` does not forward original `previousMonthSpending` option -- manual input silently dropped after category edit | `apps/web/src/lib/store.svelte.ts:400` |
| C44-03 | LOW | Medium | Card filter result count changes lack ARIA live region for screen reader announcement | `apps/web/src/components/cards/CardGrid.svelte` |

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
