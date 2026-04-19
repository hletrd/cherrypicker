# Comprehensive Code Review — Cycle 25

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 25)
**Scope:** Full repository — all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (23+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, and apps/web). Cross-referenced with prior cycle 1-24 reviews, deferred items (D-01 through D-105), and the aggregate. Focused on finding genuinely NEW issues not previously reported. Verified that prior cycle 24 findings (C24-01 through C24-03) have been addressed.

---

## Verification of Cycle 24 Findings

| Finding | Status | Evidence |
|---|---|---|
| C24-01 | **FIXED** | `apps/web/src/lib/analyzer.ts:106` — ID now includes `idPrefix = fileIndex !== undefined ? 'f${fileIndex}-' : ''`, producing `tx-f0-0`, `tx-f1-0`, etc. |
| C24-02 | **FIXED** | `apps/web/src/components/dashboard/SavingsComparison.svelte:189` — Uses `(opt.savingsVsSingleCard >= 0 ? opt.savingsVsSingleCard : Math.abs(opt.savingsVsSingleCard)) * 12` to avoid double-negative |
| C24-03 | **FIXED** | `SavingsComparison.svelte:82-97` — `isSuboptimal` derived; `singleBarWidth` returns 100 when suboptimal; `cherrypickBarWidth` returns proportional ratio when suboptimal |

---

## New Findings

### C25-01: Greedy optimizer double-counts cap usage for transactions with both rate and fixedAmount

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/core/src/calculator/reward.ts:253-271`
- **Description:** When a `RewardTierRate` has both a `rate > 0` and a `fixedAmount > 0`, the code at lines 254-263 processes the rate-based reward first (calculating `rawReward` and applying the monthly cap via `ruleResult`), and then the `else if (hasFixedReward)` branch is skipped because the rate branch was taken. This means the fixed amount is silently ignored when a rate is present. However, some Korean card rules genuinely have both (e.g., a base percentage rate plus a fixed daily bonus). The current code only applies one or the other, never both, silently dropping the fixed reward component.
- **Failure scenario:** A card rule specifies "3% discount + 1,000 won per day" for a category. The optimizer only calculates the 3% discount, ignoring the daily fixed bonus entirely. The user sees lower rewards than their card actually provides, and the optimizer may not recommend that card when it should.
- **Fix:** When both rate and fixedAmount are present, calculate both rewards separately, sum them, then apply the monthly cap to the combined total. Alternatively, document explicitly in the schema that rate and fixedAmount are mutually exclusive, and enforce this with a Zod refinement.

### C25-02: `scoreCardsForTransaction` is O(n*m) per transaction with full reward recalculation

- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/optimizer/greedy.ts:116-141`
- **Description:** For each transaction, `scoreCardsForTransaction` iterates over every card rule and calls `calculateCardOutput` twice (before and after adding the transaction). `calculateCardOutput` runs `calculateRewards` over all previously assigned transactions for that card. For N transactions, M cards, and K average assigned transactions per card, the total cost is O(N * M * K). With large statement files (500+ transactions) and 10+ cards, this becomes noticeably slow — each marginal reward calculation re-processes all prior assignments.
- **Failure scenario:** A user uploads a statement with 500 transactions and has 15 cards in their portfolio. The greedy optimizer takes several seconds because each of the 500 transactions triggers 15 * 2 full `calculateRewards` calls, and each call processes all previously assigned transactions for that card.
- **Fix:** Cache the previous `calculateCardOutput` result per card and incrementally update it rather than recalculating from scratch. Alternatively, memoize the per-card output at the start of each iteration and only recompute for the card that received the new transaction.

### C25-03: `TransactionReview.svelte` search is case-sensitive for Korean text, misses English merchant names

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:153-155`
- **Description:** The search filter converts both the query and merchant name to lowercase via `.toLowerCase()`, which works for English but is a no-op for Korean characters. However, the real issue is that the search only matches against `tx.merchant` (the merchant name), not against `tx.category` or `tx.subcategory`. A user searching for "coffee" or "커피" would not find transactions categorized as "cafe" unless the merchant name contains that exact text.
- **Failure scenario:** A user types "cafe" or "카페" in the search box expecting to find all cafe transactions. Only transactions whose merchant name contains "cafe" (case-insensitive) are shown. Transactions at "스타벅스" (Starbucks in Korean) or "커피빈" (Coffee Bean) that are categorized as "cafe" are not found because their merchant names don't contain the search term.
- **Fix:** Extend the search to also match against the category/subcategory labels (using the `categoryMap`). This gives users a way to find all transactions in a category regardless of the merchant name.

### C25-04: `parseAndCategorize` creates a new `MerchantMatcher` for every file in multi-file upload

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/analyzer.ts:86-135`
- **Description:** In `analyzeMultipleFiles`, `parseAndCategorize` is called for each file via `Promise.all`. Each call to `parseAndCategorize` independently calls `loadCategories()` and constructs a new `MerchantMatcher`. The `loadCategories` function fetches `data/categories.json` each time, so for N uploaded files, there are N parallel fetches to the same URL. While the browser cache may serve these from the HTTP cache, the JSON parsing and `MerchantMatcher` construction are duplicated N times.
- **Failure scenario:** A user uploads 5 files simultaneously. Five parallel `loadCategories()` calls are made, each fetching and parsing the same `categories.json`. Five `MerchantMatcher` instances are constructed from identical data. This wastes CPU and network resources.
- **Fix:** Move `loadCategories()` and `MerchantMatcher` construction out of `parseAndCategorize` and into `analyzeMultipleFiles`, so they are done once before the parallel parsing loop. Pass the matcher as a parameter to `parseAndCategorize`.

