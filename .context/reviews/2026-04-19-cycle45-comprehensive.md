# Comprehensive Code Review -- Cycle 45

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 45)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-44 reviews. Verified that all prior cycle 44 findings (C44-L01 through C44-L04) are still tracked. Ran `bun test` (266 pass, 0 fail). Focused on finding genuinely NEW issues not previously reported, with particular attention to:

1. Cross-file consistency between server-side and web-side parsers
2. Reward calculation edge cases in `calculateRewards` (rate+fixedAmount, perTxCap, global cap rollback)
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

---

## Verification of Cycle 44 Findings

| Finding | Status | Evidence |
|---|---|---|
| C44-L01 | **FIXED** | `apps/web/src/components/dashboard/SavingsComparison.svelte:55` now uses `if (target === 0 && displayedSavings === 0) return;` -- smooth animation when target drops to 0 |
| C44-L02 | **STILL DEFERRED** | `packages/parser/src/csv/index.ts:56-65` still uses `catch { continue; }` for content-signature detection. Same as D-107. |
| C44-L03 | **STILL DEFERRED** | `apps/web/src/lib/parser/pdf.ts:284` still uses bare `catch {}`. Same as D-106. |
| C44-L04 | **STILL DEFERRED** | `apps/web/src/lib/store.svelte.ts:340-411` -- non-latest month edits have no visible optimization effect. Same as D-110. |

---

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `apps/web/src/lib/store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |
| D-28 | **STILL FIXED** | `apps/web/src/components/upload/FileDropzone.svelte:206` uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard |
| D-102 | **RESOLVED** | `packages/core/src/index.ts:18` now exports `buildCategoryKey` |

---

## New Findings

No genuinely new HIGH or MEDIUM severity findings. The codebase remains in excellent shape after 44 prior fix cycles. All previously identified HIGH/MEDIUM issues have been addressed and remain fixed.

The following LOW-severity observations are documented from this cycle's thorough review:

### C45-L01: `formatWon` does not handle negative zero (`-0`) distinctly from positive zero

- **Severity:** LOW (cosmetic)
- **Confidence:** Medium
- **File:** `apps/web/src/lib/formatters.ts:5-8`
- **Description:** `formatWon(-0)` produces `"-0원"` via `toLocaleString('ko-KR')` which preserves the signed zero. This could appear in the SavingsComparison component when `displayedSavings` animates through 0 from a negative starting value (e.g., suboptimal optimization where savings go from -5,000 to 0). The visual output would be `"-0원"` instead of `"0원"`. However, in practice, the SavingsComparison component uses `displayedSavings >= 0 ? '+' : ''` prefix which would show `"+-0원"` (double prefix) if `displayedSavings` is exactly `-0`. This is extremely unlikely since `Math.round()` on the animation interpolation produces regular `0` in the vast majority of cases.
- **Failure scenario:** User sees `"+-0원"` in the SavingsComparison component when the animation passes through a `-0` value.
- **Fix:** Add `amount = Math.abs(amount)` at the start of `formatWon` or use `Object.is(amount, -0) ? 0 : amount` to normalize signed zero. Alternatively, guard in SavingsComparison with `Math.abs(displayedSavings)` when formatting.

### C45-L02: `SpendingSummary` accesses `monthlyBreakdown[lastIndex - 2]` without bounds check when only one month exists

- **Severity:** LOW (robustness)
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:118`
- **Description:** When `monthlyBreakdown.length > 1`, line 118 accesses `monthlyBreakdown[analysisStore.result.monthlyBreakdown.length - 2]?.spending` to display the previous month's spending. The optional chaining (`?.`) protects against `undefined`, but if `monthlyBreakdown` has exactly 2 elements, `length - 2 = 0` which is the first month -- which may not actually be the "previous" month relative to the optimization. This works correctly in the current flow because `analyzeMultipleFiles` always adds months in chronological order, but the labeling "전월실적" (previous month's spending) could be misleading if the two months are not consecutive (e.g., January and March with February missing).
- **Failure scenario:** User uploads statements for January and March (no February). The "전월실적" shows January's spending, which is not the previous month relative to March's optimization.
- **Fix:** Either: (a) add a check that the months are consecutive before displaying "전월실적", or (b) change the label to "이전 달 실적" (previous available month) instead of "전월실적" (previous month). This is a UX clarity issue, not a bug.

### C45-L03: `getCategoryColor` falls through to `uncategorized` color for missing dot-notation keys with no subcategory ID match

