# Review Aggregate -- 2026-04-22 (Cycle 3)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-22-cycle94-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-93 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-93 findings are confirmed fixed except as noted below. C93 findings verified this cycle:

| Finding | Status | Evidence |
|---|---|---|
| C92-01 | **CONFIRMED OPEN (LOW)** | Savings sign-prefix logic still triplicated across SavingsComparison, VisibilityToggle, and ReportContent without a shared helper. |
| C92-02 | **CONFIRMED OPEN (LOW)** | ALL_BANKS 5th copy of bank list in FileDropzone. Same as C74-05/C7-07. |
| C89-01 | **CONFIRMED OPEN (LOW)** | `VisibilityToggle.svelte:70-71` forward-direction `classList.toggle` has no `isConnected` guard. |
| C89-02 | **CONFIRMED OPEN (LOW)** | `CategoryBreakdown.svelte:129` `rawPct < 2` threshold uses unrounded value. |
| C89-03 | **CONFIRMED OPEN (LOW)** | `formatters.ts:155-157` `m!` non-null assertion after length check. |
| C90-02 | **CONFIRMED OPEN (LOW)** | KakaoBank issuer badge `#fee500` (yellow) on white text fails WCAG AA. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C94-01 | LOW | MEDIUM | `ReportContent.svelte:48` | Savings sign-prefix in ReportContent uses conditional `Math.abs` while SavingsComparison uses unconditional `Math.abs()`. Semantically equivalent but inconsistent style across the triplicated pattern (C92-01). |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| SavingsComparison sign-prefix animation | C82-C91 | **FIXED** (C91-01) |
| MerchantMatcher/taxonomy O(n) scan | C16-C94 | OPEN (MEDIUM) -- 34 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21-C94 | OPEN (MEDIUM) -- 37 cycles agree |
| persistToStorage bare catch / error handling | C62-C94 | PARTIALLY FIXED (C69 added 'error' kind) |
| Annual savings simple *12 projection | C7-C94 | OPEN (LOW) -- 33 cycles agree |
| date-utils unparseable passthrough | C56-C94 | PARTIALLY FIXED (C70 added warn) |
| CSV DATE_PATTERNS divergence risk | C20-C94 | OPEN (LOW) -- 32 cycles agree |
| Hardcoded fallback drift | C8-C94 | OPEN (LOW) -- 30 cycles agree |
| BANK_SIGNATURES duplication | C7-C94 | OPEN (LOW) -- 29 cycles agree |
| inferYear() timezone dependence | C8-C94 | OPEN (LOW) -- 27 cycles agree |
| Greedy optimizer O(m*n*k) quadratic | C67-C94 | OPEN (MEDIUM) -- 27 cycles agree |
| CATEGORY_COLORS dark mode contrast | C4-C94 | OPEN (LOW) -- many cycles agree |
| Multi-location bank data sync | C74-C94 | OPEN (LOW) -- 21 cycles noting all 5+ locations |
| BOM handling redundancy | C73-C94 | OPEN (LOW) -- 22 cycles |
| XLSX HTML-as-XLS double decode | C73-C94 | OPEN (LOW) -- 22 cycles |
| VisibilityToggle direct DOM mutation | C18-C94 | OPEN (LOW) -- many cycles agree |
| No integration test for multi-file upload | C86-C94 | OPEN (MEDIUM) -- 9 cycles agree |
| Mobile menu focus trap | C86-C94 | OPEN (LOW) -- 9 cycles agree |
| KakaoBank badge contrast | C90-C94 | OPEN (LOW) -- 5 cycles |
| Savings sign-prefix logic triplication | C92-C94 | OPEN (LOW) -- 3 cycles |

---

## Still-Open Actionable Findings (fixable this cycle)

No new actionable (HIGH/MEDIUM) findings remaining. C93-01 was HIGH and has been fixed.

---

