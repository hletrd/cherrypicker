# Comprehensive Code Review — Cycle 8 (2026-04-19)

**Reviewer:** multi-angle (code quality, perf, security, debugger, architect, designer, test, verifier)
**Scope:** Full repository — all packages, apps, tools, e2e, tests
**Focus:** New findings beyond cycles 1-7; verification of cycle 7 fixes; deep analysis of edge cases

---

## Verification of Cycle 7 Fixes

| Fix | Status | Notes |
|-----|--------|-------|
| C7-08: Korean short-date and MM/DD in PDF parser | **FIXED** | `inferYear` and koreanShort/mdMatch added to pdf.ts:126-174 |
| C7-02: formatRatePrecise in SpendingSummary | **FIXED** | Line 94 now uses `formatRatePrecise(analysisStore.optimization.effectiveRate)` |
| C7-01: formatRate in SavingsComparison breakdown | **FIXED** | Line 223 now uses `formatRate(card.rate)` |
| C7-03: formatRatePrecise in SavingsComparison best single card | **FIXED** | Line 149 now uses `formatRatePrecise(opt.bestSingleCard.totalReward / opt.totalSpending)` |
| C7-11: Differentiate persistWarning truncation vs corruption | **FIXED** | `PersistWarningKind` type with 'truncated'/'corrupted'/null, separate messages in SpendingSummary |
| C7-04: Guard TransactionReview effect against unnecessary re-syncs | **FIXED** | `lastSyncedGeneration` state tracks last synced gen, skips re-sync when gen unchanged |
| C7-06: Document all-month transactions behavior | **FIXED** | Comment block at analyzer.ts:285-290 explains the design |

All cycle 7 fixes verified as correctly implemented.

---

## New Findings

### C8-01: `SpendingSummary.formatPeriod` uses `parseInt` without NaN guard on split date parts

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:17-23`
- **Description:** The `formatPeriod` function splits period dates on `-` and calls `parseInt(sm, 10)` / `parseInt(em, 10)` at lines 20-21 without checking if the split produced valid numeric strings. If `period.start` is malformed (e.g., "2026--15"), `parseInt` returns NaN and the displayed text would be "2026년 NaN월". The existing `if (!sy || !sm || !ey || !em)` guard at line 19 checks for empty strings but not for non-numeric strings like "ab".
- **Failure scenario:** A corrupted `statementPeriod` from sessionStorage contains `{ start: "2026-ab-01", end: "2026-ab-31" }`. The empty-string check passes (`"ab"` is truthy), but `parseInt("ab", 10)` returns NaN, showing "2026년 NaN월 ~ 2026년 NaN월" in the UI.
- **Fix:** After the truthy check, add a `Number.isNaN(parseInt(sm, 10))` guard and return '-' if any part is not a valid number. Or use the `formatDateKo` / `formatDateShort` helpers from formatters.ts which have the same `parseInt` issue (already deferred as D-58), but at least centralize the risk.

### C8-02: `pdf.ts` fallback parser's `fallbackDatePattern` doesn't match Korean date formats or short dates

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/pdf.ts:303`
- **Description:** The fallback line-scanning parser at line 303 uses `fallbackDatePattern = /(\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}|\d{2}[.\-\/]\d{2}[.\-\/]\d{2})/` which only matches YYYY-MM-DD and YY-MM-DD formats. It does NOT match Korean dates like "1월 15일" or "2024년 1월 15일", nor short MM/DD dates. Meanwhile, the structured parser's `parseDateToISO` (line 138) handles all these formats. The fallback parser calls `parseDateToISO(dateMatch[1]!)` at line 322, so if the regex doesn't match a Korean date on the line, the line is skipped entirely — even though `parseDateToISO` could handle it.
- **Failure scenario:** A PDF where the table parser fails (no column structure detected) and transactions appear on individual lines with Korean dates like "1월 15일 스타벅스 5,000원". The `fallbackDatePattern` doesn't match "1월 15일", so the line is skipped and the transaction is lost.
- **Fix:** Extend `fallbackDatePattern` to include Korean and short-date patterns: `/(\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}|\d{2}[.\-\/]\d{2}[.\-\/]\d{2}|\d{1,2}월\s*\d{1,2}일|\d{1,2}[.\-\/]\d{1,2}(?![.\-\/]\d))/`. Or, more robustly, extract date patterns using the same regexes that `parseDateToISO` handles.

