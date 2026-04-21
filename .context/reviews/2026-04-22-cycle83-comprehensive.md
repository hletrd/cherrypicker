# Cycle 83 Comprehensive Code Review

**Date:** 2026-04-22
**Reviewer:** Single-pass deep review (all source files re-read)
**Scope:** Full repository -- apps/web/src/, packages/core/, packages/parser/, packages/rules/, packages/viz/, tools/

---

## Verification of Prior Cycle Fixes (C82)

All C82 findings verified against current source:

| Finding | Status | Evidence |
|---|---|---|
| C82-01 | **FIXED** | `TransactionReview.svelte:133-148` reads `analysisStore.result` once into `currentResult` and derives both `gen` and `txs` from the snapshot. Atomic reads confirmed. |
| C82-02 | **FIXED** | `SavingsComparison.svelte:46-47` tracks `lastTargetSavings` and `lastTargetAnnual`; animation starts from last target, not mid-animation value. |
| C82-03 | **FIXED** | `SavingsComparison.svelte:230` uses `displayedSavings >= 100` threshold for `+` prefix. |
| C82-04 | OPEN (LOW) | Deferred -- encoding detection heuristic requires ArrayBuffer. |
| C82-05 | OPEN (LOW) | Re-confirmed -- VisibilityToggle direct DOM mutation persists. |

---

## New Findings (This Cycle)

### C83-01: ReportContent sign-prefix threshold inconsistent with SavingsComparison

**Severity:** MEDIUM | **Confidence:** HIGH
**File:** `apps/web/src/components/report/ReportContent.svelte:48`

The `+` prefix logic in ReportContent uses `opt.savingsVsSingleCard > 0` while SavingsComparison (the dashboard component) uses `displayedSavings >= 100` (the C82-03 fix). For small savings values (1-99 won), the report page shows "+1원" or "+50원" while the dashboard shows "1원" or "50원". This is a direct inconsistency between two views of the same data.

The C82-03 fix added a 100-won threshold to prevent "+1원" flashes during animation, but the same reasoning applies to the report page: amounts below 100 won are not meaningfully positive in Korean banking and the `+` prefix is misleading.

**Concrete scenario:** User has savingsVsSingleCard = 50 won. Dashboard shows "50원" (no prefix), report shows "+50원". Two views of the same optimization result display different formatting.

**Suggested fix:** Change `opt.savingsVsSingleCard > 0` to `opt.savingsVsSingleCard >= 100` in ReportContent line 48, matching the SavingsComparison threshold.

### C83-02: SavingsComparison `lastTargetSavings`/`lastTargetAnnual` are unnecessarily `$state`

**Severity:** LOW | **Confidence:** MEDIUM
**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:46-47`

These variables are declared as `$state(0)` but are only read and written within the same `$effect`. No other reactive binding or derived value reads them. Using `$state` adds unnecessary reactivity tracking. While Svelte 5 correctly handles self-writes within effects (they don't re-trigger the same effect), plain `let` variables would be more semantically correct and slightly more efficient, since there's no reason for these values to be tracked by the reactivity system.

**Suggested fix:** Change from `let lastTargetSavings = $state(0)` to `let lastTargetSavings = 0` (and same for `lastTargetAnnual`).

### C83-03: ReportContent shows negative savings with redundant minus sign under "추가 비용" label

**Severity:** LOW | **Confidence:** MEDIUM
**File:** `apps/web/src/components/report/ReportContent.svelte:46-49`

When cherry-picking is worse than a single card, the label changes to "추가 비용" but the amount still shows with a minus sign (e.g., "추가 비용: -5,000원"). The dashboard's SavingsComparison has the same pattern at line 230. Showing the absolute value ("5,000원") under the "추가 비용" label would be less redundant and clearer, since the label already communicates the negative direction.

**Concrete scenario:** User's cherry-pick result is 5,000 won worse than the best single card. Report shows "추가 비용: -5,000원" -- the minus sign and "추가 비용" label both indicate the same direction.

**Suggested fix:** When `savingsVsSingleCard < 0`, show `formatWon(Math.abs(savingsVsSingleCard))` instead of `formatWon(savingsVsSingleCard)`. Apply the same fix to SavingsComparison line 230.

### C83-04: SpendingSummary `lastWarningGeneration` is `$state` but only used within the same `$effect`

**Severity:** LOW | **Confidence:** MEDIUM
**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:13`

