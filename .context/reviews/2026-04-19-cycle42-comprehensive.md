# Comprehensive Code Review -- Cycle 42

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 42)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-41 reviews. Verified that all prior cycle 41 finding (C41-01) is fixed in the current codebase. Ran `bun test` (266 pass, 0 fail). Focused on finding genuinely NEW issues not previously reported, with particular attention to:

1. C41-01 NaN guard implementation verification across all 10 server-side CSV bank adapters
2. Cross-file consistency between server-side and web-side parsers
3. Reward calculation edge cases and cap rollback logic
4. SessionStorage validation and state management
5. Optimizer correctness (greedy vs ILP fallback)
6. LLM fallback security and error handling
7. Web-side PDF `tryStructuredParse` exception handling inconsistency
8. CategoryBreakdown color handling and hardcoded maps

---

## Verification of Cycle 41 Findings

| Finding | Status | Evidence |
|---|---|---|
| C41-01 | **FIXED** | All 10 server-side CSV bank adapters now have `if (isNaN(amount))` guard with `continue` before `transactions.push()`. Verified in hyundai.ts:99, samsung.ts:101, shinhan.ts:98, kb.ts:98, lotte.ts:98, hana.ts:98, woori.ts:98, nh.ts:98, ibk.ts:98, bc.ts:98. Each guard also pushes a Korean-language error message when the raw amount is non-empty. |

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `apps/web/src/lib/store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |

---

## New Findings

No genuinely new HIGH or MEDIUM severity findings. The codebase is in excellent shape after 41 prior fix cycles. All previously identified HIGH/MEDIUM issues have been addressed.

The following LOW-severity observations are carry-overs from prior cycle sweeps (not new findings), documented here for completeness:

### C42-L01: Web-side PDF `tryStructuredParse` catches all exceptions with bare `catch {}`

- **Severity:** LOW (defensive coding)
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/pdf.ts:284`
- **Description:** The web-side `tryStructuredParse` uses `catch {}` which swallows all errors including programming errors (ReferenceError, etc.). The server-side equivalent at `packages/parser/src/pdf/index.ts:181-186` only catches `SyntaxError | TypeError | RangeError` and re-throws everything else. This inconsistency was noted in the C41 final sweep item 17.
- **Failure scenario:** A programming error (e.g., typo in variable name) inside the web-side `tryStructuredParse` would be silently caught, making the parser fail silently without any diagnostic output. The user would see "no transactions found" with no indication of a bug.
- **Fix:** Change `catch {}` to `catch (err) { if (!(err instanceof SyntaxError || err instanceof TypeError || err instanceof RangeError)) throw err; return null; }` to match the server-side behavior.
- **Note:** Already covered by D-17 in prior reviews. Not a new finding.

### C42-L02: Server-side `csv/index.ts` silently swallows adapter errors during content-signature detection

- **Severity:** LOW (diagnostics)
- **Confidence:** High
- **File:** `packages/parser/src/csv/index.ts:56-65`
- **Description:** The content-signature detection loop uses `catch { continue; }` which silently drops errors from bank-specific adapters. If all adapters fail, the user gets no feedback about why bank-specific parsing failed. The web-side equivalent at `apps/web/src/lib/parser/csv.ts:974-980` logs the error with `console.warn`.
- **Fix:** Add `console.warn` or error collection in the catch block to match the web-side behavior.
- **Note:** Already covered in C41 final sweep item 19. Not a new finding.

---

## Final Sweep -- Cross-File Interactions

1. **C41-01 fix verified:** All 10 server-side CSV bank adapters have NaN guards. No regressions.

2. **parseAmount consistency across ALL parsers (complete inventory):**
   - Server-side CSV bank adapters (10 files): return `NaN`, guarded by `if (isNaN(amount))` -- **FIXED**
   - Server-side CSV generic (`generic.ts`): returns `null`, guarded by `amount === null`
   - Server-side PDF (`pdf/index.ts:102-108`): returns `0`, filtered by `amount <= 0`
   - Web-side CSV (`csv.ts:114-121`): returns `NaN`, guarded by `isValidAmount()`
   - Web-side CSV generic (`csv.ts:244-248`): returns `NaN`, guarded by `Number.isNaN(amount)`
   - Web-side PDF (`pdf.ts:207-213`): returns `0`, filtered by `amount <= 0`
   - Web-side XLSX (`xlsx.ts:124-141`): returns `null`, guarded by `amount === null`
   - All parsers now correctly guard against NaN/null propagation. **No issues.**

3. **Installment handling consistency re-verified:** All parsing locations use `inst > 1` for installment filtering. No regressions.

4. **Date validation consistency re-verified:** All `parseDateToISO` implementations have month/day range validation. No regressions.

5. **Global cap rollback logic verified:** The `ruleMonthUsed` rollback at `reward.ts:316-317` is correct. The over-count is correctly subtracted from `ruleResult.newMonthUsed`.

6. **SessionStorage validation re-verified:** `isValidTx` has both `Number.isFinite(tx.amount)` and `tx.amount > 0` checks. Web-side is protected against NaN even if parser leaks it.