### C8-03: `pdf.ts` structured `findDateCell` doesn't search for Korean date formats

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/pdf.ts:182-188`
- **Description:** The `findDateCell` function only checks cells against `STRICT_DATE_PATTERN` (YYYY-MM-DD) and `SHORT_YEAR_DATE_PATTERN` (YY-MM-DD). It does not check for Korean date formats (`1월 15일`, `2024년 1월 15일`) or MM/DD short dates. If a PDF table row has a Korean date in one of its cells, `findDateCell` returns null, causing the entire row to be skipped even though `parseDateToISO` could handle the format.
- **Failure scenario:** A PDF statement with tabular data where the date column contains Korean dates like "1월 15일" instead of "01-15". The structured parser fails to find a date cell, skips the row, and the transaction is lost.
- **Fix:** Add Korean date and short-date regex checks to `findDateCell`:
  ```ts
  const KOREAN_DATE_PATTERN = /\d{1,2}월\s*\d{1,2}일/;
  const SHORT_MD_PATTERN = /^\d{1,2}[.\-\/]\d{1,2}$/;
  // Add to findDateCell's check alongside STRICT_DATE_PATTERN and SHORT_YEAR_DATE_PATTERN
  ```

### C8-04: `CardDetail.svelte` fetch race condition — `fetchGeneration` is not reset on cardId change

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/cards/CardDetail.svelte:57-72`
- **Description:** The `$effect` at line 57 increments `fetchGeneration` on each run and checks `gen === fetchGeneration` in the .then/.catch/.finally callbacks. This correctly handles out-of-order responses. However, `fetchGeneration` is declared as a module-level `let` (line 15) that persists across the component's lifetime. It's never reset, so it monotonically increases. This is functionally correct but means that if the component is destroyed and recreated (e.g., navigating away and back), the counter continues from its previous value rather than resetting. This is not a bug — the stale-response guard still works correctly — but it's slightly fragile. More importantly, there's no cleanup for the `getCardDetail` promise if the component is destroyed while the fetch is in-flight.
- **Failure scenario:** User views card A, then card B, then quickly navigates away from the cards page. The fetch for card B completes after the component is destroyed. No memory leak since the .then only sets local state, but the stale promise is wasteful.
- **Fix:** Minor — add an `onDestroy` cleanup flag to cancel pending fetches, or use an AbortController. The current implementation works correctly; this is a robustness improvement.

### C8-05: `SavingsComparison.svelte` annual projection divides `savingsVsSingleCard` by zero when `bestSingleCard.totalReward` is 0

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:71-75`
- **Description:** `savingsPct` is computed as `opt.savingsVsSingleCard / opt.bestSingleCard.totalReward` at line 73. When `bestSingleCard.totalReward` is 0 (e.g., no card gives any reward for the uploaded transactions), this produces `0 / 0 = NaN`. The `Number.isFinite(raw)` check at line 74 returns false for NaN, so `savingsPct` falls back to 0. The result is correct, but the NaN computation is unnecessary and could confuse debugging.
- **Failure scenario:** User uploads a statement where all transactions are in uncategorized categories with no matching reward rules. All cards produce 0 reward. `savingsPct` goes through a NaN path before being clamped to 0. No visible bug, but the code path is misleading.
- **Fix:** Add a guard: `if (!opt.bestSingleCard || opt.bestSingleCard.totalReward === 0) return 0;` before the division.

### C8-06: `CategoryBreakdown.svelte` `CATEGORY_COLORS` is missing `traditional_market` and other categories present in taxonomy

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:7-49`
- **Description:** The hardcoded `CATEGORY_COLORS` map does not include `traditional_market` (already noted as D-46/D-42). However, reviewing more broadly, several other categories from the core package's `CATEGORY_NAMES_KO` (greedy.ts:7-50) are also missing: `offline_shopping`, `department_store`, `taxi`, `subway`, `bus`, `parking`, `toll`, `hospital`, `pharmacy`, `academy`, `books`, `movie`, `hotel`, `airline`, `electricity`, `gas`, `water`, `general`. These all fall through to `CATEGORY_COLORS.uncategorized` (gray), making them indistinguishable from truly uncategorized items.
- **Failure scenario:** User has transactions in `offline_shopping` and `department_store` categories. Both display with the same gray color as `uncategorized`, making the breakdown chart visually confusing.
- **Fix:** This extends D-42/D-46. The exit criterion (dynamic color generation) remains the correct long-term fix. For now, adding the missing entries to `CATEGORY_COLORS` is a quick improvement.

