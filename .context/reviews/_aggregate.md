# Review Aggregate -- 2026-04-22 (Cycle 68)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-22-cycle68-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-67 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-67 findings are confirmed fixed except as noted below.
New in cycle 68: C67-04 and C67-05 confirmed **FIXED**.

| Finding | Status | Evidence |
|---|---|---|
| C67-04 | **FIXED** | Web-side XLSX parser serial-date path now uses `isValidDayForMonth()`. |
| C67-05 | **FIXED** | Server-side XLSX parser serial-date path now uses `isValidDayForMonth()`. |
| C67-01 | OPEN (MEDIUM) | Greedy optimizer O(m*n*k) quadratic behavior unchanged. |
| C66-02 | OPEN (MEDIUM) | `cachedCategoryLabels` stale across redeployments. 12 cycles agree. |
| C66-03 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction. 10 cycles agree. |
| C66-04 | OPEN (LOW) | `persistToStorage` returns 'corrupted' for non-quota errors. 7 cycles agree. |
| C66-05 | OPEN (LOW) | `FALLBACK_CATEGORIES` hardcoded 13 categories vs 40+ in taxonomy. 5 cycles agree. |
| C66-08 | OPEN (LOW) | `formatIssuerNameKo` and `CATEGORY_COLORS` hardcoded maps will drift. 5 cycles agree. |
| C66-10 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between server and web. 4 cycles agree. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C68-01 | LOW | HIGH | `packages/parser/src/pdf/index.ts:24-31` | Server-side PDF `isValidShortDate` uses `day <= 31` instead of month-aware `MAX_DAYS_PER_MONTH` table. Parity bug with web-side (which was fixed in C65-01). Production `parseDateStringToISO()` catches invalid dates downstream, but `findDateCell` pre-filter inconsistency can cause different row-identification behavior between server and web. |
| C68-02 | LOW | HIGH | `packages/core/src/optimizer/greedy.ts:133` | `scoreCardsForTransaction` creates a new spread array `[...currentTransactions, transaction]` per card per transaction, producing O(m*n) temporary array allocations. Push/pop pattern would eliminate this GC pressure. Related to C67-01 but distinct (allocation vs computation). |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

The following findings have been flagged by multiple cycles, indicating high signal:

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16, C33, C50, C62, C63, C64, C65, C66, C67, C68 | OPEN (MEDIUM) -- 10 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21, C23, C25, C26, C33, C62, C63, C64, C65, C66, C67, C68 | OPEN (MEDIUM) -- 12 cycles agree |
| persistToStorage bare catch / 'corrupted' for all non-quota | C62, C63, C64, C65, C66, C67, C68 | OPEN (LOW) -- 7 cycles agree |
| Annual savings simple *12 projection | C7, C18, C62, C63, C64, C65, C66, C67, C68 | OPEN (LOW) -- 9 cycles agree |
| date-utils unparseable passthrough | C56, C62, C63, C64, C65, C66, C67, C68 | OPEN (LOW) -- 8 cycles agree |
| CSV DATE_PATTERNS divergence risk | C20, C25, C62, C64, C65, C66, C67, C68 | OPEN (LOW) -- 8 cycles agree |
| Hardcoded fallback drift (CATEGORY_NAMES_KO / build-stats) | C8, C64, C65, C66, C67, C68 | OPEN (LOW) -- 6 cycles agree |
| BANK_SIGNATURES duplication | C7, C66, C67, C68 | OPEN (LOW) -- 4 cycles agree |
| inferYear() timezone dependence | C8, C67, C68 | OPEN (LOW) -- 3 cycles agree (60+ cycles deferred) |
| Greedy optimizer O(m*n*k) quadratic | C67, C68 | OPEN (MEDIUM) -- 2 cycles agree |
| Server-side PDF isValidShortDate parity | C68 | NEW (LOW) |
| Greedy optimizer O(m*n) temp array alloc | C68 | NEW (LOW) |

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
| C7-07/C66-10 | LOW | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-11 | LOW | persistWarning message misleading for data corruption vs size truncation |
| C8-05/C4-09 | LOW | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast |
| C8-07/C4-14/C66-07 | LOW | build-stats.ts fallback values will drift |
| C8-08/C67-02 | LOW | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | LOW | Test duplicates production code instead of testing it directly |
| C18-01/C50-08 | LOW | VisibilityToggle $effect directly mutates DOM |
| C18-02 | LOW | Results page stat elements queried every effect run even on dashboard page |
| C18-04 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C20-02/C25-03 | LOW | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04/C25-10 | LOW | pdf.ts module-level regex constants divergence risk with date-utils.ts |
| C21-02 | LOW | cards.ts shared fetch AbortSignal race |
| C22-04 | LOW | CSV adapter registry only covers 10 of 24 detected banks |
| C33-01/C66-03 | MEDIUM | MerchantMatcher substring scan O(n) per transaction -- partially fixed |
| C33-02/C66-02 | MEDIUM | cachedCategoryLabels stale across redeployments |
| C34-04 | LOW | Server-side PDF has no fallback line scanner |
| C41-05/C42-04 | LOW | cards.ts loadCategories returns empty array on AbortError |
| C56-04 | LOW | date-utils.ts returns raw input for unparseable dates without error reporting |
| C56-05 | LOW | Zero savings shows "0원" without plus sign |
| C62-11/C66-04 | LOW | persistToStorage returns 'corrupted' for non-quota errors |
| C64-03/C66-05/C67-03 | LOW | CATEGORY_NAMES_KO hardcoded map can drift from YAML taxonomy |
| C66-08 | LOW | formatIssuerNameKo and CATEGORY_COLORS hardcoded maps will drift |
| C67-01 | MEDIUM | Greedy optimizer O(m*n*k) quadratic behavior |
| C68-01 | LOW | Server-side PDF isValidShortDate uses day <= 31 instead of month-aware table |
| C68-02 | LOW | Greedy optimizer scoreCardsForTransaction O(m*n) temp array allocations |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
