# Comprehensive Code Review — Cycle 29

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 29)
**Scope:** Full repository — all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (35+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-28 reviews and all 105 deferred items. Focused on finding genuinely NEW issues not previously reported. Verified that prior cycle 28 findings (C28-01 through C28-04) have been addressed.

---

## Verification of Cycle 28 Findings

| Finding | Status | Evidence |
|---|---|---|
| C28-01 | **FIXED** | `SpendingSummary.svelte:50-62` — "최근 월 지출" shows `optimization.totalSpending`, "전체" sub-label when multi-month |
| C28-02 | **FIXED** | `FileDropzone.svelte:206` — `Math.round(Number(v))` instead of `Number(v)` |
| C28-03 | **FIXED** | `xlsx.ts parseDateToISO` — MM/DD format handler added with inferYear + month/day validation |
| C28-04 | **FIXED** | `SavingsComparison.svelte:74-85` — Defensive comment explaining Infinity sentinel is unreachable but kept as guard |

---

## New Findings

### C29-01: performanceExclusions filters on `tx.category` but excludes should also match subcategory keys

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/analyzer.ts:189-192`
- **Description:** When computing per-card previousMonthSpending without explicit user input, the code filters transactions with `!exclusions.has(tx.category)`. However, `performanceExclusions` in the YAML files can contain category IDs that correspond to parent categories (e.g., `tax_payment`), and transactions may have `tx.category` set to a parent category while their `tx.subcategory` is a specific subcategory. More critically, if a `performanceExclusions` entry is a subcategory ID (e.g., `cafe`), and the transaction's `tx.category` is `dining` (the parent) with `tx.subcategory = 'cafe'`, the exclusion would NOT match because `exclusions.has('dining')` returns false even though the exclusion list contains `'cafe'`.
- **Failure scenario:** A card's `performanceExclusions` includes `cafe` (the subcategory ID). A user has 200,000 Won in cafe transactions. The `tx.category` is `dining` and `tx.subcategory` is `cafe`. The filter `!exclusions.has('dining')` passes (cafe is not in exclusions as 'dining'), so the 200,000 Won is incorrectly included in the previousMonthSpending, potentially pushing the user into a higher performance tier than they qualify for.
- **Fix:** Check both `tx.category` and the dot-notation key `${tx.category}.${tx.subcategory}` against exclusions, and also check `tx.subcategory` directly:
  ```typescript
  const exclusions = new Set(rule.performanceExclusions);
  const qualifying = transactions
    .filter(tx => 
      !exclusions.has(tx.category) && 
      !exclusions.has(tx.subcategory ?? '') &&
      !(tx.subcategory && exclusions.has(`${tx.category}.${tx.subcategory}`))
    )
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  ```

### C29-02: results.astro "총 지출" stat card shows raw optimization spending, not formatted with latest-month context

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/pages/results.astro:51`
- **Description:** The results page has a "총 지출" stat card (`id="stat-total-spending"`) that is populated by `results.js` from sessionStorage data. However, the `results.js` script is an inline `<script is:inline>` that directly reads `data.optimization.totalSpending` — this is the latest-month-only optimization spending. Unlike the dashboard's `SpendingSummary.svelte` (which was fixed in C28-01 to show "최근 월 지출" with a "전체" sub-label for multi-month data), the results page shows this value as "총 지출" (total spending), which is misleading when the user uploaded multiple months. The dashboard fix was not applied to the results page.
- **Failure scenario:** User uploads 3 months of statements. Dashboard shows "최근 월 지출 500,000원 / 전체 1,200,000원". The results page shows "총 지출 500,000원" — inconsistent and confusing.
- **Fix:** Either: (a) Update the results page stat label from "총 지출" to "최근 월 지출" and add an "전체" sub-stat, or (b) Show the full-period spending from `data.monthlyBreakdown` instead of `data.optimization.totalSpending`, with a "(최근 월 기준)" qualifier.

### C29-03: CSV `parseDateToISO` does not validate month/day ranges for short MM/DD format

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/csv.ts:58-64`
- **Description:** The CSV `parseDateToISO` handles MM/DD short dates (e.g., "01/15") with the `inferYear` heuristic but does NOT validate that the month is 1-12 or the day is 1-31. If a value like "13/45" is parsed, `inferYear(13, 45)` creates a `new Date(year, 12, 45)` which JavaScript auto-normalizes to a valid date in the next month, producing a silently wrong date string. The xlsx.ts version (added in the C28-03 fix) correctly includes range validation (`month >= 1 && month <= 12 && day >= 1 && day <= 31`), but the csv.ts version does not.
- **Failure scenario:** A CSV cell contains "99/99" (likely a misidentified non-date column). The csv.ts parser produces `"2026-99-99"` as the date string, which is not a valid ISO date. Downstream code treats this as an invalid date, and the transaction is assigned to no month bucket, effectively disappearing from the analysis.
- **Fix:** Add the same range validation used in xlsx.ts to the csv.ts `parseDateToISO` short-date handler:
  ```typescript
  if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    const year = inferYear(month, day);
    return `${year}-${shortMatch[1]!.padStart(2, '0')}-${shortMatch[2]!.padStart(2, '0')}`;
  }
  ```

### C29-04: PDF `parseDateToISO` does not validate month/day ranges for Korean short dates

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/parser/pdf.ts:163-169`
- **Description:** Same class as C29-03 but for the PDF parser. The Korean short date handler (`1월 15일` format) at pdf.ts:163-169 does not validate that `month` is 1-12 or `day` is 1-31 before passing them to `inferYear()`. While the regex `(\d{1,2})월\s*(\d{1,2})일` already constrains to 1-2 digits, values like "99월 99일" would pass the regex and produce an invalid date. The xlsx.ts version (C28-03 fix) validates ranges for the MM/DD handler but not for the Korean short date handler either.
- **Failure scenario:** A PDF text extraction artifact contains "99월 99일" (corrupted text). The PDF parser's `parseDateToISO` produces `"2026-99-99"`, an invalid date string.
- **Fix:** Add range validation for Korean short dates across all three parser files (csv.ts, xlsx.ts, pdf.ts):
  ```typescript
  if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    const year = inferYear(month, day);
    return `${year}-${...}`;
  }
  ```

