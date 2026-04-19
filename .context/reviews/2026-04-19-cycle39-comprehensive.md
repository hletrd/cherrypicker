# Comprehensive Code Review -- Cycle 39

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 39)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-38 reviews. Verified that all prior cycle 38 findings (C38-01) are already fixed in the current codebase. Ran `bun test` (266 pass, 0 fail). Focused on finding genuinely NEW issues not previously reported, with particular attention to:

1. Server-side vs web-side parser consistency (CSV, XLSX, PDF)
2. Date format handling across all parser implementations
3. Reward calculation edge cases and global cap rollback logic
4. SessionStorage validation and state management
5. Optimizer correctness (greedy vs ILP fallback)
6. Cross-file regex/constant consistency

---

## Verification of Cycle 38 Findings

| Finding | Status | Evidence |
|---|---|---|
| C38-01 | **FIXED** | `apps/web/src/components/upload/FileDropzone.svelte:409` now says "이번 달 지출액을 기준으로 자동 계산해요" instead of "50만원으로 계산해요" |

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `apps/web/src/lib/store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |

---

## New Findings

### C39-01: Server-side PDF `findDateCell` DATE_PATTERN is too narrow -- misses Korean/short-year format transaction rows

- **Severity:** MEDIUM (correctness -- silently dropping valid transactions)
- **Confidence:** High
- **File:** `packages/parser/src/pdf/index.ts:11` (DATE_PATTERN), `packages/parser/src/pdf/index.ts:104-109` (findDateCell)
- **Also affects:** `packages/parser/src/pdf/table-parser.ts:2` (DATE_PATTERN used in filterTransactionRows)
- **Description:** The server-side PDF parser uses `DATE_PATTERN = /(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})/` (line 11) to identify date cells in `findDateCell` (line 104-109) and filter transaction rows in `filterTransactionRows` (via `table-parser.ts`). This pattern only matches full `YYYY-MM-DD` / `YYYY.MM.DD` / `YYYY/MM/DD` formats.

  However, `parseDateToISO` (line 26-94) supports many more date formats:
  - Korean full: `2025년 11월 30일`
  - Korean short: `11월 30일`
  - Short year: `25-11-30`
  - Month/Day: `11/30`
  - Compact: `YYYYMMDD`

  When a PDF row contains any non-YYYY-MM-DD date format, `findDateCell` returns `null`, causing the transaction to be silently skipped at line 131 (`if (!dateCell || !amountCell) continue;`). Similarly, `filterTransactionRows` in `table-parser.ts` uses the same narrow `DATE_PATTERN`, filtering out those rows before they even reach the structured parser.

  The web-side PDF parser (`apps/web/src/lib/parser/pdf.ts:215-227`) correctly handles this by checking for all date formats using multiple compiled regexes (`STRICT_DATE_PATTERN`, `SHORT_YEAR_DATE_PATTERN`, `KOREAN_FULL_DATE_PATTERN`, `KOREAN_SHORT_DATE_PATTERN`, `SHORT_MD_DATE_PATTERN`). This inconsistency means the server-side parser may silently drop valid transactions from PDFs that use Korean or short-year date formats, while the web-side parser correctly parses them.

- **Failure scenario:** A Korean credit card PDF statement that uses Korean date format (e.g., "2025년 11월 30일") in its table cells would have all its transactions silently dropped by the server-side parser, returning an empty transactions list and falling through to the LLM fallback (if enabled) or reporting "no transactions found." The same PDF uploaded via the web interface would parse correctly. This affects CLI users and any server-side processing pipeline.

- **Fix:**
  1. In `packages/parser/src/pdf/index.ts`, update `findDateCell` to check for all date formats that `parseDateToISO` handles (matching the web-side implementation at `apps/web/src/lib/parser/pdf.ts:215-227`). Create module-level regex constants for each format, and check all of them in `findDateCell`.
  2. In `packages/parser/src/pdf/table-parser.ts`, update `DATE_PATTERN` to also match Korean dates and short-year dates, or use multiple patterns (matching the web-side `DATE_PATTERN` at `apps/web/src/lib/parser/pdf.ts:9-15`).
  3. Run `bun test` to verify no regressions.

---

## Final Sweep -- Cross-File Interactions

1. **All prior findings confirmed fixed:** C38-01 is verified as resolved. D-99 remains fixed.

2. **parseAmount consistency re-verified across all parsers:**
   - CSV (`csv.ts:114-123`): returns NaN for unparseable, guarded by `isValidAmount()` at every call site
   - XLSX (`xlsx.ts:282-298`): returns `null` for unparseable, callers skip null amounts
   - Server-side PDF (`pdf/index.ts:96-102`): returns 0 for unparseable (C37-01 fix applied)
   - Web-side PDF (`pdf.ts:207-213`): returns 0 for unparseable
   - All four approaches are internally consistent.

3. **Installment handling consistency re-verified:** All parsing locations use `inst > 1` for installment filtering. No regressions.

4. **Date validation consistency re-verified:** All `parseDateToISO` implementations have month/day range validation. No regressions.

5. **Global cap rollback logic verified:** The `ruleMonthUsed` rollback at `reward.ts:316-317` is correct. The overcount computation `rewardAfterMonthlyCap - appliedReward` is always >= 0 because `appliedReward = Math.min(rewardAfterMonthlyCap, globalRemaining)`.

6. **SessionStorage validation re-verified:** `isValidTx` has both `Number.isFinite(tx.amount)` and `tx.amount > 0` checks. The `loadFromStorage` validation correctly checks the optimization object structure.

7. **FileDropzone previousMonthSpending text verified:** Line 409 now correctly says "이번 달 지출액을 기준으로 자동 계산해요" (C38-01 fix applied).

8. **Server-side vs web-side PDF date format handling discrepancy:** C39-01 above -- `findDateCell` on server-side only matches YYYY-MM-DD format, while web-side matches all formats.

9. **`cachedCoreRules` module-level cache:** Still present in `analyzer.ts:47`. Intentionally never invalidated since `cards.json` static data never changes within a session. Not a bug.

10. **AI categorizer disabled:** `categorizer-ai.ts` correctly stubs all methods to throw. `TransactionReview.svelte` checks `aiAvailable` before showing the AI button. No dead-code path issues.

11. **E2E test isolation:** `bunfig.toml` correctly excludes `e2e/**` from `bun test`. Confirmed working (266 pass, 0 fail).

12. **Report HTML generator** (`packages/viz/src/report/generator.ts`): Uses `esc()` for HTML escaping. The savings sign prefix correctly prepends "+" for non-negative savings. No issues found.

13. **LLM fallback security:** The `ANTHROPIC_API_KEY` is read from `process.env` and only used server-side. The browser guard prevents client-side execution. The 30-second timeout and text truncation (8000 chars) are reasonable safeguards.

14. **SavingsComparison.svelte count-up animation:** The `$effect` correctly returns a cleanup function that cancels the animation frame. No memory leak.

15. **FileDropzone previousMonthSpending parsing:** Line 206 uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard. Correctly handles the `parseInt("1e5", 10)` issue from D-28.

16. **CategoryBreakdown colors:** Still uses hardcoded `CATEGORY_COLORS` map (D-42/D-46/D-64/D-78). Missing categories fall through to `uncategorized` gray. No new categories added since last review. Not a new issue.

17. **`reoptimize` flow:** The store correctly filters to the latest month for reoptimization (store.svelte.ts:348-351), matching the initial `analyzeMultipleFiles` behavior. The `previousMonthSpending` is recomputed from edited transactions (store.svelte.ts:373-384). No stale data risk.

18. **Web-side PDF `tryStructuredParse` catches all exceptions:** `apps/web/src/lib/parser/pdf.ts:284` uses `catch {}` which swallows all errors including programming errors. The server-side equivalent at `packages/parser/src/pdf/index.ts:168-173` only catches `SyntaxError | TypeError | RangeError` and re-throws everything else. This inconsistency could mask bugs on the web side, but it's a defensive choice for a best-effort parser that falls through to the line-by-line fallback. Low severity.

19. **Server-side detect.ts reads entire file for CSV detection:** `detectFormat` at line 158-201 calls `readFile(filePath)` twice (once for format detection from magic bytes, once for bank detection from content). For large files, this is wasteful. However, CSV files are typically small (< 5MB) and the double-read only occurs for CSV/unknown formats. Low severity.

---

## Summary of Active Findings (New in Cycle 39)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C39-01 | MEDIUM | High | `packages/parser/src/pdf/index.ts:11,104-109` + `packages/parser/src/pdf/table-parser.ts:2` | Server-side PDF `findDateCell` DATE_PATTERN only matches YYYY-MM-DD -- silently drops rows with Korean/short-year dates while web-side correctly parses them |
