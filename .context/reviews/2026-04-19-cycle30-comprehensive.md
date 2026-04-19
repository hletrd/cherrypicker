# Comprehensive Code Review — Cycle 30

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 30)
**Scope:** Full repository — all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (35+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-29 reviews and all 105 deferred items. Focused on finding genuinely NEW issues not previously reported. Verified that prior cycle 29 findings (C29-01 through C29-04) have been addressed.

---

## Verification of Cycle 29 Findings

| Finding | Status | Evidence |
|---|---|---|
| C29-01 | **FIXED** | `analyzer.ts:194-200` — performanceExclusions now checks `tx.category`, `tx.subcategory`, and `${tx.category}.${tx.subcategory}` |
| C29-02 | **FIXED** | `results.astro:50` — "최근 월 지출" label instead of "총 지출" |
| C29-03 | **FIXED** | `csv.ts:64` — month/day range validation added to MM/DD short-date handler |
| C29-04 | **FIXED** | `pdf.ts:167` — month/day range validation added to Korean short-date handler; also added to xlsx.ts Korean short-date |

---

## New Findings

### C30-01: results.js unconditionally prepends "+" on savings, producing "+-N원" for negative savingsVsSingleCard

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/public/scripts/results.js:14`
- **Description:** The results page's inline script reads `opt.savingsVsSingleCard` and displays it as "예상 절약액". Line 14 unconditionally prepends a "+" sign: `'+' + formatWon(opt.savingsVsSingleCard)`. However, `formatWon()` uses `amount.toLocaleString('ko-KR') + '원'`, which for negative numbers produces "-50,000원" (with the minus sign already included). When `savingsVsSingleCard` is negative (cherry-picking is worse than the best single card), the display becomes "+-50,000원" — a double sign that looks broken.

  The dashboard's `SavingsComparison.svelte` handles this correctly at line 202: `{displayedSavings >= 0 ? '+' : ''}{formatWon(displayedSavings)}` — it only prepends "+" when the value is non-negative.

- **Failure scenario:** User uploads statements where the best single card earns more than the cherry-picked combination (e.g., only one card is available). `savingsVsSingleCard` is -5,000. The results page shows "예상 절약액: +-5,000원" instead of "예상 절약액: -5,000원".
- **Fix:** Match the dashboard's conditional sign logic:
  ```javascript
  if (totalSavings) totalSavings.textContent = (opt.savingsVsSingleCard >= 0 ? '+' : '') + formatWon(opt.savingsVsSingleCard);
  ```
  Also update the label to match SavingsComparison's context-aware label ("추가 절약" when positive, "추가 비용" when negative).

### C30-02: Korean full-date format (YYYY년 M월 D일) lacks month/day range validation across all three parsers

- **Severity:** LOW
- **Confidence:** Medium
- **Files:** `apps/web/src/lib/parser/csv.ts:71-72`, `apps/web/src/lib/parser/pdf.ts:159-160`, `apps/web/src/lib/parser/xlsx.ts:224-225`
- **Description:** The `koreanFull` date handler matches `(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일` and directly formats the captured month/day into an ISO date string without range validation. While the 4-digit year prefix makes this format much more specific (and thus lower-risk) than the short-date formats fixed in C29-03/C29-04, it remains the case that `2026년 99월 99일` (from corrupted PDF text extraction) would produce "2026-99-99" — an invalid date string. This is the same class of issue as C29-03/C29-04 but for the full Korean date format.
- **Failure scenario:** A PDF text extraction artifact contains "2026년 99월 99일" (corrupted text from a table header or footer). The parser produces `"2026-99-99"` as the date string, which is not a valid ISO date. Downstream code treats this as an invalid date, and the transaction is assigned to no month bucket.
- **Fix:** Add month/day range validation before formatting, consistent with the short-date handlers:
  ```typescript
  const koreanFull = cleaned.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (koreanFull) {
    const month = parseInt(koreanFull[2]!, 10);
    const day = parseInt(koreanFull[3]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${koreanFull[1]}-${koreanFull[2]!.padStart(2, '0')}-${koreanFull[3]!.padStart(2, '0')}`;
    }
  }
  ```

---

## Final Sweep — Cross-File Interactions

1. **C29-01 through C29-04 — confirmed fixed:** All four cycle 29 findings have been properly addressed with code changes and commits.

2. **results.js is inconsistent with SavingsComparison.svelte (C30-01):** The results.js unconditionally prepends "+" while the Svelte component conditionally adds it. Additionally, the results page doesn't change the "예상 절약액" label when savings are negative, while SavingsComparison changes to "추가 비용" — another inconsistency.

3. **koreanFull date validation gap (C30-02):** All three parser files (csv.ts, xlsx.ts, pdf.ts) share the same gap for the full Korean date format. The short-date formats were fixed in C29-03/C29-04 but the full-date format was not included.

4. **Deferred items unchanged:** D-01 through D-105 remain unchanged from prior cycles. Key deferrals include type duplication (D-01/D-42), bank name duplication (D-42/D-57), parser code duplication, and `inferYear`/`parseDateToISO` duplication across files.

5. **`cachedCoreRules` module-level cache:** Still present in `analyzer.ts:47`. This is intentionally never invalidated since the underlying `cards.json` static data never changes within a browser session. The store's `reset()` method clears `cachedCategoryLabels` (which depends on the volatile analysis state) but correctly leaves `cachedCoreRules` alone (it depends on immutable static data). Not a bug.

6. **`results.js` is a plain JS file with no type safety:** This file is intentionally a plain `<script is:inline>` for the Astro page, meaning it has no TypeScript checking. The double-sign bug (C30-01) is an example of the kind of error that slips through without type checking. This is a known trade-off (deferred item D-xxx) and not a new finding.

---

## Summary of Active Findings (New in Cycle 30)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C30-01 | MEDIUM | High | `apps/web/public/scripts/results.js:14` | Unconditional "+" prepended to savings — produces "+-50,000원" for negative savingsVsSingleCard; inconsistent with SavingsComparison.svelte |
| C30-02 | LOW | Medium | `csv.ts:71-72`, `pdf.ts:159-160`, `xlsx.ts:224-225` | Korean full-date format (YYYY년 M월 D일) lacks month/day range validation — "2026년 99월 99일" produces "2026-99-99" |
