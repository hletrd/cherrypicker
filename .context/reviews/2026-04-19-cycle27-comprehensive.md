# Comprehensive Code Review — Cycle 27

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 27)
**Scope:** Full repository — all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (30+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-26 reviews and deferred items. Focused on finding genuinely NEW issues not previously reported. Verified that prior cycle 26 findings (C26-01 through C26-05) have been addressed or remain deferred.

---

## Verification of Cycle 26 Findings

| Finding | Status | Evidence |
|---|---|---|
| C26-01 | **FIXED** | `packages/core/src/calculator/reward.ts:214-328` — Now has `rewardTypeAccum` map tracking cumulative reward per rewardType per category bucket, with dominant type selection at lines 344-362 |
| C26-02 | **FIXED** | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:56-61` — `getCategoryColor()` tries full key first, then leaf ID via `.split('.').pop()`, then falls back to `uncategorized` |
| C26-03 | **FIXED** | `apps/web/src/lib/store.svelte.ts:358-384` — `reoptimize` now computes `updatedMonthlyBreakdown` from `editedTransactions` before computing `previousMonthSpending` |
| C26-04 | **DEFERRED** | `inferYear`/`parseDateToISO` duplication remains across 4+ files — refactoring effort deferred |
| C26-05 | **DEFERRED** | 전월실적 display mismatch remains — UX clarification deferred |

---

## New Findings

### C27-01: `SavingsComparison.svelte` savingsPct divides by `bestSingleCard.totalReward` which can be zero

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:73-76`
- **Description:** The `savingsPct` derived value computes `opt.savingsVsSingleCard / opt.bestSingleCard.totalReward`. When `bestSingleCard.totalReward` is 0 (which happens when no card earns any reward for the given transactions — e.g., all transactions in uncategorized categories with no matching rules), this produces `Infinity` or `NaN`. The code has a `Number.isFinite` guard that maps these to 0, but the displayed percentage is then 0%, which is misleading because the cherry-picking optimizer may also produce 0 reward. More importantly, the `savingsPct > 0` check at line 191 will be false (0 is not > 0), so no badge is shown — this is correct behavior. However, if `savingsVsSingleCard` is positive while `bestSingleCard.totalReward` is 0, the division produces Infinity, and `Number.isFinite` maps it to 0, hiding a legitimate "infinite improvement" case. The displayed badge should show something like "최적" instead of silently showing 0%.
- **Failure scenario:** A user has transactions that only match cherry-picked rules (not the best single card's rules). The single card earns 0, the cherry-pick earns 5,000. `savingsPct = 5000/0 = Infinity`, mapped to 0. The badge shows nothing even though cherry-picking is infinitely better than the single card.
- **Fix:** Add a special case when `bestSingleCard.totalReward === 0 && savingsVsSingleCard > 0` — display a special badge like "최적" or "+" instead of computing a percentage. This avoids the Infinity-to-0 masking.

### C27-02: `SavingsComparison.svelte` annual projection multiplies `savingsVsSingleCard` by 12 but does not account for the optimizer only covering the latest month

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:189`
- **Description:** The "연간 약 {formatWon(...)} 절약" line computes `(opt.savingsVsSingleCard) * 12` as the annual projection. However, `savingsVsSingleCard` is the marginal benefit for the latest month only (the optimizer only optimizes the latest month). If the user uploaded 3 months of statements, the monthly spending pattern may vary, and projecting a single month's savings across 12 months may be inaccurate. Additionally, if the user's card portfolio or reward rules change mid-year, the projection becomes stale. This is a minor UX inaccuracy rather than a bug.
- **Failure scenario:** A user uploads January+February statements. The optimizer uses February (latest month) which has higher spending than January due to Lunar New Year. The annual projection overestimates savings.
- **Fix:** Add a footnote clarifying the projection is based on the latest month only, or compute the projection from the average monthly savings across all uploaded months. Alternatively, just label it as "월 절약액 x 12" to make the assumption explicit.

### C27-03: `TransactionReview.svelte` AI categorization sets `subcategory = undefined` after category change, losing subcategory information that could be preserved

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:114`
- **Description:** When the AI categorizer changes a transaction's category, it unconditionally sets `tx.subcategory = undefined`. However, the AI result does not include subcategory information at all. For example, if the AI categorizes a "스타벅스 강남점" transaction as `dining`, the subcategory could reasonably be set to `cafe` based on the parent category's subcategories. Instead, the transaction ends up with `category: 'dining'` and `subcategory: undefined`, which means it matches the broad "dining" rule instead of the more specific "dining.cafe" rule. This can result in lower reward accuracy.
- **Failure scenario:** A "스타벅스" transaction is initially matched by the keyword matcher as `category: 'dining', subcategory: 'cafe'` with high confidence. The user clicks "AI 분류" and the AI returns `category: 'dining'` but no subcategory. The subcategory is cleared, and the transaction now matches the broad dining rule (e.g., 3%) instead of the cafe-specific rule (e.g., 5%).
- **Fix:** After the AI sets the category, run the transaction through the MerchantMatcher again with only the new category as a hint, or at minimum, preserve the existing subcategory if the AI's category matches the transaction's existing category.

### C27-04: `FileDropzone.svelte` duplicate file detection uses file name only, not file content

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:129`
- **Description:** The `addFiles` function checks for duplicates by comparing file names (`uploadedFiles.some(existing => existing.name === f.name)`). This means a user cannot upload two different files with the same name (e.g., "statement.csv" from different months or different banks). Conversely, uploading the same file twice with different names is allowed, leading to duplicate transaction entries in the analysis.
- **Failure scenario:** A user downloads two monthly statements from the same bank, both named "이용내역.csv". They rename one to "이용내역_1월.csv" and the other to "이용내역_2월.csv" — both upload fine. But if they don't rename them, the second file is silently dropped with no error message.
- **Fix:** Consider checking file size + modification date in addition to name, or compute a simple hash of the first few KB. At minimum, show a warning when a file is skipped due to name collision, so the user knows to rename it.

### C27-05: `detectBank` uses `RegExp.test()` in a loop which mutates `lastIndex` on stateful regexes

- **Severity:** LOW
- **Confidence:** Medium
- **Files:**
  - `packages/parser/src/detect.ts:116`
  - `apps/web/src/lib/parser/detect.ts:134`
- **Description:** Both `detectBank` implementations iterate over `BANK_SIGNATURES` and call `pattern.test(content)` for each pattern. The regex objects are defined as literals in the `BANK_SIGNATURES` array. While the current regexes do not use the `g` flag (so `lastIndex` is not mutated), the `test()` call on a regex that shares the `/g` flag would advance `lastIndex` and break subsequent calls. This is not currently a bug, but it is a latent risk — if someone adds a `/g` flag to any pattern in `BANK_SIGNATURES`, the detection logic would break silently on the second call. The same risk applies to the CSV adapter `detect()` methods which also use regex `test()`.
- **Failure scenario:** A developer adds a pattern like `/something/gi` to `BANK_SIGNATURES`. The first call to `detectBank` works, but on the second call, the regex's `lastIndex` is still set from the previous call, causing it to start matching from the wrong position. The bank detection returns incorrect results.
- **Fix:** Either document that all patterns must avoid the `/g` flag, or reset `lastIndex` before each `test()` call, or use `String.prototype.search()` instead of `RegExp.test()` for the pattern matching.

---

## Final Sweep — Cross-File Interactions

1. **C26-01 (rewardType tracking) — confirmed fixed:** The `rewardTypeAccum` map at `reward.ts:214` and the dominant type selection at lines 344-362 correctly track which reward type contributes the most cumulative reward per category bucket. This replaces the old behavior where `bucket.rewardType` was unconditionally overwritten on each transaction.

2. **C26-02 (CategoryBreakdown color lookup) — confirmed fixed:** The `getCategoryColor()` function at `CategoryBreakdown.svelte:56-61` correctly tries the full dot-notation key first (e.g., `dining.cafe`), then the leaf ID (`cafe`), then falls back to `uncategorized`. This ensures subcategorized categories get the correct color instead of gray.

3. **C26-03 (reoptimize stale monthlyBreakdown) — confirmed fixed:** The `reoptimize` method at `store.svelte.ts:358-384` now computes `updatedMonthlyBreakdown` from `editedTransactions` before computing `previousMonthSpending`. The previous stale data issue is resolved.

4. **Bank name duplication (D-42/D-57):** Still present — `ALL_BANKS` in `FileDropzone.svelte`, `formatIssuerNameKo` in `formatters.ts`, `BANK_SIGNATURES` in both `packages/parser/src/detect.ts` and `apps/web/src/lib/parser/detect.ts`, `BANK_COLUMN_CONFIGS` in `apps/web/src/lib/parser/xlsx.ts` are five independent hardcoded lists. Adding a new bank requires updating all five.

5. **Type duplication (D-01/D-42):** `packages/parser/src/types.ts` and `apps/web/src/lib/parser/types.ts` still define identical `BankId`, `RawTransaction`, `ParseResult`, `ParseError`, `BankAdapter` types.

6. **`inferYear` / `parseDateToISO` duplication (D-03/D-43, C26-04):** Still present across 4+ files. Noted as deferred finding.

7. **PDF table parser duplication:** `packages/parser/src/pdf/table-parser.ts` and `apps/web/src/lib/parser/pdf.ts` have nearly identical `detectColumnBoundaries`, `splitByColumns`, `parseTable`, and `filterTransactionRows` functions.

8. **`detectBank` / `detectCSVDelimiter` duplication:** `packages/parser/src/detect.ts` and `apps/web/src/lib/parser/detect.ts` have identical `detectBank` and `detectCSVDelimiter` functions with identical `BANK_SIGNATURES` arrays. Part of D-42/D-57.

9. **`loadCategories` is called redundantly in `store.svelte.ts` and `analyzer.ts`:** The `getCategoryLabels` method in `store.svelte.ts:244-262` calls `loadCategories()` and builds a Map, and `optimizeFromTransactions` in `analyzer.ts:198-214` also calls `loadCategories()` and builds a Map when `prebuiltCategoryLabels` is not provided. Both build identical Maps with the same dot-notation entries. The `reoptimize` method passes the pre-built labels, but the initial `analyze` path does not — `analyzeMultipleFiles` builds its own labels at lines 257-278 and passes them to `optimizeFromTransactions`. This is correct but means the labels are built twice for the initial analysis path (once in `analyzeMultipleFiles` and once in `store.getCategoryLabels`).

10. **`FileDropzone.svelte` sets `fileInputEl.value = ''` on file removal (line 162) but uses `bind:this={fileInputEl}` which means both file inputs share the same binding:** There are two `<input type="file">` elements — one in the "empty state" drop zone (line 343) and one in the "add more" button (line 323). Both use `bind:this={fileInputEl}`, so the second one to render overwrites the binding. The `removeFile` and `clearAllFiles` functions reset `fileInputEl.value`, but only one input's value is reset. This is a minor UX issue — the other input may retain stale file selections.

---

## Summary of Active Findings (New in Cycle 27)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C27-01 | MEDIUM | High | `apps/web/src/components/dashboard/SavingsComparison.svelte:73-76` | `savingsPct` division by zero when `bestSingleCard.totalReward` is 0 — Infinity mapped to 0 hides legitimate improvement |
| C27-02 | LOW | Medium | `apps/web/src/components/dashboard/SavingsComparison.svelte:189` | Annual projection multiplies single-month savings by 12 without clarification |
| C27-03 | LOW | High | `apps/web/src/components/dashboard/TransactionReview.svelte:114` | AI categorization clears subcategory, losing specificity that could affect reward matching |
| C27-04 | LOW | High | `apps/web/src/components/upload/FileDropzone.svelte:129` | Duplicate file detection by name only — silently drops same-named different files, allows same-content different-name |
| C27-05 | LOW | Medium | `packages/parser/src/detect.ts:116`, `apps/web/src/lib/parser/detect.ts:134` | `RegExp.test()` in loop is safe now but fragile — adding `/g` flag to any pattern would break bank detection silently |
