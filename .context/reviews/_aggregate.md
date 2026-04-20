# Review Aggregate -- 2026-04-21 (Cycle 65)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-21-cycle65-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-64 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-64 findings are confirmed fixed except as noted below.
New in cycle 65: C64-01, C64-02 confirmed **FIXED**.

| Finding | Status | Evidence |
|---|---|---|
| C64-01 | **FIXED** | `parser-date.test.ts:9-10` now imports from production `date-utils.ts`. 12 test cases cover month-aware day validation including leap years, century boundaries. |
| C64-02 | **FIXED** | `parser/index.ts:20-23` encoding list is `['utf-8', 'cp949']` with EUC-KR removed. |
| C64-03 | OPEN (LOW) | `CATEGORY_NAMES_KO` hardcoded map still present with TODO comment. No taxonomy drift yet. |
| C63-04 | **FIXED** | `date-utils.ts:12-20` adds `daysInMonth()` and `isValidDayForMonth()`. All branches validated. |
| C63-07 | **FIXED** | `parser/index.ts:29-38` iterates ALL encodings and picks fewest replacement chars. |
| C62-09 | **FIXED** | `cards.ts:158-168` builds `cardIndex` Map; `getCardById` uses O(1) lookup |
| C62-11 | PARTIALLY FIXED | `store.svelte.ts:154-165` logs non-quota errors but returns 'corrupted' for ALL non-quota errors |
| C56-04 | OPEN (LOW) | `date-utils.ts:132` still returns raw input for unparseable dates |
| C56-05 | OPEN (LOW) | Zero savings shows "0원" without plus sign |
| C33-01/C62-01 | OPEN (MEDIUM) | MerchantMatcher/taxonomy substring scan O(n) per transaction |
| C33-02/C62-04 | OPEN (MEDIUM) | cachedCategoryLabels stale across redeployments |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C65-01 | LOW | HIGH | `apps/web/src/lib/parser/pdf.ts:32-38` | `isValidShortDate()` uses `day >= 1 && day <= 31` pre-filter, while production `parseDateStringToISO()` uses `isValidDayForMonth(year, month, day)`. Same class as C64-01 but in PDF parser's row-detection heuristic. No incorrect date output (final validation catches it), but the pre-filter may cause a row with an invalid date like "2/31" to be processed as a transaction row, resulting in a raw "2/31" date string instead of being skipped. |
| C65-02 | LOW | MEDIUM | `apps/web/src/lib/parser/date-utils.ts:100,124` | MM/DD and Korean short date branches have redundant `day <= 31` pre-check before `isValidDayForMonth(year, month, day)`. Other branches (full date, YYYYMMDD, short-year) only use `isValidDayForMonth`. Inconsistent style -- `isValidDayForMonth` makes the `day <= 31` check redundant. |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

The following findings have been flagged by multiple cycles, indicating high signal:

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| VisibilityToggle DOM mutation | C18, C50 | OPEN (LOW) -- 2 cycles agree |
| MerchantMatcher/taxonomy O(n) scan | C16, C33, C50, C62, C63, C64, C65 | OPEN (MEDIUM) -- 7 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21, C23, C25, C26, C33, C62, C63, C64, C65 | OPEN (MEDIUM) -- 9 cycles agree |
| CategoryBreakdown dark mode contrast | C4, C8, C59, C62 | OPEN (LOW) -- 4 cycles agree |
| Annual savings simple *12 projection | C7, C18, C62, C63, C64, C65 | OPEN (LOW) -- 6 cycles agree |
| Full-page reload navigation | C19, C60, C62 | **FIXED** (C63 confirmed) |
| date-utils unparseable passthrough | C56, C62, C63, C64, C65 | OPEN (LOW) -- 5 cycles agree |
| CSV DATE_PATTERNS divergence risk | C20, C25, C62, C64, C65 | OPEN (LOW) -- 5 cycles agree |
| Print stylesheet dark-mode fix | C60, C61 | **FIXED** (C62 confirmed) |
| CardGrid reactive dependency cycle | C60 | **FIXED** (C61 confirmed) |
| CardDetail category labels flash | C61 | **FIXED** (C62 confirmed) |
| TransactionReview stale editedTxs on reset | C61 | **FIXED** (C62 confirmed) |
| SavingsComparison zero-prefix inconsistency | C57, C58 | **FIXED** |
| getCardById O(n) | C3, C50, C56, C62 | **FIXED** (C63 confirmed) |
| Breadcrumb `<a>` to `<button>` | C61, C62 | **FIXED** (C63 confirmed) |
| persistToStorage bare catch | C62, C63, C64, C65 | OPEN (LOW) -- 4 cycles agree |
| Hardcoded fallback drift (CATEGORY_NAMES_KO / build-stats) | C8, C64, C65 | OPEN (LOW) -- 3 cycles agree |

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
| C62-11 | LOW | persistToStorage returns 'corrupted' for non-quota errors |
| C64-03 | LOW | CATEGORY_NAMES_KO hardcoded map can drift from YAML taxonomy |
| C65-01 | LOW | PDF isValidShortDate uses day<=31 pre-filter vs production isValidDayForMonth |
| C65-02 | LOW | date-utils.ts redundant day<=31 pre-check before isValidDayForMonth |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