- **Severity:** LOW (UX)
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:56-60`
- **Description:** Same class as D-42/D-46/D-64/D-78. The `getCategoryColor` function tries: (1) full key (e.g., "dining.cafe"), (2) leaf ID (e.g., "cafe"), (3) uncategorized fallback. If a new subcategory is added to the taxonomy but not to `CATEGORY_COLORS`, and its leaf ID doesn't match any existing key, it falls through to the `uncategorized` gray color. Currently, all subcategory leaf IDs in the taxonomy ARE present in `CATEGORY_COLORS`, so this is not triggered. But the `traditional_market` parent category is present while its dot-notation key `grocery.traditional_market` is not explicitly in the map -- though it resolves correctly because `traditional_market` IS in the map as a leaf ID.
- **Failure scenario:** A new category is added to the taxonomy (e.g., "pet") but not to `CATEGORY_COLORS`. Transactions in that category show as gray.
- **Fix:** Same as D-42 exit criterion: implement a hash-based dynamic color function for missing categories.
- **Note:** This is a carry-over from prior cycles (same as D-42/D-46/D-64/D-78). Not a new finding, but re-confirmed.

### C45-L04: `OptimalCardMap` `maxRate` uses `0.001` as minimum denominator but rate values can be much smaller

- **Severity:** LOW (edge-case)
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:19`
- **Description:** `maxRate` is computed as `assignments.reduce((max, a) => Math.max(max, a.rate), 0.001)`. The `0.001` minimum ensures the rate bar width calculation (`a.rate / maxRate`) never divides by zero. However, if all assignment rates are smaller than 0.001 (e.g., 0.0005 = 0.05% rate), the bar widths would be calculated relative to 0.001 rather than the actual maximum, making them appear wider than they should. This would only occur with very low-rate cards, which is an uncommon edge case.
- **Failure scenario:** All optimized cards have very low effective rates (< 0.1%). The rate bar widths appear proportionally larger than they should because the denominator is 0.001 instead of the actual maximum rate.
- **Fix:** Use `0` as the initial reduce value and add a guard: `const maxRate = Math.max(computedMax, 0.0001)` or use a minimum bar width of 5% instead of relying on a large denominator.

---

## Final Sweep -- Cross-File Interactions

1. **C44-L01 fix status:** `SavingsComparison.svelte:55` now has `if (target === 0 && displayedSavings === 0) return;`. Smooth animation confirmed. Fixed.

2. **C44-L02/D-107 fix status:** `packages/parser/src/csv/index.ts:56-65` still uses `catch { continue; }`. Still deferred.

3. **C44-L03/D-106 fix status:** `apps/web/src/lib/parser/pdf.ts:284` still uses `catch {}`. Still deferred.

4. **C44-L04/D-110 fix status:** Non-latest month edits have no visible optimization effect. Still deferred.

5. **parseAmount consistency across ALL parsers (complete inventory):**
   - Server-side CSV bank adapters (10 files): return `NaN`, guarded by `if (isNaN(amount))` -- FIXED in C41-01
   - Server-side CSV generic (`generic.ts`): returns `null`, guarded by `amount === null`
   - Server-side PDF (`pdf/index.ts:102-108`): returns `0`, filtered by `amount <= 0`
   - Web-side CSV (`csv.ts:114-121`): returns `NaN`, guarded by `isValidAmount()`
   - Web-side CSV generic (`csv.ts:244-248`): returns `NaN`, guarded by `Number.isNaN(amount)`
   - Web-side PDF (`pdf.ts:207-213`): returns `0`, filtered by `amount <= 0`
   - Web-side XLSX (`xlsx.ts:124-141`): returns `null`, guarded by `amount === null`
   - All parsers correctly guard against NaN/null propagation. **No issues.**

6. **Installment handling consistency re-verified:** All parsing locations use `inst > 1` for installment filtering. No regressions.

7. **Date validation consistency re-verified:** All `parseDateToISO` implementations have month/day range validation. No regressions.

8. **Global cap rollback logic verified:** The `ruleMonthUsed` rollback at `reward.ts:316-317` is correct. The over-count is correctly subtracted from `ruleResult.newMonthUsed`.

9. **SessionStorage validation re-verified:** `isValidTx` has both `Number.isFinite(tx.amount)` and `tx.amount > 0` checks. Web-side is protected against NaN even if parser leaks it.

10. **Server-side vs web-side PDF date format handling:** Consistent since C39-01 fix. Both handle full dates, short-year dates, Korean dates, and short MM/DD dates with month/day range validation. No regressions.

11. **`cachedCoreRules` module-level cache:** Still present in `analyzer.ts:47`. Intentionally never invalidated since `cards.json` static data never changes within a session. Not a bug.

12. **AI categorizer disabled:** `categorizer-ai.ts` correctly stubs all methods to throw. `TransactionReview.svelte` checks `aiAvailable` before showing the AI button. No dead-code path issues.

13. **E2E test isolation:** `bunfig.toml` correctly excludes `e2e/**` from `bun test`. Confirmed working (266 pass, 0 fail).

14. **Report HTML generator** (`packages/viz/src/report/generator.ts`): Uses `esc()` for HTML escaping. The savings sign prefix correctly prepends "+" for non-negative savings. `formatWon` and `formatRate` have NaN guards. No other issues found.

15. **LLM fallback security:** The `ANTHROPIC_API_KEY` is read from `process.env` and only used server-side. The browser guard (`typeof window !== 'undefined'`) prevents client-side execution. The 30-second timeout and text truncation (8000 chars) are reasonable safeguards. The JSON extraction with greedy match and progressive fallback is robust.

