# Comprehensive Code Review -- Cycle 37

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 37)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-36 reviews. Verified that all prior cycle 36 findings (C36-01 and C36-02) are already fixed in the current codebase. Ran `bun test` (266 pass, 0 fail). Focused on finding genuinely NEW issues not previously reported, with particular attention to:

1. Cross-file consistency between server-side and web-side parsers (especially `parseAmount` return values)
2. SessionStorage validation correctness after prior fixes
3. Reward calculation edge cases and global cap rollback logic
4. PDF parser fallback path safety
5. Edge cases in the optimizer and category matching pipeline

---

## Verification of Cycle 36 Findings

| Finding | Status | Evidence |
|---|---|---|
| C36-01 | **FIXED** | `apps/web/src/lib/parser/csv.ts:258` now uses `inst > 1` instead of `inst > 0` |
| C36-02 | **FIXED** | `packages/parser/src/xlsx/index.ts:128` now uses `Math.round(raw)` for numeric values |

## Verification of Deferred Item D-99

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **FIXED** | `apps/web/src/lib/store.svelte.ts:147-148` now has `Number.isFinite(tx.amount) && tx.amount > 0` in `isValidTx` |

---

## New Findings

### C37-01: Server-side PDF `parseAmount` returns NaN for unparseable amounts -- inconsistent with web-side which returns 0

- **Severity:** LOW (correctness/safety)
- **Confidence:** High
- **File:** `packages/parser/src/pdf/index.ts:96-99`
- **Description:** The server-side PDF parser's `parseAmount` returns `NaN` when `parseInt` fails: `return Number.isNaN(n) ? NaN : n`. The web-side equivalent at `apps/web/src/lib/parser/pdf.ts:207-213` explicitly returns `0` instead, with a comment: "Return 0 instead of NaN so callers never have to guard against NaN propagation. Amounts of 0 are correctly filtered out by the > 0 checks in both the structured and fallback parsing paths."

  The server-side `tryStructuredParse` at line 142 checks `Number.isNaN(amount)` to filter NaN values, so they ARE caught in the current code. However, the web-side design is safer for future maintenance: if a developer adds a new code path that doesn't explicitly check for NaN, the server-side version would propagate NaN into `RawTransaction.amount`, which could then flow into the reward calculator. The web-side's approach of returning 0 means that `0 > 0` is `false`, so any path that checks `amount > 0` will safely skip the transaction.

  The same pattern is also used in `packages/parser/src/pdf/index.ts:96-99` -- the server-side PDF `parseAmount` is the ONLY `parseAmount` in the entire codebase that returns NaN. All other `parseAmount` implementations (in csv.ts, xlsx.ts, and the web-side pdf.ts) return null, 0, or a valid number -- never NaN.

- **Failure scenario:** A developer adds a new PDF parsing code path in `packages/parser/src/pdf/index.ts` that processes `parseAmount` results without a `Number.isNaN()` guard. A PDF with corrupted text (e.g., "abc원") produces `amount: NaN` on the transaction. This NaN propagates to `calculateRewards`, where `tx.amount <= 0` at line 218 evaluates to `false` (NaN comparisons always return false), so the transaction is NOT skipped. Then `buildCategoryKey(tx.category, tx.subcategory)` at line 222 produces a valid key, and the NaN amount flows into `bucket.spending += NaN`, corrupting the entire category bucket and all downstream calculations. The `Math.round(NaN)` in the XLSX path and `Math.floor(NaN * rate)` in the calculator would also produce NaN, which would propagate through `totalReward`, `effectiveRate`, etc.

- **Fix:** Change `packages/parser/src/pdf/index.ts:98` from `return Number.isNaN(n) ? NaN : n;` to `return Number.isNaN(n) ? 0 : n;` to match the web-side pattern. Add a comment explaining why 0 is returned instead of NaN (same as the web-side comment).

---

## Final Sweep -- Cross-File Interactions

1. **All prior findings confirmed fixed:** C36-01 and C36-02 are verified as resolved. D-99 is also resolved (isValidTx now has both `Number.isFinite` and `> 0` checks).

2. **Installment handling consistency re-verified:** All 22+ installment parsing locations now use `inst > 1`. No regressions from the C36-01 fix.

3. **parseAmount consistency re-verified:** All `parseAmount` functions now use `Math.round()` for numeric values (XLSX), or `parseInt` which truncates to integers (CSV, PDF string path). Only the server-side PDF `parseAmount` returns NaN for unparseable values -- C37-01 above.

4. **Date validation consistency re-verified:** All `parseDateToISO` implementations have month/day range validation. No regressions found.

5. **Global cap rollback logic verified:** The `ruleMonthUsed` rollback at `reward.ts:316-317` correctly computes `currentRuleMonthUsed + appliedReward` (the math simplifies correctly). The overcount computation `rewardAfterMonthlyCap - appliedReward` is always >= 0 because `appliedReward = Math.min(rewardAfterMonthlyCap, globalRemaining)`.

6. **SessionStorage validation re-verified:** `isValidTx` now has `Number.isFinite(tx.amount) && tx.amount > 0`, which covers both the NaN and negative amount cases that D-99 identified. The `loadFromStorage` validation correctly checks the optimization object structure and filters invalid transactions.

7. **Deferred items unchanged:** D-01 through D-105 remain unchanged from prior cycles. D-99 is now FIXED.

8. **`cachedCoreRules` module-level cache:** Still present in `analyzer.ts:47`. Intentionally never invalidated since `cards.json` static data never changes within a session. Not a bug.

9. **AI categorizer disabled:** `categorizer-ai.ts` correctly stubs all methods to throw. `TransactionReview.svelte` checks `aiAvailable` before showing the AI button. No dead-code path issues.

10. **E2E test isolation:** `bunfig.toml` correctly excludes `e2e/**` from `bun test`. Confirmed working (266 pass, 0 fail).

11. **Report HTML generator** (`packages/viz/src/report/generator.ts`): Uses `esc()` for HTML escaping of user-provided strings. The savings sign prefix correctly prepends "+" for non-negative savings. No issues found.

12. **LLM fallback security:** The `ANTHROPIC_API_KEY` is read from `process.env` and only used server-side. The browser guard (`typeof window !== 'undefined'`) prevents client-side execution. The 30-second timeout and text truncation (8000 chars) are reasonable safeguards. No new security issues found.

13. **SavingsComparison.svelte count-up animation:** The `$effect` correctly returns a cleanup function that cancels the animation frame. No memory leak.

14. **FileDropzone previousMonthSpending parsing:** Line 206 uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard. This correctly handles the `parseInt("1e5", 10)` issue from D-28 by using `Number()` instead of `parseInt()`.

---

## Summary of Active Findings (New in Cycle 37)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C37-01 | LOW | High | `packages/parser/src/pdf/index.ts:98` | Server-side PDF `parseAmount` returns NaN for unparseable amounts instead of 0 -- inconsistent with web-side, creates fragile NaN-propagation risk if new code paths skip NaN guard |
