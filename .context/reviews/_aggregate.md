# Review Aggregate -- 2026-04-21 (Cycle 63)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-21-cycle63-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-62 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-61 findings are confirmed fixed except as noted below.
New in cycle 63: C62-09, C61-02, C62-15 (both FileDropzone+CardDetail), C49-01 confirmed **FIXED**.

| Finding | Status | Evidence |
|---|---|---|
| C62-09 | **FIXED** | `cards.ts:158-168` builds `cardIndex` Map; `getCardById` uses `cardIndex.get()` O(1) lookup |
| C61-02 | **FIXED** | `CardPage.svelte:70-74` uses `<button type="button">` instead of `<a href="#">` |
| C62-15 | **FIXED** | `FileDropzone.svelte:241-246` and `CardDetail.svelte:275-280` both use Astro `navigate()` |
| C49-01 | **FIXED** | `isSubstringSafeKeyword` function no longer exists in codebase |
| C62-11 | PARTIALLY FIXED | `store.svelte.ts:154-165` now logs non-quota errors but still returns `{ kind: 'corrupted' }` for ALL non-quota errors |
| C56-04 | OPEN (LOW) | `date-utils.ts:112` still returns raw input for unparseable dates |
| C56-05 | OPEN (LOW) | Zero savings shows "0원" without plus sign |
| C33-01/C62-01 | OPEN (MEDIUM) | MerchantMatcher/taxonomy substring scan O(n) per transaction |
| C33-02/C62-04 | OPEN (MEDIUM) | cachedCategoryLabels stale across redeployments |
| C21-04/C62-04 | OPEN (MEDIUM) | cachedCategoryLabels invalidated only on explicit reset |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C63-01 | LOW | HIGH | `apps/web/src/lib/store.svelte.ts:327` | `cachedCategoryLabels` closure-level cache only invalidated on `reset()` -- converges with C62-04/C33-02 |
| C63-02 | -- | -- | ~~not an issue~~ | Bar chart width calculation is self-correcting (categories < 2% grouped into "other") |
| C63-03 | LOW | HIGH | `packages/core/src/categorizer/taxonomy.ts:71-78` | `findCategory` full keywordMap iteration -- converges with C33-01/C62-01 |
| C63-04 | MEDIUM | MEDIUM | `apps/web/src/lib/parser/date-utils.ts:46-112` | Day-of-month validation does not account for month-specific day limits (e.g., Feb 31 passes, producing impossible date "2026-02-31"). Downstream sorting/filtering by date would be incorrect for impossible dates. |
| C63-05 | LOW | MEDIUM | `apps/web/src/components/dashboard/SavingsComparison.svelte:60` | `annualTarget = target * 12` simple projection -- converges with C18-03/C62-03. Template disclaimer is adequate. |
| C63-06 | LOW | LOW | `apps/web/src/lib/formatters.ts:1-2` | `getIssuerFromCardId` splits on `-` prefix assumption -- latent risk if ID format changes |
| C63-07 | MEDIUM | MEDIUM | `apps/web/src/lib/parser/index.ts:23-36` | Encoding detection heuristic breaks early when UTF-8 produces < 5 replacement chars. For small files with mostly ASCII content and a few Korean characters, the wrong encoding may be selected (UTF-8 instead of EUC-KR), producing garbled Korean text. |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

The following findings have been flagged by multiple cycles, indicating high signal:

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| VisibilityToggle DOM mutation | C18, C50 | OPEN (LOW) -- 2 cycles agree |
| MerchantMatcher/taxonomy O(n) scan | C16, C33, C50, C62, C63 | OPEN (MEDIUM) -- 5 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21, C23, C25, C26, C33, C62, C63 | OPEN (MEDIUM) -- 7 cycles agree |
| CategoryBreakdown dark mode contrast | C4, C8, C59, C62 | OPEN (LOW) -- 4 cycles agree |
| Annual savings simple *12 projection | C7, C18, C62, C63 | OPEN (LOW) -- 4 cycles agree |
| Full-page reload navigation | C19, C60, C62 | **FIXED** (C63 confirmed) |
| date-utils unparseable passthrough | C56, C62, C63 | OPEN (LOW) -- 3 cycles agree |
| CSV DATE_PATTERNS divergence risk | C20, C25, C62 | OPEN (LOW) -- 3 cycles agree |
| Print stylesheet dark-mode fix | C60, C61 | **FIXED** (C62 confirmed) |
| CardGrid reactive dependency cycle | C60 | **FIXED** (C61 confirmed) |
| CardDetail category labels flash | C61 | **FIXED** (C62 confirmed) |
| TransactionReview stale editedTxs on reset | C61 | **FIXED** (C62 confirmed) |
| SavingsComparison zero-prefix inconsistency | C57, C58 | **FIXED** |
| getCardById O(n) | C3, C50, C56, C62 | **FIXED** (C63 confirmed) |
| Breadcrumb `<a>` to `<button>` | C61, C62 | **FIXED** (C63 confirmed) |
| persistToStorage bare catch | C62, C63 | OPEN (LOW) -- 2 cycles agree |

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
| C56-04 | LOW | date-utils.ts returns raw input for unparseable dates without error reporting |
| C56-05 | LOW | Zero savings shows "0원" without plus sign |
| C61-02 | -- | **FIXED** -- breadcrumb now uses `<button>` |
| C62-11 | LOW | persistToStorage returns 'corrupted' for non-quota errors |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
