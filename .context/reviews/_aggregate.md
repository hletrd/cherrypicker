# Review Aggregate -- 2026-04-20 (Cycle 35)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-20-cycle35-comprehensive.md` (full re-read of all source files, re-verified all prior findings, cross-verified parseAmount consistency across ALL parsers including bank adapters)

**Prior cycle reviews (still relevant):**
- All cycle 1-34 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-34 findings are confirmed fixed except as noted below:

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
| C22-05 | OPEN (LOW) | TransactionReview changeCategory O(n) array copy (deferred) |
| C24-06 | OPEN (LOW) | buildCardResults totalSpending no negative amount guard (safe in practice) |
| C27-02 | OPEN (LOW) | Duplicate NaN/zero checks in parseGenericCSV (inline) vs isValidAmount() (bank adapters) -- maintenance divergence |
| C33-01 | OPEN (MEDIUM) | cachedCategoryLabels stale across redeployments |
| C33-02 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction |
| C34-01 | FIXED | Server-side PDF parseAmount now returns null for NaN, uses Math.round(parseFloat(...)), handles parenthesized negatives |
| C34-02 | FIXED | Server-side XLSX parseAmount string path now uses Math.round(parseFloat(...)) |
| C34-03 | FIXED | Server-side PDF findDateCell now has isValidShortDate() |
| C34-04 | OPEN (LOW) | Server-side PDF has no fallback line scanner -- architectural gap |
| C34-05 | FIXED | inferYear centralized into date-utils.ts, shared across CSV/XLSX/PDF |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C35-01 | MEDIUM | High | `packages/parser/src/csv/{hyundai,kb,shinhan,woori,samsung,hana,nh,lotte,ibk,bc}.ts:28` | All 10 bank-specific CSV adapters use `parseInt(cleaned, 10)` instead of `Math.round(parseFloat(...))` for amount parsing and return `NaN` instead of `null` -- parity bug with all fixed parsers (same class as C34-01/C34-02) |
| C35-02 | LOW | High | All 10 bank-specific CSV adapters | Bank adapters don't filter zero-amount rows -- generic CSV does `if (amount === 0) continue;` but bank adapters pass zero amounts through |
| C35-03 | LOW | High | All 10 bank-specific CSV adapters | Bank adapters have duplicated `parseDateToISO` without `inferYear` support -- missing Korean dates, short dates, and short-year dates that the generic CSV handles |

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02/D-40/D-82/C9R-04 | LOW | Annual savings projection label unchanged |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13/C9-08/D-43/D-74 | LOW | Small-percentage bars nearly invisible |
| C20-02/C25-03 | LOW | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04/C25-10 | LOW | pdf.ts module-level regex constants divergence risk with date-utils.ts |
| C34-04 | LOW | Server-side PDF has no fallback line scanner |
| C53-02 | LOW | Duplicated card stats reading logic in index.astro and Layout.astro |
| D-01 through D-111 | Various | See deferred items file for full list |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
