# Comprehensive Code Review -- Cycle 46

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 46)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-45 reviews. Verified that all prior cycle 45 findings (C45-L01 through C45-L04) are tracked. Ran `bun test` (266 pass, 0 fail). Focused on finding genuinely NEW issues not previously reported, with particular attention to:

1. Reward calculation edge cases (rate+fixedAmount coexistence, perTxCap, global cap rollback, `calculateFixedReward` unit handling)
2. Cross-file consistency between server-side and web-side parsers
3. SessionStorage validation and state management
4. Optimizer correctness (greedy marginal scoring, cap interactions)
5. LLM fallback security and error handling
6. Web-side PDF `tryStructuredParse` exception handling inconsistency
7. CategoryBreakdown color handling and hardcoded maps
8. EUC-KR encoding detection robustness
9. Edge cases in `formatWon` / `formatRate` with NaN/Infinity inputs
10. Store `reoptimize` state consistency with `editedTxs`
11. TransactionReview `changeCategory` mutation and reactivity
12. FileDropzone file validation and duplicate detection
13. SpendingSummary `formatPeriod` edge cases
14. OptimalCardMap sorting and `maxRate` denominator
15. ILP optimizer stub correctness
16. Report HTML generator XSS and formatting
17. `calculatePercentageReward` shared primitive correctness
18. `buildConstraints` transaction preservation
19. `MerchantMatcher` substring matching edge cases
20. `loadCategories` / `loadCardsData` fetch deduplication and error recovery

---

## Verification of Cycle 45 Findings

| Finding | Status | Evidence |
|---|---|---|
| C45-L01 | **FIXED** | `apps/web/src/lib/formatters.ts:8` now has `if (amount === 0) amount = 0;` which normalizes negative zero to positive zero. `SavingsComparison.svelte:202` also has `Object.is(displayedSavings, -0)` guard. |
| C45-L02 | **FIXED** | `apps/web/src/components/dashboard/SpendingSummary.svelte:119` now checks consecutive months and switches label between "전월실적" and "이전 달 실적". |
| C45-L03 | **STILL PRESENT** | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:56-60` still uses hardcoded `CATEGORY_COLORS` map with fallback to uncategorized gray. Same as D-42/D-46/D-64/D-78. |
| C45-L04 | **FIXED** | `apps/web/src/components/dashboard/OptimalCardMap.svelte:23` now uses `0.0001` minimum instead of `0.001`, with proportional epsilon comment. |

---

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `apps/web/src/lib/store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |
| D-28 | **STILL FIXED** | `apps/web/src/components/upload/FileDropzone.svelte:206` uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard |
| D-102 | **STILL FIXED** | `packages/core/src/index.ts:18` exports `buildCategoryKey` |
| D-106 | **STILL DEFERRED** | `apps/web/src/lib/parser/pdf.ts:284` still uses bare `catch {}` |
| D-107 | **STILL DEFERRED** | `packages/parser/src/csv/index.ts:60-63` still uses `catch { continue; }` for content-signature detection |
| D-110 | **STILL DEFERRED** | Non-latest month edits have no visible optimization effect |

---

## New Findings

No genuinely new HIGH or MEDIUM severity findings. The codebase remains in excellent shape after 45 prior fix cycles. All previously identified HIGH/MEDIUM issues have been addressed and remain fixed.

The following LOW-severity observations are documented from this cycle's thorough review:

### C46-L01: `viz/report/generator.ts` `formatWon` does not normalize negative zero

