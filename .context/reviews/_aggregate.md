# Review Aggregate -- 2026-04-21 (Cycle 67)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-21-cycle67-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-66 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-66 findings are confirmed fixed except as noted below.
New in cycle 67: C66-01, C66-06, C66-09/C65-02 all confirmed **FIXED**.

| Finding | Status | Evidence |
|---|---|---|
| C66-01 | **FIXED** | Server-side `date-utils.ts` uses `isValidDayForMonth()` in all branches. |
| C66-06 | **FIXED** | Server-side parser uses `cp949` instead of `euc-kr`. |
| C66-09/C65-02 | **FIXED** | Web-side `date-utils.ts` redundant `day >= 1` pre-checks removed. |
| C66-07 | NO-OP | build-stats.ts fallback values (683/24/45) match current cards.json. |
| C66-02 | OPEN (MEDIUM) | `cachedCategoryLabels` stale across redeployments (carry-forward from C33-02). 11 cycles agree. |
| C66-03 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction (carry-forward from C33-01). 9 cycles agree. |
| C66-04 | OPEN (LOW) | `persistToStorage` returns 'corrupted' for non-quota errors (carry-forward from C62-11). 6 cycles agree. |
| C66-05 | OPEN (LOW) | `FALLBACK_CATEGORIES` hardcoded 13 categories vs 40+ in taxonomy (carry-forward from C64-03). 4 cycles agree. |
| C66-08 | OPEN (LOW) | `formatIssuerNameKo` and `CATEGORY_COLORS` hardcoded maps will drift. 4 cycles agree. |
| C66-10 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between server and web (carry-forward from C7-07). 3 cycles agree. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C67-01 | MEDIUM | HIGH | `packages/core/src/optimizer/greedy.ts:120-146` | `scoreCardsForTransaction` recalculates ALL card rewards for every transaction — O(m*n*k) quadratic behavior in the greedy optimizer. For 500 transactions x 600 cards, produces ~300,000 full `calculateRewards()` calls. Could be optimized with incremental reward tracking. |
| C67-02 | LOW | HIGH | `packages/parser/src/date-utils.ts:22-29`, `apps/web/src/lib/parser/date-utils.ts:33-41` | `inferYear()` uses `new Date()` timezone-dependent — narrow edge case near midnight Dec 31. Carry-forward from C8-08 (59 cycles, consistently deferred). |
| C67-03 | LOW | HIGH | `packages/core/src/optimizer/greedy.ts:11-86` | `CATEGORY_NAMES_KO` hardcoded map can drift from YAML taxonomy. Carry-forward from C64-03. TODO comment acknowledges. CLI path has no fallback. |
| C67-04 | MEDIUM | HIGH | `apps/web/src/lib/parser/xlsx.ts:187-204` | XLSX parser `parseDateToISO` returns Excel serial date WITHOUT month-aware day validation. String path uses `isValidDayForMonth()` but serial-date path bypasses it. Inconsistency with the validation-consistent string path. |
| C67-05 | LOW | HIGH | `packages/parser/src/xlsx/adapters/index.ts` | Server-side XLSX parser also lacks month-aware day validation for serial dates. Same class as C67-04. |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

The following findings have been flagged by multiple cycles, indicating high signal:

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16, C33, C50, C62, C63, C64, C65, C66, C67 | OPEN (MEDIUM) -- 9 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21, C23, C25, C26, C33, C62, C63, C64, C65, C66, C67 | OPEN (MEDIUM) -- 11 cycles agree |
| persistToStorage bare catch / 'corrupted' for all non-quota | C62, C63, C64, C65, C66, C67 | OPEN (LOW) -- 6 cycles agree |
| CategoryBreakdown dark mode contrast | C4, C8, C59, C62 | OPEN (LOW) -- 4 cycles agree |
| Annual savings simple *12 projection | C7, C18, C62, C63, C64, C65, C66, C67 | OPEN (LOW) -- 8 cycles agree |
| date-utils unparseable passthrough | C56, C62, C63, C64, C65, C66, C67 | OPEN (LOW) -- 7 cycles agree |
| CSV DATE_PATTERNS divergence risk | C20, C25, C62, C64, C65, C66, C67 | OPEN (LOW) -- 7 cycles agree |
| Hardcoded fallback drift (CATEGORY_NAMES_KO / build-stats) | C8, C64, C65, C66, C67 | OPEN (LOW) -- 5 cycles agree |
| BANK_SIGNATURES duplication | C7, C66, C67 | OPEN (LOW) -- 3 cycles agree |
| inferYear() timezone dependence | C8, C67 | OPEN (LOW) -- 2 cycles agree (59 cycles deferred) |
| XLSX serial date validation gap | C67 | NEW (MEDIUM) |
| Greedy optimizer O(m*n*k) quadratic | C67 | NEW (MEDIUM) |

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
| C65-02/C66-09 | **FIXED** | Redundant day pre-checks removed |
| C66-01 | **FIXED** | Server-side date-utils.ts now uses month-aware day validation |
| C66-06 | **FIXED** | Server-side parser now uses CP949 |
| C66-08 | LOW | formatIssuerNameKo and CATEGORY_COLORS hardcoded maps will drift |
| C67-01 | MEDIUM | Greedy optimizer O(m*n*k) quadratic behavior |
| C67-04 | MEDIUM | XLSX serial-date path lacks month-aware day validation |
| C67-05 | LOW | Server-side XLSX parser also lacks serial-date validation |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
