# Comprehensive Code Review -- Cycle 38

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 38)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-37 reviews. Verified that all prior cycle 37 findings (C37-01) are already fixed in the current codebase. Ran `bun test` (266 pass, 0 fail). Focused on finding genuinely NEW issues not previously reported, with particular attention to:

1. UI text vs actual code behavior mismatches
2. Cross-file consistency between server-side and web-side parsers
3. Reward calculation edge cases and global cap rollback logic
4. PDF/XLSX/CSV parser consistency
5. SessionStorage validation correctness
6. Store state management and reoptimize flow
7. Category matching and optimizer correctness

---

## Verification of Cycle 37 Findings

| Finding | Status | Evidence |
|---|---|---|
| C37-01 | **FIXED** | `packages/parser/src/pdf/index.ts:98-101` now returns `0` instead of `NaN` for unparseable amounts, with explanatory comment matching the web-side rationale |

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `apps/web/src/lib/store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |

---

## New Findings

### C38-01: FileDropzone "50만원으로 계산해요" text is misleading -- UI claims 500,000 Won default but code computes per-card exclusion-filtered spending

- **Severity:** MEDIUM (documentation/UI accuracy)
- **Confidence:** High
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:409`
- **Description:** The FileDropzone component displays the text "입력하지 않으면 50만원으로 계산해요" (if you don't enter it, it'll be calculated as 500,000 Won) when only one file is uploaded. However, the actual code does NOT use 500,000 as a default for `previousMonthSpending`.

  The actual flow when the user doesn't enter a value:
  1. `analyzeMultipleFiles` (analyzer.ts:313-315) sets `previousMonthSpending` to `options?.previousMonthSpending` which is `undefined` when the user hasn't entered anything and only one month of data is present.
  2. `optimizeFromTransactions` (analyzer.ts:184-203) receives `undefined` for `previousMonthSpending`, triggering the else branch which computes per-card exclusion-filtered spending from the current month's transactions: `transactions.filter(tx => !exclusions.has(tx.category) && ...).reduce((sum, tx) => sum + Math.abs(tx.amount), 0)`.

  This per-card computation is actually more accurate than a flat 500,000 Won default, but the UI text is factually wrong. The user is told "50만원" but the system uses the actual spending amount (which could be much higher or lower than 500,000).

- **Failure scenario:** A user with low spending (e.g., 200,000 Won/month) sees "50만원으로 계산해요" and assumes their performance tier will be calculated at 500,000 Won. But the actual calculation uses their real 200,000 Won spending, potentially placing them in a lower tier. The displayed rewards would be correct, but the user's mental model of how the system works is wrong, leading to confusion when they compare the results against their own calculations using 500,000.

- **Fix:** Update the FileDropzone text to accurately describe the actual behavior. Suggested text: "입력하지 않으면 이번 달 지출액을 기준으로 계산해요" (if you don't enter it, it'll be calculated based on this month's spending). This matches the actual code behavior.

---

## Final Sweep -- Cross-File Interactions

1. **All prior findings confirmed fixed:** C37-01 is verified as resolved. D-99 remains fixed.

2. **parseAmount consistency re-verified across all parsers:**
   - CSV (`csv.ts:114-123`): returns NaN for unparseable, guarded by `isValidAmount()` at every call site
   - XLSX (`xlsx.ts:282-298`): returns `null` for unparseable, callers skip null amounts
   - Server-side PDF (`pdf/index.ts:96-102`): returns 0 for unparseable (C37-01 fix applied)
   - Web-side PDF (`pdf.ts:207-213`): returns 0 for unparseable
   All four approaches are internally consistent -- each parser's callers handle the corresponding sentinel value correctly.

3. **Installment handling consistency re-verified:** All parsing locations use `inst > 1` for installment filtering. No regressions.

4. **Date validation consistency re-verified:** All `parseDateToISO` implementations have month/day range validation. No regressions.

5. **Global cap rollback logic verified:** The `ruleMonthUsed` rollback at `reward.ts:316-317` is correct. The overcount computation `rewardAfterMonthlyCap - appliedReward` is always >= 0 because `appliedReward = Math.min(rewardAfterMonthlyCap, globalRemaining)`.

6. **SessionStorage validation re-verified:** `isValidTx` has both `Number.isFinite(tx.amount)` and `tx.amount > 0` checks. The `loadFromStorage` validation correctly checks the optimization object structure.

7. **Deferred items unchanged:** D-01 through D-105 remain unchanged from prior cycles.

8. **`previousMonthSpending` default behavior verified:** When the user doesn't input a value, the code computes per-card exclusion-filtered spending from uploaded transactions (analyzer.ts:187-203), NOT 500,000 Won as the UI claims (C38-01 above).

9. **`cachedCoreRules` module-level cache:** Still present in `analyzer.ts:47`. Intentionally never invalidated since `cards.json` static data never changes within a session. Not a bug.

10. **AI categorizer disabled:** `categorizer-ai.ts` correctly stubs all methods to throw. `TransactionReview.svelte` checks `aiAvailable` before showing the AI button. No dead-code path issues.

11. **E2E test isolation:** `bunfig.toml` correctly excludes `e2e/**` from `bun test`. Confirmed working (266 pass, 0 fail).

12. **Report HTML generator** (`packages/viz/src/report/generator.ts`): Uses `esc()` for HTML escaping. The savings sign prefix correctly prepends "+" for non-negative savings. No issues found.

13. **LLM fallback security:** The `ANTHROPIC_API_KEY` is read from `process.env` and only used server-side. The browser guard prevents client-side execution. The 30-second timeout and text truncation (8000 chars) are reasonable safeguards.

14. **SavingsComparison.svelte count-up animation:** The `$effect` correctly returns a cleanup function that cancels the animation frame. No memory leak.

15. **FileDropzone previousMonthSpending parsing:** Line 206 uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard. Correctly handles the `parseInt("1e5", 10)` issue from D-28.

16. **CategoryBreakdown colors:** Still uses hardcoded `CATEGORY_COLORS` map (D-42/D-46/D-64/D-78). Missing categories fall through to `uncategorized` gray. No new categories added since last review. Not a new issue.

17. **`reoptimize` flow:** The store correctly filters to the latest month for reoptimization (store.svelte.ts:348-351), matching the initial `analyzeMultipleFiles` behavior. The `previousMonthSpending` is recomputed from edited transactions (store.svelte.ts:373-384). No stale data risk.

---

## Summary of Active Findings (New in Cycle 38)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C38-01 | MEDIUM | High | `apps/web/src/components/upload/FileDropzone.svelte:409` | "50만원으로 계산해요" text is misleading -- code computes per-card exclusion-filtered spending, not a flat 500,000 Won default |
