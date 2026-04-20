# Review Aggregate -- 2026-04-22 (Cycle 69)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-22-cycle69-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-68 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-68 findings are confirmed fixed except as noted below.
No new fix verifications this cycle.

| Finding | Status | Evidence |
|---|---|---|
| C68-01 | **FIXED** | Server-side PDF `isValidShortDate` uses `MAX_DAYS_PER_MONTH` table. |
| C68-02 | **FIXED** | `scoreCardsForTransaction` uses push/pop instead of spread array. |
| C67-01 | OPEN (MEDIUM) | Greedy optimizer O(m*n*k) quadratic behavior unchanged. |
| C66-02 | OPEN (MEDIUM) | `cachedCategoryLabels` stale across redeployments. 13 cycles agree. |
| C66-03 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction. 11 cycles agree. |
| C66-04 | OPEN (LOW) | `persistToStorage` returns 'corrupted' for non-quota errors. 8 cycles agree. |
| C66-05 | OPEN (LOW) | `FALLBACK_CATEGORIES` hardcoded 13 categories vs 40+ in taxonomy. 6 cycles agree. |
| C66-08 | OPEN (LOW) | `formatIssuerNameKo` and `CATEGORY_COLORS` hardcoded maps will drift. 6 cycles agree. |
| C66-10 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between server and web. 5 cycles agree. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C69-01 | LOW | HIGH | `apps/web/src/components/dashboard/SavingsComparison.svelte:217` | During count-up animation, tiny savings (1-2 won) could show brief "+1원" flicker before stabilizing. The `Math.abs(displayedSavings) >= 1` guard mostly prevents this. Sub-second visual artifact only. |
| C69-02 | LOW | MEDIUM | `packages/parser/src/csv/shared.ts` | Web-side CSV `parseAmount` handles parenthesized negatives `(1,234)` but server-side shared CSV parser may not, creating parse-result parity gap for negative-amount rows. Needs verification. |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

The following findings have been flagged by multiple cycles, indicating high signal:

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16, C33, C50, C62, C63, C64, C65, C66, C67, C68, C69 | OPEN (MEDIUM) -- 11 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21, C23, C25, C26, C33, C62, C63, C64, C65, C66, C67, C68, C69 | OPEN (MEDIUM) -- 13 cycles agree |
| persistToStorage bare catch / 'corrupted' for all non-quota | C62, C63, C64, C65, C66, C67, C68, C69 | OPEN (LOW) -- 8 cycles agree |
| Annual savings simple *12 projection | C7, C18, C62, C63, C64, C65, C66, C67, C68, C69 | OPEN (LOW) -- 10 cycles agree |
| date-utils unparseable passthrough | C56, C62, C63, C64, C65, C66, C67, C68, C69 | OPEN (LOW) -- 9 cycles agree |
| CSV DATE_PATTERNS divergence risk | C20, C25, C62, C64, C65, C66, C67, C68, C69 | OPEN (LOW) -- 9 cycles agree |
| Hardcoded fallback drift (CATEGORY_NAMES_KO / build-stats) | C8, C64, C65, C66, C67, C68, C69 | OPEN (LOW) -- 7 cycles agree |
| BANK_SIGNATURES duplication | C7, C66, C67, C68, C69 | OPEN (LOW) -- 5 cycles agree |
| inferYear() timezone dependence | C8, C67, C68, C69 | OPEN (LOW) -- 4 cycles agree (60+ cycles deferred) |
| Greedy optimizer O(m*n*k) quadratic | C67, C68, C69 | OPEN (MEDIUM) -- 3 cycles agree |
| Server-side PDF isValidShortDate parity | C68 | FIXED |
| Greedy optimizer O(m*n) temp array alloc | C68 | FIXED |

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
| C69-01 | LOW | SavingsComparison tiny savings animation flicker (informational) |
| C69-02 | LOW | Server-side CSV shared.ts may lack parenthesized-negative handling |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
