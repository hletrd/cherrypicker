# Review Aggregate -- 2026-04-21 (Cycle 26)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-21-cycle26-comprehensive.md` (full re-read of all source files, re-verified all prior findings)

**Prior cycle reviews (still relevant):**
- All cycle 1-25 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-25 findings are confirmed fixed except as noted below:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview $effect re-sync fragile -- no change since cycle 7 |
| C7-06 | OPEN (LOW) | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07 | OPEN (LOW) | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-11 | OPEN (LOW) | persistWarning message misleading for data corruption vs size truncation |
| C8-01 | **FIXED** | categorizer-ai.ts removed entirely; TransactionReview no longer imports it |
| C8-05/C4-09 | OPEN (LOW→MEDIUM) | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast (re-elevated: water/gas nearly invisible) |
| C8-07/C4-14 | OPEN (LOW) | build-stats.ts fallback values will drift |
| C8-08 | OPEN (LOW) | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | OPEN (LOW) | Test duplicates production code instead of testing it directly |
| C18-01 | OPEN (MEDIUM) | VisibilityToggle $effect directly mutates DOM; now uses cached refs with isConnected check (C21-01 fix) but pattern remains fragile |
| C18-02 | OPEN (LOW) | Results page stat elements queried every effect run even on dashboard page |
| C18-03 | OPEN (LOW) | Annual savings projection simply multiplies monthly by 12 without seasonal adjustment |
| C18-04 | OPEN (LOW) | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C19-04 | OPEN (LOW) | FileDropzone navigation uses full page reload (deferred: requires ClientRouter) |
| C19-05 | OPEN (LOW) | CardDetail navigation uses full page reload (deferred: requires ClientRouter) |
| C21-01 | OPEN (MEDIUM) | VisibilityToggle $effect caches elements with isConnected check (C21 fix), but getElementById pattern remains fragile |
| C21-02 | OPEN (LOW) | cards.ts shared fetch AbortSignal race (deferred) |
| C21-04 | OPEN (LOW→MEDIUM) | cachedCategoryLabels never invalidated (deferred) |
| C22-04 | OPEN (LOW) | CSV adapter registry only covers 10 of 24 detected banks (deferred) |
| C22-05 | OPEN (LOW) | TransactionReview changeCategory O(n) array copy (deferred) |
| C23-02 | OPEN (LOW→MEDIUM) | `analyzer.ts:47` cachedCoreRules never invalidated -- same class as C21-04 |
| C24-06 | OPEN (LOW) | buildCardResults totalSpending no negative amount guard (safe in practice) |
| C25-01 | OPEN (MEDIUM) | CATEGORY_COLORS poor dark mode contrast: water/gas/electricity nearly invisible on dark backgrounds |
| C25-02 | OPEN (MEDIUM) | cachedCoreRules never invalidated across sessions |
| C25-06/D-106 | **FIXED** | pdf.ts now logs `console.warn` inside catch block for structured parse failure |
| C25-09 | OPEN (MEDIUM) | CardDetail performance tier header dark mode contrast |
| C22-02 | **FIXED** | SavingsComparison count-up animation respects prefers-reduced-motion (JS check + global CSS rule) |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C26-01 | LOW | Medium | `SpendingSummary.svelte:147` | Inline `catch {}` in template event handler (dismiss button) -- inconsistent with C24-02 fix pattern that added console.warn for sessionStorage failures |
| C26-02 | LOW | High | `csv.ts:101-210` | parseGenericCSV does not skip zero-amount rows, unlike the PDF parser which explicitly skips them. Zero-amount rows (balance inquiries, declined transactions) appear in the transaction list but don't contribute to optimization. |
| C26-03 | LOW | Medium | `analyzer.ts:166-170` | cachedCoreRules is never reset when store.reset() is called, unlike cachedCategoryLabels which is cleared. Same class as C21-04/C23-02/C25-02. |

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02/D-40/D-82/C9R-04 | LOW | Annual savings projection label unchanged |
| C4-09/C52-05/D-42/D-46/D-64/D-78/C8-05/C25-01 | MEDIUM | Hardcoded CATEGORY_COLORS in CategoryBreakdown (dark mode contrast -- water/gas invisible) |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13/C9-08/D-43/D-74 | LOW | Small-percentage bars nearly invisible |
| C4-14/D-44/C8-07/C25-08 | LOW | Stale fallback values in Layout footer / build-stats |
| C7-04 | LOW | TransactionReview $effect re-sync fragile |
| C7-06 | LOW | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07 | LOW | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-11 | LOW | persistWarning message misleading for data corruption vs size truncation |
| C8-08 | LOW | inferYear() timezone edge case near midnight Dec 31 |
| C8-09 | LOW | Test duplicates production code |
| C18-01 | MEDIUM | VisibilityToggle $effect directly mutates DOM (cleanup improved but pattern fragile) |
| C18-02 | LOW | Results page stat elements queried on dashboard where they don't exist |
| C18-03 | LOW | Annual savings projection multiplies by 12 without seasonal adjustment |
| C18-04 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C19-04 | LOW | FileDropzone navigation uses full page reload (deferred: requires ClientRouter) |
| C19-05 | LOW | CardDetail navigation uses full page reload (deferred: requires ClientRouter) |
| C20-02/C25-03 | LOW | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04/C25-10 | LOW | pdf.ts module-level regex constants divergence risk with date-utils.ts |
| C21-02 | LOW | cards.ts shared fetch AbortSignal race (deferred) |
| C21-04/C23-02/C25-02/C26-03 | LOW→MEDIUM | cachedCategoryLabels/cachedCoreRules never invalidated (deferred) |
| C22-04 | LOW | CSV adapter gap for 14 banks (deferred) |
| C22-05/C25-11 | LOW | TransactionReview O(n) changeCategory (deferred) |
| C24-06/C25-04 | LOW | buildCardResults totalSpending no negative guard (safe in practice) |
| C53-02 | LOW | Duplicated card stats reading logic in index.astro and Layout.astro |
| C53-03/C25-09 | MEDIUM | CardDetail performance tier header dark mode contrast |
| D-01 through D-111 | Various | See deferred items file for full list |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