### C25-05: `SpendingSummary.svelte` shows optimization `totalSpending` instead of all-transaction spending

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:57`
- **Description:** The "총 지출" (total spending) card displays `analysisStore.optimization?.totalSpending`. The optimization result only includes the latest month's transactions (see `analyzer.ts:301`), but `totalTransactionCount` includes all uploaded months. This means for a multi-month upload, the spending figure reflects only the latest month while the transaction count reflects all months — an inconsistency that may confuse users.
- **Failure scenario:** A user uploads 3 months of statements (Jan-Mar). The "총 지출" shows March's spending (e.g., 1,200,000원) while "거래 건수" shows all 3 months' count (e.g., 150건). The user might think their average transaction is 8,000원 when it's actually higher.
- **Fix:** Either display the full-period spending (sum of all months' spending from `monthlyBreakdown`) with the total transaction count, or display the latest-month spending with `transactionCount` (not `totalTransactionCount`). Keep both metrics consistent in scope.

---

## Final Sweep — Cross-File Interactions

1. **Rate + fixedAmount coexistence (C25-01):** The greedy optimizer's `scoreCardsForTransaction` calls `calculateRewards` which uses the `if/else if` pattern. The optimizer itself doesn't inspect `tierRate` — it delegates entirely to `calculateRewards`. So fixing C25-01 only requires changes in `reward.ts`, not in `greedy.ts`.

2. **Duplicate `loadCategories` in analyzer.ts:** The `parseAndCategorize` function (line 96) and `optimizeFromTransactions` (line 197) both call `loadCategories()`. When `analyzeMultipleFiles` calls both, `loadCategories` is called N+1 times (N for each file's parseAndCategorize, 1 for optimizeFromTransactions). The `categoriesPromise` cache in `cards.ts` helps but the JSON parsing and matcher construction are still duplicated.

3. **Bank name drift (C21-03, D-42/D-57):** Still present — `ALL_BANKS` in `FileDropzone.svelte`, `formatIssuerNameKo` in `formatters.ts`, and `BANK_SIGNATURES` in both `packages/parser/src/detect.ts` and `apps/web/src/lib/parser/detect.ts` are four independent hardcoded lists. Adding a new bank requires updating all four.

4. **`BankId` type duplication:** `packages/parser/src/types.ts` and `apps/web/src/lib/parser/types.ts` define identical `BankId` union types. Still present from prior cycles (D-01/D-42).

5. **`inferYear` / `parseDateToISO` duplication:** Still present across 4+ files. Not a runtime bug but a maintenance hazard (D-03/D-43).

6. **AI categorizer is disabled:** `apps/web/src/lib/categorizer-ai.ts` stubs out all functions with `throw new Error(...)`. `TransactionReview.svelte` checks `aiAvailable` before showing the AI button, so the disabled state is handled correctly in the UI. No issue.

7. **LLM fallback security:** `packages/parser/src/pdf/llm-fallback.ts` properly requires explicit `allowRemoteLLM` opt-in, validates API key, uses 30-second timeout, and has JSON parse guards. No new security concerns.

8. **CSP `'unsafe-inline'`:** Still present with documented TODO. Not new.

9. **`cachedCoreRules` stale cache:** The cache in `apps/web/src/lib/analyzer.ts:47` persists across optimizer calls within a session. Since `cardIds` filtering is applied after cache retrieval (line 164), filtered calls correctly get the right subset. The cache is only stale if the underlying `cards.json` changes during a session (e.g., HMR), which is acceptable for production.

10. **`report.js` DOM construction:** Uses `document.createElement` and `setAttribute`, which is XSS-safe. Data comes from same-origin sessionStorage. No issue.

---

## Summary of Active Findings (New in Cycle 25)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C25-01 | MEDIUM | High | `packages/core/src/calculator/reward.ts:253-271` | When both rate and fixedAmount are present on a tier, only rate-based reward is calculated — fixed amount is silently ignored |
| C25-02 | LOW | High | `packages/core/src/optimizer/greedy.ts:116-141` | Greedy optimizer recalculates full per-card rewards from scratch for every transaction — O(N*M*K) complexity, slow on large inputs |
| C25-03 | LOW | High | `apps/web/src/components/dashboard/TransactionReview.svelte:153-155` | Search only matches merchant names, not category labels — users can't find transactions by category |
| C25-04 | LOW | High | `apps/web/src/lib/analyzer.ts:86-135` | `parseAndCategorize` creates a new MerchantMatcher per file — redundant in multi-file uploads |
| C25-05 | LOW | Medium | `apps/web/src/components/dashboard/SpendingSummary.svelte:57` | Total spending shows only latest month but transaction count shows all months — inconsistent scope |
