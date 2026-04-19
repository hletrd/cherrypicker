# Comprehensive Code Review — Cycle 7 (2026-04-19)

**Reviewer:** multi-angle (code quality, perf, security, debugger, architect, designer, test, verifier)
**Scope:** Full repository — all packages, apps, tools, e2e, tests
**Focus:** New findings beyond cycles 1-6; verification of cycle 6 fixes; deep analysis of edge cases

---

## Verification of Cycle 6 Fixes

| Fix | Status | Notes |
|-----|--------|-------|
| C6-07: AI categorizer not clearing subcategory | **FIXED** | `tx.subcategory = undefined;` added at TransactionReview.svelte:103 |
| C6-01: Redundant `rate` field in CardBreakdown | **FIXED** | `rate` removed from interface and map.set(), computed only in .map() at line 40-43 |
| C6-02: persistWarning indicator for truncated sessionStorage | **FIXED** | `_persistWarning` module-level flag, `persistWarning` state in store, SpendingSummary banner at line 110-114 |
| C6-03: Smooth count-up animation on re-render | **FIXED** | `startVal = displayedSavings` captured in $effect, smooth transition from current value |
| C6-11: formatRatePrecise helper | **FIXED** | Added to formatters.ts:32-35, used in SavingsComparison.svelte:162 |

All cycle 6 fixes verified as correctly implemented.

---

## New Findings

### C7-01: `SavingsComparison` breakdown table uses inline rate formatting instead of `formatRate`

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:223`
- **Description:** The breakdown table displays `{(card.rate * 100).toFixed(1)}%` at line 223. After the C6-11 fix, `formatRatePrecise` was added for the effective rate display (line 162), and `formatRate` already exists in formatters.ts for 1-decimal percentage display. The breakdown table should use `formatRate(card.rate)` for consistency. This is a specific instance of the same class as C6-11 but in a different location — the fix for C6-11 only addressed line 161-162, not line 223.
- **Failure scenario:** A developer changes the rate calculation logic in one place but not the other. Using the helper ensures a single source of truth for rate formatting.
- **Fix:** Replace `{(card.rate * 100).toFixed(1)}%` at line 223 with `{formatRate(card.rate)}`. Import `formatRate` is already available via the existing import on line 3.

### C7-02: `SpendingSummary` effective rate uses inline calculation instead of `formatRatePrecise`

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:94`
- **Description:** Line 94 displays `{(analysisStore.optimization.effectiveRate * 100).toFixed(2) + '%'}` — the exact same inline calculation that C6-11 fixed in SavingsComparison.svelte. The `formatRatePrecise` helper was created specifically for this pattern but SpendingSummary was not updated.
- **Failure scenario:** Same as C6-11 — a developer refactors to use `formatRate()` and loses the extra decimal place.
- **Fix:** Replace `{(analysisStore.optimization.effectiveRate * 100).toFixed(2) + '%'}` at line 94 with `{formatRatePrecise(analysisStore.optimization.effectiveRate)}`. Add `formatRatePrecise` to the import on line 4.

