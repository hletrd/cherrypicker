# Review Aggregate -- 2026-04-21 (Cycle 37)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-21-cycle37-comprehensive.md` (full re-read of all source files, re-verified all prior findings, cross-verified parseAmount consistency across ALL parsers)

**Prior cycle reviews (still relevant):**
- All cycle 1-36 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-36 findings are confirmed fixed except as noted below:

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
| C36-01 | FIXED | Web-side PDF parseAmount now handles parenthesized negatives |
| C36-02 | FIXED | Server-side CSV adapters now use shared.ts utilities |
| C36-03 | FIXED | categoryLabels Map construction centralized into buildCategoryLabelMap() |
| C53-01 | FIXED | TransactionReview changeCategory now uses replacement pattern |
| C53-02 | FIXED | Card stats reading logic centralized into build-stats.ts |
| C53-03 | FIXED | CardDetail performance tier header dark mode contrast fixed |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C37-01 | MEDIUM | High | `apps/web/src/lib/parser/csv.ts:33-45` | Web-side CSV `parseAmount` returns NaN (not null) for unparseable inputs -- inconsistent with all other parsers which return null. The `number` return type hides the risk of NaN propagation. |
| C37-02 | LOW | High | `apps/web/src/lib/parser/csv.ts:49-61` | `isValidAmount` combines NaN check and zero-amount filter in one function, diverging from the separated pattern used by PDF/XLSX/server parsers |
| C37-03 | MEDIUM | High | `apps/web/src/components/upload/FileDropzone.svelte:11-43` | Page-level drag handlers lack an `active` guard for unmount race -- stale closures could cause stuck drag-over state during Astro View Transitions |

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
| C53-02 | LOW | Duplicated card stats reading logic in index.astro and Layout.astro -- NOW FIXED via build-stats.ts |
| D-01 through D-111 | Various | See deferred items file for full list |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