## Still-Open Deferred Findings (carried forward)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02/D-40/D-82/C9R-04/C18-03/C39-06/C71-03 | LOW | Annual savings projection label unchanged / visual inconsistency |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13/C9-08/D-43/D-74 | LOW | Small-percentage bars nearly invisible |
| C7-04 | LOW | TransactionReview $effect re-sync fragile |
| C7-06 | LOW | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07/C66-10/C70-05/C86-10/C92-02 | LOW | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-11 | LOW | persistWarning message misleading for data corruption vs size truncation |
| C8-05/C4-09/C73-07/C86-14/C90-02 | LOW | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast; KakaoBank badge yellow-on-white |
| C8-07/C4-14/C66-07/C76-05 | LOW | build-stats.ts fallback values will drift |
| C8-08/C67-02 | LOW | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | LOW | Test duplicates production code instead of testing it directly |
| C18-01/C50-08/C76-04/C79-02/C82-05/C86-04/C89-01 | LOW | VisibilityToggle $effect directly mutates DOM |
| C18-02 | LOW | Results page stat elements queried every effect run even on dashboard page |
| C18-04 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C20-02/C25-03 | LOW | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04/C25-10 | LOW | pdf.ts module-level regex constants divergence risk with date-utils.ts |
| C21-02/C33-02/C86-11 | MEDIUM | cachedCategoryLabels stale across redeployments |
| C22-04/C74-08/C90-03 | LOW | CSV adapter registry only covers 10 of 24 detected banks |
| C33-01/C66-02/C86-12 | MEDIUM | MerchantMatcher substring scan O(n) per transaction |
| C41-05/C42-04/C71-02 | MEDIUM | loadCategories returns empty array on AbortError -- NOW PARTIALLY FIXED by C71-02 guard |
| C56-04/C70-03/C71-04 | LOW | date-utils.ts returns raw input for unparseable dates without error reporting |
| C56-05 | LOW | Zero savings shows "0원" without plus sign |
| C62-11/C66-04 | LOW | persistToStorage returns 'corrupted' for non-quota errors -- PARTIALLY FIXED |
| C64-03/C66-05/C67-03 | LOW | CATEGORY_NAMES_KO hardcoded map can drift from YAML taxonomy |
| C66-08/C74-04/C77-04 | LOW | formatIssuerNameKo and CATEGORY_COLORS hardcoded maps will drift |
| C67-01/C74-06 | MEDIUM | Greedy optimizer O(m*n*k) quadratic behavior |
| C69-01/C73-01/C79-03/C82-02 | LOW | SavingsComparison animation flicker / mid-value start |
| C70-02 | LOW | cachedCategoryLabels not invalidated on Astro View Transitions |
| C70-04 | LOW | csv.ts reimplements shared.ts instead of importing from it |
| C71-05 | LOW | BANK_SIGNATURES array order affects detection accuracy for overlapping patterns |
| C73-04 | LOW | BOM stripping redundancy across parser chain |
| C73-06/C74-03/C75-01 | LOW | XLSX HTML-as-XLS: double-decode overhead remains |
| C74-05 | LOW | ALL_BANKS in FileDropzone is 5th copy of bank list needing sync |
| C74-07 | LOW | AbortError vs genuine fetch failure not distinguished in error message |
| C75-02/C76-02/C78-02 | LOW | FALLBACK_CATEGORIES leading-space labels cause browser-inconsistent dropdown rendering |
| C77-02 | LOW | Annual savings projection uses simple *12 multiplication (labeled transparently) |
| C82-04 | LOW | parseFile double memory for CSV (ArrayBuffer + decoded string) |
| C85-03 | LOW | CardDetail loadCategories without AbortSignal on unmount |
| C86-02/C87-03 | LOW | CategoryBreakdown getCategoryColor gray fallback for unknown dot-notation keys |
| C86-03 | LOW | Generic CSV header detection matches summary rows |
| C86-05 | LOW | XLSX header detection matchCount without category weighting |
| C86-13/C88-11 | LOW | Mobile menu lacks focus trap and Escape-to-close |
| C86-16/C88-09 | MEDIUM | No integration test for multi-file upload |
| C88-10 | LOW | No test for SavingsComparison sign-prefix behavior |
| C92-01 | LOW | Savings sign-prefix logic triplicated across components without shared helper |
| C94-01 | LOW | ReportContent uses conditional Math.abs while SavingsComparison uses unconditional -- style inconsistency within triplicated pattern |

---

## Agent Failures

No agent failures. Review completed successfully.
