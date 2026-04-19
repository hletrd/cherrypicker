# Comprehensive Code Review -- Cycle 43

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 43)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-42 reviews. Verified that all prior cycle 42 findings (C42-L01, C42-L02) are still tracked in the deferred items list. Ran `bun test` (266 pass, 0 fail). Focused on finding genuinely NEW issues not previously reported, with particular attention to:

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

## Verification of Cycle 42 Findings

| Finding | Status | Evidence |
|---|---|---|
| C42-L01 | **STILL DEFERRED** | `apps/web/src/lib/parser/pdf.ts:284` still uses bare `catch {}` in `tryStructuredParse`. Server-side `packages/parser/src/pdf/index.ts:181-186` still catches only `SyntaxError \| TypeError \| RangeError`. No change since last cycle. |
| C42-L02 | **STILL DEFERRED** | `packages/parser/src/csv/index.ts:56-65` content-signature detection loop still uses `catch { continue; }` silently. No change since last cycle. |

---

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `apps/web/src/lib/store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |
| D-28 | **STILL FIXED** | `apps/web/src/components/upload/FileDropzone.svelte:206` uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard |

---

## New Findings

No genuinely new HIGH or MEDIUM severity findings. The codebase remains in excellent shape after 42 prior fix cycles. All previously identified HIGH/MEDIUM issues have been addressed and remain fixed.

The following LOW-severity observations are carry-overs from prior cycle sweeps (not new findings), documented here for completeness:

### C43-L01: `calculateRewards` double-applies `applyMonthlyCap` when both `rate` and `fixedAmount` are present

- **Severity:** LOW (edge case)
- **Confidence:** Medium
- **File:** `packages/core/src/calculator/reward.ts:259-273`
- **Description:** When a rule has both `normalizedRate > 0` AND `hasFixedReward`, the code logs a warning and uses rate-based reward only (line 259-273). The `rawReward` from `calcFn` is then passed to `applyMonthlyCap`. This is correct for the rate-based path. However, the warning message says "using rate-based reward only" but the `perTxCap` is also applied via `Math.min(tx.amount, perTxCap)`. If the `perTxCap` was intended to cap the fixed-amount reward (e.g., a per-day fixed reward), using it on the rate-based reward instead could produce a different (and possibly lower) reward. In practice, none of the 81 YAML files have both `rate` and `fixedAmount` on the same tier, so this is a theoretical concern.
- **Failure scenario:** A future YAML file with both rate and fixedAmount where the perTxCap was calibrated for the fixed-amount reward (e.g., per-day cap of 1000 Won) would incorrectly cap the percentage-based reward, potentially producing a much lower result than intended.
- **Fix:** When both are present, either: (a) add both rewards before applying perTxCap, or (b) make the YAML schema enforce mutual exclusivity at the Zod level, preventing this combination entirely.
- **Note:** This is a refinement of the existing warning at line 265-269, which already flags the issue. Not a new finding per se, but a specific edge case within the existing warning.

### C43-L02: `formatWon` in `packages/viz/src/report/generator.ts` does not handle NaN/Infinity

- **Severity:** LOW (defensive coding)
- **Confidence:** High
- **File:** `packages/viz/src/report/generator.ts:9-11`
- **Description:** The server-side `formatWon` at `generator.ts:9-11` uses `amount.toLocaleString('ko-KR') + '원'` without a `Number.isFinite` guard. The web-side `formatWon` at `apps/web/src/lib/formatters.ts:5-8` has `if (!Number.isFinite(amount)) return '0원'`. If NaN or Infinity were to leak into the report generator (unlikely given upstream guards), it would produce "NaN원" or "Infinity원" in the HTML report.
- **Failure scenario:** A programming error upstream that produces a NaN reward value would render "NaN원" in the generated HTML report, which would look broken to the user.
- **Fix:** Add `if (!Number.isFinite(amount)) return '0원'` to the report generator's `formatWon`, matching the web-side implementation.

### C43-L03: `formatRate` in `packages/viz/src/report/generator.ts` does not handle NaN/Infinity

- **Severity:** LOW (defensive coding)
- **Confidence:** High
- **File:** `packages/viz/src/report/generator.ts:13-15`
- **Description:** Same class as C43-L02. The server-side `formatRate` uses `(rate * 100).toFixed(2) + '%'` without a `Number.isFinite` guard. The web-side `formatRate` at `apps/web/src/lib/formatters.ts:14-17` has `if (!Number.isFinite(rate)) return '0.0%'`. NaN would produce "NaN%" in the HTML report.
- **Fix:** Add `if (!Number.isFinite(rate)) return '0.00%'` to the report generator's `formatRate`, matching the web-side implementation.

### C43-L04: Web-side CSV `parseCSV` function swallows encoding errors silently

- **Severity:** LOW (diagnostics)
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/index.ts:34`
- **Description:** The web-side `parseFile` tries multiple encodings (utf-8, euc-kr, cp949) in a loop with `catch { continue; }`. If all decodings fail, `bestContent` stays empty and the fallback at line 37 uses `new TextDecoder('utf-8').decode(buffer)` which may produce garbled text. The user gets no feedback that encoding detection failed. The server-side `parseStatement` at `packages/parser/src/index.ts:35-49` has a similar issue but at least checks for replacement characters.
- **Failure scenario:** A corrupted file that doesn't decode properly in any encoding would produce garbled transaction data without any error message.
- **Fix:** If `bestReplacements` is still very high after all encoding attempts, push a warning error to the ParseResult.

