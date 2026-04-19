# Comprehensive Code Review -- Cycle 47

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 47)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-46 reviews. Verified that all prior cycle 46 findings (C46-L01, C46-L02) are now fixed. Ran `bun test` (266 pass, 0 fail). Focused on finding genuinely NEW issues not previously reported, with particular attention to:

1. Terminal `formatWon`/`formatRate` consistency with web-side and report-generator versions
2. Reward calculation edge cases (global cap rollback, perTxCap + fixedAmount)
3. Cross-file consistency between server-side and web-side parsers
4. SessionStorage validation and state management
5. Optimizer correctness (greedy marginal scoring, cap interactions)
6. LLM fallback security and error handling
7. CategoryBreakdown color handling
8. EUC-KR encoding detection robustness
9. Edge cases in `formatWon` / `formatRate` with NaN/Infinity/negative-zero inputs
10. Store `reoptimize` state consistency with `editedTxs`

---

## Verification of Cycle 46 Findings

| Finding | Status | Evidence |
|---|---|---|
| C46-L01 | **FIXED** | `packages/viz/src/report/generator.ts:12` now has `if (amount === 0) amount = 0;` negative-zero normalization. Commit `590de85`. |
| C46-L02 | **FIXED** | `packages/parser/src/csv/index.ts:62` now has `console.warn` in the content-signature detection loop. Commit `8d9d1dd`. |

---

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |
| D-28 | **STILL FIXED** | `FileDropzone.svelte:206` uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard |
| D-102 | **STILL FIXED** | `packages/core/src/index.ts:18` exports `buildCategoryKey` |
| D-106 | **STILL DEFERRED** | `apps/web/src/lib/parser/pdf.ts:284` still uses bare `catch {}` |
| D-107 | **STILL DEFERRED** (partially addressed by C46-L02) | `packages/parser/src/csv/index.ts:60-63` now logs warnings for adapter failures (C46-L02 fix), but the original `catch` block still does `continue` without collecting errors for the ParseResult. |
| D-110 | **STILL DEFERRED** | Non-latest month edits have no visible optimization effect |

---

## New Findings

### C47-L01: Terminal `formatWon` lacks `Number.isFinite` guard and negative-zero normalization

- **Severity:** LOW (cosmetic/defensive)
- **Confidence:** High
- **File:** `packages/viz/src/terminal/summary.ts:5-7` and `packages/viz/src/terminal/comparison.ts:4-6`
- **Description:** The terminal `formatWon` functions use `amount.toLocaleString('ko-KR')` without a `Number.isFinite` check. If NaN or Infinity reaches these functions, they would render "NaN원" or "Infinity원" in the terminal table output. Additionally, they do not normalize negative zero (`-0`), which would render "-0원". The web-side `formatWon` (fixed in C45-L01) and the report generator `formatWon` (fixed in C46-L01) both have these guards. The terminal versions are the only remaining `formatWon` implementations without them.

  The terminal `formatRate` functions (`(rate * 100).toFixed(2)`) also lack `Number.isFinite` guards. While `toFixed()` handles NaN/Infinity by producing "NaN"/"Infinity" (no crash), the output would be confusing ("NaN%").
- **Failure scenario:** A terminal user sees "NaN원" or "-0원" in the CLI spending summary or optimization comparison table.
- **Fix:** Add `Number.isFinite` guards and negative-zero normalization to both terminal `formatWon` and `formatRate` functions, matching the web-side and report-generator implementations.

### C47-L02: Terminal `formatRate` does not guard against NaN/Infinity

- **Severity:** LOW (cosmetic)
- **Confidence:** High
- **File:** `packages/viz/src/terminal/summary.ts:9-11` and `packages/viz/src/terminal/comparison.ts:8-10`
- **Description:** Same class as C47-L01 but specifically for `formatRate`. The terminal `formatRate` uses `(rate * 100).toFixed(2)` without a `Number.isFinite` check. While `Number.prototype.toFixed()` converts NaN to "NaN" and Infinity to "Infinity" without throwing, the rendered output "NaN%" or "Infinity%" would be confusing. The web-side `formatRate` and report-generator `formatRate` both have `Number.isFinite` guards.
- **Failure scenario:** A terminal user sees "NaN%" in the CLI optimization comparison table.
- **Fix:** Add `if (!Number.isFinite(rate)) return '0.00%';` at the start of both terminal `formatRate` functions.

---

## Final Sweep -- Cross-File Interactions

1. **C46-L01 fix verified:** `packages/viz/src/report/generator.ts:12` normalizes negative zero. The savings sign prefix at line 40 uses `>= 0` which is correct.

2. **C46-L02 fix verified:** `packages/parser/src/csv/index.ts:62` logs `console.warn` for adapter failures during content-signature detection. The bank-specific adapter failure at line 44-49 already records the error in `fallbackResult.errors`.

3. **All `formatWon` implementations inventory (complete):**
   - `apps/web/src/lib/formatters.ts:5-9` -- Has `Number.isFinite` guard + negative-zero normalization -- OK
   - `packages/viz/src/report/generator.ts:9-14` -- Has `Number.isFinite` guard + negative-zero normalization -- OK
   - `packages/viz/src/terminal/summary.ts:5-7` -- **NO** `Number.isFinite` guard, **NO** negative-zero normalization -- NEW C47-L01
   - `packages/viz/src/terminal/comparison.ts:4-6` -- **NO** `Number.isFinite` guard, **NO** negative-zero normalization -- NEW C47-L01

