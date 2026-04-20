# Comprehensive Code Review -- Cycle 40

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 40)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-39 reviews. Verified that all prior cycle 39 findings (C39-01) are already fixed in the current codebase. Ran `bun test` (266 pass, 0 fail). Focused on finding genuinely NEW issues not previously reported, with particular attention to:

1. Server-side vs web-side parser consistency (CSV, XLSX, PDF)
2. Amount filtering logic across parser implementations
3. Reward calculation edge cases and global cap rollback logic
4. SessionStorage validation and state management
5. Optimizer correctness (greedy vs ILP fallback)
6. Cross-file regex/constant consistency
7. Negative/zero amount handling in PDF structured parsing

---

## Verification of Cycle 39 Findings

| Finding | Status | Evidence |
|---|---|---|
| C39-01 | **FIXED** | `packages/parser/src/pdf/index.ts:13-17` now has `STRICT_DATE_PATTERN`, `SHORT_YEAR_DATE_PATTERN`, `KOREAN_FULL_DATE_PATTERN`, `KOREAN_SHORT_DATE_PATTERN`, `SHORT_MD_DATE_PATTERN` -- matching the web-side implementation. `table-parser.ts:3` DATE_PATTERN also updated to include Korean and short-year formats. |

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `apps/web/src/lib/store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |

---

## New Findings

### C40-01: Server-side PDF `tryStructuredParse` includes zero-amount and negative-amount transactions -- web-side correctly filters them out

- **Severity:** MEDIUM (correctness -- refund/zero transactions leak into results)
- **Confidence:** High
- **File:** `packages/parser/src/pdf/index.ts:158`
- **Also affects:** Web-side `apps/web/src/lib/parser/pdf.ts:262` (correct reference implementation)
- **Description:** The server-side PDF parser's `tryStructuredParse` function uses this filter at line 158:

  ```typescript
  if (Number.isNaN(amount) || (!merchant && amount === 0)) continue;
  ```

  This has two problems:
  1. `Number.isNaN(amount)` is dead code -- the `parseAmount` function (line 102-108) already converts NaN to 0, so `Number.isNaN(amount)` is always false.
  2. The condition `(!merchant && amount === 0)` only skips zero-amount rows that lack a merchant name. Zero-amount rows WITH a merchant are included, and negative-amount rows are always included.

  The web-side implementation at `apps/web/src/lib/parser/pdf.ts:262` correctly uses:
  ```typescript
  if (amount <= 0 || (!merchant && amount === 0)) continue;
  ```

  The `amount <= 0` check correctly filters out both zero and negative amounts.

  **Why this matters:** Korean credit card PDF statements can contain refund rows with negative amounts (e.g., "-50,000원"). The server-side `AMOUNT_PATTERN = /^-?[\d,]+원?$/` (line 18) matches negative amounts, and `parseAmount` preserves the negative sign. When a refund row passes through `tryStructuredParse`, it gets included in the transaction list.

  Downstream code (reward calculator at `reward.ts:218` and greedy optimizer at `greedy.ts:266`) filters out `amount <= 0` transactions, so the leak doesn't corrupt reward calculations. However, the inflated transaction count and visible refund rows in CLI output mislead users.

- **Failure scenario:** A Korean credit card PDF with a refund entry "-50,000원" on a transaction row. The server-side `findAmountCell` matches the cell (AMOUNT_PATTERN allows `-`), `parseAmount` returns -50000, and `tryStructuredParse` includes it because `Number.isNaN(-50000)` is false and the condition `(!merchant && -50000 === 0)` is also false. The web-side would correctly skip this row with `amount <= 0`.

- **Fix:** In `packages/parser/src/pdf/index.ts:158`, change:
  ```typescript
  if (Number.isNaN(amount) || (!merchant && amount === 0)) continue;
  ```
  to:
  ```typescript
  if (amount <= 0 || (!merchant && amount === 0)) continue;
  ```
  This matches the web-side implementation and correctly filters out all non-positive amounts.

---

## Final Sweep -- Cross-File Interactions

1. **C39-01 fix verified:** Server-side `findDateCell` now checks all date format patterns matching the web-side. `table-parser.ts` DATE_PATTERN also updated. No regressions.

2. **parseAmount consistency re-verified across all parsers:**
   - CSV (`generic.ts:119-127`): returns `null` for unparseable, callers skip null amounts
   - XLSX (`xlsx adapters`): returns `null` for unparseable, callers skip null amounts
   - Server-side PDF (`pdf/index.ts:102-108`): returns 0 for unparseable -- C40-01 identified that downstream filter is incorrect
   - Web-side PDF (`pdf.ts:207-213`): returns 0 for unparseable, correctly filtered by `amount <= 0`
   - Three of four parsers are internally consistent; server-side PDF is the outlier (C40-01).

3. **Installment handling consistency re-verified:** All parsing locations use `inst > 1` for installment filtering. No regressions.

4. **Date validation consistency re-verified:** All `parseDateToISO` implementations have month/day range validation. No regressions.

5. **Global cap rollback logic verified:** The `ruleMonthUsed` rollback at `reward.ts:316-317` is correct. The overcount computation `rewardAfterMonthlyCap - appliedReward` is always >= 0 because `appliedReward = Math.min(rewardAfterMonthlyCap, globalRemaining)`.

6. **SessionStorage validation re-verified:** `isValidTx` has both `Number.isFinite(tx.amount)` and `tx.amount > 0` checks. The `loadFromStorage` validation correctly checks the optimization object structure.

7. **Server-side vs web-side PDF `parseDateToISO` consistency:** The server-side `parseDateToISO` (lines 32-100) handles YYYYMMDD format (line 46-52), but the web-side `parseDateToISO` (pdf.ts:146-205) does not. Additionally, neither side's `findDateCell` or `filterTransactionRows` recognizes YYYYMMDD as a date cell, making the server-side YYYYMMDD handling dead code for the structured parsing path. Low severity since YYYYMMDD is very rare in Korean credit card PDFs (they use YYYY.MM.DD or Korean format). Not filing as a separate finding.

8. **`cachedCoreRules` module-level cache:** Still present in `analyzer.ts:47`. Intentionally never invalidated since `cards.json` static data never changes within a session. Not a bug.

9. **AI categorizer disabled:** `categorizer-ai.ts` correctly stubs all methods to throw. `TransactionReview.svelte` checks `aiAvailable` before showing the AI button. No dead-code path issues.

10. **E2E test isolation:** `bunfig.toml` correctly excludes `e2e/**` from `bun test`. Confirmed working (266 pass, 0 fail).

11. **Report HTML generator** (`packages/viz/src/report/generator.ts`): Uses `esc()` for HTML escaping. The savings sign prefix correctly prepends "+" for non-negative savings. No issues found.

12. **LLM fallback security:** The `ANTHROPIC_API_KEY` is read from `process.env` and only used server-side. The browser guard prevents client-side execution. The 30-second timeout and text truncation (8000 chars) are reasonable safeguards.

13. **SavingsComparison.svelte count-up animation:** The `$effect` correctly returns a cleanup function that cancels the animation frame. No memory leak.

14. **FileDropzone previousMonthSpending parsing:** Line 206 uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard. Correctly handles the `parseInt("1e5", 10)` issue from D-28.

15. **CategoryBreakdown colors:** Still uses hardcoded `CATEGORY_COLORS` map (D-42/D-46/D-64/D-78). Missing categories fall through to `uncategorized` gray. No new categories added since last review. Not a new issue.

16. **`reoptimize` flow:** The store correctly filters to the latest month for reoptimization (store.svelte.ts:348-351), matching the initial `analyzeMultipleFiles` behavior. The `previousMonthSpending` is recomputed from edited transactions (store.svelte.ts:373-384). No stale data risk.

17. **Web-side PDF `tryStructuredParse` catches all exceptions:** `apps/web/src/lib/parser/pdf.ts:284` uses `catch {}` which swallows all errors including programming errors. The server-side equivalent at `packages/parser/src/pdf/index.ts:181-186` only catches `SyntaxError | TypeError | RangeError` and re-throws everything else. This inconsistency could mask bugs on the web side, but it's a defensive choice for a best-effort parser. Low severity.

18. **Server-side detect.ts reads entire file for CSV detection:** `detectFormat` at line 158-201 calls `readFile(filePath)` twice (once for format detection from magic bytes, once for bank detection from content). For large files, this is wasteful. However, CSV files are typically small (< 5MB) and the double-read only occurs for CSV/unknown formats. Low severity.

19. **CSV parseCSV silent adapter failure swallowing:** `csv/index.ts:56-65` silently swallows errors from bank-specific adapters during the content-signature detection loop (`catch { continue; }`). If all adapters fail, the user gets no feedback about why bank-specific parsing failed -- they just get generic parser results. This could hide parsing bugs. Low severity -- the generic parser is a reasonable fallback.

---

## Summary of Active Findings (New in Cycle 40)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C40-01 | MEDIUM | High | `packages/parser/src/pdf/index.ts:158` | Server-side PDF `tryStructuredParse` includes zero/negative-amount transactions (dead `Number.isNaN` check) while web-side correctly uses `amount <= 0` filter |