---

## Final Sweep -- Cross-File Interactions

1. **C42-L01/C42-L01 fix status:** Web-side PDF `tryStructuredParse` bare `catch {}` still present at `apps/web/src/lib/parser/pdf.ts:284`. Server-side correctly narrows at `packages/parser/src/pdf/index.ts:181-186`. No regression.

2. **C42-L02 fix status:** Server-side CSV `parseCSV` silent error swallowing still present at `packages/parser/src/csv/index.ts:56-65`. No regression.

3. **parseAmount consistency across ALL parsers (complete inventory):**
   - Server-side CSV bank adapters (10 files): return `NaN`, guarded by `if (isNaN(amount))` -- FIXED in C41-01
   - Server-side CSV generic (`generic.ts`): returns `null`, guarded by `amount === null`
   - Server-side PDF (`pdf/index.ts:102-108`): returns `0`, filtered by `amount <= 0`
   - Web-side CSV (`csv.ts:114-121`): returns `NaN`, guarded by `isValidAmount()`
   - Web-side CSV generic (`csv.ts:244-248`): returns `NaN`, guarded by `Number.isNaN(amount)`
   - Web-side PDF (`pdf.ts:207-213`): returns `0`, filtered by `amount <= 0`
   - Web-side XLSX (`xlsx.ts:124-141`): returns `null`, guarded by `amount === null`
   - All parsers correctly guard against NaN/null propagation. **No issues.**

4. **Installment handling consistency re-verified:** All parsing locations use `inst > 1` for installment filtering. No regressions.

5. **Date validation consistency re-verified:** All `parseDateToISO` implementations have month/day range validation. No regressions.

6. **Global cap rollback logic verified:** The `ruleMonthUsed` rollback at `reward.ts:316-317` is correct. The over-count is correctly subtracted from `ruleResult.newMonthUsed`.

7. **SessionStorage validation re-verified:** `isValidTx` has both `Number.isFinite(tx.amount)` and `tx.amount > 0` checks. Web-side is protected against NaN even if parser leaks it.

8. **Server-side vs web-side PDF date format handling:** Consistent since C39-01 fix. Both handle full dates, short-year dates, Korean dates, and short MM/DD dates with month/day range validation. No regressions.

9. **`cachedCoreRules` module-level cache:** Still present in `analyzer.ts:47`. Intentionally never invalidated since `cards.json` static data never changes within a session. Not a bug.

10. **AI categorizer disabled:** `categorizer-ai.ts` correctly stubs all methods to throw. `TransactionReview.svelte` checks `aiAvailable` before showing the AI button. No dead-code path issues.

11. **E2E test isolation:** `bunfig.toml` correctly excludes `e2e/**` from `bun test`. Confirmed working (266 pass, 0 fail).

12. **Report HTML generator** (`packages/viz/src/report/generator.ts`): Uses `esc()` for HTML escaping. The savings sign prefix correctly prepends "+" for non-negative savings. `formatWon` and `formatRate` lack NaN guards (C43-L02, C43-L03). No other issues found.

13. **LLM fallback security:** The `ANTHROPIC_API_KEY` is read from `process.env` and only used server-side. The browser guard (`typeof window !== 'undefined'`) prevents client-side execution. The 30-second timeout and text truncation (8000 chars) are reasonable safeguards. The JSON extraction with greedy match and progressive fallback is robust.