4. **All `formatRate` implementations inventory (complete):**
   - `apps/web/src/lib/formatters.ts:16-19` (`formatRate`) -- Has `Number.isFinite` guard -- OK
   - `apps/web/src/lib/formatters.ts:34-37` (`formatRatePrecise`) -- Has `Number.isFinite` guard -- OK
   - `packages/viz/src/report/generator.ts:16-19` -- Has `Number.isFinite` guard -- OK
   - `packages/viz/src/terminal/summary.ts:9-11` -- **NO** `Number.isFinite` guard -- NEW C47-L02
   - `packages/viz/src/terminal/comparison.ts:8-10` -- **NO** `Number.isFinite` guard -- NEW C47-L02

5. **parseAmount consistency across ALL parsers (complete inventory):** All parsers correctly guard against NaN/null propagation. No regressions since cycle 46.

6. **Global cap rollback logic verified:** The `ruleMonthUsed` rollback at `reward.ts:316-317` is correct. The over-count is correctly subtracted from `ruleResult.newMonthUsed`.

7. **SessionStorage validation re-verified:** `isValidTx` has both `Number.isFinite(tx.amount)` and `tx.amount > 0` checks. Web-side is protected against NaN even if parser leaks it.

8. **Server-side vs web-side PDF date format handling:** Consistent since C39-01 fix. Both handle full dates, short-year dates, Korean dates, and short MM/DD dates with month/day range validation. No regressions.

9. **`cachedCoreRules` module-level cache:** Still present in `analyzer.ts:47`. Intentionally never invalidated since `cards.json` static data never changes within a session. Not a bug.

10. **AI categorizer disabled:** `categorizer-ai.ts` correctly stubs all methods to throw. `TransactionReview.svelte` checks `aiAvailable` before showing the AI button. No dead-code path issues.

11. **E2E test isolation:** `bunfig.toml` correctly excludes `e2e/**` from `bun test`. Confirmed working (266 pass, 0 fail).

12. **Report HTML generator** (`packages/viz/src/report/generator.ts`): Uses `esc()` for HTML escaping. The savings sign prefix correctly prepends "+" for non-negative savings. `formatWon` and `formatRate` have NaN guards and negative-zero normalization. No issues.

13. **LLM fallback security:** The `ANTHROPIC_API_KEY` is read from `process.env` and only used server-side. The browser guard (`typeof window !== 'undefined'`) prevents client-side execution. The 30-second timeout and text truncation (8000 chars) are reasonable safeguards. The JSON extraction with greedy match and progressive fallback is robust.

14. **SavingsComparison.svelte count-up animation:** The `$effect` correctly returns a cleanup function that cancels the animation frame. No memory leak. The `target === 0 && displayedSavings === 0` guard prevents the jump (C44-L01 fix). The `Object.is(displayedSavings, -0)` guard prevents double-prefix (C45-L01 fix).

15. **FileDropzone previousMonthSpending parsing:** Line 206 uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard. Correctly handles the `parseInt("1e5", 10)` issue from D-28.

16. **CategoryBreakdown colors:** Still uses hardcoded `CATEGORY_COLORS` map (D-42/D-46/D-64/D-78). Missing categories fall through to `uncategorized` gray. Not a new issue.

17. **`reoptimize` flow:** The store correctly filters to the latest month for reoptimization (store.svelte.ts:348-351), matching the initial `analyzeMultipleFiles` behavior. The `previousMonthSpending` is recomputed from edited transactions (store.svelte.ts:373-384). No stale data risk.

18. **`loadCategories` fetch deduplication:** Both `analyzer.ts` and `store.svelte.ts` call `loadCategories()`, which uses a module-level `categoriesPromise` cache. The cache ensures only one fetch occurs per session. No race condition risk.

19. **Web-side PDF `tryStructuredParse` catches all exceptions:** `apps/web/src/lib/parser/pdf.ts:284` uses `catch {}` which swallows all errors including programming errors. The server-side equivalent at `packages/parser/src/pdf/index.ts:181-186` only catches `SyntaxError | TypeError | RangeError` and re-throws everything else. This inconsistency could mask bugs on the web side. LOW severity -- same as D-106.

20. **`calculatePercentageReward` primitive:** Uses `Math.floor(amount * rate)` for all reward types. This is correct for Korean Won (integer currency). The monthly cap logic is consistent across discount/points/cashback/mileage. No issues.

---

## Summary of Active Findings (New in Cycle 47)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C47-L01 | LOW | High | `packages/viz/src/terminal/summary.ts:5-7`, `comparison.ts:4-6` | Terminal `formatWon` lacks `Number.isFinite` guard and negative-zero normalization | NEW -- consistency gap with web/report versions |
| C47-L02 | LOW | High | `packages/viz/src/terminal/summary.ts:9-11`, `comparison.ts:8-10` | Terminal `formatRate` lacks `Number.isFinite` guard | NEW -- consistency gap with web/report versions |
