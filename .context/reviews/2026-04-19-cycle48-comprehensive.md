# Comprehensive Code Review -- Cycle 48

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 48)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-47 reviews. Verified that all prior cycle 47 findings (C47-L01, C47-L02) are now fixed. Ran `bun test` (266 pass, 0 fail). Focused on finding genuinely NEW issues not previously reported, with particular attention to:

1. Terminal `formatWon`/`formatRate` consistency with web-side and report-generator versions (C47-L01/C47-L02 fix verification)
2. Reward calculation edge cases (global cap rollback, perTxCap + fixedAmount)
3. Cross-file consistency between server-side and web-side parsers
4. SessionStorage validation and state management
5. Optimizer correctness (greedy marginal scoring, cap interactions)
6. LLM fallback security and error handling
7. CategoryBreakdown color handling
8. EUC-KR encoding detection robustness
9. `formatCount` negative-zero edge case
10. Bare `catch {}` patterns across the codebase
11. Web-side parser index.ts encoding detection `catch { continue; }` pattern
12. `parseInt` usage safety across all parsers

---

## Verification of Cycle 47 Findings

| Finding | Status | Evidence |
|---|---|---|
| C47-L01 | **FIXED** | `packages/viz/src/terminal/summary.ts:5-7` and `packages/viz/src/terminal/comparison.ts:4-6` now have `Number.isFinite` guard and negative-zero normalization (`if (amount === 0) amount = 0;`) |
| C47-L02 | **FIXED** | `packages/viz/src/terminal/summary.ts:11-13` and `packages/viz/src/terminal/comparison.ts:10-12` now have `if (!Number.isFinite(rate)) return '0.00%';` guard |

---

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |
| D-28 | **STILL FIXED** | `FileDropzone.svelte:206` uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard |
| D-102 | **STILL FIXED** | `packages/core/src/index.ts:18` exports `buildCategoryKey` |
| D-106 | **STILL DEFERRED** | `apps/web/src/lib/parser/pdf.ts:284` still uses bare `catch {}` |
| D-107 | **PARTIALLY ADDRESSED** | `packages/parser/src/csv/index.ts:60-63` now logs warnings for adapter failures (C46-L02 fix), but the `catch` block still does `continue` without collecting errors for the ParseResult |
| D-110 | **STILL DEFERRED** | Non-latest month edits have no visible optimization effect |

---

## Final Sweep -- Cross-File Interactions

1. **All `formatWon` implementations (complete inventory, fully consistent):**
   - `apps/web/src/lib/formatters.ts:5-9` -- Has `Number.isFinite` guard + negative-zero normalization
   - `packages/viz/src/report/generator.ts:9-14` -- Has `Number.isFinite` guard + negative-zero normalization
   - `packages/viz/src/terminal/summary.ts:5-7` -- Has `Number.isFinite` guard + negative-zero normalization (C47-L01 fix verified)
   - `packages/viz/src/terminal/comparison.ts:4-6` -- Has `Number.isFinite` guard + negative-zero normalization (C47-L01 fix verified)

2. **All `formatRate` implementations (complete inventory, fully consistent):**
   - `apps/web/src/lib/formatters.ts:16-19` (`formatRate`) -- Has `Number.isFinite` guard
   - `apps/web/src/lib/formatters.ts:34-37` (`formatRatePrecise`) -- Has `Number.isFinite` guard
   - `packages/viz/src/report/generator.ts:16-19` -- Has `Number.isFinite` guard
   - `packages/viz/src/terminal/summary.ts:11-13` -- Has `Number.isFinite` guard (C47-L02 fix verified)
   - `packages/viz/src/terminal/comparison.ts:10-12` -- Has `Number.isFinite` guard (C47-L02 fix verified)

3. **`formatCount` function** (`apps/web/src/lib/formatters.ts:43-46`): Has `Number.isFinite` guard but lacks negative-zero normalization. However, `formatCount` is used for transaction counts which are always non-negative integers, making `-0` rendering (`"-0"`) theoretically impossible in practice. Not flagged as a finding -- the guard is sufficient for its use case.

