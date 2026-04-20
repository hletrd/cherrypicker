# Comprehensive Code Review — Cycle 28

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 28)
**Scope:** Full repository — all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (30+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-27 reviews and deferred items. Focused on finding genuinely NEW issues not previously reported. Verified that prior cycle 27 findings (C27-01 through C27-05) have been addressed.

---

## Verification of Cycle 27 Findings

| Finding | Status | Evidence |
|---|---|---|
| C27-01 | **FIXED** | `SavingsComparison.svelte:72-83` — `savingsPct` now returns `Infinity` sentinel when `bestSingleCard.totalReward === 0 && savingsVsSingleCard > 0`, with template showing "최적 조합만 혜택" badge |
| C27-02 | **FIXED** | `SavingsComparison.svelte:196` — Annual projection now shows "(최근 월 기준)" qualifier |
| C27-03 | **FIXED** | `TransactionReview.svelte:117-118` — Subcategory is only cleared when AI changes the category to a different one |
| C27-04 | **FIXED** | `FileDropzone.svelte:121,157-159` — `duplicateNames` array tracks skipped files, warning message displayed |
| C27-05 | **FIXED** | `packages/parser/src/detect.ts:121`, `apps/web/src/lib/parser/detect.ts:139` — `pattern.lastIndex = 0` before each `test()` call |

---

## New Findings

### C28-01: SpendingSummary "총 지출" shows sum of all months while optimization metrics only cover latest month

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:57`
- **Description:** The "총 지출" (total spending) card computes its value as `analysisStore.result.monthlyBreakdown.reduce((sum, m) => sum + m.spending, 0)` when `monthlyBreakdown` is available, which sums ALL months' spending. However, every other metric on the dashboard — "실효 혜택률", "월 예상 혜택" in SavingsComparison, the category breakdown, and the optimal card map — only covers the latest month's optimization. This creates a confusing inconsistency: a user uploading 3 months of statements sees "1,500,000원 총 지출" but the savings comparison is based on only the latest month's 500,000원. The "거래 건수" card similarly shows `totalTransactionCount` (all months) while the optimization only covers the latest month's transactions.
- **Failure scenario:** A user uploads January (300,000원), February (400,000원), and March (500,000원) statements. The dashboard shows "1,200,000원 총 지출" and "150건" transaction count, but the optimization and savings are only for March (500,000원, 50건). The user assumes the savings are calculated on 1,200,000원 and overestimates the benefit.
- **Fix:** Either: (a) Change "총 지출" to show only the latest month's spending with a separate "전체 기간" label showing all months, or (b) Add a clarifying label like "최근 월 기준" next to the spending figure, similar to how the annual projection was clarified in C27-02, or (c) Show two separate cards: "이번 달 지출" (latest month) and "전체 기간 지출" (all months).

### C28-02: FileDropzone previousMonthSpending accepts fractional Won values

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:206`
- **Description:** The `previousMonthSpending` value is parsed as `Number(v)`, which accepts fractional values like `500000.5`. Korean Won amounts must be integers — no fractional Won exists. While the `type="number"` input with `step="10000"` makes it unlikely a user would enter a fraction via the UI, programmatic input or browser autofill could produce one. The fractional value would be passed to the optimizer, where it's compared with integer tier thresholds (which works numerically but is semantically incorrect) and persisted to sessionStorage.
- **Failure scenario:** A browser autofills "500000.5" into the previousMonthSpending field. The optimizer uses this value for performance tier calculation, which still works (500000.5 >= 500000 is true), but the value is semantically wrong and could cause confusion in debugging or display.
- **Fix:** Use `Math.round(Number(v))` or `parseInt(v, 10)` instead of `Number(v)` to ensure integer Won values.

### C28-03: XLSX parseDateToISO missing MM/DD string format that csv.ts handles

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/parser/xlsx.ts` (parseDateToISO function, ~lines 192-239)
- **Description:** The XLSX version of `parseDateToISO` handles numeric (Excel serial) dates, YYYY-MM-DD, YYYYMMDD, YY-MM-DD, Korean full dates (YYYY년 M월 D일), and Korean short dates (M월 D일). However, unlike the csv.ts version (lines 58-64), it does NOT handle short MM/DD or MM.DD format strings (e.g., "01/15"). If a cell in an XLSX file contains a short date as text (rather than an Excel serial number), the function falls through to `return cleaned`, producing an invalid date string like "01/15" instead of "2026-01-15". This gap is partially mitigated because Excel typically converts dates to serial numbers, but HTML-as-XLS files (common for Korean card exports with .xls extension) may contain string-formatted dates.
- **Failure scenario:** A Korean card company exports an HTML table with .xls extension. A cell contains the text "01/15" for a January 15th transaction. The XLSX parser's `parseDateToISO` returns "01/15" as-is, which is not a valid ISO date. Downstream code treats this as an invalid date string, and the transaction may be filtered out or assigned to the wrong month.
- **Fix:** Add the MM/DD and MM.DD handling from csv.ts to the xlsx.ts `parseDateToISO` function, including the `inferYear` heuristic for the year.

### C28-04: savingsPct Infinity sentinel is unreachable dead code

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:77-79`
- **Description:** The `Infinity` sentinel added in the C27-01 fix (`if (opt.bestSingleCard.totalReward === 0 && opt.savingsVsSingleCard > 0) return Infinity`) can never be reached in practice. When `bestSingleCard.totalReward === 0`, it means no card earns any reward for any of the user's transactions (given their performance tier). Since the optimizer has access to the same card rules, it also cannot earn any reward, so `totalReward` is 0 and `savingsVsSingleCard` is 0 (not > 0). The code is defensively correct and harmless, but the "최적 조합만 혜택" badge in the template (line 198-201) is dead code that will never be displayed.
- **Failure scenario:** No failure scenario — the code is correct but the Infinity branch is unreachable.
- **Fix:** Either remove the Infinity sentinel and the associated template branch, or add a comment explaining that it is a defensive guard for a theoretically impossible case that could become possible if the optimizer's card selection logic changes in the future (e.g., if cards can be excluded from the "best single card" evaluation but still used by the optimizer).

---

## Final Sweep — Cross-File Interactions

1. **C27-01 through C27-05 — confirmed fixed:** All five cycle 27 findings have been properly addressed with code changes and commits. The fixes are correct and well-implemented.

2. **Bank name duplication (D-42/D-57):** Still present — `ALL_BANKS` in `FileDropzone.svelte`, `formatIssuerNameKo` in `formatters.ts`, `BANK_SIGNATURES` in both `packages/parser/src/detect.ts` and `apps/web/src/lib/parser/detect.ts`, `BANK_COLUMN_CONFIGS` in `apps/web/src/lib/parser/xlsx.ts` are five independent hardcoded lists. Adding a new bank requires updating all five.

3. **Type duplication (D-01/D-42):** `packages/parser/src/types.ts` and `apps/web/src/lib/parser/types.ts` still define identical `BankId`, `RawTransaction`, `ParseResult`, `ParseError`, `BankAdapter` types.

4. **`inferYear` / `parseDateToISO` duplication (D-03/D-43, C26-04):** Still present across 4+ files (`apps/web/src/lib/parser/csv.ts`, `apps/web/src/lib/parser/pdf.ts`, `apps/web/src/lib/parser/xlsx.ts`, `packages/parser/src/pdf/table-parser.ts`). The xlsx.ts version is now confirmed to be incomplete relative to csv.ts (C28-03).

5. **PDF table parser duplication:** `packages/parser/src/pdf/table-parser.ts` and `apps/web/src/lib/parser/pdf.ts` have nearly identical `detectColumnBoundaries`, `splitByColumns`, `parseTable`, and `filterTransactionRows` functions.

6. **`detectBank` / `detectCSVDelimiter` duplication:** `packages/parser/src/detect.ts` and `apps/web/src/lib/parser/detect.ts` have identical `detectBank` and `detectCSVDelimiter` functions with identical `BANK_SIGNATURES` arrays.

7. **`loadCategories` is called redundantly in `store.svelte.ts` and `analyzer.ts`:** Both `getCategoryLabels()` (store.svelte.ts:244-262) and the category labels build in `optimizeFromTransactions` (analyzer.ts:198-214) construct the same Map from the same taxonomy data. The store caches its labels, and `optimizeFromTransactions` receives pre-built labels from `analyzeMultipleFiles`, so the initial path builds labels twice. This is a minor performance concern, not a correctness issue.

8. **`FileDropzone.svelte` dual file input binding:** Two `<input type="file">` elements (lines 329 and 347) both use `bind:this={fileInputEl}`. Since conditional rendering means only one is visible at a time, the binding is always to the currently visible input. The `removeFile` and `clearAllFiles` functions reset `fileInputEl.value`, which correctly targets whichever input is currently bound. Not a bug, but a subtle design that could confuse future maintainers.

---

## Summary of Active Findings (New in Cycle 28)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C28-01 | MEDIUM | High | `apps/web/src/components/dashboard/SpendingSummary.svelte:57` | "총 지출" shows sum of all months while optimization only covers latest month — confusing inconsistency |
| C28-02 | LOW | High | `apps/web/src/components/upload/FileDropzone.svelte:206` | previousMonthSpending accepts fractional Won values via `Number()` instead of integer-only parsing |
| C28-03 | LOW | Medium | `apps/web/src/lib/parser/xlsx.ts` parseDateToISO | Missing MM/DD string format handling that csv.ts has — short dates in HTML-as-XLS would produce invalid date strings |
| C28-04 | LOW | High | `apps/web/src/components/dashboard/SavingsComparison.svelte:77-79` | savingsPct Infinity sentinel is unreachable dead code — `bestSingleCard.totalReward === 0` implies `savingsVsSingleCard === 0` |
