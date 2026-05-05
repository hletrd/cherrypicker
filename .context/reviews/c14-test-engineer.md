# Cycle 14 Test Engineer Review

## Findings

### C14-TEST-01: No test for `isValidISODate` with invalid month/day (MEDIUM)
- **Files:** `packages/parser/__tests__/date-utils.test.ts`, `apps/web/__tests__/parser-date.test.ts`
- **Description:** `isValidISODate` is tested for valid dates but there is no test asserting that "2024-99-99" returns false.
- **Failure scenario:** The bug in C14-01 could regress without any test failing.
- **Fix:** Add tests for boundary values: "2024-00-01", "2024-13-01", "2024-01-99", "0000-00-00".
- **Confidence:** High

### C14-TEST-02: No test for `parseAmountString` with multiple decimal points (LOW)
- **File:** `packages/parser/__tests__/csv-shared.test.ts`
- **Description:** `parseAmountString` uses `parseFloat` internally. No test verifies behavior with malformed input like "1.2.3".
- **Fix:** Add a test asserting that `parseAmountString("1.2.3")` returns `null`.
- **Confidence:** Medium

### C14-TEST-03: Web-side parser tests added but coverage gaps remain (MEDIUM)
- **Files:** `apps/web/__tests__/parser-html.test.ts`, `apps/web/__tests__/parser-json.test.ts`, `apps/web/__tests__/parser-ofx.test.ts`, `apps/web/__tests__/parser-pdf.test.ts`
- **Description:** Tests were added for T13-01, but edge cases (negative amounts, formula errors, malformed dates) may not be fully covered.
- **Fix:** Review each new test file for missing edge cases.
- **Confidence:** Medium
