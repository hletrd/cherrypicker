# Comprehensive Code Review -- Cycle 44

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 44)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-43 reviews. Verified that all prior cycle 43 findings (C43-L01 through C43-L04) are still tracked. Ran `bun test` (266 pass, 0 fail). Focused on finding genuinely NEW issues not previously reported, with particular attention to:

1. Cross-file consistency between server-side and web-side parsers
2. Reward calculation edge cases and cap rollback logic
3. SessionStorage validation and state management
4. Optimizer correctness (greedy vs ILP fallback)
5. LLM fallback security and error handling
6. Web-side PDF `tryStructuredParse` exception handling inconsistency
7. CategoryBreakdown color handling and hardcoded maps
8. EUC-KR encoding detection robustness
9. Edge cases in `calculateRewards` when both `rate` and `fixedAmount` are present
10. Store `reoptimize` state consistency with `editedTxs`

---

## Verification of Cycle 43 Findings

| Finding | Status | Evidence |
|---|---|---|
| C43-L01 | **STILL DEFERRED** | `packages/core/src/calculator/reward.ts:259-273` -- when both rate and fixedAmount are present, perTxCap applied to rate-based reward. No current YAML files trigger this. |
| C43-L02 | **FIXED** | `packages/viz/src/report/generator.ts:10` now has `if (!Number.isFinite(amount)) return '0원';` |
| C43-L03 | **FIXED** | `packages/viz/src/report/generator.ts:15` now has `if (!Number.isFinite(rate)) return '0.00%';` |
| C43-L04 | **STILL DEFERRED** | `apps/web/src/lib/parser/index.ts:34` still uses `catch { continue; }` for encoding detection. Same class as D-109. |

---

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `apps/web/src/lib/store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |
| D-28 | **STILL FIXED** | `apps/web/src/components/upload/FileDropzone.svelte:206` uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard |
| D-102 | **RESOLVED** | `packages/core/src/index.ts:18` now exports `buildCategoryKey` |

---

## New Findings

No genuinely new HIGH or MEDIUM severity findings. The codebase remains in excellent shape after 43 prior fix cycles. All previously identified HIGH/MEDIUM issues have been addressed and remain fixed.

The following LOW-severity observations are documented from this cycle's thorough review:

### C44-L01: `displayedSavings` animation target can become negative when `savingsVsSingleCard` is negative

- **Severity:** LOW (UX)
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:53-69`
- **Description:** The `$effect` that drives the count-up animation sets `displayedSavings` to the `opt.savingsVsSingleCard` target. When `savingsVsSingleCard < 0` (suboptimal optimization), the animation correctly transitions to a negative value. However, the guard at line 55 (`if (target === 0) { displayedSavings = 0; return; }`) means that when the optimization produces exactly 0 savings, the animation resets to 0 without a smooth transition. This is a minor visual inconsistency -- when the user reoptimizes and savings drop from positive to exactly 0, the display jumps instead of animating down.
- **Failure scenario:** User reoptimizes with edits that bring savings to exactly 0. The displayed savings jumps from the previous positive value to 0 instead of animating smoothly.
- **Fix:** Remove the early return for `target === 0` and let the animation handle it naturally, or add a threshold (e.g., `if (target === 0 && displayedSavings === 0) return;`).

### C44-L02: Server-side CSV content-signature detection loop silently drops adapter errors

- **Severity:** LOW (diagnostics)
- **Confidence:** High
- **File:** `packages/parser/src/csv/index.ts:56-65`
- **Description:** Same finding as C42-L02/D-107. The content-signature detection loop uses `catch { continue; }` which silently drops errors from bank-specific adapters. The web-side equivalent at `apps/web/src/lib/parser/csv.ts:974-980` logs the error with `console.warn`. If all adapters fail, the user gets no feedback about why bank-specific parsing failed, but the generic parser provides a reasonable fallback.
- **Failure scenario:** A bank adapter throws an unexpected error (e.g., malformed encoding) during content-signature detection, and the error is silently dropped with no diagnostic output.
- **Fix:** Add `console.warn` or error collection in the catch block to match the web-side behavior.
- **Note:** This is a carry-over from prior cycles (same as D-107/C42-L02). Not a new finding, but re-confirmed.

### C44-L03: Web-side PDF `tryStructuredParse` catches all exceptions with bare `catch {}`