7. **Server-side vs web-side PDF date format handling:** Consistent since C39-01 fix. Both handle full dates, short-year dates, Korean dates, and short MM/DD dates with month/day range validation. No regressions.

8. **`cachedCoreRules` module-level cache:** Still present in `analyzer.ts:47`. Intentionally never invalidated since `cards.json` static data never changes within a session. Not a bug.

9. **AI categorizer disabled:** `categorizer-ai.ts` correctly stubs all methods to throw. `TransactionReview.svelte` checks `aiAvailable` before showing the AI button. No dead-code path issues.

10. **E2E test isolation:** `bunfig.toml` correctly excludes `e2e/**` from `bun test`. Confirmed working (266 pass, 0 fail).

11. **Report HTML generator** (`packages/viz/src/report/generator.ts`): Uses `esc()` for HTML escaping. The savings sign prefix correctly prepends "+" for non-negative savings. No issues found.

12. **LLM fallback security:** The `ANTHROPIC_API_KEY` is read from `process.env` and only used server-side. The browser guard (`typeof window !== 'undefined'`) prevents client-side execution. The 30-second timeout and text truncation (8000 chars) are reasonable safeguards. The JSON extraction with greedy match and progressive fallback is robust.

13. **SavingsComparison.svelte count-up animation:** The `$effect` correctly returns a cleanup function that cancels the animation frame. No memory leak.

14. **FileDropzone previousMonthSpending parsing:** Line 206 uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard. Correctly handles the `parseInt("1e5", 10)` issue from D-28.

15. **CategoryBreakdown colors:** Still uses hardcoded `CATEGORY_COLORS` map (D-42/D-46/D-64/D-78). Missing categories fall through to `uncategorized` gray. No new categories added since last review. Not a new issue.

16. **`reoptimize` flow:** The store correctly filters to the latest month for reoptimization (store.svelte.ts:348-351), matching the initial `analyzeMultipleFiles` behavior. The `previousMonthSpending` is recomputed from edited transactions (store.svelte.ts:373-384). No stale data risk.

17. **Web-side PDF `tryStructuredParse` catches all exceptions:** `apps/web/src/lib/parser/pdf.ts:284` uses `catch {}` which swallows all errors including programming errors. The server-side equivalent at `packages/parser/src/pdf/index.ts:181-186` only catches `SyntaxError | TypeError | RangeError` and re-throws everything else. This inconsistency could mask bugs on the web side, but it's a defensive choice for a best-effort parser. LOW severity -- same as C41 sweep item 17.

18. **Server-side `detect.ts` reads file twice for CSV detection:** `detectFormat` at line 158-201 calls `readFile(filePath)` twice (once for magic bytes, once for content). For large files, this is wasteful. However, CSV files are typically small. LOW severity -- same as C41 sweep item 18.

19. **Server-side CSV `parseCSV` silent adapter failure swallowing:** `csv/index.ts:56-65` silently swallows errors from bank-specific adapters during the content-signature detection loop (`catch { continue; }`). If all adapters fail, the user gets no feedback about why bank-specific parsing failed. LOW severity -- same as C41 sweep item 19.

20. **Web-side CSV `isValidAmount` vs generic `Number.isNaN(amount)` inconsistency:** The bank-specific adapters use `isValidAmount()` helper while the generic parser uses `Number.isNaN(amount)` directly. Both correctly guard against NaN but the inconsistency is a maintenance risk. LOW severity.

21. **`buildCategoryKey` not re-exported from `@cherrypicker/core` index:** `packages/core/src/index.ts` exports `calculateRewards` and other functions but not `buildCategoryKey`. External consumers must import from the deep path. Same as D-102.

22. **`savingsPct` computation handles zero-reward edge case correctly:** `SavingsComparison.svelte:72-91` has proper guards for `bestSingleCard.totalReward === 0` including the `Number.isFinite(raw)` check. No issues.

23. **TransactionReview.svelte AI categorizer import:** `categorizer-ai.ts` import at line 6 is still present but guarded by `aiAvailable` check. The import adds minimal bundle weight. Same as D-10/D-68/D-81.

24. **`greedyOptimize` transaction filter uses `tx.amount > 0`:** At `greedy.ts:266`, transactions are filtered by `tx.amount > 0`. Since NaN > 0 is false, NaN amounts would be filtered out here even if they leaked past the parser. This is a second line of defense. However, NaN amounts from the web-side path are already blocked by `isValidTx` in the store, and from the server-side path by the NaN guards in the CSV adapters (C41-01 fix). Defense in depth is working correctly.

---

## Summary of Active Findings (New in Cycle 42)

No new HIGH or MEDIUM severity findings. The two LOW-severity observations (C42-L01, C42-L02) are carry-overs from prior cycle sweeps and are already tracked in the deferred items list.

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C42-L01 | LOW | High | `apps/web/src/lib/parser/pdf.ts:284` | Web-side PDF tryStructuredParse catches all exceptions (bare catch {}) while server-side only catches specific types -- already tracked in deferred items | DEFERRED (same as prior sweep) |
| C42-L02 | LOW | High | `packages/parser/src/csv/index.ts:56-65` | Server-side CSV parseCSV silently swallows adapter errors during content-signature detection -- already tracked in deferred items | DEFERRED (same as prior sweep) |
