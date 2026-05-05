# Test Engineering Review — cherrypicker (Cycle 19)

**Reviewer:** test-engineer
**Scope:** Coverage gaps, flaky tests, TDD opportunities, test quality
**Date:** 2026-05-06

---

## Summary

Cycle 18 added web-side ParseError tests and fixed the vacuous parse-error structural test. Cycle 19 review finds test gaps in the new parser formats (JSON, OFX, HTML) and missing parity tests between server and web implementations.

---

## New Findings

### C19-TEST01 [MEDIUM] — No parity tests between server and web parsers for new formats

**File:** `packages/parser/__tests__/` vs `apps/web/__tests__/`
**Confidence:** High

JSON, OFX, and HTML parsers exist in both `packages/parser/src/` and `apps/web/src/lib/parser/`. The test suites for these formats only cover one side:
- `packages/parser/__tests__/json.test.ts` — server JSON parser
- `packages/parser/__tests__/ofx.test.ts` — server OFX parser
- `packages/parser/__tests__/html.test.ts` — server HTML parser
- `apps/web/__tests__/parser-json.test.ts` — web JSON parser
- `apps/web/__tests__/parser-ofx.test.ts` — web OFX parser
- `apps/web/__tests__/parser-html.test.ts` — web HTML parser

But there are no cross-side parity tests that verify both parsers produce identical output for the same input. The code is maintained as "parity" copies (comments cite C97-01, C98-01, C100-01) but without automated verification, drift is inevitable.

**Fix:** Add a parity test suite that feeds identical fixtures to both parsers and asserts matching `ParseResult` structures.

---

### C19-TEST02 [LOW] — HTML forward-fill with summary row contamination untested

**File:** `apps/web/__tests__/parser-html.test.ts` / `packages/parser/__tests__/html.test.ts`
**Confidence:** Medium

The forward-fill logic in both HTML parsers skips summary rows when updating `last*` variables:
```ts
if (!isSummaryRow(String(rawDateValue))) {
  lastDate = rawDateValue;
}
```

But if a summary row appears between two data rows, the forward-fill should NOT propagate the summary value. No test verifies this edge case.

**Fix:** Add a test fixture with a summary row (e.g., "소계", "합계") between data rows and assert the second row gets the first row's value, not the summary row's.

---

### C19-TEST03 [LOW] — OFX credit card statement (CCSTMTRS) parsing untested

**File:** `packages/parser/__tests__/ofx.test.ts`
**Confidence:** Medium

The OFX parser supports credit card statements (`CCSTMTRS` wrapper, `CREDITCARDMSGSRSV1`) per the code comments (C99-03, C100-03), but the test suite may only cover bank statements (`STMTRS`). Without a CCSTMTRS fixture, the SGML terminator pattern `</CCSTMTRS` is not exercised.

**Fix:** Add a CCSTMTRS test fixture with sample credit card transactions.

---

### C19-TEST04 [LOW] — `isOptimizableTx` negative amount behavior untested

**File:** `apps/web/__tests__/tx-validation.test.ts`
**Confidence:** Low

The `isOptimizableTx` function allows negative amounts (line 17: `obj.amount !== 0`). Tests should verify that transactions with `amount: -5000` pass validation (they are displayable) while `amount: 0` fails.

**Fix:** Add test cases for negative and zero amounts.

---

## Carry-overs from Previous Cycles

- **T6-02** — No parity tests between server and web parsers (HIGH, now more urgent with 3 new formats)

---

## Verdict

**FIX AND SHIP** — C19-TEST01 is the highest priority; parity drift across 6 parser files is a maintenance time bomb.