- **Severity:** LOW (cosmetic, same class as C45-L01 which was fixed in the web-side formatter)
- **Confidence:** Medium
- **File:** `packages/viz/src/report/generator.ts:9-12`
- **Description:** The report generator has its own local `formatWon` function that does not normalize negative zero. While the web-side `formatWon` in `apps/web/src/lib/formatters.ts` was fixed in C45-L01 to use `if (amount === 0) amount = 0;`, the report generator's version still passes `-0` through to `toLocaleString('ko-KR')`, potentially rendering "-0원" in the HTML report's "추가 혜택" cell when `savingsVsSingleCard` is exactly `-0`. This is extremely unlikely in practice because `savingsVsSingleCard` is computed as `totalReward - bestSingleCard.totalReward`, both of which are integer-rounded Won values, making exact `-0` mathematically improbable.
- **Failure scenario:** A report shows "-0원" in the "단일 최적 카드 대비 추가 혜택" cell.
- **Fix:** Add the same negative-zero normalization: `if (amount === 0) amount = 0;` after the `Number.isFinite` check.

### C46-L02: Web-side CSV `parseCSV` adapter fallback loop logs warnings but server-side silently continues

- **Severity:** LOW (observability)
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/csv.ts:973-981` vs `packages/parser/src/csv/index.ts:56-65`
- **Description:** The web-side CSV parser logs `console.warn` when a bank adapter fails during the content-signature detection loop (line 978), while the server-side CSV parser uses `catch { continue; }` with no logging. The web-side behavior is strictly better for debugging, but the inconsistency means the server-side silently swallows adapter failures with zero feedback. This is the same fundamental issue as D-107 but highlighted from a different angle: the web-side improved it (added logging) while the server-side did not.
- **Failure scenario:** A bank adapter fails on the server-side and the user has no indication of why bank-specific parsing was skipped.
- **Fix:** Add `console.warn` in the server-side `catch` block at `packages/parser/src/csv/index.ts:60-63`, matching the web-side behavior.
- **Note:** This is the same underlying issue as D-107 (silent adapter failure swallowing), but with a specific actionable fix (add logging) that is less invasive than restructuring the error handling.

---

## Final Sweep -- Cross-File Interactions

1. **C45-L01 fix verified:** `formatWon` in `apps/web/src/lib/formatters.ts:8` normalizes negative zero. `SavingsComparison.svelte:202` also has `Object.is(displayedSavings, -0)` guard. Both layers are protected.

2. **C45-L02 fix verified:** `SpendingSummary.svelte:119` computes `prevLabel` based on consecutive-month check using `Math.abs(parseInt(latestMonth.month.slice(5, 7) ?? '0', 10) - parseInt(prevMonth.month.slice(5, 7) ?? '0', 10)) <= 1`. Correctly handles non-consecutive months.

3. **C45-L04 fix verified:** `OptimalCardMap.svelte:19-23` uses `computed > 0 ? computed : 0.0001` with a proportional epsilon comment. Bars will render correctly even for very small rates.

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

13. **Report HTML generator** (`packages/viz/src/report/generator.ts`): Uses `esc()` for HTML escaping. The savings sign prefix correctly prepends "+" for non-negative savings. `formatWon` and `formatRate` have NaN guards. The only new finding is C46-L01 (negative zero in the local `formatWon`).

14. **LLM fallback security:** The `ANTHROPIC_API_KEY` is read from `process.env` and only used server-side. The browser guard (`typeof window !== 'undefined'`) prevents client-side execution. The 30-second timeout and text truncation (8000 chars) are reasonable safeguards. The JSON extraction with greedy match and progressive fallback is robust.

15. **SavingsComparison.svelte count-up animation:** The `$effect` correctly returns a cleanup function that cancels the animation frame. No memory leak. The `target === 0 && displayedSavings === 0` guard prevents the jump (C44-L01 fix).

16. **FileDropzone previousMonthSpending parsing:** Line 206 uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard. Correctly handles the `parseInt("1e5", 10)` issue from D-28.

17. **CategoryBreakdown colors:** Still uses hardcoded `CATEGORY_COLORS` map (D-42/D-46/D-64/D-78). Missing categories fall through to `uncategorized` gray. No new categories added since last review. Not a new issue.

18. **`reoptimize` flow:** The store correctly filters to the latest month for reoptimization (store.svelte.ts:348-351), matching the initial `analyzeMultipleFiles` behavior. The `previousMonthSpending` is recomputed from edited transactions (store.svelte.ts:373-384). No stale data risk.

19. **Web-side PDF `tryStructuredParse` catches all exceptions:** `apps/web/src/lib/parser/pdf.ts:284` uses `catch {}` which swallows all errors including programming errors. The server-side equivalent at `packages/parser/src/pdf/index.ts:181-186` only catches `SyntaxError | TypeError | RangeError` and re-throws everything else. This inconsistency could mask bugs on the web side. LOW severity -- same as C44-L03/C42-L01/D-106.

20. **Server-side `detect.ts` reads file twice for CSV detection:** `detectFormat` at line 158-201 calls `readFile(filePath)` twice (once for magic bytes, once for content). For large files, this is wasteful. However, CSV files are typically small. LOW severity -- same as C41 sweep item 18.

21. **Server-side CSV `parseCSV` silent adapter failure swallowing:** `csv/index.ts:56-65` silently swallows errors from bank-specific adapters during the content-signature detection loop (`catch { continue; }`). If all adapters fail, the user gets no feedback about why bank-specific parsing failed. LOW severity -- same as C44-L02/C42-L02/D-107. The web-side now logs warnings (C46-L02).

22. **`buildCategoryKey` is re-exported from `@cherrypicker/core` index:** `packages/core/src/index.ts:18` now exports `buildCategoryKey` from the calculator module. D-102 is resolved.

23. **Web-side `parseFile` encoding fallback:** The multi-encoding loop at `apps/web/src/lib/parser/index.ts:20-35` tries utf-8, euc-kr, and cp949, selecting the encoding with the fewest replacement characters. This is robust for Korean card statements. The `catch { continue; }` at line 34 silently skips unsupported encodings (which is correct since `TextDecoder` may throw for unsupported labels).

24. **EUC-KR ratio-based detection (server-side):** `packages/parser/src/index.ts:41` uses `ratio > 1` (replacement characters per KB) to decide whether to fall back to EUC-KR. This threshold is reasonable for Korean card statements.

25. **`greedyOptimize` transaction filter uses `tx.amount > 0`:** At `greedy.ts:266`, transactions are filtered by `tx.amount > 0`. Since NaN > 0 is false, NaN amounts would be filtered out here even if they leaked past the parser. Defense in depth is working correctly.

26. **`scoreCardsForTransaction` double computation (D-09/D-51/D-86):** Still present. `calculateCardOutput` is called twice per card per transaction (before and after adding the new transaction). For typical use cases this is acceptable. No regression.

27. **TransactionReview.svelte `editedTxs` mutation through `changeCategory`:** The `changeCategory` function (line 182-199) directly mutates `editedTxs` array entries via `tx.category = ...` and `tx.subcategory = ...`. Since `editedTxs` is a `$state` array and the entries are plain objects, Svelte 5's reactivity system tracks these mutations correctly. No reactivity bug.

28. **`loadCategories` fetch deduplication:** Both `analyzer.ts` and `store.svelte.ts` call `loadCategories()`, which uses a module-level `categoriesPromise` cache. The cache ensures only one fetch occurs per session. No race condition risk.

29. **`formatWon` and `formatRate` NaN guards:** Both functions have `Number.isFinite` checks that return safe defaults ('0원', '0.0%'). No NaN propagation to the UI.

30. **`calculatePercentageReward` primitive:** Uses `Math.floor(amount * rate)` for all reward types. This is correct for Korean Won (integer currency). The monthly cap logic is consistent across discount/points/cashback/mileage. No issues.

---

## Summary of Active Findings (New in Cycle 46)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C46-L01 | LOW | Medium | `packages/viz/src/report/generator.ts:9-12` | Local `formatWon` does not normalize negative zero (same class as C45-L01, which was fixed on the web side) | NEW -- cosmetic edge case |
| C46-L02 | LOW | High | `packages/parser/src/csv/index.ts:60-63` | Server-side CSV adapter fallback loop silently swallows errors; web-side logs warnings | NEW -- observability (same root cause as D-107 but with specific fix) |
