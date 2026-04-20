# Comprehensive Code Review — Cycle 32

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 32)
**Scope:** Full repository — all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (35+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-31 reviews. Verified that prior cycle 31 findings C31-01 through C31-03 have been addressed (C31-02 and C31-03 confirmed fixed; C31-01 still open). Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Cycle 31 Findings

| Finding | Status | Evidence |
|---|---|---|
| C31-01 | **STILL OPEN** | `parser-date.test.ts:35` — YYYYMMDD handler has no range validation; production csv.ts lines 46-54 and xlsx.ts lines 212-220 both validate. No YYYYMMDD invalid-date test cases. |
| C31-02 | **FIXED** | `report.js:63` — now uses `opt.savingsVsSingleCard >= 0 ? '추가 절약' : '추가 비용'` |
| C31-03 | **FIXED** | `csv.ts:46-54`, `xlsx.ts:212-220` — YYYYMMDD format now validates month/day ranges |

---

## New Findings

### C32-01: Report page lacks "+" prefix on positive savings, inconsistent with results.js and SavingsComparison.svelte

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/public/scripts/report.js:63`
- **Description:** The report page displays savings as `formatWon(opt.savingsVsSingleCard)`, which for positive values produces "5,000원" without a "+" prefix. The results page (`results.js:14`) shows `(+5,000원)` and SavingsComparison.svelte (`SavingsComparison.svelte:202`) shows `+5,000원`. All three surfaces should consistently show the "+" prefix for positive savings amounts to indicate improvement over a single card.

- **Failure scenario:** User views the report page and sees "추가 절약: 5,000원" without the "+" prefix. They then view the results page and see "+5,000원". The inconsistency suggests a display bug to the user.
- **Fix:** Add a "+" prefix in report.js when savingsVsSingleCard is positive, consistent with results.js and SavingsComparison.svelte:
  ```javascript
  const savingsDisplay = (opt.savingsVsSingleCard >= 0 ? '+' : '') + formatWon(opt.savingsVsSingleCard);
  summaryTable.appendChild(summaryRow(opt.savingsVsSingleCard >= 0 ? '추가 절약' : '추가 비용', savingsDisplay));
  ```

### C32-02: Full-date format (YYYY-MM-DD etc.) lacks month/day range validation in parseDateToISO

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/parser/csv.ts:43-44`, `apps/web/src/lib/parser/xlsx.ts:209-210`, `apps/web/src/lib/parser/pdf.ts:148`
- **Description:** The full-date regex `^(\d{4})[.\-\/\s](\d{1,2})[.\-\/\s](\d{1,2})` matches dates like "2026-13-99" and directly formats them as "2026-13-99" — an invalid ISO date string. The same class of issue was fixed for YYYYMMDD, MM/DD, Korean full, and Korean short formats, but the full-date format (which is the most common format in real statements) was never given the same validation. The priority is lower because the 4-digit year prefix and separator characters make accidental matches unlikely, but corrupted or malformed data could still produce invalid dates.

  This gap exists in all three parser files (csv.ts, xlsx.ts, pdf.ts) and the test file's local reproduction.

- **Failure scenario:** A corrupted CSV cell contains "2026/13/99". The parser produces "2026-13-99" as the date string, which is not a valid ISO date. The transaction is assigned to no month bucket and silently excluded from optimization.
- **Fix:** Add month/day range validation for the full-date format:
  ```typescript
  if (fullMatch) {
    const month = parseInt(fullMatch[2]!, 10);
    const day = parseInt(fullMatch[3]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${fullMatch[1]}-${fullMatch[2]!.padStart(2, '0')}-${fullMatch[3]!.padStart(2, '0')}`;
    }
  }
  ```

### C32-03: Short year format (YY-MM-DD) lacks month/day range validation in parseDateToISO

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/parser/csv.ts:57-62`, `apps/web/src/lib/parser/xlsx.ts:222-228`, `apps/web/src/lib/parser/pdf.ts:151-156`
- **Description:** The short-year regex `^(\d{2})[.\-\/](\d{2})[.\-\/](\d{2})$` matches dates like "99/13/99" and formats them as "2099-13-99" without validating the month/day ranges. This is the same class of validation gap as C32-02. The short-year format requires exactly 2-digit components, making accidental matches less likely, but corrupted data could still trigger it.

