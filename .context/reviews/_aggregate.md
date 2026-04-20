# Review Aggregate -- 2026-04-20 (Cycle 33)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-20-cycle33-comprehensive.md` (full re-read of all source files, re-verified all prior findings)

**Prior cycle reviews (still relevant):**
- All cycle 1-32 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-32 findings are confirmed fixed except as noted below:

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
| C32-01 | FIXED | Server-side parseGenericCSV now uses Math.round(parseFloat(...)) |
| C32-02 | FIXED | Server-side parseGenericCSV now filters zero-amount transactions |
| C32-03 | FIXED | Server-side parseCSV generic fallback now wrapped in try/catch |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C33-01 | MEDIUM | High | `packages/core/src/categorizer/matcher.ts:55-71` | MerchantMatcher substring scan is O(n) over ALL_KEYWORDS on every call — performance concern for large statement files |
| C33-02 | MEDIUM | Medium | `apps/web/src/lib/store.svelte.ts:309,491-502` | cachedCategoryLabels never invalidated when categories.json changes on the server (e.g., redeployment); stale across long-lived tabs (extends C21-04) |
| C33-03 | LOW | High | `apps/web/src/lib/parser/pdf.ts:166-177` | parseAmount returns 0 for unparseable amounts instead of null — fallback PDF scanner silently drops unparseable amounts without error reporting |
| C33-04 | LOW | Medium | `packages/parser/src/csv/generic.ts:133-153` | SplitCSVLine does not handle doubled-quote escape (""), while web-side splitLine at csv.ts:14 does — parity bug |
| C33-05 | LOW | Low | `apps/web/src/lib/analyzer.ts:63-67` | toCoreCardRuleSets does not validate tiers[].unit narrowing, unlike source and type which have explicit allowlists |
| C33-06 | LOW | Medium | `packages/core/src/optimizer/greedy.ts:224` | buildCardResults totalSpending uses Math.abs(tx.amount) but assignedTransactions are always positive — misleading implication |

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
