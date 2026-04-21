# Review Aggregate -- 2026-04-21 (Cycle 85)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-21-cycle85-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-84 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-84 findings are confirmed fixed except as noted below. C84 findings verified this cycle:

| Finding | Status | Evidence |
|---|---|---|
| C84-01 | **FIXED** | `VisibilityToggle.svelte:93` now uses `>= 100` threshold matching SavingsComparison and ReportContent. |
| C84-02 | **FIXED** | `VisibilityToggle.svelte:93` now uses `Math.abs()` for negative values under "추가 비용", matching SavingsComparison and ReportContent. |
| C84-03 | FALSE POSITIVE | `Number.isFinite(obj.amount)` already guards against Infinity at store.svelte.ts:206. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C85-01 | MEDIUM | HIGH | `SavingsComparison.svelte:237` | Annual projection line not updated with C83-03 fix — shows redundant minus for negative values under "추가 비용" label, inconsistent with monthly display on line 235. |
| C85-02 | LOW | MEDIUM | `SavingsComparison.svelte:237` | Annual projection line missing `+` prefix when savings is positive, inconsistent with monthly display which uses `>= 100` threshold (C82-03). |
| C85-03 | LOW | MEDIUM | `CardDetail.svelte:24-32` | `loadCategories()` called without AbortSignal — fetch not cancelled on unmount during Astro View Transitions. Minor wasted work / memory leak pattern. |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16-C85 | OPEN (MEDIUM) -- 25 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21-C85 | OPEN (MEDIUM) -- 28 cycles agree |
| persistToStorage bare catch / error handling | C62-C85 | PARTIALLY FIXED (C69 added 'error' kind) |
| Annual savings simple *12 projection | C7-C85 | OPEN (LOW) -- 24 cycles agree |
| date-utils unparseable passthrough | C56-C85 | PARTIALLY FIXED (C70 added warn) |
| CSV DATE_PATTERNS divergence risk | C20-C85 | OPEN (LOW) -- 23 cycles agree |
| Hardcoded fallback drift | C8-C85 | OPEN (LOW) -- 21 cycles agree (C76-05) |
| BANK_SIGNATURES duplication | C7-C85 | OPEN (LOW) -- 20 cycles agree |
| inferYear() timezone dependence | C8-C85 | OPEN (LOW) -- 18 cycles agree (60+ cycles deferred) |
| Greedy optimizer O(m*n*k) quadratic | C67-C85 | OPEN (MEDIUM) -- 18 cycles agree |
| CATEGORY_COLORS dark mode contrast | C4-C85 | OPEN (LOW) -- many cycles agree |
| Multi-location bank data sync | C74-C85 | OPEN (LOW) -- 12 cycles noting all 5+ locations |
| BOM handling redundancy | C73-C85 | OPEN (LOW) -- 13 cycles |
| XLSX HTML-as-XLS double decode | C73-C85 | OPEN (LOW) -- 13 cycles (C75-01 simplified to boolean) |
| FALLBACK_CATEGORIES incomplete subcategory coverage | C75-C85 | FIXED (C75-02 added missing entries) |
| loadFromStorage version check lacks migration | C75-C85 | FIXED (C75-03 added framework; C76-01 fixed undefined-_v gap) |
| VisibilityToggle direct DOM mutation | C18-C85 | OPEN (LOW) -- many cycles agree (C76-04/C79-02/C82-05) |
| Generic CSV header detection can misidentify metadata rows | C77-C85 | FIXED (C77-03 added keyword validation; C78-03 defaults to -1) |
| SpendingSummary dismissed not reset on store.reset() | C76-C85 | FIXED (C78-01 added generation-based reset + clearStorage cleanup) |
| TransactionReview changeCategory stale rawCategory | C79-C85 | FIXED (C79-01 added rawCategory: undefined on manual override) |
| FileDropzone filename-only dedup | C80-C85 | FIXED (C80-01 now uses name+size) |
| TransactionReview select not disabled during reoptimizing | C80-C85 | FIXED (C80-02 added disabled={reoptimizing}) |
| CSV header scan limit (20) vs XLSX (30) | C80-C85 | FIXED (C80-03 both now 30) |
| CATEGORY_COLORS missing subcategory keys | C81-C85 | FIXED (C81-04 added dot-notation keys) |
| Bank adapter header scan limit (10) vs generic (30) | C81-C85 | FIXED (C81-02 all adapters now use 30) |
| reoptimize() result! spread without snapshot | C81-C85 | FIXED (C81-01 now uses snapshot) |
| parseAndCategorize redundant loadCategories | C81-C85 | FIXED (C81-03 passes categoryNodes from caller) |
| SavingsComparison animation mid-value start | C82-C85 | FIXED (C82-02 tracks lastTargetSavings) |
| SavingsComparison "+1원" flash at zero | C82-C85 | FIXED (C82-03 uses >= 100 threshold) |
| TransactionReview $effect non-atomic reads | C82-C85 | FIXED (C82-01 reads result once into snapshot) |
| parseFile double memory for CSV | C82-C85 | DEFERRED (C82-04 encoding detection requires ArrayBuffer) |
| ReportContent sign-prefix inconsistency with SavingsComparison | C83-C85 | FIXED (C83-01 applied >= 100 threshold) |
| Unnecessary $state for effect-local variables | C83-C85 | FIXED (C83-02/C83-04 changed to plain let) |
| Negative savings shows redundant minus under "추가 비용" | C83-C85 | PARTIALLY FIXED (C83-01/C84-01 fixed monthly + VisibilityToggle, but annual projection line 237 still missing -- C85-01) |
| detectCSVDelimiter scans all lines without limit | C83-C85 | FIXED (C83-05 added 30-line slice) |
| VisibilityToggle sign-prefix threshold inconsistent | C84-C85 | FIXED (C84-01 applied >= 100 threshold and Math.abs) |
| VisibilityToggle negative savings redundant minus | C84-C85 | FIXED (C84-02 applied Math.abs, merged into C84-01 fix) |
| isOptimizableTx Infinity guard missing | C84-C85 | FALSE POSITIVE (Number.isFinite already present) |
| SavingsComparison annual projection redundant minus under "추가 비용" | C85 | OPEN (MEDIUM) -- C83-03 fix was not applied to the annual projection line |
| SavingsComparison annual projection missing `+` prefix | C85 | OPEN (LOW) -- inconsistent with monthly display |
| CardDetail loadCategories without AbortSignal | C85 | OPEN (LOW) -- minor wasted work on unmount |

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02/D-40/D-82/C9R-04/C18-03/C39-06/C71-03 | LOW | Annual savings projection label unchanged / visual inconsistency |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13/C9-08/D-43/D-74 | LOW | Small-percentage bars nearly invisible |
| C7-04 | LOW | TransactionReview $effect re-sync fragile |
| C7-06 | LOW | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07/C66-10/C70-05 | LOW | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-11 | LOW | persistWarning message misleading for data corruption vs size truncation |
| C8-05/C4-09/C73-07 | LOW | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast |
| C8-07/C4-14/C66-07/C76-05 | LOW | build-stats.ts fallback values will drift |
| C8-08/C67-02 | LOW | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | LOW | Test duplicates production code instead of testing it directly |
| C18-01/C50-08/C76-04/C79-02/C82-05 | LOW | VisibilityToggle $effect directly mutates DOM |
| C18-02 | LOW | Results page stat elements queried every effect run even on dashboard page |
| C18-04 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C20-02/C25-03 | LOW | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04/C25-10 | LOW | pdf.ts module-level regex constants divergence risk with date-utils.ts |
| C21-02 | LOW | cards.ts shared fetch AbortSignal race |
| C22-04/C74-08 | LOW | CSV adapter registry only covers 10 of 24 detected banks |
| C33-01/C66-02 | MEDIUM | MerchantMatcher substring scan O(n) per transaction |
| C33-02/C66-02 | MEDIUM | cachedCategoryLabels stale across redeployments |
| C41-05/C42-04/C71-02 | MEDIUM | loadCategories returns empty array on AbortError -- silently wrong results -- NOW PARTIALLY FIXED by C71-02 guard |
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
| C73-06/C74-03/C75-01 | LOW | XLSX HTML-as-XLS: double-decode overhead remains (prefix dead code fixed) |
| C74-05 | LOW | ALL_BANKS in FileDropzone is 5th copy of bank list needing sync |
| C74-07 | LOW | AbortError vs genuine fetch failure not distinguished in error message |
| C75-02/C76-02/C78-02 | LOW | FALLBACK_CATEGORIES leading-space labels cause browser-inconsistent dropdown rendering |
| C77-02 | LOW | Annual savings projection uses simple *12 multiplication (labeled transparently) |
| C82-04 | LOW | parseFile double memory for CSV (ArrayBuffer + decoded string) |
| C85-01 | MEDIUM | SavingsComparison annual projection redundant minus under "추가 비용" |
| C85-02 | LOW | SavingsComparison annual projection missing `+` prefix |
| C85-03 | LOW | CardDetail loadCategories without AbortSignal on unmount |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
