# Cycle 30 Debugger Review

## Findings

### HIGH-01: parseAmount accepts invalid decimal strings
- **Status:** FIXED in commits e6c98a2 / 2465404
- **Verification:** `apps/web/src/lib/parser/amount.ts:40-42` now has dotCount validation. Tests pass.

### MED-01: JSON boolean amount silently ignored
- **File:** `apps/web/src/lib/parser/json.ts:67-76`, `packages/parser/src/json/index.ts:79-88`
- **Severity:** MEDIUM
- **Confidence:** High
- **Issue:** When a JSON export has `amount: true`, `normalizeAmount` returns `null` with no error. The transaction is silently dropped. This is a data quality issue — a boolean amount is almost certainly a bug in the export data, and the user should be informed.
- **Concrete scenario:** A banking API export incorrectly serializes null amounts as `true` (observed in some systems). The user uploads the file and sees fewer transactions than expected with no error message.
- **Fix:** Add error reporting for unexpected types in `normalizeAmount`.
- **Cross-reference:** C29-debugger-MEDIUM-02, Plan 53 Task 6

### MED-02: Missing empty-string guard after parseAmountString
- **File:** `apps/web/src/lib/parser/html.ts:238-245`
- **Severity:** MEDIUM
- **Confidence:** Medium
- **Issue:** After calling `parseAmountString(amountRaw)`, the code checks `if (amount === null)` and pushes an error if `amountRaw` is truthy. But if `amountRaw` is an empty string after forward-fill, no error is pushed and the row is silently skipped. This is correct behavior for genuinely empty cells but could mask data quality issues.
- **Fix:** Add a debug-level log or comment explaining the empty-string skip behavior.

### LOW-01: parseInt without Number.isFinite guard for installments
- **File:** `apps/web/src/lib/parser/html.ts:259`
- **Severity:** LOW
- **Confidence:** Medium
- **Issue:** `parseInt(installRaw, 10)` on line 259 could produce unexpected results for non-standard inputs. For example, `parseInt("1e5", 10)` returns `1` (not `100000`). While the subsequent `!Number.isNaN(inst) && inst > 1` check filters this out, it's a subtle pitfall.
- **Fix:** Add a comment or use `Number(installRaw)` instead, with explicit integer validation.
- **Cross-reference:** Similar issue was fixed in FileDropzone.svelte (C4-12 / Plan 09 Task 1)

### LOW-02: Numeric literal precision warning in tests
- **File:** `apps/web/__tests__/amount.test.ts:104-105`
- **Severity:** LOW
- **Confidence:** High
- **Issue:** TypeScript warns (TS80008): "Numeric literals with absolute values equal to 2^53 or greater are too large to be represented accurately as integers." The test uses `9999999999999999` which exceeds `Number.MAX_SAFE_INTEGER` (9007199999999999). The runtime comparison may produce false positives on some JS engines.
- **Fix:** Use a smaller test value within safe integer range, or add an explicit test that validates `Number.isSafeInteger()` behavior.