14. **SavingsComparison.svelte count-up animation:** The `$effect` correctly returns a cleanup function that cancels the animation frame. No memory leak.

15. **FileDropzone previousMonthSpending parsing:** Line 206 uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard. Correctly handles the `parseInt("1e5", 10)` issue from D-28.

16. **CategoryBreakdown colors:** Still uses hardcoded `CATEGORY_COLORS` map (D-42/D-46/D-64/D-78). Missing categories fall through to `uncategorized` gray. No new categories added since last review. Not a new issue.

17. **`reoptimize` flow:** The store correctly filters to the latest month for reoptimization (store.svelte.ts:348-351), matching the initial `analyzeMultipleFiles` behavior. The `previousMonthSpending` is recomputed from edited transactions (store.svelte.ts:373-384). No stale data risk.

18. **Web-side PDF `tryStructuredParse` catches all exceptions:** `apps/web/src/lib/parser/pdf.ts:284` uses `catch {}` which swallows all errors including programming errors. The server-side equivalent at `packages/parser/src/pdf/index.ts:181-186` only catches `SyntaxError | TypeError | RangeError` and re-throws everything else. This inconsistency could mask bugs on the web side. LOW severity -- same as C42-L01/C41 sweep item 17.

19. **Server-side `detect.ts` reads file twice for CSV detection:** `detectFormat` at line 158-201 calls `readFile(filePath)` twice (once for magic bytes, once for content). For large files, this is wasteful. However, CSV files are typically small. LOW severity -- same as C41 sweep item 18.

20. **Server-side CSV `parseCSV` silent adapter failure swallowing:** `csv/index.ts:56-65` silently swallows errors from bank-specific adapters during the content-signature detection loop (`catch { continue; }`). If all adapters fail, the user gets no feedback about why bank-specific parsing failed. LOW severity -- same as C42-L02/C41 sweep item 19.

21. **`buildCategoryKey` is now re-exported from `@cherrypicker/core` index:** `packages/core/src/index.ts:18` now exports `buildCategoryKey` from the calculator module. D-102 is resolved.

22. **Web-side `parseFile` encoding fallback:** The multi-encoding loop at `apps/web/src/lib/parser/index.ts:20-35` tries utf-8, euc-kr, and cp949, selecting the encoding with the fewest replacement characters. This is robust for Korean card statements. The `catch { continue; }` at line 34 silently skips unsupported encodings (which is correct since `TextDecoder` may throw for unsupported labels).

23. **EUC-KR ratio-based detection (server-side):** `packages/parser/src/index.ts:41` uses `ratio > 1` (replacement characters per KB) to decide whether to fall back to EUC-KR. This threshold was introduced in the commit `fix: EUC-KR ratio-based detection, ILP fallback warning, storage validation`. The threshold of 1 replacement char per KB is reasonable for Korean card statements.

24. **`greedyOptimize` transaction filter uses `tx.amount > 0`:** At `greedy.ts:266`, transactions are filtered by `tx.amount > 0`. Since NaN > 0 is false, NaN amounts would be filtered out here even if they leaked past the parser. Defense in depth is working correctly.

25. **`scoreCardsForTransaction` double computation (D-09/D-51/D-86):** Still present. `calculateCardOutput` is called twice per card per transaction (before and after adding the new transaction). For typical use cases this is acceptable. No regression.

---

## Summary of Active Findings (New in Cycle 43)

No new HIGH or MEDIUM severity findings. The four LOW-severity observations are either carry-overs from prior cycle sweeps or new observations about existing defensive coding patterns.

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C43-L01 | LOW | Medium | `packages/core/src/calculator/reward.ts:259-273` | When both rate and fixedAmount are present, perTxCap is applied to rate-based reward but may have been calibrated for fixed-amount reward -- no current YAML files trigger this | DEFERRED (theoretical edge case) |
| C43-L02 | LOW | High | `packages/viz/src/report/generator.ts:9-11` | Server-side `formatWon` lacks `Number.isFinite` guard matching web-side implementation | NEW -- trivial fix |
| C43-L03 | LOW | High | `packages/viz/src/report/generator.ts:13-15` | Server-side `formatRate` lacks `Number.isFinite` guard matching web-side implementation | NEW -- trivial fix |
| C43-L04 | LOW | High | `apps/web/src/lib/parser/index.ts:34` | Web-side encoding detection silently swallows errors with `catch { continue; }` | DEFERRED (same class as C42-L02) |
