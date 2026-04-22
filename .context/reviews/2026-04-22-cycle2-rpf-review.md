# Cycle 2 Deep Code Review (2026-04-22)

Reviewer: general-purpose agent
Scope: packages/core/src/, packages/parser/src/, packages/rules/src/, packages/viz/src/, apps/web/src/, tools/cli/src/, tools/scraper/src/

---

## Methodology

Read every source file in scope (~55 files). Searched for logic bugs, edge cases, error handling gaps, security issues, performance problems, test gaps, and doc-code mismatches. Compared all findings against the prior aggregate (`_aggregate.md`) to identify truly new issues.

---

## Findings

### C2-N01: viz/summary.ts and viz/generator.ts include negative-amount transactions in grandTotal

**File:** `packages/viz/src/terminal/summary.ts:34,44` and `packages/viz/src/report/generator.ts:73,82`
**Severity:** LOW
**Confidence:** High

Both `printSpendingSummary()` and `buildCategoryTable()` iterate over `CategorizedTransaction[]` and accumulate `tx.amount` into category totals and `grandTotal` without filtering for `tx.amount > 0`. The CLI report command (`tools/cli/src/commands/report.ts:108`) passes the full `categorized` array which includes all transactions from the parser. While the parsers filter out `amount <= 0` at parse time, the optimizer's `greedyOptimize()` also filters, but the report function receives the raw categorized array (before optimizer filtering). If any refund/zero-amount transaction somehow made it through categorization (e.g., a parser bug or future code path), it would distort spending totals in the HTML report and terminal summary.

**Failure scenario:** A future code change bypasses the parser's `amount <= 0` filter, or a negative amount leaks through a new parser adapter. The terminal summary and HTML report would show incorrect (lower) totals and skewed category percentages.

**Suggested fix:** Add `if (tx.amount <= 0) continue;` at the top of both loops, matching the pattern used in `greedyOptimize()` and `calculateRewards()`.

**Note:** This is LOW severity because all current parsers enforce `amount > 0` at parse time, making the code path currently unreachable. The fix is defensive.

---

### C2-N02: XLSX server parser does not filter amount <= 0

**File:** `packages/parser/src/xlsx/index.ts` (lines ~203-245 in the data loop)
**Severity:** LOW
**Confidence:** Medium

The server-side XLSX parser (`parseXLSXSheet`) does not filter out zero or negative amounts after `parseAmount()`. All CSV adapters (both server and web) have `if (amount <= 0) continue;` or use `isValidAmount()` which rejects `amount <= 0`. The web XLSX parser (`apps/web/src/lib/parser/xlsx.ts:448`) also has this filter. But the server XLSX parser only checks `amount === null` (unparseable) and proceeds with any non-null amount including zero and negatives.

**Failure scenario:** An XLSX file containing balance inquiry rows (amount=0) or refund rows (amount<0) processed via the CLI would include those transactions, inflating monthly spending totals and distorting optimization results.

**Suggested fix:** After the `if (amount === null)` block, add `if (amount <= 0) continue;` matching all other parser paths.

**Note:** LOW severity because the CLI's `parseStatement` is rarely used for XLSX files (CSV is the primary format), and most Korean card XLSX exports use HTML-as-XLS which may have different characteristics.

---

## Items Verified as Correct (No Issue)

1. **Optimizer filtering:** `greedyOptimize()` correctly filters `tx.amount > 0 && Number.isFinite(tx.amount)` at line 285. `calculateRewards()` also skips `tx.amount <= 0` and non-KRW currencies. Double filtering is redundant but harmless.

2. **Savings sign logic:** The `formatSavingsValue()` helper is correctly used across SavingsComparison, VisibilityToggle, and ReportContent, using `Math.abs(value)` unconditionally with directional labels.

3. **RAF cleanup:** SavingsComparison's `$effect` correctly returns a cleanup function `() => { cancelled = true; cancelAnimationFrame(rafId); }`. The `cancelAnimationFrame(rafId)` call is safe even if `rafId` is the return value of the first `requestAnimationFrame` call (a valid number), or if the effect is cleaned up after animation completes (no-op per spec).

4. **Category matching:** The `findRule()` function correctly uses secondary sort by `rules.indexOf(a)` for deterministic ordering when specificity is equal (C1-12 fix verified).

5. **Monthly spending calculation:** `analyzeMultipleFiles()` correctly accumulates only `tx.amount > 0` for `monthlySpending` (C1-01 fix verified).

6. **Store reoptimize snapshot:** The `reoptimize()` method correctly captures `snapshot = result` after the null guard and uses it for the spread, preventing async race conditions (C81-01 fix verified).

7. **CSV parser duplication:** The web-side CSV parser (`apps/web/src/lib/parser/csv.ts`) duplicates helpers from `packages/parser/src/csv/shared.ts`. This is a known issue (C1-N04 / D-01 architectural refactor) already tracked in the aggregate.

8. **Hardcoded maps:** `formatIssuerNameKo` (C1-N01), `CATEGORY_COLORS` (C1-N02), and `CATEGORY_NAMES_KO` (C64-03) are all known hardcoded maps that can drift from YAML. All tracked in the aggregate.

---

## Comparison with Prior Aggregate

| Finding | Already Known? | Reference |
|---|---|---|
| C2-N01 (viz no amount filter) | **NEW** | Not in prior aggregate |
| C2-N02 (XLSX server no amount filter) | **NEW** | Not in prior aggregate |
| C1-N01 formatIssuerNameKo drift | Known | Already in aggregate |
| C1-N02 CATEGORY_COLORS drift | Known | Already in aggregate |
| C1-N03 RAF cancelAnimationFrame | Known | Already in aggregate |
| C1-N04 Web CSV parser duplication | Known | Already in aggregate |
| C1-03 KakaoBank WCAG contrast | Known | Already in aggregate |
| C89-01 VisibilityToggle isConnected | Known | Already in aggregate |
| C89-02 CategoryBreakdown rawPct threshold | Known | Already in aggregate |
| C89-03 formatters.ts m! assertion | Known | Already in aggregate |
| C64-03 CATEGORY_NAMES_KO drift | Known | Already in aggregate |
