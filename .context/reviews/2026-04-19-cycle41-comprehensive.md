# Comprehensive Code Review -- Cycle 41

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 41)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-40 reviews. Verified that all prior cycle 40 findings (C40-01) are already fixed in the current codebase. Ran `bun test` (266 pass, 0 fail). Focused on finding genuinely NEW issues not previously reported, with particular attention to:

1. Server-side CSV bank adapter `parseAmount` NaN propagation
2. Server-side vs web-side parser consistency (CSV, XLSX, PDF)
3. Reward calculation edge cases and global cap rollback logic
4. SessionStorage validation and state management
5. Optimizer correctness (greedy vs ILP fallback)
6. Cross-file regex/constant consistency

---

## Verification of Cycle 40 Findings

| Finding | Status | Evidence |
|---|---|---|
| C40-01 | **FIXED** | `packages/parser/src/pdf/index.ts:158` now reads `if (amount <= 0) continue;` instead of the dead `Number.isNaN(amount)` check. Matches the web-side `amount <= 0` filter at `apps/web/src/lib/parser/pdf.ts:262`. |

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `apps/web/src/lib/store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |

---

## New Findings

### C41-01: Server-side CSV bank adapters propagate NaN amounts -- no NaN guard before transactions.push

- **Severity:** HIGH (correctness -- NaN amounts corrupt downstream reward calculations)
- **Confidence:** High
- **File:** All 10 server-side CSV bank adapters:
  - `packages/parser/src/csv/hyundai.ts:24-30` (parseAmount) + line 101 (amount: parseAmount) + line 110 (transactions.push)
  - `packages/parser/src/csv/samsung.ts:24-30` + line 103 + line 112
  - `packages/parser/src/csv/shinhan.ts:24-30` + line 100 + line 109
  - `packages/parser/src/csv/kb.ts:24-30` + line 100 + line 109
  - `packages/parser/src/csv/lotte.ts:24-30` + line 100 + line 109
  - `packages/parser/src/csv/hana.ts:24-30` + line 100 + line 109
  - `packages/parser/src/csv/woori.ts:24-30` + line 100 + line 109
  - `packages/parser/src/csv/nh.ts:24-30` + line 100 + line 109
  - `packages/parser/src/csv/ibk.ts:24-30` + line 100 + line 109
  - `packages/parser/src/csv/bc.ts:24-30` + line 100 + line 109
- **Also affects:** `packages/parser/src/csv/generic.ts:119-127` (correct reference -- returns `null` and skips)
- **Description:** All 10 server-side CSV bank adapters define a local `parseAmount` function that returns `NaN` for unparseable values:

  ```typescript
  function parseAmount(raw: string): number {
    let cleaned = raw.trim().replace(/원$/, '').replace(/,/g, '');
    const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
    if (isNeg) cleaned = cleaned.slice(1, -1);
    const n = parseInt(cleaned, 10);
    if (isNaN(n)) return NaN;  // ← returns NaN
    return isNeg ? -n : n;
  }
  ```

  However, none of these adapters check whether `parseAmount` returned NaN before pushing the transaction. Each adapter does:

  ```typescript
  const tx: RawTransaction = {
    date: parseDateToISO(dateRaw),
    merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
    amount: parseAmount(amountRaw),  // ← could be NaN
  };
  // ... no NaN check ...
  transactions.push(tx);  // ← NaN amount propagated
  ```

  **Contrast with other parsers:**
  - `packages/parser/src/csv/generic.ts:119-127` correctly returns `null` and checks `amount === null` before pushing (line 232-237).
  - `apps/web/src/lib/parser/csv.ts:114-121` returns `NaN` but checks with `isValidAmount()` (line 127-135) which pushes an error and returns false for NaN.
  - `apps/web/src/lib/parser/xlsx.ts:282-298` returns `null` and checks `amount === null` before pushing.

  **Downstream impact:** The `CategorizedTransaction` type has `amount: number`. The greedy optimizer at `greedy.ts:266` filters out `tx.amount <= 0`, but `NaN <= 0` evaluates to `false` in JavaScript, so NaN-amount transactions **pass through** the filter. They then propagate into `calculateRewards` where `Math.floor(NaN * rate)` = NaN, `Math.min(NaN, remaining)` = NaN, and so on. The NaN cascades through the entire reward calculation chain, corrupting `totalReward`, `effectiveRate`, and all downstream display values.

  **Note on `Number.isFinite` guard:** The web-side `isValidTx` at `store.svelte.ts:147-148` has `Number.isFinite(tx.amount)` which would catch NaN on the web path. But the CLI/server path (tools/cli) has no such guard -- it reads from the parser output directly.

- **Failure scenario:** A Hyundai Card CSV file with a corrupted amount cell (e.g., "N/A" or empty string after trimming). The `parseAmount` function returns NaN. The hyundai adapter pushes a transaction with `amount: NaN`. The CLI pipeline processes it, and the optimizer produces NaN totalReward, NaN effectiveRate, and NaN savingsVsSingleCard. The user sees "NaN원" in the terminal output or report HTML.

- **Fix:** In each of the 10 bank adapters, add a NaN check after `parseAmount`:
  ```typescript
  const amount = parseAmount(amountRaw);
  if (isNaN(amount)) {
    if (amountRaw.trim()) {
      errors.push({ line: i + 1, message: `금액을 해석할 수 없습니다: ${amountRaw}`, raw: line });
    }
    continue;
  }
  ```
  This matches the pattern already used by the web-side CSV parser (`isValidAmount` at `apps/web/src/lib/parser/csv.ts:127-135`).

---

## Final Sweep -- Cross-File Interactions

1. **C40-01 fix verified:** Server-side PDF `tryStructuredParse` now correctly uses `if (amount <= 0) continue;` at line 158. No regressions.

2. **parseAmount consistency across all parsers:**
   - Server-side CSV bank adapters (10 files): return `NaN`, **no NaN guard** (C41-01)
   - Server-side CSV generic (`generic.ts`): returns `null`, correctly guarded
   - Server-side PDF (`pdf/index.ts:102-108`): returns `0`, correctly filtered by `amount <= 0`
   - Web-side CSV (`csv.ts:114-121`): returns `NaN`, guarded by `isValidAmount()`
   - Web-side PDF (`pdf.ts:207-213`): returns `0`, correctly filtered by `amount <= 0`
   - Web-side XLSX (`xlsx.ts:282-298`): returns `null`, correctly guarded
   - Only the 10 server-side CSV bank adapters are missing the NaN guard.

3. **Installment handling consistency re-verified:** All parsing locations use `inst > 1` for installment filtering. No regressions.

4. **Date validation consistency re-verified:** All `parseDateToISO` implementations have month/day range validation. No regressions.

5. **Global cap rollback logic verified:** The `ruleMonthUsed` rollback at `reward.ts:316-317` is correct.

6. **SessionStorage validation re-verified:** `isValidTx` has both `Number.isFinite(tx.amount)` and `tx.amount > 0` checks. Web-side is protected against NaN even if parser leaks it.

7. **Server-side vs web-side PDF date format handling:** Consistent since C39-01 fix. No regressions.

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

## Summary of Active Findings (New in Cycle 41)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C41-01 | HIGH | High | `packages/parser/src/csv/{hyundai,samsung,shinhan,kb,lotte,hana,woori,nh,ibk,bc}.ts` | Server-side CSV bank adapters return NaN from parseAmount but never check for it before pushing transactions -- NaN amounts propagate through the optimizer and corrupt reward calculations |