### C8-07: `detectBank` confidence score can be misleading when only one generic pattern matches

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/parser/detect.ts:114-137`
- **Description:** The `detectBank` function computes confidence as `bestScore / bestBankPatterns`. When a bank has only one pattern (like `cu` with only `/신협/`), any match gives confidence 1.0 (100%). But "신협" is a common substring that could appear in non-credit-card contexts. Conversely, banks with multiple patterns (like `hyundai` with 3 patterns) get a lower confidence score even when 2 out of 3 patterns match (0.67). This means a weak single-pattern match can outscore a strong multi-pattern match.
- **Failure scenario:** A document mentions "신협" in passing (e.g., "신협에서 대출받음") but is actually a Hyundai Card statement. The `cu` bank gets confidence 1.0 while `hyundai` might only get 0.67, causing the wrong bank to be selected.
- **Fix:** Weight confidence by the number of patterns matched (absolute score), not by the ratio. Or use a minimum threshold (e.g., at least 2 patterns must match for confidence > 0.5).

### C8-08: `CardGrid.svelte` issuer filter shows ALL issuers including those with 0 matching cards

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/cards/CardGrid.svelte:22`
- **Description:** `availableIssuers` is derived from `cards.map(c => c.issuer)`, which means it only includes issuers that have cards. However, after applying the `typeFilter`, some issuers may have 0 cards in the filtered set. The issuer filter pill still shows these issuers, and clicking them shows "검색 결과가 없어요" with no cards.
- **Failure scenario:** User filters to "체크카드" type. The issuer filter still shows all issuers including those that only offer credit cards. Clicking "현대카드" when Hyundai has no check cards in the dataset shows an empty result.
- **Fix:** Derive `availableIssuers` from the type-filtered card list, not the full list.

### C8-09: `analyzer.ts` category labels map is rebuilt on every `optimizeFromTransactions` call even when `prebuiltCategoryLabels` is not provided

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/analyzer.ts:172-184`
- **Description:** When `prebuiltCategoryLabels` is not provided (which happens when `optimizeFromTransactions` is called directly from `reoptimize` in the store), the function fetches categories again via `loadCategories()` and rebuilds the labels map. During `reoptimize`, this means an extra network fetch for `categories.json` on every re-optimization. The `loadCategories` function caches the promise, so it's not a true network request after the first call, but it still rebuilds the `Map` from scratch each time.
- **Failure scenario:** User edits a transaction category and clicks "apply edits". The reoptimize flow calls `optimizeFromTransactions(editedTxs)` without `prebuiltCategoryLabels`, triggering a redundant `loadCategories()` call and Map rebuild.
- **Fix:** The `reoptimize` method in the store should pass the prebuilt category labels. Since the store already has access to the analysis result which was built with labels, save the labels map in the store and pass it through on reoptimize.

### C8-10: `pdf.ts` `parseAmount` uses `parseInt` which silently truncates decimal amounts

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/parser/pdf.ts:177-180`
- **Description:** `parseAmount` calls `parseInt(raw.replace(/원$/, '').replace(/,/g, ''), 10)` which truncates any decimal portion. While Korean Won amounts are always integers, some PDF statements may include amounts with trailing decimals (e.g., "1,234.00원" from automated exports). `parseInt("1234.00")` returns 1234, which is correct for Won, but `parseInt("1,234.56")` after removing commas gives `parseInt("1234.56")` which returns 1234 — silently discarding the 56 jeon (0.56 Won). This is the same pattern used in csv.ts and xlsx.ts.
- **Failure scenario:** A PDF from a foreign-card-enabled statement includes KRW-converted amounts with decimal remainders. The 0.56 Won is lost. Since Korean Won doesn't have sub-unit coins, this is effectively a non-issue for domestic statements, but it could affect foreign-currency-converted amounts.
- **Fix:** Use `Math.round(parseFloat(...))` instead of `parseInt` to properly round rather than truncate. This is consistent with the convention that all amounts are in Won (integer).

