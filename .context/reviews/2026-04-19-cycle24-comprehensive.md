# Comprehensive Code Review — Cycle 24

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 24)
**Scope:** Full repository — all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (23 source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, and apps/web). Cross-referenced with prior cycle 1-23 reviews, deferred items (D-01 through D-105), and the aggregate. Focused on finding genuinely NEW issues not previously reported. Verified that prior cycle 23 findings (C23-01 through C23-02) have been addressed.

---

## Verification of Cycle 23 Findings

| Finding | Status | Evidence |
|---|---|---|
| C23-01 | **FIXED** | `packages/core/src/calculator/reward.ts:161-166` — `won_per_liter` case added, returns `fixedAmount` as per-transaction discount |
| C23-02 | **FIXED** | `apps/web/src/components/dashboard/SavingsComparison.svelte:173` — conditional `+` prefix; line 175 — label switches to "추가 비용" when negative |

---

## New Findings

### C24-01: Duplicate transaction IDs when multiple files are uploaded

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/analyzer.ts:101-117`
- **Description:** When `parseAndCategorize` is called for each file in `analyzeMultipleFiles`, it assigns transaction IDs using the pattern `tx-${idx}` where `idx` is the index within that single file. When transactions from multiple files are merged into `allTransactions`, IDs from different files collide. For example, if two files each have 10 transactions, both produce IDs `tx-0` through `tx-9`, and the merged array has duplicate IDs.
- **Failure scenario:** A user uploads two statement files. The dashboard's `TransactionReview.svelte` uses `{#each displayTxs as tx (tx.id)}` as the Svelte keyed each block. With duplicate keys, Svelte cannot correctly track which DOM nodes correspond to which transactions when the list updates. The `changeCategory` function also uses `editedTxs.find(t => t.id === txId)`, which always returns the first match — editing a transaction from the second file silently modifies the wrong transaction from the first file. The user's category edits are applied to the wrong transactions, producing incorrect optimization results.
- **Fix:** Include the file index in the transaction ID. In `analyzeMultipleFiles`, pass the file index to `parseAndCategorize` and use `id: tx-file${fileIdx}-${idx}` instead of `tx-${idx}`. Alternatively, use a global counter or UUID.

### C24-02: Negative annual savings displays double-negative "-X원 추가 비용"

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:175`
- **Description:** When `savingsVsSingleCard < 0` (greedy optimizer produces a suboptimal result), line 175 shows `연간 약 {formatWon(opt.savingsVsSingleCard * 12)} 추가 비용`. The `formatWon` function uses `toLocaleString('ko-KR')` which formats negative numbers with a minus sign prefix. Combined with the "추가 비용" (additional cost) label, the output becomes "연간 약 -5,000원 추가 비용" — a confusing double-negative where the minus sign and "additional cost" both indicate negativity. The correct display should be "연간 약 5,000원 추가 비용" (without the minus sign, since "추가 비용" already conveys that it's a cost rather than savings).
- **Failure scenario:** The greedy optimizer produces a result where using multiple cards yields less total reward than using the best single card. The savings card shows "연간 약 -60,000원 추가 비용", which reads as "approximately negative 60,000 won additional cost" — confusing and semantically redundant.
- **Fix:** When the label is "추가 비용" (i.e., `savingsVsSingleCard < 0`), pass the absolute value to `formatWon`: `formatWon(Math.abs(opt.savingsVsSingleCard) * 12)`. This produces "연간 약 60,000원 추가 비용" — clear and unambiguous.

### C24-03: Bar comparison visually misleading when greedy optimizer is suboptimal

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:79-83`
- **Description:** The `singleBarWidth` is computed as `Math.min(Math.round(ratio * 100), 100)` where `ratio = opt.bestSingleCard.totalReward / opt.totalReward`. When the greedy optimizer is optimal, `ratio <= 1` and the single-card bar is correctly shorter than the cherry-pick bar (which is always 100%). But when the optimizer is suboptimal (`opt.totalReward < opt.bestSingleCard.totalReward`), `ratio > 1` and the cap makes both bars 100% wide, visually implying they are equal when the single card is actually better.
- **Failure scenario:** The greedy optimizer produces a suboptimal result. Both bars render at full width, making it appear that cherry-picking and single-card strategies yield equal rewards, when in fact the single card yields more. The numerical values shown next to the bars are correct, but the visual impression is misleading.
- **Fix:** When `savingsVsSingleCard < 0`, invert the bar comparison: make the cherry-pick bar proportional to `opt.totalReward / opt.bestSingleCard.totalReward` (less than 100%) and the single-card bar full width. This accurately represents that the single card gives more reward.

---

## Final Sweep — Cross-File Interactions

1. **Duplicate transaction ID scope (C24-01):** The collision affects `TransactionReview.svelte` (Svelte key, `changeCategory`), but the optimizer itself (`greedyOptimize`, `calculateRewards`) does not use `tx.id` for any computation logic — it relies on category/subcategory/amount. So the optimization result is correct even with duplicate IDs; only the UI editing path is broken.

2. **Double-negative display consistency (C24-02):** The line 173 fix from C23-02 correctly handles the `+`/`-` prefix for the animated counter card. However, the line 175 annual savings label was not fully addressed — it still produces "-X원 추가 비용" instead of "X원 추가 비용". This is a separate issue from C23-02 which only fixed the sign prefix and label switching.

3. **Bank name drift (C21-03, D-42/D-57):** Still present — `ALL_BANKS` in `FileDropzone.svelte`, `formatIssuerNameKo` in `formatters.ts`, and `BANK_SIGNATURES` in both `packages/parser/src/detect.ts` and `apps/web/src/lib/parser/detect.ts` are four independent hardcoded lists. Adding a new bank requires updating all four.

4. **`BankId` type duplication:** `packages/parser/src/types.ts` and `apps/web/src/lib/parser/types.ts` define identical `BankId` union types. Still present from prior cycles (D-01/D-42).

5. **`inferYear` / `parseDateToISO` duplication:** Still present across 4+ files. Not a runtime bug but a maintenance hazard (D-03/D-43).

6. **AI categorizer is disabled:** `apps/web/src/lib/categorizer-ai.ts` stubs out all functions with `throw new Error(...)`. `TransactionReview.svelte` checks `aiAvailable` before showing the AI button, so the disabled state is handled correctly in the UI. No issue.

7. **LLM fallback security:** `packages/parser/src/pdf/llm-fallback.ts` properly requires explicit `allowRemoteLLM` opt-in, validates API key, uses 30-second timeout, and has JSON parse guards. No new security concerns.

8. **CSP `'unsafe-inline'`:** Still present with documented TODO. Not new.

9. **`cachedCoreRules` stale cache:** The cache in `apps/web/src/lib/analyzer.ts:47` persists across optimizer calls within a session. Since `cardIds` filtering is applied after cache retrieval (line 164), filtered calls correctly get the right subset. The cache is only stale if the underlying `cards.json` changes during a session (e.g., HMR), which is acceptable for production.

10. **`report.js` DOM construction:** Uses `document.createElement` and `setAttribute`, which is XSS-safe. Data comes from same-origin sessionStorage. No issue.

---

## Summary of Active Findings (New in Cycle 24)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C24-01 | MEDIUM | High | `apps/web/src/lib/analyzer.ts:101-117` | Duplicate transaction IDs when multiple files are uploaded — breaks Svelte keyed each and `changeCategory` in TransactionReview |
| C24-02 | MEDIUM | High | `apps/web/src/components/dashboard/SavingsComparison.svelte:175` | Negative annual savings displays double-negative "-X원 추가 비용" — minus sign from `formatWon` conflicts with "추가 비용" label |
| C24-03 | LOW | High | `apps/web/src/components/dashboard/SavingsComparison.svelte:79-83` | Bar comparison visually misleading when greedy optimizer is suboptimal — both bars render at 100% width |
