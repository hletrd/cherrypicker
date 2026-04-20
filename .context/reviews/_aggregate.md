# Review Aggregate -- 2026-04-22 (Cycle 36)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-22-cycle36-comprehensive.md` (full re-read of all source files, re-verified all prior findings, cross-verified parseAmount consistency across ALL parsers including web-side PDF)

**Prior cycle reviews (still relevant):**
- All cycle 1-35 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-35 findings are confirmed fixed except as noted below:

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
| C33-01 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction -- partially fixed with SUBSTRING_SAFE_ENTRIES |
| C33-02 | OPEN (MEDIUM) | cachedCategoryLabels stale across redeployments |
| C34-04 | OPEN (LOW) | Server-side PDF has no fallback line scanner -- architectural gap |
| C35-01 | FIXED | All 10 bank-specific CSV adapters now use Math.round(parseFloat(...)), return null for NaN, handle parenthesized negatives |
| C35-02 | FIXED | All 10 bank-specific CSV adapters now filter zero-amount rows |
| C35-03 | FIXED | All 10 bank-specific CSV adapters now import parseDateStringToISO from shared date-utils.ts |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C36-01 | MEDIUM | High | `apps/web/src/lib/parser/pdf.ts:169-179` | Web-side PDF `parseAmount` does not handle parenthesized negative amounts like `(1,234)` -- parity bug with all other parsers (web CSV, web XLSX, server CSV, server XLSX, server PDF all handle it) |
| C36-02 | LOW | High | `packages/parser/src/csv/{hyundai,kb,shinhan,woori,samsung,hana,nh,lotte,ibk,bc}.ts:15-30` + `generic.ts:49-71` | `splitLine` / `splitCSVLine` and `parseAmount` are copy-pasted identically across 11 files -- DRY violation (same class as C7-07, C34-05) |
| C36-03 | LOW | High | `apps/web/src/lib/store.svelte.ts:316-329`, `apps/web/src/lib/analyzer.ts:218-231`, `apps/web/src/lib/analyzer.ts:274-295`, `apps/web/src/components/cards/CardDetail.svelte:23-30` | `categoryLabels` Map construction (id + sub.id + dot-notation key) duplicated 4 times -- maintenance risk |

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