### C8-11: `store.svelte.ts` `_loadPersistWarningKind` module-level variable is not reset after being read

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/store.svelte.ts:154`
- **Description:** `_loadPersistWarningKind` is set in `loadFromStorage` (line 180) and read during store initialization (line 231). However, it is never reset to `null` after being consumed. If the store is created again (e.g., in a hot-module-reload scenario during development), the stale `_loadPersistWarningKind` value from a previous load would be used, potentially showing an incorrect warning. The `reset()` method at line 329 does reset `_persistWarningKind` but does NOT reset `_loadPersistWarningKind`.
- **Failure scenario:** During development with HMR, the store module is re-evaluated. `loadFromStorage()` returns null (sessionStorage was cleared), but `_loadPersistWarningKind` still holds 'corrupted' from a previous load cycle. The store initializes with `persistWarningKind = 'corrupted'` even though the storage is clean.
- **Fix:** Reset `_loadPersistWarningKind = null` after reading it in the store initialization, and also reset it in the `reset()` method.

### C8-12: `TransactionReview.svelte` AI categorizer import is dead code — `aiCategorizer.isAvailable()` always returns false

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:6`
- **Description:** The `categorizer-ai.ts` module is imported at line 6, and `aiCategorizer.isAvailable()` is called at line 45. The module's `isAvailable()` function always returns `false` (categorizer-ai.ts:17), so `aiAvailable` is always `false`. This means the AI categorization UI button is never shown, making the import and all AI-related state variables (`aiStatus`, `aiProgress`, `aiRunning`, `aiAvailable`) dead code. This was already deferred as D-10.
- **Failure scenario:** The import adds a small amount of dead code to the bundle. No runtime impact since the code is never executed.
- **Fix:** Already deferred as D-10. No change needed this cycle.

### C8-13: `buildConstraints` uses shallow copy of transactions array — mutations to transaction objects could affect caller

- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/optimizer/constraints.ts:17`
- **Description:** `buildConstraints` creates `[...transactions]` (shallow copy) at line 17, which means the array itself is new but the transaction objects inside are the same references. If the optimizer or calculator mutates a transaction object (e.g., changing `tx.category`), it would affect the caller's data. Currently, the optimizer does NOT mutate transaction objects (it only reads them), so this is not an active bug. But it's a latent risk if the code is refactored.
- **Failure scenario:** A future change to the optimizer mutates a transaction's `amount` field (e.g., to apply a per-transaction cap). This would corrupt the original data in the caller's array.
- **Fix:** Document that the optimizer must not mutate transaction objects, or deep-copy them in `buildConstraints`. Deep-copying would have a performance cost for large transaction sets.

---

## Summary of New Findings

| ID | Severity | Confidence | Category | Description |
|----|----------|------------|----------|-------------|
| C8-01 | MEDIUM | High | robustness | `SpendingSummary.formatPeriod` uses `parseInt` without NaN guard on date parts |
| C8-02 | MEDIUM | High | bug | PDF fallback `fallbackDatePattern` doesn't match Korean/short dates — misses transactions |
| C8-03 | MEDIUM | High | bug | PDF structured `findDateCell` doesn't search Korean/short date formats — skips rows |
| C8-04 | LOW | Medium | robustness | `CardDetail.svelte` fetch has no cleanup on component destroy |
| C8-05 | LOW | High | robustness | `savingsPct` divides by zero (NaN path) when bestSingleCard has 0 reward |
| C8-06 | LOW | High | UX | CategoryBreakdown CATEGORY_COLORS missing many categories from taxonomy (extends D-42/D-46) |
| C8-07 | LOW | Medium | logic | `detectBank` confidence score can be misleading with single-pattern banks |
| C8-08 | LOW | High | UX | CardGrid issuer filter shows issuers with 0 cards after type filter |
| C8-09 | LOW | High | perf | `optimizeFromTransactions` rebuilds category labels map on every reoptimize call |
| C8-10 | LOW | Medium | robustness | PDF `parseAmount` uses `parseInt` which truncates instead of rounding |
| C8-11 | MEDIUM | High | bug | `_loadPersistWarningKind` not reset after consumption or in `reset()` |
| C8-12 | LOW | High | dead-code | AI categorizer import is dead code (extends D-10) |
| C8-13 | LOW | High | latent-risk | `buildConstraints` shallow-copies transactions — latent mutation risk |

---

## Prioritized Action Items

### HIGH (should fix this cycle)
1. C8-02 + C8-03: Extend PDF fallback and structured parsers to match Korean date formats and short dates — currently loses transactions
2. C8-11: Reset `_loadPersistWarningKind` after consumption and in `reset()` method

### MEDIUM (plan for next cycles)
3. C8-01: Add NaN guard to `SpendingSummary.formatPeriod` (or use centralized date formatters)
4. C8-09: Pass prebuilt category labels through reoptimize to avoid redundant map rebuilds

### LOW (defer or accept)
- C8-04, C8-05, C8-06, C8-07, C8-08, C8-10, C8-12, C8-13

---

## Deferred items carried forward

All deferred items from cycles 1-7 (D-01 through D-61) remain unchanged. No new deferred items this cycle beyond the LOW findings listed above.
