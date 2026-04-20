# Review Aggregate -- 2026-04-22 (Cycle 34)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-22-cycle34-comprehensive.md` (full re-read of all source files, re-verified all prior findings)

**Prior cycle reviews (still relevant):**
- All cycle 1-33 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-33 findings are confirmed fixed except as noted below:

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
| C22-04 | OPEN (LOW) | CSV adapter registry only covers 10 of 24 detected banks (deferred) |
| C22-05 | OPEN (LOW) | TransactionReview changeCategory O(n) array copy (deferred) |
| C24-06 | OPEN (LOW) | buildCardResults totalSpending no negative amount guard (safe in practice) |
| C27-02 | OPEN (LOW) | Duplicate NaN/zero checks in parseGenericCSV (inline) vs isValidAmount() (bank adapters) -- maintenance divergence |
| C31-01 | FIXED | SpendingSummary dismiss catch now logs console.warn matching C27-01/C30-03 pattern |
| C31-02 | FIXED | greedyOptimize Map.set() replaced with if/else -- only .set() on first insertion |
| C33-01 | PARTIALLY FIXED | SUBSTRING_SAFE_ENTRIES pre-computed at module level; still O(n) substring scan per transaction but avoids per-call allocation |
| C33-02 | OPEN (MEDIUM) | cachedCategoryLabels stale across redeployments |
| C33-04 | FIXED | Server-side splitCSVLine now handles RFC 4180 doubled quotes |
| C33-06 | FIXED | buildCardResults uses tx.amount directly instead of Math.abs(tx.amount) |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C34-01 | MEDIUM | High | `packages/parser/src/pdf/index.ts:102-108` | Server-side PDF parseAmount returns 0 for NaN (not null), uses parseInt (truncation) instead of Math.round(parseFloat(...)), and lacks parenthesized negative handling -- parity bug with fixed web-side |
| C34-02 | LOW | High | `packages/parser/src/xlsx/index.ts:136` | Server-side XLSX parseAmount string path uses parseInt (truncation) instead of Math.round(parseFloat(...)) -- inconsistent with numeric path |
| C34-03 | LOW | High | `packages/parser/src/pdf/index.ts:110-122` | Server-side PDF findDateCell does not validate month/day ranges for SHORT_MD_DATE_PATTERN (no isValidShortDate) -- parity bug with web-side |
| C34-04 | LOW | High | `packages/parser/src/pdf/index.ts:131-187, 189-258` | Server-side PDF has no fallback line scanner -- missing entire parsing tier present on web-side |
| C34-05 | LOW | High | `packages/parser/src/csv/generic.ts:33-40`, `xlsx/index.ts:31-38`, `pdf/index.ts:23-30` | inferYear duplicated 3 times across server-side parsers -- not centralized like web-side date-utils.ts |

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
| C53-02 | LOW | Duplicated card stats reading logic in index.astro and Layout.astro |
| D-01 through D-111 | Various | See deferred items file for full list |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