---

## Final Sweep — Cross-File Interactions

1. **C28-01 through C28-04 — confirmed fixed:** All four cycle 28 findings have been properly addressed with code changes and commits. The fixes are correct and well-implemented.

2. **Bank name duplication (D-42/D-57):** Still present — `ALL_BANKS` in `FileDropzone.svelte`, `formatIssuerNameKo` in `formatters.ts`, `BANK_SIGNATURES` in both `packages/parser/src/detect.ts` and `apps/web/src/lib/parser/detect.ts`, `BANK_COLUMN_CONFIGS` in `apps/web/src/lib/parser/xlsx.ts` are five independent hardcoded lists. Adding a new bank requires updating all five.

3. **Type duplication (D-01/D-42):** `packages/parser/src/types.ts` and `apps/web/src/lib/parser/types.ts` still define identical `BankId`, `RawTransaction`, `ParseResult`, `ParseError`, `BankAdapter` types.

4. **`inferYear` / `parseDateToISO` duplication (D-03/D-35/D-55):** Still present across 4+ files. Now there is also a consistency gap: xlsx.ts validates month/day ranges for MM/DD but csv.ts and pdf.ts do not (C29-03, C29-04).

5. **PDF table parser duplication:** `packages/parser/src/pdf/table-parser.ts` and `apps/web/src/lib/parser/pdf.ts` have nearly identical `detectColumnBoundaries`, `splitByColumns`, `parseTable`, and `filterTransactionRows` functions.

6. **`detectBank` / `detectCSVDelimiter` duplication (D-57):** `packages/parser/src/detect.ts` and `apps/web/src/lib/parser/detect.ts` have identical `detectBank` and `detectCSVDelimiter` functions with identical `BANK_SIGNATURES` arrays.

7. **`loadCategories` is called redundantly:** Both `getCategoryLabels()` (store.svelte.ts:244-262) and the category labels build in `optimizeFromTransactions` (analyzer.ts:198-214) construct the same Map from the same taxonomy data. The store caches its labels, and `optimizeFromTransactions` receives pre-built labels from `analyzeMultipleFiles`, so the initial path builds labels twice. Minor performance concern, not correctness.

8. **`FileDropzone.svelte` dual file input binding:** Two `<input type="file">` elements (lines 329 and 347) both use `bind:this={fileInputEl}`. Since conditional rendering means only one is visible at a time, the binding is always to the currently visible input. Not a bug, but subtle design.

9. **`performanceExclusions` matching gap (C29-01):** The exclusion filter only checks `tx.category` but not `tx.subcategory` or dot-notation keys. This is a correctness issue that could lead to wrong performance tier calculations.

10. **Results page inconsistency with dashboard (C29-02):** The results.astro page shows `optimization.totalSpending` as "총 지출" without the latest-month qualifier that was added to the dashboard in C28-01.

---

## Summary of Active Findings (New in Cycle 29)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C29-01 | MEDIUM | High | `apps/web/src/lib/analyzer.ts:189-192` | performanceExclusions only checks `tx.category`, missing subcategory and dot-notation key matches — wrong previousMonthSpending for cards with subcategory-level exclusions |
| C29-02 | LOW | High | `apps/web/src/pages/results.astro:51` | "총 지출" shows optimization spending without latest-month qualifier — inconsistent with dashboard fix from C28-01 |
| C29-03 | LOW | High | `apps/web/src/lib/parser/csv.ts:58-64` | MM/DD short-date handler missing month/day range validation that xlsx.ts has — "13/45" produces invalid date string |
| C29-04 | LOW | Medium | `apps/web/src/lib/parser/pdf.ts:163-169` | Korean short-date handler missing month/day range validation — same class as C29-03 for PDF parser |
