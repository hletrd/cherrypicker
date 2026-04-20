# Review Aggregate -- 2026-04-21 (Cycle 62)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-21-cycle62-comprehensive.md` (full re-read of all source files, gate verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-61 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-60 findings are confirmed fixed except as noted below.
New in cycle 62: C61-01, C61-04, C61-05 confirmed **FIXED**.

| Finding | Status | Evidence |
|---|---|---|
| C61-01 | **FIXED** | `TransactionReview.svelte:81-84` clears `editedTxs = []` when `txs.length === 0` |
| C61-04 | **FIXED** | `CardDetail.svelte:22,31,204` uses `categoryLabelsReady` flag |
| C61-05 | **FIXED** | `report.astro:64-77` `cherrypickerPrint()` removes `dark` class before print |
| C60-01 | **FIXED** | `CardGrid.svelte:29-35` derives `availableIssuers` from type-filtered cards only |
| C59-02 | **FIXED** | `SpendingSummary.svelte:124-130` validates `month` against regex |
| C59-03 | **FIXED** | `VisibilityToggle.svelte:22,102-104,125` captures original label text |
| C58-01 | **FIXED** | `VisibilityToggle.svelte:92` uses `> 0` instead of `>= 0` |
| C56-04 | OPEN (LOW) | `date-utils.ts:112` still returns raw input for unparseable dates |
| C56-05 | OPEN (LOW) | Zero savings shows "0원" without plus sign |
| C33-01/C62-01 | OPEN (MEDIUM) | MerchantMatcher/taxonomy substring scan O(n) per transaction |
| C33-02/C62-04 | OPEN (MEDIUM) | cachedCategoryLabels stale across redeployments |
| C21-04/C62-04 | OPEN (MEDIUM) | cachedCategoryLabels invalidated only on explicit reset |
| C62-09 | OPEN (MEDIUM) | `getCardById` O(n) linear scan through all issuers |
| C62-15 | OPEN (MEDIUM) | FileDropzone full-page reload after upload loses truncated session data |
| C62-11 | OPEN (LOW) | `persistToStorage` bare catch returns 'corrupted' for non-quota errors |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C62-01 | MEDIUM | HIGH | `packages/core/src/categorizer/taxonomy.ts:71-78` | `findCategory` substring scan iterates ALL keywordMap entries per call -- converges with C33-01 |
| C62-02 | LOW | HIGH | `apps/web/src/lib/parser/date-utils.ts:112` | `parseDateStringToISO` returns raw input for unparseable dates -- converges with C56-04 |
| C62-03 | LOW | MEDIUM | `apps/web/src/components/dashboard/SavingsComparison.svelte:60` | Annual projection `target * 12` -- converges with C18-03 |
| C62-04 | LOW | MEDIUM | `apps/web/src/lib/store.svelte.ts:317-323` | `cachedCategoryLabels` stale across redeployments -- converges with C21-04/C33-02 |
| C62-05 | LOW | MEDIUM | `apps/web/src/components/cards/CardPage.svelte:70-74` | Breadcrumb `<a href="#">` should be `<button>` -- converges with C61-02 |
| C62-06 | LOW | LOW | `apps/web/src/lib/parser/csv.ts:96-103` | `DATE_PATTERNS` divergence risk with date-utils.ts -- converges with C20-02/C25-03 |
| C62-07 | -- | -- | ~~withdrawn~~ | Initially flagged QuotaExceededError logging, but re-examination found the filter is correct. Not an issue. |
| C62-08 | LOW | MEDIUM | `apps/web/src/lib/parser/xlsx.ts:241-249` | `isHTMLContent` only checks first 512 bytes -- converges with C18-04 |
| C62-09 | MEDIUM | HIGH | `apps/web/src/lib/cards.ts:280-307` | `getCardById` O(n) linear scan -- converges with C3-D111/C50/C56 |
| C62-10 | LOW | HIGH | `apps/web/src/components/ui/VisibilityToggle.svelte:62-127` | `$effect` directly mutates DOM -- converges with C18-01/C50 |
| C62-11 | LOW | MEDIUM | `apps/web/src/lib/store.svelte.ts:155` | `persistToStorage` bare catch returns 'corrupted' for non-quota errors |
| C62-12 | LOW | LOW | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-49` | `CATEGORY_COLORS` incomplete coverage + dark mode contrast -- converges with C8-05/C4-09 |
| C62-13 | LOW | MEDIUM | `apps/web/src/lib/analyzer.ts:48-79` | `cachedCoreRules` stale across redeployments -- converges with C62-04 |
| C62-14 | LOW | LOW | `apps/web/__tests__/parser-date.test.ts` | Tests duplicate production code -- converges with C8-09 |
| C62-15 | MEDIUM | HIGH | `apps/web/src/components/upload/FileDropzone.svelte:237-239` | Full-page reload after upload loses truncated session data -- converges with C19-04 |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

The following findings have been flagged by multiple cycles, indicating high signal:

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| VisibilityToggle DOM mutation | C18, C50 | OPEN (LOW) -- 2 cycles agree |
| getCardById O(n) | C3, C50, C56, C62 | OPEN (MEDIUM) -- 4 cycles agree |
| MerchantMatcher/taxonomy O(n) scan | C16, C33, C50, C62 | OPEN (MEDIUM) -- 4 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21, C23, C25, C26, C33, C62 | OPEN (MEDIUM) -- 6 cycles agree |
| CategoryBreakdown dark mode contrast | C4, C8, C59, C62 | OPEN (LOW) -- 4 cycles agree |
| Annual savings simple *12 projection | C7, C18, C62 | OPEN (LOW) -- 3 cycles agree |
| Full-page reload navigation | C19, C60, C62 | OPEN (LOW) -- 3 cycles agree |
| date-utils unparseable passthrough | C56, C62 | OPEN (LOW) -- 2 cycles agree |
| CSV DATE_PATTERNS divergence risk | C20, C25, C62 | OPEN (LOW) -- 3 cycles agree |
| Print stylesheet dark-mode fix | C60, C61 | **FIXED** |
| CardGrid reactive dependency cycle | C60 | **FIXED** (C61 confirmed) |
| CardDetail category labels flash | C61 | **FIXED** (C62 confirmed) |
| TransactionReview stale editedTxs on reset | C61 | **FIXED** (C62 confirmed) |
| SavingsComparison zero-prefix inconsistency | C57, C58 | **FIXED** |

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02/D-40/D-82/C9R-04/C18-03/C39-06 | LOW | Annual savings projection label unchanged / visual inconsistency |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13/C9-08/D-43/D-74 | LOW | Small-percentage bars nearly invisible |
| C7-04 | LOW | TransactionReview $effect re-sync fragile |
| C7-06 | LOW | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07 | LOW | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-11 | LOW | persistWarning message misleading for data corruption vs size truncation |
| C8-05/C4-09 | LOW | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast |
| C8-07/C4-14 | LOW | build-stats.ts fallback values will drift |
| C8-08 | LOW | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | LOW | Test duplicates production code instead of testing it directly |
| C18-01/C50-08 | LOW | VisibilityToggle $effect directly mutates DOM |
| C18-02 | LOW | Results page stat elements queried every effect run even on dashboard page |
| C18-04 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C19-04 | LOW | FileDropzone navigation uses full page reload |
| C19-05 | LOW | CardDetail navigation uses full page reload |
| C20-02/C25-03 | LOW | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04/C25-10 | LOW | pdf.ts module-level regex constants divergence risk with date-utils.ts |
| C21-02 | LOW | cards.ts shared fetch AbortSignal race |
| C22-04 | LOW | CSV adapter registry only covers 10 of 24 detected banks |
| C33-01 | MEDIUM | MerchantMatcher substring scan O(n) per transaction -- partially fixed |
| C33-02 | MEDIUM | cachedCategoryLabels stale across redeployments |
| C34-04 | LOW | Server-side PDF has no fallback line scanner |
| C41-05/C42-04 | LOW | cards.ts loadCategories returns empty array on AbortError |
| C49-01 | LOW | `isSubstringSafeKeyword` is dead code superseded by SUBSTRING_SAFE_ENTRIES |
| C56-04 | LOW | date-utils.ts returns raw input for unparseable dates without error reporting |
| C56-05 | LOW | Zero savings shows "0원" without plus sign |
| C61-02 | LOW | Breadcrumb uses `<a>` instead of `<button>` for action |
| C62-11 | LOW | persistToStorage bare catch returns 'corrupted' for non-quota errors |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