Same pattern as C83-02: `lastWarningGeneration` is only read and written within the same `$effect` at lines 14-19. It doesn't need `$state` reactivity because no other binding or derived value depends on it. Plain `let` would be sufficient and more semantically correct.

**Suggested fix:** Change from `let lastWarningGeneration = $state(0)` to `let lastWarningGeneration = 0`.

### C83-05: `detectCSVDelimiter` scans all lines without a limit for large files

**Severity:** LOW | **Confidence:** MEDIUM
**File:** `apps/web/src/lib/parser/detect.ts:171-188`

The function splits the content by newlines and counts comma, tab, and pipe occurrences on every line. For large CSV files with thousands of lines, this creates many regex match arrays unnecessarily. The delimiter pattern is typically consistent throughout a file, so sampling the first N lines (e.g., 30, matching the header scan limit) would be sufficient and significantly faster for large files.

**Concrete scenario:** A 50,000-line CSV file would run 150,000 regex matches (3 patterns x 50,000 lines). Sampling 30 lines would reduce this to 90 matches with no loss of accuracy.

**Suggested fix:** Add `const sampleLines = lines.slice(0, 30);` and iterate over `sampleLines` instead of `lines`.

---

## Prior Cycle Findings Verification (Sampled)

| Finding | Status | Notes |
|---|---|---|
| C81-01 (reoptimize snapshot) | **FIXED** | store.svelte.ts:501 captures snapshot, uses at line 569 |
| C80-01 (name+size dedup) | **FIXED** | FileDropzone.svelte:141 |
| C79-01 (rawCategory on override) | **FIXED** | TransactionReview.svelte:192 |
| C78-02 (FALLBACK_CATEGORIES leading spaces) | OPEN (LOW) | TransactionReview.svelte:36-64 -- labels still have leading spaces |
| C78-01 (SpendingSummary reset) | **FIXED** | SpendingSummary.svelte:14-19 generation-based reset |
| C77-03 (generic CSV header validation) | **FIXED** | csv.ts header keywords validated |
| C75-02 (FALLBACK_CATEGORIES incomplete) | **FIXED** | 29 subcategory entries now included |
| C72-03 (cachedCategoryLabels empty guard) | **FIXED** | store.svelte.ts:389 |
| C70-01 (detectBank confidence cap) | **FIXED** | detect.ts:159 |
| C67-01 (Greedy optimizer O(m*n*k)) | OPEN (MEDIUM) | Still quadratic -- no architectural fix applied |
| C33-01 (MerchantMatcher O(n) scan) | OPEN (MEDIUM) | Pre-computed SUBSTRING_SAFE_ENTRIES reduces per-call allocation but O(n) scan remains |

---

## No New High-Severity Findings

This cycle found no new HIGH severity issues. The codebase is in a mature state with all previously identified HIGH-severity issues fixed. The most significant new finding is C83-01 (sign-prefix inconsistency between report and dashboard), which is MEDIUM severity.

---

## Final Sweep: Commonly Missed Issue Check

| Category | Checked | Found |
|---|---|---|
| XSS / injection | All dynamic content rendering | No XSS vectors. All content rendered via Svelte template bindings or `textContent`. |
| Prototype pollution | All `JSON.parse` results | No `__proto__` or `constructor` assignments. |
| Uncaught promise rejections | All `.then()` chains and async functions | CardDetail, CardGrid, FileDropzone, VisibilityToggle all handle errors. No uncaught rejections. |
| Memory leaks | All `requestAnimationFrame`, `setTimeout`, event listeners | SavingsComparison cleans up rAF. FileDropzone cleans up timeout. onMount returns cleanup. No leaks found. |
| Off-by-one errors | All `slice()`, loop bounds, array indexing | Date parsing regex groups correctly bounded. Header row scan limits consistent at 30. |
| Type unsafety | All `as` casts | `toCoreCardRuleSets` uses validated narrowing via `VALID_SOURCES`/`VALID_REWARD_TYPES` sets. No unsafe casts. |
| Inconsistent thresholds | All `> 0` / `>= N` checks across components | **Found C83-01**: ReportContent uses `> 0` for savings prefix while SavingsComparison uses `>= 100`. |
| Unnecessary reactivity | All `$state` declarations | **Found C83-02 and C83-04**: Variables used only within the same `$effect` don't need `$state`. |
