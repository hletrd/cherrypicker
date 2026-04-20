# Review Aggregate -- 2026-04-21 (Cycle 66)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-21-cycle66-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-65 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-65 findings are confirmed fixed except as noted below.
New in cycle 66: C65-01 confirmed **FIXED** (isValidShortDate now uses MAX_DAYS_PER_MONTH table).

| Finding | Status | Evidence |
|---|---|---|
| C65-01 | **FIXED** | `pdf.ts:32-50` uses `MAX_DAYS_PER_MONTH` table for month-aware day validation in `isValidShortDate()`. |
| C65-02 | OPEN (LOW) | `date-utils.ts:100,124` still has redundant `day >= 1` pre-check before `isValidDayForMonth`. |
| C64-01 | **FIXED** | `parser-date.test.ts:9-10` imports from production `date-utils.ts`. |
| C64-02 | **FIXED** | `parser/index.ts:20-23` encoding list is `['utf-8', 'cp949']`. |
| C64-03 | OPEN (LOW) | `CATEGORY_NAMES_KO` hardcoded map still present with TODO comment. |
| C63-04 | **FIXED** | `date-utils.ts:12-20` adds `daysInMonth()` and `isValidDayForMonth()`. |
| C63-07 | **FIXED** | `parser/index.ts:29-38` iterates ALL encodings and picks fewest replacement chars. |
| C62-09 | **FIXED** | `cards.ts:158-168` builds `cardIndex` Map; `getCardById` uses O(1) lookup. |
| C62-11 | OPEN (LOW) | `store.svelte.ts:154-165` logs non-quota errors but returns 'corrupted' for ALL non-quota errors. |
| C56-04 | OPEN (LOW) | `date-utils.ts:132` still returns raw input for unparseable dates. |
| C56-05 | OPEN (LOW) | Zero savings shows "0원" without plus sign. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C66-01 | MEDIUM | HIGH | `packages/parser/src/date-utils.ts:43,52,64,74,85,95` | Server-side `parseDateStringToISO` uses `day <= 31` validation while web-side uses `isValidDayForMonth(year, month, day)`. Server-side parser (CLI) will accept impossible dates like "2024-02-31" that the web parser correctly rejects. |
| C66-02 | MEDIUM | HIGH | `apps/web/src/lib/store.svelte.ts:327-334` | `cachedCategoryLabels` stale across redeployments (carry-forward from C33-02). 9 cycles agree. |
| C66-03 | MEDIUM | HIGH | `packages/core/src/categorizer/taxonomy.ts:71-76` | MerchantMatcher substring scan O(n) per transaction (carry-forward from C33-01). 7 cycles agree. |
| C66-04 | LOW | HIGH | `apps/web/src/lib/store.svelte.ts:154-166` | `persistToStorage` returns 'corrupted' for non-quota errors like circular references, giving misleading user message (carry-forward from C62-11). 4 cycles agree. |
| C66-05 | LOW | HIGH | `apps/web/src/components/dashboard/TransactionReview.svelte:13-27` | `FALLBACK_CATEGORIES` hardcoded 13 categories vs 40+ in taxonomy. Carry-forward from C64-03. |
| C66-06 | LOW | HIGH | `packages/parser/src/index.ts:43` | Server-side parser uses `euc-kr` while web-side uses `cp949`. CP949 is a strict superset; EUC-KR may produce more replacement characters for certain Korean text. |
| C66-07 | LOW | HIGH | `apps/web/src/lib/build-stats.ts:16-18` | Hardcoded fallback stats (`totalCards: 683`) will drift from actual card count. Carry-forward from C8-07. |
| C66-08 | LOW | MEDIUM | `apps/web/src/lib/formatters.ts:52-79` | `formatIssuerNameKo()` and `CATEGORY_COLORS` are hardcoded maps that must be manually updated when issuers/categories are added. |
| C66-09 | LOW | HIGH | `apps/web/src/lib/parser/date-utils.ts:100,124` | Redundant `day >= 1` pre-check before `isValidDayForMonth`. Carry-forward from C65-02. |
| C66-10 | LOW | HIGH | `packages/parser/src/detect.ts` vs `apps/web/src/lib/parser/detect.ts` | `BANK_SIGNATURES` duplicated between server and web. Carry-forward from C7-07. |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

The following findings have been flagged by multiple cycles, indicating high signal:

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16, C33, C50, C62, C63, C64, C65, C66 | OPEN (MEDIUM) -- 8 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21, C23, C25, C26, C33, C62, C63, C64, C65, C66 | OPEN (MEDIUM) -- 10 cycles agree |
| persistToStorage bare catch / 'corrupted' for all non-quota | C62, C63, C64, C65, C66 | OPEN (LOW) -- 5 cycles agree |
| CategoryBreakdown dark mode contrast | C4, C8, C59, C62 | OPEN (LOW) -- 4 cycles agree |
| Annual savings simple *12 projection | C7, C18, C62, C63, C64, C65, C66 | OPEN (LOW) -- 7 cycles agree |
| date-utils unparseable passthrough | C56, C62, C63, C64, C65, C66 | OPEN (LOW) -- 6 cycles agree |
| CSV DATE_PATTERNS divergence risk | C20, C25, C62, C64, C65, C66 | OPEN (LOW) -- 6 cycles agree |
| Hardcoded fallback drift (CATEGORY_NAMES_KO / build-stats) | C8, C64, C65, C66 | OPEN (LOW) -- 4 cycles agree |
| BANK_SIGNATURES duplication | C7, C66 | OPEN (LOW) -- 2 cycles agree |
| Server vs web date-utils validation gap | C66 | NEW (MEDIUM) |
| Server EUC-KR vs web CP949 | C66 | NEW (LOW) |

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
| C8-08 | LOW | inferYear() timezone-dependent near midnight Dec 31 |
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
| C64-03/C66-05 | LOW | CATEGORY_NAMES_KO hardcoded map can drift from YAML taxonomy |
| C65-02/C66-09 | LOW | date-utils.ts redundant day<=31 pre-check before isValidDayForMonth |
| C66-01 | MEDIUM | Server-side date-utils.ts lacks month-aware day validation |
| C66-06 | LOW | Server-side parser uses EUC-KR while web-side uses CP949 |
| C66-08 | LOW | formatIssuerNameKo and CATEGORY_COLORS hardcoded maps will drift |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
