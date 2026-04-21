# Review Aggregate -- 2026-04-22 (Cycle 82)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-22-cycle82-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-81 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-80 findings are confirmed fixed except as noted below. C81 findings verified this cycle:

| Finding | Status | Evidence |
|---|---|---|
| C81-01 | **FIXED** | `store.svelte.ts:501` now captures `const snapshot = result;` after the null guard and uses `...snapshot` at line 569 instead of `...result!`. |
| C81-02 | **FIXED** | All 10 bank adapters in `csv.ts` now scan `Math.min(30, lines.length)` for header detection. |
| C81-03 | **FIXED** | `analyzer.ts:110` uses `categoryNodes ??` with nullish coalescing; `analyzeMultipleFiles` passes `categoryNodes` at line 284. |
| C81-04 | **FIXED** | `CategoryBreakdown.svelte:51-84` now includes dot-notation subcategory keys in `CATEGORY_COLORS`. |
| C80-01 | **FIXED** | `FileDropzone.svelte:141` uses name+size dedup. |
| C80-02 | **FIXED** | `TransactionReview.svelte:289` has `disabled={reoptimizing}`. |
| C80-03 | **FIXED** | `csv.ts:158` uses `Math.min(30, lines.length)` for generic header scan. |
| C79-01 | **FIXED** | `TransactionReview.svelte:185` sets `rawCategory: undefined` on manual override. |
| C78-02 | OPEN (LOW) | FALLBACK_CATEGORIES leading-space labels (same as C75-02/C76-02). |
| C78-03 | **FIXED** | `parseGenericCSV` defaults `headerIdx = -1` and returns error when no header found. |
| C77-03 | **FIXED** | `parseGenericCSV` header detection validates against `HEADER_KEYWORDS` list. |
| C76-01 | **FIXED** | `loadFromStorage` migration loop treats `_v ?? 0` as version 0. |
| C75-01 | **FIXED** | `isHTMLContent` reverted to boolean return. |
| C75-02 | **FIXED** | `FALLBACK_CATEGORIES` now includes 29 subcategory entries. |
| C75-03 | **FIXED** | `MIGRATIONS` map added; migration loop added in `loadFromStorage`. |
| C72-01 | **FIXED** | `handleRetry()` clears `navigateTimeout`. |
| C72-02 | **FIXED** | `optimizeFromTransactions()` guards `transformed.length > 0` before caching. |
| C72-03 | **FIXED** | `getCategoryLabels()` guards `nodes.length > 0` before caching. |
| C72-04 | **FIXED** | `addFiles()` accumulates all error types into `errorParts[]`. |
| C72-05 | **FIXED** | `loadCardsData()` and `loadCategories()` retry on undefined/aborted promise. |
| C73-02 | **FIXED** | TransactionReview uses AbortController in onMount with cleanup. |
| C70-01 | **FIXED** | `detectBank` caps confidence at 0.5 for single-pattern banks. |
| C69-02 | **FIXED** | `parseCSVAmount`/`parseAmount` handle parenthesized negatives. |
| C68-01 | **FIXED** | Server-side PDF `isValidShortDate` uses `MAX_DAYS_PER_MONTH` table. |
| C68-02 | **FIXED** | `scoreCardsForTransaction` uses push/pop instead of spread array. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C82-01 | MEDIUM | MEDIUM | `apps/web/src/components/dashboard/TransactionReview.svelte:127-142` | `$effect` sync reads `analysisStore.generation` and `analysisStore.transactions` reactively from separate getter calls. The two reads are not atomic -- if `result` changes between them during Astro View Transition re-mounts, the effect may copy stale/inconsistent data. Reading `analysisStore.result` once into a snapshot and deriving both values from it would be safer. |
| C82-02 | LOW | HIGH | `apps/web/src/components/dashboard/SavingsComparison.svelte:45-76` | `displayedSavings` animation reads its own reactive value as the animation start point. During rapid reoptimize clicks, two animation loops can overlap, causing the second animation to start from a mid-animation value rather than the previous target, creating a visible "dip" or "jump" in the displayed number. |
| C82-03 | LOW | HIGH | `apps/web/src/lib/formatters.ts:8` + `SavingsComparison.svelte:217` | `formatWon` normalizes `-0` to `+0` but the sign-prefix logic in SavingsComparison uses `displayedSavings > 0`. During the count-up animation, small positive values from rounding (e.g., 1 won) cause a brief "+1원" flash before settling to "0원" when savings is actually 0. A threshold check (e.g., `>= 100`) would prevent this. |
| C82-04 | LOW | MEDIUM | `apps/web/src/lib/parser/index.ts:17-68` | For CSV files, `parseFile` reads the file into an ArrayBuffer (~10MB) then decodes it with TextDecoder into a JavaScript string (~30MB UTF-16), creating ~40MB peak memory for a 10MB file. Using `file.text()` directly for CSV would avoid the intermediate ArrayBuffer. |
| C82-05 | LOW | HIGH | `apps/web/src/components/ui/VisibilityToggle.svelte:70-71,90-108,119-125` | Re-confirmation of C18-01/C76-04/C79-02: direct DOM mutation via `textContent` and `classList.toggle` outside Svelte's reactivity system. No new regression, but the architectural risk persists. |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16-C82 | OPEN (MEDIUM) -- 22 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21-C82 | OPEN (MEDIUM) -- 25 cycles agree |
| persistToStorage bare catch / error handling | C62-C82 | PARTIALLY FIXED (C69 added 'error' kind) |
| Annual savings simple *12 projection | C7-C82 | OPEN (LOW) -- 21 cycles agree |
| date-utils unparseable passthrough | C56-C82 | PARTIALLY FIXED (C70 added warn) |
| CSV DATE_PATTERNS divergence risk | C20-C82 | OPEN (LOW) -- 20 cycles agree |
| Hardcoded fallback drift | C8-C82 | OPEN (LOW) -- 18 cycles agree (C76-05) |
| BANK_SIGNATURES duplication | C7-C82 | OPEN (LOW) -- 17 cycles agree |
| inferYear() timezone dependence | C8-C82 | OPEN (LOW) -- 15 cycles agree (60+ cycles deferred) |
| Greedy optimizer O(m*n*k) quadratic | C67-C82 | OPEN (MEDIUM) -- 15 cycles agree |
| CATEGORY_COLORS dark mode contrast | C4-C82 | OPEN (LOW) -- many cycles agree |
| Multi-location bank data sync | C74-C82 | OPEN (LOW) -- 9 cycles noting all 5+ locations |
| BOM handling redundancy | C73-C82 | OPEN (LOW) -- 10 cycles |
| XLSX HTML-as-XLS double decode | C73-C82 | OPEN (LOW) -- 10 cycles (C75-01 simplified to boolean) |
| FALLBACK_CATEGORIES incomplete subcategory coverage | C75-C82 | FIXED (C75-02 added missing entries) |
| loadFromStorage version check lacks migration | C75-C82 | FIXED (C75-03 added framework; C76-01 fixed undefined-_v gap) |
| VisibilityToggle direct DOM mutation | C18-C82 | OPEN (LOW) -- many cycles agree (C76-04/C79-02/C82-05) |
| Generic CSV header detection can misidentify metadata rows | C77-C82 | FIXED (C77-03 added keyword validation; C78-03 defaults to -1) |
| SpendingSummary dismissed not reset on store.reset() | C76-C82 | FIXED (C78-01 added generation-based reset + clearStorage cleanup) |
| TransactionReview changeCategory stale rawCategory | C79-C82 | FIXED (C79-01 added rawCategory: undefined on manual override) |
| FileDropzone filename-only dedup | C80-C82 | FIXED (C80-01 now uses name+size) |
| TransactionReview select not disabled during reoptimizing | C80-C82 | FIXED (C80-02 added disabled={reoptimizing}) |
| CSV header scan limit (20) vs XLSX (30) | C80-C82 | FIXED (C80-03 both now 30) |
| CATEGORY_COLORS missing subcategory keys | C81-C82 | FIXED (C81-04 added dot-notation keys) |
| Bank adapter header scan limit (10) vs generic (30) | C81-C82 | FIXED (C81-02 all adapters now use 30) |
| reoptimize() result! spread without snapshot | C81-C82 | FIXED (C81-01 now uses snapshot) |
| parseAndCategorize redundant loadCategories | C81-C82 | FIXED (C81-03 passes categoryNodes from caller) |
| SavingsComparison animation mid-value start | C82 | NEW (LOW) |
| SavingsComparison "+1원" flash at zero | C82 | NEW (LOW) |
| TransactionReview $effect non-atomic reads | C82 | NEW (MEDIUM) |
| parseFile double memory for CSV | C82 | NEW (LOW) |

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
| C33-01/C66-03 | MEDIUM | MerchantMatcher substring scan O(n) per transaction |
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
| C82-01 | MEDIUM | TransactionReview $effect non-atomic reactive reads |
| C82-03 | LOW | SavingsComparison "+1원" flash at zero savings |
| C82-04 | LOW | parseFile double memory for CSV (ArrayBuffer + decoded string) |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
