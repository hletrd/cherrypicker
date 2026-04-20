# Comprehensive Code Review — Cycle 31

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 31)
**Scope:** Full repository — all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (35+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-30 reviews and all 105 deferred items. Focused on finding genuinely NEW issues not previously reported. Verified that prior cycle 30 findings (C30-01, C30-02) have been addressed.

---

## Verification of Cycle 30 Findings

| Finding | Status | Evidence |
|---|---|---|
| C30-01 | **FIXED** | `results.js:14` — now uses `(opt.savingsVsSingleCard >= 0 ? '+' : '')` and updates label to "추가 비용" when negative |
| C30-02 | **FIXED** | `csv.ts:72-79`, `pdf.ts:160-167`, `xlsx.ts:225-232` — Korean full-date format now validates month/day ranges before formatting |

---

## New Findings

### C31-01: Test file's local parseDateToISO lacks month/day range validation that was added to production code

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/__tests__/parser-date.test.ts:46-68`
- **Description:** The test file reproduces `parseDateToISO` and `inferYear` locally (since they are private functions), but the local copy was never updated when C29-03/C29-04 (short-date range validation) and C30-02 (full-date range validation) were added to the production code.

  Specifically:
  1. Lines 46-52: The MM/DD handler in the test has NO range validation (`month >= 1 && month <= 12 && day >= 1 && day <= 31`), while `csv.ts:62-68`, `pdf.ts:181-188`, and `xlsx.ts:249-256` all validate ranges.
  2. Lines 55-56: The `koreanFull` handler in the test has NO range validation, while `csv.ts:72-79`, `pdf.ts:160-167`, and `xlsx.ts:225-232` all validate ranges.
  3. Lines 59-65: The `koreanShort` handler in the test has NO range validation, while `csv.ts:82-90`, `pdf.ts:170-178`, and `xlsx.ts:235-243` all validate ranges.

  This means the tests do not verify the range validation logic that was the subject of three separate fixes (C29-03, C29-04, C30-02). Invalid dates like "99/99" or "2026년 99월 99일" would pass through unvalidated in the test reproduction, producing "2026-99-99" instead of falling through as they should.

- **Failure scenario:** A future change to the date validation logic is made in the production code but the test reproduction is not updated (since it was already out of sync). The tests pass but the actual behavior differs from what was tested. Additionally, there are no tests for the range validation itself (e.g., "99/99" producing the raw string rather than an invalid date).
- **Fix:** Update the test file's local `parseDateToISO` to include the same range validation as the production code. Add explicit test cases for invalid dates (e.g., "13/45", "2026년 99월 99일", "99월 99일") verifying they fall through without producing invalid ISO date strings.

### C31-02: Report page "추가 절약" label always shows positive framing even when cherry-picking is worse

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/public/scripts/report.js:63`
- **Description:** The report page's summary table row shows `formatWon(opt.savingsVsSingleCard)` with the fixed label "추가 절약" (additional savings). When `savingsVsSingleCard` is negative (cherry-picking is worse than the best single card), this displays a negative number under "추가 절약" — confusing UX.

  The dashboard's `SavingsComparison.svelte` and the results page (`results.js`) both handle this case: SavingsComparison changes its label from "추가 절약" to "추가 비용", and results.js updates `stat-savings-label` to "추가 비용" when savings are negative. But the report page has no such logic.

- **Failure scenario:** User has a spending profile where cherry-picking produces less reward than using a single card. The report page shows "추가 절약: -5,000원" — a negative number under a "savings" heading. The dashboard and results page correctly show "추가 비용: -5,000원".
- **Fix:** Add conditional logic in `report.js` to change the label from "추가 절약" to "추가 비용" when `opt.savingsVsSingleCard < 0`, consistent with SavingsComparison and results.js.

### C31-03: YYYYMMDD format in csv.ts lacks month/day range validation

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/parser/csv.ts:47`
- **Description:** The `YYYYMMDD` handler in `csv.ts` matches exactly 8 digits (`/^\d{8}$/`) and directly slices them into a date string without any range validation. While the 4-digit year prefix makes this format less likely to match non-date columns, corrupted data like "20261399" would produce "2026-13-99" — an invalid ISO date string. The same gap exists in `xlsx.ts:213`.

  This is the same class of issue as C29-03/C29-04/C30-02 but for the YYYYMMDD format. The priority is lower because this format is very specific (exactly 8 digits) and unlikely to be produced by corrupted text, but it remains a gap in the validation chain.

- **Failure scenario:** A CSV cell contains "20261399" (corrupted data). The parser produces "2026-13-99" as the date string, which is not a valid ISO date. The transaction is assigned to no month bucket.
- **Fix:** Add month/day range validation for the YYYYMMDD format:
  ```typescript
  if (/^\d{8}$/.test(cleaned)) {
    const month = parseInt(cleaned.slice(4, 6), 10);
    const day = parseInt(cleaned.slice(6, 8), 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    }
  }
  ```

---

## Final Sweep — Cross-File Interactions

1. **C30-01 and C30-02 — confirmed fixed:** Both cycle 30 findings have been properly addressed with code changes and commits.

2. **Test code out of sync with production (C31-01):** The test file `parser-date.test.ts` was written before the range validation fixes and was never updated. This is a test gap — the range validation that was the subject of three fixes has zero test coverage.

3. **Report page inconsistency with dashboard/results (C31-02):** The report page's `report.js` shows "추가 절약" unconditionally, while both `SavingsComparison.svelte` and `results.js` conditionally show "추가 비용" when savings are negative. This is the same class of inconsistency that C30-01 fixed for the results page.

4. **YYYYMMDD validation gap (C31-03):** The YYYYMMDD format in csv.ts and xlsx.ts lacks the same range validation that was added for short dates and Korean dates. Lower priority due to format specificity but still a gap.

5. **Deferred items unchanged:** D-01 through D-105 remain unchanged from prior cycles. Key deferrals include type duplication, bank name duplication, parser code duplication, and `inferYear`/`parseDateToISO` duplication across files.

6. **`cachedCoreRules` module-level cache:** Still present in `analyzer.ts:47`. This is intentionally never invalidated since the underlying `cards.json` static data never changes within a browser session. Not a bug.

7. **`report.js` `formatWon` does not handle negative savings display:** The report uses `formatWon(opt.savingsVsSingleCard)` which for negative numbers produces "-5,000원" — this is correct, but the label "추가 절약" is misleading for negative values (C31-02).

---

## Summary of Active Findings (New in Cycle 31)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C31-01 | MEDIUM | High | `apps/web/__tests__/parser-date.test.ts:46-68` | Test's local parseDateToISO lacks range validation — production code was fixed in C29-03/C29-04/C30-02 but test reproduction was never updated |
| C31-02 | LOW | High | `apps/web/public/scripts/report.js:63` | Report page always shows "추가 절약" even when savings are negative — inconsistent with SavingsComparison.svelte and results.js |
| C31-03 | LOW | Medium | `csv.ts:47`, `xlsx.ts:213` | YYYYMMDD format lacks month/day range validation — "20261399" produces "2026-13-99" |