16. **SavingsComparison.svelte count-up animation:** The `$effect` correctly returns a cleanup function that cancels the animation frame. No memory leak. The `target === 0 && displayedSavings === 0` guard prevents the jump (C44-L01 fix).

17. **FileDropzone previousMonthSpending parsing:** Line 206 uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard. Correctly handles the `parseInt("1e5", 10)` issue from D-28.

18. **CategoryBreakdown colors:** Still uses hardcoded `CATEGORY_COLORS` map (D-42/D-46/D-64/D-78). Missing categories fall through to `uncategorized` gray. No new categories added since last review. Not a new issue.

19. **`reoptimize` flow:** The store correctly filters to the latest month for reoptimization (store.svelte.ts:348-351), matching the initial `analyzeMultipleFiles` behavior. The `previousMonthSpending` is recomputed from edited transactions (store.svelte.ts:373-384). No stale data risk.

20. **Web-side PDF `tryStructuredParse` catches all exceptions:** `apps/web/src/lib/parser/pdf.ts:284` uses `catch {}` which swallows all errors including programming errors. The server-side equivalent at `packages/parser/src/pdf/index.ts:181-186` only catches `SyntaxError | TypeError | RangeError` and re-throws everything else. This inconsistency could mask bugs on the web side. LOW severity -- same as C44-L03/C42-L01/D-106.

21. **Server-side `detect.ts` reads file twice for CSV detection:** `detectFormat` at line 158-201 calls `readFile(filePath)` twice (once for magic bytes, once for content). For large files, this is wasteful. However, CSV files are typically small. LOW severity -- same as C41 sweep item 18.

22. **Server-side CSV `parseCSV` silent adapter failure swallowing:** `csv/index.ts:56-65` silently swallows errors from bank-specific adapters during the content-signature detection loop (`catch { continue; }`). If all adapters fail, the user gets no feedback about why bank-specific parsing failed. LOW severity -- same as C44-L02/C42-L02/D-107.

23. **`buildCategoryKey` is now re-exported from `@cherrypicker/core` index:** `packages/core/src/index.ts:18` now exports `buildCategoryKey` from the calculator module. D-102 is resolved.

24. **Web-side `parseFile` encoding fallback:** The multi-encoding loop at `apps/web/src/lib/parser/index.ts:20-35` tries utf-8, euc-kr, and cp949, selecting the encoding with the fewest replacement characters. This is robust for Korean card statements. The `catch { continue; }` at line 34 silently skips unsupported encodings (which is correct since `TextDecoder` may throw for unsupported labels).

25. **EUC-KR ratio-based detection (server-side):** `packages/parser/src/index.ts:41` uses `ratio > 1` (replacement characters per KB) to decide whether to fall back to EUC-KR. This threshold is reasonable for Korean card statements.

26. **`greedyOptimize` transaction filter uses `tx.amount > 0`:** At `greedy.ts:266`, transactions are filtered by `tx.amount > 0`. Since NaN > 0 is false, NaN amounts would be filtered out here even if they leaked past the parser. Defense in depth is working correctly.

27. **`scoreCardsForTransaction` double computation (D-09/D-51/D-86):** Still present. `calculateCardOutput` is called twice per card per transaction (before and after adding the new transaction). For typical use cases this is acceptable. No regression.

28. **TransactionReview.svelte `editedTxs` mutation through `changeCategory`:** The `changeCategory` function (line 182-199) directly mutates `editedTxs` array entries via `tx.category = ...` and `tx.subcategory = ...`. Since `editedTxs` is a `$state` array and the entries are plain objects, Svelte 5's reactivity system tracks these mutations correctly. No reactivity bug.

29. **`loadCategories` fetch deduplication:** Both `analyzer.ts` and `store.svelte.ts` call `loadCategories()`, which uses a module-level `categoriesPromise` cache. The cache ensures only one fetch occurs per session. No race condition risk.

30. **`formatWon` and `formatRate` NaN guards:** Both functions have `Number.isFinite` checks that return safe defaults ('0원', '0.0%'). No NaN propagation to the UI.

---

## Summary of Active Findings (New in Cycle 45)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C45-L01 | LOW | Medium | `apps/web/src/lib/formatters.ts:5-8` | `formatWon(-0)` produces `"-0원"` instead of `"0원"` for negative zero | NEW -- cosmetic edge case |
| C45-L02 | LOW | Medium | `apps/web/src/components/dashboard/SpendingSummary.svelte:118` | "전월실적" label may show non-consecutive month's spending | NEW -- UX clarity |
| C45-L03 | LOW | High | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:56-60` | getCategoryColor falls through to gray for missing categories (same as D-42/D-64/D-78) | CARRY-OVER from D-42 |
| C45-L04 | LOW | Medium | `apps/web/src/components/dashboard/OptimalCardMap.svelte:19` | `maxRate` uses `0.001` minimum which inflates bars when all rates are < 0.1% | NEW -- edge case |