- **Failure scenario:** A cell contains "99/13/99" (corrupted data). The parser produces "2099-13-99" — an invalid ISO date.
- **Fix:** Add month/day range validation for the short-year format:
  ```typescript
  if (shortYearMatch) {
    const year = parseInt(shortYearMatch[1]!, 10);
    const fullYear = year >= 50 ? 1900 + year : 2000 + year;
    const month = parseInt(shortYearMatch[2]!, 10);
    const day = parseInt(shortYearMatch[3]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${fullYear}-${shortYearMatch[2]!.padStart(2, '0')}-${shortYearMatch[3]!.padStart(2, '0')}`;
    }
  }
  ```

---

## Final Sweep — Cross-File Interactions

1. **C31-01 — still open:** The test file's YYYYMMDD handler at line 35 lacks range validation. The production code was fixed but the test reproduction was never updated. No test cases exist for invalid YYYYMMDD strings.

2. **C31-02 — confirmed fixed:** The report page now conditionally shows "추가 비용" when savings are negative. However, it still lacks the "+" prefix for positive savings (C32-01).

3. **C31-03 — confirmed fixed:** YYYYMMDD format now has range validation in both csv.ts and xlsx.ts.

4. **Validation gap chain completed:** The date validation chain is now:
   - YYYYMMDD: validated (csv.ts, xlsx.ts) — not present in pdf.ts
   - MM/DD: validated (csv.ts, xlsx.ts, pdf.ts)
   - Korean full: validated (csv.ts, xlsx.ts, pdf.ts)
   - Korean short: validated (csv.ts, xlsx.ts, pdf.ts)
   - **Full-date YYYY-MM-DD: NOT validated** (C32-02)
   - **Short-year YY-MM-DD: NOT validated** (C32-03)

5. **Test-production drift:** The test file's local `parseDateToISO` is out of sync with all three production copies in multiple ways:
   - YYYYMMDD: test lacks validation (C31-01)
   - Full-date: test lacks validation (C32-02)
   - Short-year: test lacks validation (C32-03)
   
   This is concerning because the tests are supposed to verify the production behavior, but the local reproduction has never been updated to match the cumulative fixes from cycles 29-32.

6. **Deferred items unchanged:** D-01 through D-105 remain unchanged from prior cycles. Key deferrals include type duplication, bank name duplication, parser code duplication, and `inferYear`/`parseDateToISO` duplication across files.

7. **`cachedCoreRules` module-level cache:** Still present in `analyzer.ts:47`. This is intentionally never invalidated since the underlying `cards.json` static data never changes within a browser session. Not a bug.

8. **AI categorizer disabled:** `categorizer-ai.ts` correctly stubs all methods to throw. The `TransactionReview.svelte` component checks `aiAvailable` before showing the AI button, and `isAvailable()` returns `false`. No dead-code path issues.

---

## Summary of Active Findings (New in Cycle 32)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C32-01 | LOW | High | `apps/web/public/scripts/report.js:63` | Report page lacks "+" prefix on positive savings — inconsistent with results.js and SavingsComparison.svelte |
| C32-02 | LOW | Medium | `csv.ts:43-44`, `xlsx.ts:209-210`, `pdf.ts:148` | Full-date format (YYYY-MM-DD) lacks month/day range validation — "2026/13/99" produces "2026-13-99" |
| C32-03 | LOW | Medium | `csv.ts:57-62`, `xlsx.ts:222-228`, `pdf.ts:151-156` | Short-year format (YY-MM-DD) lacks month/day range validation — "99/13/99" produces "2099-13-99" |

## Carried-Over Findings (Still Open from Prior Cycles)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C31-01 | MEDIUM | High | `apps/web/__tests__/parser-date.test.ts:35` | Test's local parseDateToISO YYYYMMDD handler lacks range validation; no YYYYMMDD invalid-date test cases |