- **Severity:** LOW (defensive coding)
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/pdf.ts:284`
- **Description:** Same finding as C42-L01/D-106. The web-side `tryStructuredParse` uses `catch {}` which swallows all errors including programming errors (ReferenceError, etc.). The server-side equivalent at `packages/parser/src/pdf/index.ts:181-186` only catches `SyntaxError | TypeError | RangeError` and re-throws everything else. This inconsistency could mask bugs on the web side, but the parser is a best-effort component where silent failure is acceptable behavior.
- **Failure scenario:** A programming error in the web-side PDF parser (e.g., accessing a property on undefined) is silently caught, producing no transactions and no diagnostic output.
- **Fix:** Narrow the catch to specific error types matching the server-side implementation.
- **Note:** This is a carry-over from prior cycles (same as D-106/C42-L01). Not a new finding, but re-confirmed.

### C44-L04: `reoptimize` edits all transactions but only optimizes latest month -- potential confusion with non-latest edits

- **Severity:** LOW (UX)
- **Confidence:** Medium
- **File:** `apps/web/src/lib/store.svelte.ts:340-411`
- **Description:** When the user edits a transaction from a non-latest month in `TransactionReview.svelte`, the `reoptimize` method correctly recalculates `previousMonthSpending` from all edited transactions (including non-latest). However, the optimization result only reflects the latest month's transactions. If the user changes a category on a non-latest month transaction, the optimization doesn't visibly change (because the optimization only covers the latest month), which could be confusing. The `hasEdits` flag remains true until the user applies, but applying changes only affects the latest month's optimization.
- **Failure scenario:** User changes a category on a January transaction when the latest month is February. The optimization result doesn't change (still February's optimization), and the user may not understand why their edit had no visible effect.
- **Fix:** Either: (a) show a message explaining that only the latest month is optimized, or (b) include non-latest-month transactions in the optimization result for visual feedback (even though they don't affect the greedy assignment).
- **Note:** This is a UX design consideration, not a bug. The current behavior is correct from a reward calculation perspective.

---

## Final Sweep -- Cross-File Interactions

1. **C43-L02/C43-L03 fix status:** Both `formatWon` and `formatRate` in `packages/viz/src/report/generator.ts` now have `Number.isFinite` guards (lines 10 and 15). Fixed and verified.

2. **C43-L01 fix status:** `packages/core/src/calculator/reward.ts:259-273` still has the rate+fixedAmount edge case. No YAML files trigger this. Still deferred as D-108.

3. **C43-L04/D-109 fix status:** `apps/web/src/lib/parser/index.ts:34` still uses `catch { continue; }`. Still deferred.

4. **parseAmount consistency across ALL parsers (complete inventory):**
   - Server-side CSV bank adapters (10 files): return `NaN`, guarded by `if (isNaN(amount))` -- FIXED in C41-01
   - Server-side CSV generic (`generic.ts`): returns `null`, guarded by `amount === null`
   - Server-side PDF (`pdf/index.ts:102-108`): returns `0`, filtered by `amount <= 0`
   - Web-side CSV (`csv.ts:114-121`): returns `NaN`, guarded by `isValidAmount()`
   - Web-side CSV generic (`csv.ts:244-248`): returns `NaN`, guarded by `Number.isNaN(amount)`
   - Web-side PDF (`pdf.ts:207-213`): returns `0`, filtered by `amount <= 0`
   - Web-side XLSX (`xlsx.ts:124-141`): returns `null`, guarded by `amount === null`
   - All parsers correctly guard against NaN/null propagation. **No issues.**

5. **Installment handling consistency re-verified:** All parsing locations use `inst > 1` for installment filtering. No regressions.

6. **Date validation consistency re-verified:** All `parseDateToISO` implementations have month/day range validation. No regressions.

7. **Global cap rollback logic verified:** The `ruleMonthUsed` rollback at `reward.ts:316-317` is correct. The over-count is correctly subtracted from `ruleResult.newMonthUsed`.

8. **SessionStorage validation re-verified:** `isValidTx` has both `Number.isFinite(tx.amount)` and `tx.amount > 0` checks. Web-side is protected against NaN even if parser leaks it.

9. **Server-side vs web-side PDF date format handling:** Consistent since C39-01 fix. Both handle full dates, short-year dates, Korean dates, and short MM/DD dates with month/day range validation. No regressions.

10. **`cachedCoreRules` module-level cache:** Still present in `analyzer.ts:47`. Intentionally never invalidated since `cards.json` static data never changes within a session. Not a bug.

11. **AI categorizer disabled:** `categorizer-ai.ts` correctly stubs all methods to throw. `TransactionReview.svelte` checks `aiAvailable` before showing the AI button. No dead-code path issues.

12. **E2E test isolation:** `bunfig.toml` correctly excludes `e2e/**` from `bun test`. Confirmed working (266 pass, 0 fail).

13. **Report HTML generator** (`packages/viz/src/report/generator.ts`): Uses `esc()` for HTML escaping. The savings sign prefix correctly prepends "+" for non-negative savings. `formatWon` and `formatRate` now have NaN guards (C43-L02/C43-L03 fix). No other issues found.

14. **LLM fallback security:** The `ANTHROPIC_API_KEY` is read from `process.env` and only used server-side. The browser guard (`typeof window !== 'undefined'`) prevents client-side execution. The 30-second timeout and text truncation (8000 chars) are reasonable safeguards. The JSON extraction with greedy match and progressive fallback is robust.

15. **SavingsComparison.svelte count-up animation:** The `$effect` correctly returns a cleanup function that cancels the animation frame. No memory leak. However, the `target === 0` early return causes a visual jump (C44-L01).

16. **FileDropzone previousMonthSpending parsing:** Line 206 uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard. Correctly handles the `parseInt("1e5", 10)` issue from D-28.

17. **CategoryBreakdown colors:** Still uses hardcoded `CATEGORY_COLORS` map (D-42/D-46/D-64/D-78). Missing categories fall through to `uncategorized` gray. No new categories added since last review. Not a new issue.

18. **`reoptimize` flow:** The store correctly filters to the latest month for reoptimization (store.svelte.ts:348-351), matching the initial `analyzeMultipleFiles` behavior. The `previousMonthSpending` is recomputed from edited transactions (store.svelte.ts:373-384). No stale data risk.

19. **Web-side PDF `tryStructuredParse` catches all exceptions:** `apps/web/src/lib/parser/pdf.ts:284` uses `catch {}` which swallows all errors including programming errors. The server-side equivalent at `packages/parser/src/pdf/index.ts:181-186` only catches `SyntaxError | TypeError | RangeError` and re-throws everything else. This inconsistency could mask bugs on the web side. LOW severity -- same as C42-L01/C41 sweep item 17 / D-106.

20. **Server-side `detect.ts` reads file twice for CSV detection:** `detectFormat` at line 158-201 calls `readFile(filePath)` twice (once for magic bytes, once for content). For large files, this is wasteful. However, CSV files are typically small. LOW severity -- same as C41 sweep item 18.

21. **Server-side CSV `parseCSV` silent adapter failure swallowing:** `csv/index.ts:56-65` silently swallows errors from bank-specific adapters during the content-signature detection loop (`catch { continue; }`). If all adapters fail, the user gets no feedback about why bank-specific parsing failed. LOW severity -- same as C42-L02/C41 sweep item 19 / D-107.

22. **`buildCategoryKey` is now re-exported from `@cherrypicker/core` index:** `packages/core/src/index.ts:18` now exports `buildCategoryKey` from the calculator module. D-102 is resolved.

23. **Web-side `parseFile` encoding fallback:** The multi-encoding loop at `apps/web/src/lib/parser/index.ts:20-35` tries utf-8, euc-kr, and cp949, selecting the encoding with the fewest replacement characters. This is robust for Korean card statements. The `catch { continue; }` at line 34 silently skips unsupported encodings (which is correct since `TextDecoder` may throw for unsupported labels).

24. **EUC-KR ratio-based detection (server-side):** `packages/parser/src/index.ts:41` uses `ratio > 1` (replacement characters per KB) to decide whether to fall back to EUC-KR. This threshold was introduced in the commit `fix: EUC-KR ratio-based detection, ILP fallback warning, storage validation`. The threshold of 1 replacement char per KB is reasonable for Korean card statements.

25. **`greedyOptimize` transaction filter uses `tx.amount > 0`:** At `greedy.ts:266`, transactions are filtered by `tx.amount > 0`. Since NaN > 0 is false, NaN amounts would be filtered out here even if they leaked past the parser. Defense in depth is working correctly.

26. **`scoreCardsForTransaction` double computation (D-09/D-51/D-86):** Still present. `calculateCardOutput` is called twice per card per transaction (before and after adding the new transaction). For typical use cases this is acceptable. No regression.

27. **TransactionReview.svelte `editedTxs` mutation through `changeCategory`:** The `changeCategory` function (line 182-199) directly mutates `editedTxs` array entries via `tx.category = ...` and `tx.subcategory = ...`. Since `editedTxs` is a `$state` array and the entries are plain objects, Svelte 5's reactivity system tracks these mutations correctly. No reactivity bug.

28. **`loadCategories` fetch deduplication:** Both `analyzer.ts` and `store.svelte.ts` call `loadCategories()`, which uses a module-level `categoriesPromise` cache. The cache ensures only one fetch occurs per session. No race condition risk.

---

## Summary of Active Findings (New in Cycle 44)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C44-L01 | LOW | High | `apps/web/src/components/dashboard/SavingsComparison.svelte:53-69` | Count-up animation jumps to 0 when savings target is exactly 0 instead of smooth transition | NEW -- minor UX fix |
| C44-L02 | LOW | High | `packages/parser/src/csv/index.ts:56-65` | Server-side CSV content-signature detection silently swallows adapter errors (same as D-107) | CARRY-OVER from D-107 |
| C44-L03 | LOW | High | `apps/web/src/lib/parser/pdf.ts:284` | Web-side PDF `tryStructuredParse` catches all exceptions with bare `catch {}` (same as D-106) | CARRY-OVER from D-106 |
| C44-L04 | LOW | Medium | `apps/web/src/lib/store.svelte.ts:340-411` | Edits to non-latest month transactions have no visible optimization effect -- potential user confusion | NEW -- UX design consideration |