4. **Bare `catch {}` patterns (complete inventory):**
   - `apps/web/src/lib/parser/pdf.ts:284` -- D-106 (still deferred)
   - `apps/web/src/lib/parser/index.ts:34` -- `catch { continue; }` in encoding detection loop. This is acceptable: if a TextDecoder throws for a given encoding, skipping to the next encoding is the correct fallback. Not a bug.
   - `apps/web/src/lib/store.svelte.ts:134` -- `catch {}` in `persistToStorage` sets `_persistWarningKind = 'corrupted'`. Correct behavior.
   - `apps/web/src/lib/store.svelte.ts:210` -- `catch {}` in `loadFromStorage` fallback cleanup. Acceptable -- sessionStorage may be unavailable.
   - `apps/web/src/lib/store.svelte.ts:220` -- `catch { /* SSR */ }` in `clearStorage`. Correct SSR guard.
   - `apps/web/src/components/dashboard/SpendingSummary.svelte:128` -- `catch {}` in localStorage warning dismissal. Acceptable.

5. **Global cap rollback logic** in `reward.ts:316-317`: Verified correct. The over-count is correctly subtracted from `ruleResult.newMonthUsed`.

6. **SessionStorage validation**: `isValidTx` has both `Number.isFinite(tx.amount)` and `tx.amount > 0` checks. Correctly protects against NaN.

7. **Server-side vs web-side PDF date format handling**: Consistent. Both handle full dates, short-year dates, Korean dates, and short MM/DD dates with month/day range validation.

8. **`cachedCoreRules` module-level cache** in `analyzer.ts:47`: Intentionally never invalidated since `cards.json` static data never changes within a session. Not a bug.

9. **EUC-KR encoding detection**: `apps/web/src/lib/parser/index.ts:24-36` tries multiple encodings (utf-8, euc-kr, cp949) and picks the one with fewest replacement characters (U+FFFD). Correct ratio-based detection approach.

10. **SavingsComparison count-up animation**: `$effect` correctly returns cleanup function. `Object.is(displayedSavings, -0)` guard prevents double-prefix. No memory leak.

11. **CategoryBreakdown colors**: Still uses hardcoded `CATEGORY_COLORS` map. Missing categories fall through to `uncategorized` gray via `getCategoryColor()` fallback chain. Same as D-42/D-46/D-64/D-78 -- not a new issue.

12. **`reoptimize` flow**: Correctly filters to the latest month, recomputes `previousMonthSpending` from edited transactions, and updates `monthlyBreakdown`. No stale data risk.

13. **`loadCategories` fetch deduplication**: Both `analyzer.ts` and `store.svelte.ts` call `loadCategories()`, which uses module-level `categoriesPromise` cache. Only one fetch occurs per session. No race condition.

14. **Web-side PDF `tryStructuredParse`**: `apps/web/src/lib/parser/pdf.ts:284` uses `catch {}` which swallows all errors. This is D-106 (still deferred). The server-side equivalent at `packages/parser/src/pdf/index.ts:181-186` only catches `SyntaxError | TypeError | RangeError` and re-throws everything else. The inconsistency remains but is low severity since the web-side PDF parser has multiple fallback tiers.

15. **Reward calculation `Math.floor(amount * rate)`**: Correct for Korean Won (integer currency). The monthly cap logic is consistent across discount/points/cashback/mileage.

16. **Optimizer greedy marginal scoring**: `scoreCardsForTransaction` correctly calculates marginal reward (delta of totalReward before/after adding the transaction), which naturally handles cap interactions. No issues.

17. **AI categorizer disabled**: `categorizer-ai.ts` correctly stubs all methods to throw. `TransactionReview.svelte` checks `aiAvailable` before showing the AI button. No dead-code path issues.

18. **LLM fallback security**: `ANTHROPIC_API_KEY` read from `process.env`, browser guard prevents client-side execution, 30-second timeout, text truncation (8000 chars), JSON extraction with greedy match and progressive fallback. Server-side only (`allowRemoteLLM` flag defaults to false). Correct.

---

## New Findings

**None.** All previously identified issues are either fixed or actively deferred with documented rationale. The codebase is stable with 266 passing tests and 0 failures.

---

## Summary of Active Findings

No new findings in cycle 48. All prior cycle 47 findings (C47-L01, C47-L02) are confirmed fixed. Deferred items (D-106, D-107, D-110) remain deferred with no regressions.
