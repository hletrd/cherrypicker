# Comprehensive Code Review — Cycle 26

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 26)
**Scope:** Full repository — all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (30+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-25 reviews and deferred items. Focused on finding genuinely NEW issues not previously reported. Verified that prior cycle 25 findings (C25-01 through C25-05) have been addressed.

---

## Verification of Cycle 25 Findings

| Finding | Status | Evidence |
|---|---|---|
| C25-01 | **FIXED** | `packages/core/src/calculator/reward.ts:254-264` — Now has explicit branch for both rate+fixedAmount with `console.warn`, and `packages/rules/src/schema.ts:21-24` has Zod `.refine()` making them mutually exclusive at schema level |
| C25-02 | **DEFERRED** | Deferred per cycle 25 plan — not a correctness issue, acceptable for typical inputs |
| C25-03 | **FIXED** | `apps/web/src/components/dashboard/TransactionReview.svelte:153-167` — Search now matches against `categoryMap.get(tx.category)` and `categoryMap.get(`${tx.category}.${tx.subcategory}`)` in addition to merchant name |
| C25-04 | **FIXED** | `apps/web/src/lib/analyzer.ts:86-103` — `parseAndCategorize` now accepts optional `matcher` parameter; `analyzeMultipleFiles` constructs `sharedMatcher` once at line 243 and passes it to each call |
| C25-05 | **FIXED** | `apps/web/src/components/dashboard/SpendingSummary.svelte:57` — Now uses `analysisStore.result?.monthlyBreakdown.reduce((sum, m) => sum + m.spending, 0)` for total spending, consistent with `totalTransactionCount` |

---

## New Findings

### C26-01: `calculateRewards` bucket object is mutated in-place but may be shared across transactions

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/core/src/calculator/reward.ts:220-231`
- **Description:** The `categoryRewards` map uses `??` to get or create a bucket. When a bucket already exists for a `categoryKey`, the code gets the existing bucket object and mutates it (e.g., `bucket.spending += tx.amount`, `bucket.reward += appliedReward`). This is fine for the `spending` and `reward` accumulation. However, the `bucket.rewardType` is overwritten on each transaction (line 318: `bucket.rewardType = rule.type`). If two transactions in the same category have different reward types (e.g., one matches a "discount" rule and another matches a "points" rule for the same category), the `rewardType` of the bucket will reflect only the last transaction's type, not the dominant or first type. This is a data fidelity issue — the category's reported reward type may be incorrect.
- **Failure scenario:** A card has two rules for "dining" — one is a "discount" type and another is "points" type (e.g., for different subcategories that fall through to the same categoryKey because subcategory is undefined). The first transaction matches "discount" and sets `bucket.rewardType = 'discount'`. The second matches "points" and overwrites `bucket.rewardType = 'points'`. The final bucket reports "points" even though most of the reward came from discount.
- **Fix:** Track the reward type with the highest cumulative reward contribution per bucket, or at minimum preserve the first assigned type and only update if the new type contributes more reward.

### C26-02: `CategoryBreakdown.svelte` uses stale `category` field as color lookup key instead of using `subcategory`-aware key

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:87`
- **Description:** The `CATEGORY_COLORS` map contains both parent category keys (e.g., `cafe`) and some subcategory keys (e.g., `dining.cafe`). The assignment's `category` field is set by `buildCategoryKey` in `greedy.ts`, which produces keys like `dining.cafe` for subcategorized transactions. However, the `CATEGORY_COLORS` lookup at line 87 uses `a.category` directly — this correctly matches dot-notation keys like `dining.cafe` to the `cafe` color entry, but misses the `dining.cafe` entry entirely because the `CATEGORY_COLORS` map has `cafe` (no prefix) as a key but not `dining.cafe`. So subcategorized categories like `dining.cafe` fall through to the `uncategorized` fallback color.
- **Failure scenario:** A transaction categorized as `dining.cafe` gets `CATEGORY_COLORS['dining.cafe']` which returns `undefined`, so it falls back to `CATEGORY_COLORS.uncategorized` (gray `#d1d5db`). The cafe bar appears gray instead of the warm brown `#92400e` assigned to `cafe`.
- **Fix:** Add dot-notation keys to `CATEGORY_COLORS` for all subcategories, or extract the leaf subcategory ID from the dot-notation key (e.g., `a.category.split('.').pop()`) and use it as the primary lookup before falling back to the full key.

### C26-03: `reoptimize` uses stale `monthlyBreakdown` from the initial analysis when computing `previousMonthSpending`

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/store.svelte.ts:359-368`
- **Description:** When `reoptimize` is called after the user edits transactions, it computes `previousMonthSpending` from `result.monthlyBreakdown` (line 361). However, `monthlyBreakdown` was set during the initial analysis and may not reflect the edited transactions. The code later (lines 379-392) recalculates `monthlyBreakdown` from the edited transactions and stores it in the result, but this happens AFTER `previousMonthSpending` has already been computed from the old breakdown. So the first reoptimize after an edit uses stale monthly breakdown data to determine which month is "previous" and how much was spent.
- **Failure scenario:** A user uploads 3 months of statements (Jan, Feb, Mar). The optimizer uses Feb spending as `previousMonthSpending`. The user then edits a February transaction amount. The reoptimize should use the updated February spending, but instead uses the stale value from the initial analysis. The performance tier calculation is slightly off.
- **Fix:** Compute `previousMonthSpending` from the `editedTransactions` parameter (which contains the user's edits) rather than from `result.monthlyBreakdown`. Build a fresh monthly spending map from `editedTransactions` before computing `previousMonthSpending`.

### C26-04: `inferYear` function is duplicated 4 times across the codebase

- **Severity:** LOW
- **Confidence:** High
- **Files:**
  - `apps/web/src/lib/parser/csv.ts:29-37`
  - `apps/web/src/lib/parser/pdf.ts:137-144`
  - `apps/web/src/lib/parser/xlsx.ts:183-190`
  - `packages/parser/src/csv/generic.ts` (and its bank adapter files)
- **Description:** The `inferYear` function with identical logic (3-month look-back heuristic) is copy-pasted across at least 4 files in the web parser layer and the packages/parser layer. Any bug fix or logic change (e.g., adjusting the 90-day threshold) must be applied in all 4+ places. This was flagged in prior cycles as D-03/D-43 but the duplication remains.
- **Failure scenario:** A bug is found in the `inferYear` logic (e.g., it produces wrong results around year boundaries). The fix is applied to the csv.ts version but the pdf.ts and xlsx.ts versions are missed, leading to inconsistent date parsing across file formats.
- **Fix:** Extract `inferYear` and `parseDateToISO` into a shared utility module (e.g., `apps/web/src/lib/parser/date-utils.ts`) and import from all consumers. Similarly, extract into `packages/parser/src/date-utils.ts` for the server-side parser.

### C26-05: `SpendingSummary.svelte` "전월실적" hint shows spending from the second-to-last month which may not match the actual `previousMonthSpending` used in optimization

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:108`
- **Description:** The multi-month info bar shows "전월실적 {formatWon(...)} 기준" using `monthlyBreakdown[length-2].spending`. However, the actual `previousMonthSpending` used in the optimizer may differ because: (1) if the user manually specified `previousMonthSpending` in the upload form, the optimizer uses that value instead, and (2) `previousMonthSpending` is computed per-card with `performanceExclusions` filtering, while the `monthlyBreakdown` spending is the raw sum. So the displayed "전월실적" value may not match what the optimizer actually used.
- **Failure scenario:** A user uploads Jan+Feb statements and enters "500,000" as 전월실적 in the upload form. The optimizer uses 500,000 for all cards. But the SpendingSummary shows February's raw spending (e.g., 800,000원) as "전월실적", misleading the user about which value was used.
- **Fix:** Store the actual `previousMonthSpending` used in the optimization result (or in the `AnalyzeOptions` that produced it) and display that value instead of computing from `monthlyBreakdown`. Alternatively, add a note that the displayed value is "전월 지출" not "전월실적" (the latter has exclusions applied per card).

---

## Final Sweep — Cross-File Interactions

1. **Schema-level mutual exclusivity (C25-01 fix):** The Zod `.refine()` at `packages/rules/src/schema.ts:21-24` correctly prevents YAML data from having both rate and fixedAmount. The runtime warning in `reward.ts:254-264` is now a belt-and-suspenders guard. However, the web `CardRuleSet` type in `apps/web/src/lib/cards.ts:40` does not enforce this constraint — the `tiers` array allows both `rate` and `fixedAmount` without a runtime check. Since the web data comes from the same validated `cards.json`, this is acceptable but worth noting.

2. **Bank name duplication (D-42/D-57):** Still present — `ALL_BANKS` in `FileDropzone.svelte`, `formatIssuerNameKo` in `formatters.ts`, `BANK_SIGNATURES` in both `packages/parser/src/detect.ts` and `apps/web/src/lib/parser/detect.ts`, and `BANK_COLUMN_CONFIGS` in `apps/web/src/lib/parser/xlsx.ts` are five independent hardcoded lists. Adding a new bank requires updating all five.

3. **Type duplication (D-01/D-42):** `packages/parser/src/types.ts` and `apps/web/src/lib/parser/types.ts` still define identical `BankId`, `RawTransaction`, `ParseResult`, `ParseError`, `BankAdapter` types.

4. **`inferYear` / `parseDateToISO` duplication (D-03/D-43, C26-04):** Still present across 4+ files. Noted as new finding C26-04.

5. **`detectBank` / `detectCSVDelimiter` duplication:** `packages/parser/src/detect.ts` and `apps/web/src/lib/parser/detect.ts` have identical `detectBank` and `detectCSVDelimiter` functions with identical `BANK_SIGNATURES` arrays. Part of D-42/D-57.

6. **PDF table parser duplication:** `packages/parser/src/pdf/table-parser.ts` and `apps/web/src/lib/parser/pdf.ts` have nearly identical `detectColumnBoundaries`, `splitByColumns`, `parseTable`, and `filterTransactionRows` functions. The web version is a port of the server version with minor differences (e.g., the web version uses `DATE_PATTERN` from module scope while the server version uses a local constant).

7. **`isValidTx` in `store.svelte.ts` requires `tx.amount > 0`:** The validation function at line 148 rejects transactions with `amount <= 0`. This means refund transactions (negative amounts) stored in sessionStorage would be silently dropped on restore. However, refunds are already filtered out by `calculateRewards` (line 213: `if (tx.amount <= 0) continue`), so this is consistent — but it means the "거래 건수" after restore may be lower than before if the original count included refunds.

8. **`cachedCoreRules` is never invalidated:** The cache in `analyzer.ts:47` persists across all optimizer calls within a session. If the user uploads new files with different `cardIds` selections, the cache returns the full unfiltered rule set, which is then filtered (line 174). This is correct. However, if the underlying `cards.json` is updated during a long-lived session (e.g., HMR during development), the cache becomes stale. This is acceptable for production.

9. **`scoreCardsForTransaction` creates a new array with spread for every card:** At `greedy.ts:129`, `[...currentTransactions, transaction]` creates a new array for each card evaluation. With N transactions, M cards, this creates N*M temporary arrays. This is part of the C25-02 deferred performance issue but worth noting the specific allocation pattern.

10. **SavingsComparison `savingsPct` can show misleading percentages:** At `SavingsComparison.svelte:73-76`, `savingsPct` is calculated as `savingsVsSingleCard / bestSingleCard.totalReward * 100`. When `bestSingleCard.totalReward` is very small (e.g., 1,000원), even a modest absolute savings produces a large percentage (e.g., +500%). The UI shows this as "한 장짜리보다 +500%" which may be confusing. A cap on displayed percentage (e.g., max 100%) or contextual explanation would help.

---

## Summary of Active Findings (New in Cycle 26)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C26-01 | MEDIUM | High | `packages/core/src/calculator/reward.ts:220-231,318` | Bucket `rewardType` overwritten by last transaction's type instead of tracking dominant reward type |
| C26-02 | LOW | High | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:87` | `CATEGORY_COLORS` lookup misses dot-notation subcategory keys — subcategorized categories get gray fallback color |
| C26-03 | LOW | Medium | `apps/web/src/lib/store.svelte.ts:359-368` | `reoptimize` uses stale `monthlyBreakdown` for `previousMonthSpending` computation before recalculating from edited transactions |
| C26-04 | LOW | High | Multiple files in `apps/web/src/lib/parser/` | `inferYear` and `parseDateToISO` duplicated 4+ times — maintenance hazard |
| C26-05 | LOW | Medium | `apps/web/src/components/dashboard/SpendingSummary.svelte:108` | "전월실적" display uses raw monthly spending, not the actual `previousMonthSpending` used by optimizer |
