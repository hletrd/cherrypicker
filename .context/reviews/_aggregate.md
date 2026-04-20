# Review Aggregate -- 2026-04-21 (Cycle 40)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-21-cycle40-comprehensive.md` (full re-read of all source files, gate verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-39 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-39 findings are confirmed fixed except as noted below:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview $effect re-sync fragile -- no change since cycle 7 |
| C7-06 | OPEN (LOW) | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07 | OPEN (LOW) | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-11 | OPEN (LOW) | persistWarning message misleading for data corruption vs size truncation |
| C8-05/C4-09 | OPEN (LOW) | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast -- ONLY for non-utility entries now; utility entries fixed via C29-01 |
| C8-07/C4-14 | OPEN (LOW) | build-stats.ts fallback values will drift |
| C8-08 | OPEN (LOW) | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | OPEN (LOW) | Test duplicates production code instead of testing it directly |
| C18-01 | OPEN (MEDIUM) | VisibilityToggle $effect directly mutates DOM; now uses cached refs with isConnected check (C21-01 fix) but pattern remains fragile |
| C18-02 | OPEN (LOW) | Results page stat elements queried every effect run even on dashboard page |
| C18-03 | OPEN (LOW) | Annual savings projection simply multiplies monthly by 12 without seasonal adjustment |
| C18-04 | OPEN (LOW) | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C19-04 | OPEN (LOW) | FileDropzone navigation uses full page reload (deferred: requires ClientRouter) |
| C19-05 | OPEN (LOW) | CardDetail navigation uses full page reload (deferred: requires ClientRouter) |
| C21-02 | OPEN (LOW) | cards.ts shared fetch AbortSignal race (deferred) |
| C21-04/C23-02/C25-02/C26-03 | OPEN (LOW->MEDIUM) | cachedCategoryLabels/cachedCoreRules invalidated on explicit reset but stale across long-lived tabs |
| C22-04 | OPEN (LOW) | CSV adapter registry only covers 10 of 24 detected banks |
| C22-05/C39-02 | FIXED | TransactionReview changeCategory now uses O(1) index mutation instead of O(n) array copy |
| C33-01 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction -- partially fixed with SUBSTRING_SAFE_ENTRIES |
| C33-02 | OPEN (MEDIUM) | cachedCategoryLabels stale across redeployments |
| C34-04 | OPEN (LOW) | Server-side PDF has no fallback line scanner -- architectural gap |
| C39-01 | FIXED | vitest gate now passes: 8 test files, 189 tests |
| C39-03 | FIXED | Web-side parseFile now adds encoding quality warning when bestReplacements > 50 |
| C39-05 | FIXED | FileDropzone addFiles now adds valid files first, then checks total size |
| C39-04 | OPEN (LOW) | CategoryBreakdown maxPercentage initial value 1 -- theoretical edge case |
| C39-06 | OPEN (LOW) | SavingsComparison annual projection jumps while monthly savings animates -- NOW EXTENDED by C40-01 |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | Description | File+line |
|---|---|---|---|---|
| C40-01 | MEDIUM | High | SavingsComparison annual projection uses animated `displayedSavings` instead of actual `opt.savingsVsSingleCard` — shows 0원 on mount during animation | `apps/web/src/components/dashboard/SavingsComparison.svelte:218` |
| C40-02 | LOW | High | TransactionReview changeCategory index mutation lacks explanatory comment for future maintainers | `apps/web/src/components/dashboard/TransactionReview.svelte:128` |
| C40-03 | LOW | High | formatDateKo/formatDateShort redundant parseInt validation (defensive but unnecessary for validated input) | `apps/web/src/lib/formatters.ts:153,169` |
| C40-04 | LOW | High | buildCardResults totalSpending uses raw tx.amount without explicit positive-amount documentation | `packages/core/src/optimizer/greedy.ts:226` |

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