### C7-03: `SavingsComparison` best single card rate also uses inline formatting

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:149`
- **Description:** Line 149 displays `{((opt.bestSingleCard.totalReward / opt.totalSpending) * 100).toFixed(2)}%` — another inline rate calculation. This computes the same kind of value (effective rate) but with a 2-decimal format. Should use `formatRatePrecise` for consistency.
- **Failure scenario:** Same class as C7-01 and C7-02 — inline calculation diverges from helpers.
- **Fix:** Replace inline calculation with `formatRatePrecise(opt.bestSingleCard.totalReward / opt.totalSpending)`. Add a guard for `opt.totalSpending > 0` (already present in the `{#if}` at line 149).

### C7-04: `TransactionReview` `$effect` re-sync uses `analysisStore.generation` but doesn't guard against stale generation

- **Severity:** MEDIUM
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:125-132`
- **Description:** The `$effect` at line 125-132 watches `analysisStore.generation` and `analysisStore.transactions`. When `generation` increments (e.g., from `reoptimize`), the effect re-runs and overwrites `editedTxs`. However, if the user has made category edits (hasEdits=true) and then the store updates for any reason (e.g., `persistToStorage` updating `persistWarning`), the generation counter increments again, causing the effect to re-run and overwrite the user's edits. The `generation` counter increments on every `setResult`, `analyze`, and `reoptimize` call, but the `persistWarning` update in `setResult` also triggers `generation++`. This means that after `reoptimize`, the generation increments, then `persistWarning` is set from `_persistWarning` — but this does NOT increment generation again (it's in the same call). However, if `loadFromStorage` is called and creates an initial result, the `persistWarning` initialization at line 215 does NOT increment generation. This is actually fine because the effect only triggers on generation changes. The real concern is more subtle: the `reoptimize` call at line 163 calls `analysisStore.reoptimize(editedTxs)`, which increments generation. The effect then fires with the new generation and the new transactions (which ARE the editedTxs from reoptimize). So the effect overwrites `editedTxs` with `analysisStore.transactions`, which should be the same data. This is correct but wasteful — it creates an unnecessary re-render.
- **Failure scenario:** Not a bug per se, but a fragile pattern. If `reoptimize` were ever changed to NOT update `result.transactions` (e.g., to save memory), the effect would overwrite the user's edits with stale data from the store.
- **Fix:** Add a guard in the effect: only overwrite `editedTxs` if the generation actually changed from the last sync. Or skip the sync when `hasEdits` is true and the new transactions are the same reference.

### C7-05: `_persistWarning` is a module-level mutable variable — fragile coupling with store

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/store.svelte.ts:102`
- **Description:** `_persistWarning` is a module-level `let` variable that is set by `persistToStorage` and read by `setResult`, `analyze`, and `reoptimize` via `persistWarning = _persistWarning`. This creates a fragile coupling where `persistToStorage` must be called before `persistWarning = _persistWarning` is read, and there's no guarantee of ordering if the code is refactored. The correct Svelte 5 pattern would be to return the warning status from `persistToStorage` rather than using a shared mutable variable.
- **Failure scenario:** A developer refactors `analyze` to call `persistToStorage` asynchronously or after setting `persistWarning`. The warning state would be stale or incorrect.
- **Fix:** Have `persistToStorage` return a boolean indicating truncation/failure, and use the return value directly instead of reading `_persistWarning`.

### C7-06: `analyzeMultipleFiles` uses `latestMonth` for optimization but `allTransactions` for transaction list

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/analyzer.ts:264-294`
- **Description:** `analyzeMultipleFiles` filters to the latest month's transactions for optimization (line 264), but returns `allTransactions` (including all months) in the `transactions` field (line 294). This means the dashboard shows transaction counts and details for ALL months, but the optimization only covers the latest month. The `transactionCount` field (line 290) is set to `latestTransactions.length`, but `totalTransactionCount` (line 292) is `allTransactions.length`. The `transactions` field at line 294 contains ALL transactions. This is by design (showing the full picture to the user), but the `TransactionReview` component iterates over ALL transactions and allows category editing, while only the latest month's transactions affect optimization. When the user changes a category for a non-latest-month transaction and clicks "apply edits", the `reoptimize` call in the store re-optimizes with ALL editedTxs — but the original optimization only used latest-month transactions. This means old-month transactions are now included in optimization, which could change results in unexpected ways.
- **Failure scenario:** User uploads January and February statements. Only February is optimized. User changes a January transaction's category. Clicks "apply edits". The reoptimize call now includes January transactions, which were never part of the original optimization. The results may differ from the initial analysis in ways the user doesn't expect.
- **Fix:** Filter `editedTxs` to only the latest month before passing to `reoptimize`, or clearly document that all transactions are included in reoptimization. Alternatively, in `applyEdits()`, pass the same filter that `analyzeMultipleFiles` uses.

### C7-07: `BANK_SIGNATURES` is duplicated between `packages/parser/src/detect.ts` and `apps/web/src/lib/parser/detect.ts`

- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/parser/src/detect.ts:10-107` vs `apps/web/src/lib/parser/detect.ts:8-105`
- **Description:** The bank signature arrays are identical between the two files. This is the same class of DRY violation as D-35 (duplicated `inferYear`), but for bank detection signatures. If a new bank is added to one file but not the other, detection would be inconsistent between the CLI and web app.
- **Failure scenario:** A new bank (e.g., "토스뱅크") is added to `packages/parser/src/detect.ts` but not to `apps/web/src/lib/parser/detect.ts`. The CLI correctly detects this bank, but the web app falls through to the generic parser.
- **Fix:** Extract bank signatures to a shared module, or have the web app import from the rules package. This is deferred per D-01 (duplicate parser implementations) which covers the broader architectural issue.

### C7-08: `pdf.ts` browser fallback parser doesn't handle Korean short-date formats

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/pdf.ts:126-143`
- **Description:** The `parseDateToISO` function in `pdf.ts` handles `YYYY-MM-DD`, `YY-MM-DD`, and `YYYY년 M월 D일` formats, but does NOT handle `M월 D일` (short Korean date without year) or `MM/DD` formats. In contrast, `csv.ts:39-80` and `xlsx.ts:192-237` both handle short dates with the `inferYear` heuristic. If a PDF statement contains dates like "1월 15일" (common in Korean credit card PDFs), the browser PDF parser will return the raw string instead of an ISO date, causing these transactions to be ignored by downstream date sorting and month detection.
- **Failure scenario:** User uploads a Hyundai Card PDF that uses "1월 15일" date format. The fallback parser returns "1월 15일" as the date string instead of "2026-01-15". The transaction is included but with an invalid date, causing it to be sorted incorrectly or excluded from month-based analysis.
- **Fix:** Add `inferYear` and short-date handling to `pdf.ts`'s `parseDateToISO`, matching the pattern in `csv.ts` and `xlsx.ts`.

### C7-09: `formatDateKo` and `formatDateShort` use `parseInt` without NaN guard

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/formatters.ts:151,162`
- **Description:** `formatDateKo` at line 151 calls `parseInt(m!, 10)` and `parseInt(d!, 10)` without checking if the result is NaN. If `m` or `d` is not a valid number string (e.g., from a malformed date like "2026-__-15"), `parseInt` returns NaN, and the template string would produce "2026년 NaN월 NaN일". Same for `formatDateShort` at line 162.
- **Failure scenario:** A corrupted date string "2026-ab-15" is passed to `formatDateKo`. The function returns "2026년 NaN월 NaN일" instead of a fallback value.
- **Fix:** Add a NaN guard: `const mNum = parseInt(m!, 10); return Number.isNaN(mNum) ? '-' : ...`

### C7-10: `CategoryBreakdown` percentage calculation can exceed 100% due to rounding

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:78,94-95`
- **Description:** Each category's percentage is computed as `Math.round((a.spending / totalSpending) * 1000) / 10` (line 78), which rounds to 1 decimal place. The "other" group's percentage is computed the same way (line 94-95). When all percentages are summed, the total can exceed 100% due to rounding up. For example, 3 categories at 33.4% each sum to 100.2%. This is a common rounding artifact but could confuse detail-oriented users.
- **Failure scenario:** User sees categories that sum to 100.1% or 100.2% instead of exactly 100%.
- **Fix:** Apply a rounding adjustment to the largest category to ensure the total sums to exactly 100%. Or use `Math.floor` instead of `Math.round` and add the remainder to the largest category.

### C7-11: `loadFromStorage` sets `persistWarning` based on missing transactions but doesn't account for legitimate empty transaction lists

- **Severity:** MEDIUM
- **Confidence:** Medium
- **File:** `apps/web/src/lib/store.svelte.ts:215`
- **Description:** Line 215: `let persistWarning = $state(result !== null && result.transactions === undefined);`. This sets `persistWarning = true` when the loaded result has no transactions. However, there's a case where `result.transactions` could be an empty array `[]` (validTxs.length === 0 after filtering, line 167: `transactions = validTxs.length > 0 ? validTxs : undefined`). If all transactions in storage fail validation, `transactions` is set to `undefined`, and `persistWarning` is set to `true`. But the actual issue is data corruption, not size truncation. The user sees the "data truncated" warning message, which is misleading — the real problem is that their transaction data was corrupted.
- **Failure scenario:** User has transactions saved in sessionStorage. A browser extension or extension conflict corrupts the JSON data. All transactions fail `isValidTx` validation. `transactions` is set to `undefined`. `persistWarning` is `true`. The user sees "데이터가 커서 거래 내역이 저장되지 않았어요" (data was too large to save), but the actual problem is data corruption.
- **Fix:** Differentiate between truncation (size exceeded) and corruption (validation failed). Add a separate `dataCorrupted` flag, or change the `persistWarning` message to be more generic: "거래 내역을 불러오지 못했어요" (could not load transaction data).

### C7-12: `CardDetail.svelte` uses `window.location.href` for navigation instead of Astro's client-side router

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/cards/CardDetail.svelte:252`
- **Description:** Line 252 uses `window.location.href = import.meta.env.BASE_URL + 'cards'` for navigation. This causes a full page reload. Same class as D-45 (FileDropzone uses full page reload for success navigation). Since Astro supports view transitions and `navigate()`, this should use client-side navigation for a smoother UX.
- **Failure scenario:** User clicks "카드 목록으로 돌아가기" button. Full page reload flashes white and reloads all JavaScript. On slow connections, this takes 1-2 seconds.
- **Fix:** Use Astro's `navigate()` function for client-side navigation: `import { navigate } from 'astro:transitions'; navigate(import.meta.env.BASE_URL + 'cards');`

### C7-13: `toCoreCardRuleSets` caching uses reference equality which breaks if `getAllCardRules` returns new array

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/analyzer.ts:191-194`
- **Description:** The cache at lines 191-194 checks `cachedRulesRef !== cardRules`. Since `getAllCardRules` creates a new array via `flatMap` on every call (cards.ts:177), `cardRules` will always be a new reference. This means `cachedCoreRules` is always recomputed — the cache never actually hits. The intent was to avoid re-computing `toCoreCardRuleSets` when the same rules are used, but the reference check can never succeed because the rules array is always newly allocated.
- **Failure scenario:** For every call to `optimizeFromTransactions` (including during reoptimize), `toCoreCardRuleSets` recomputes the entire adapter transformation. For 683 cards, this is O(n) work that should only happen once per session.
- **Fix:** Replace reference equality check with a content-based check (e.g., comparing the first card's ID and the array length), or move the cache to a higher level (inside `getAllCardRules` or `createAnalysisStore`).

---

## Summary of New Findings

| ID | Severity | Confidence | Category | Description |
|----|----------|------------|----------|-------------|
| C7-01 | MEDIUM | High | consistency | SavingsComparison breakdown table uses inline rate formatting instead of `formatRate()` |
| C7-02 | MEDIUM | High | consistency | SpendingSummary effective rate uses inline formatting instead of `formatRatePrecise()` |
| C7-03 | LOW | High | consistency | SavingsComparison best single card rate uses inline formatting |
| C7-04 | MEDIUM | Medium | code-quality | TransactionReview $effect re-sync is fragile — overwrites editedTxs on any generation change |
| C7-05 | LOW | High | code-quality | `_persistWarning` module-level mutable variable creates fragile coupling |
| C7-06 | LOW | High | logic | `analyzeMultipleFiles` returns all-month transactions but optimizes only latest month — reoptimize includes all |
| C7-07 | LOW | High | DRY | `BANK_SIGNATURES` duplicated between packages/parser and apps/web (extends D-01) |
| C7-08 | MEDIUM | High | bug | Browser PDF parser `parseDateToISO` doesn't handle Korean short-date or MM/DD formats |
| C7-09 | LOW | High | robustness | `formatDateKo`/`formatDateShort` use `parseInt` without NaN guard |
| C7-10 | LOW | High | UX | CategoryBreakdown percentage rounding can cause total > 100% |
| C7-11 | MEDIUM | Medium | UX | `persistWarning` message is misleading for data corruption vs size truncation |
| C7-12 | LOW | High | perf/UX | CardDetail uses full page reload for navigation (extends D-45) |
| C7-13 | LOW | Medium | perf | `toCoreCardRuleSets` cache never hits due to reference equality check on always-new array |

---

## Prioritized Action Items

### HIGH (should fix this cycle)
1. C7-08: Add `inferYear` and short-date handling to PDF parser's `parseDateToISO`
2. C7-02: Replace inline rate formatting in SpendingSummary with `formatRatePrecise`
3. C7-01: Replace inline rate formatting in SavingsComparison breakdown table with `formatRate`
4. C7-03: Replace inline rate formatting in SavingsComparison best single card with `formatRatePrecise`

### MEDIUM (plan for next cycles)
5. C7-11: Differentiate persistWarning between truncation and corruption
6. C7-04: Guard TransactionReview effect against unnecessary re-syncs
7. C7-06: Filter editedTxs to latest month in reoptimize or document the behavior

### LOW (defer or accept)
- C7-05, C7-07, C7-09, C7-10, C7-12, C7-13

---

## Deferred items carried forward

All deferred items from cycles 1-6 (D-01 through D-55) remain unchanged. No new deferred items this cycle beyond the LOW findings listed above.
