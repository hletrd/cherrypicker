# Cycle 31 Test Engineering Review

**Scope:** Test coverage for new parser formats (HTML, OFX, JSON), web/server parity tests, and gap analysis.

---

## New Findings

### C31-TEST01 | MEDIUM | High | `apps/web/__tests__/parser-html.test.ts` and `packages/parser/__tests__/html.test.ts`

**HTML parser forward-fill logic has limited test coverage for edge cases**

The forward-fill tests likely cover basic merged cells, but there are no tests for:
- Blank rows between data sections (forward-fill state should ideally reset)
- Summary rows with empty cells followed by data rows with empty cells
- Multiple sheets in one HTML file with different header positions
- Malformed HTML with unclosed quotes in event handlers

**Fix:** Add test cases for multi-sheet HTML, blank row handling, and malformed HTML resilience.

### C31-TEST02 | MEDIUM | High | `apps/web/__tests__/parser-json.test.ts` and `packages/parser/__tests__/json.test.ts`

**JSON parser lacks tests for case-insensitive field matching**

The `findField` function supports case-insensitive matching, but there are no tests verifying that `TransactionDate`, `TRANSACTIONDATE`, and `transaction_date` all resolve correctly. This is a core feature of the JSON parser.

**Fix:** Add test cases for case-variant field names (e.g., `TransactionDate`, `TRANSACTION_DATE`).

### C31-TEST03 | LOW | Medium | `packages/parser/__tests__/ofx.test.ts`

**OFX parser timezone conversion is not tested**

The `parseOFXDate` function handles timezone offsets (e.g., `20240115120000[-5:EST]`), but there are likely no tests verifying that cross-midnight offsets produce the correct KST date. This is the most complex part of the OFX parser and the easiest to regress.

**Fix:** Add test cases for timezone conversion, especially cross-midnight scenarios (e.g., UTC-5 23:00 should become KST next day).

### C31-TEST04 | LOW | Medium | `apps/web/__tests__/parser-ofx.test.ts` and `packages/parser/__tests__/ofx.test.ts`

**OFX credit card statement (CCSTMTRS) parsing not explicitly tested**

The parser supports credit card OFX files (C99-03), but test coverage for the CCSTMTRS path versus STMTRS may be thin. The SGML terminator patterns differ slightly.

**Fix:** Add test cases with `<CCSTMTRS>` and `<CREDITCARDMSGSRSV1>` wrappers.

---

## Prior Open Findings Verified

| Finding | Status | Evidence |
|---|---|---|
| D-36 | OPEN (MEDIUM) | Web-side XLSX parser still lacks dedicated unit tests |
| D-37 | OPEN (MEDIUM) | E2E tests still use `waitForTimeout` in some places |
| C28-04 | FIXED | parseAmount tests added for web and server parity |
| C28-05 | FIXED | normalizeHTML javascript: URL tests added |

---

## Final Sweep

1. All 11 bun test suites passing
2. 243 vitest tests passing (web-side)
3. No test files use `fit` or `fdescribe` (focused tests)
4. No `console.log` left in test files
5. Test data fixtures are realistic (Korean bank statement samples)
