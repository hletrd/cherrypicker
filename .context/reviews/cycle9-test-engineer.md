# Cycle 9 — Test Engineer

**Reviewer:** test-engineer (manual)
**Scope:** Test coverage gaps, flaky tests, TDD opportunities
**Date:** 2026-05-06

---

## Summary

All 10 test suites pass (0 failures). However, significant coverage gaps remain in the newest parser formats (JSON, OFX, HTML) and in web-side parser parity. No new test regressions found.

---

## Verified Fixed

### T6-01 PARTIALLY FIXED: ParseError test now structural
- `packages/parser/__tests__/parse-error.test.ts` — verifies ParseError class exists but still does not verify behavioral usage by parsers

### T-TE-03 FIXED: CLI integration tests
- `tools/cli/__tests__/commands.test.ts` — covers validation and consent

---

## Still Open Findings

### T6-02 [HIGH] No parity tests between server-side and web-side parsers

**Files:** `packages/parser/src/` vs `apps/web/src/lib/parser/`
**Confidence:** High

With 7 parser formats (CSV, XLSX, PDF, JSON, OFX, HTML) implemented on both sides, there are 14 parser implementations. Zero automated tests compare their outputs for identical inputs.

This is the root cause of why parity bugs (web-side Math.abs, missing forward-fill, missing CCSTMTRS) recur every cycle.

**Fix:** Create `packages/parser/__tests__/parity/` with shared fixtures that run through both server-side and web-side parsers.

---

### T6-03 [MEDIUM] No tests for JSON parser negative amount handling

**File:** `packages/parser/src/json/index.ts:112-114`
**Confidence:** High

The JSON parser preserves negative amounts (intentionally — they are filtered by the optimizer). But there are no tests verifying this behavior. A test with `{ "amount": -50000 }` would document the expected behavior.

**Fix:** Add tests for negative amounts, zero amounts, and large values in `json.test.ts`.

---

### C8-07 [MEDIUM] No web-side parser-level tests for negative amounts

**File:** `apps/web/src/lib/parser/*.ts`
**Confidence:** High

While the web-side negative amount fixes (C8-01) were verified by code inspection, there are no automated tests ensuring they don't regress.

**Fix:** Add web-side parser tests or include web parsers in parity tests.

---

### C9-TE-01 [MEDIUM] No tests for OFX credit card statements (CCSTMTRS)

**File:** `packages/parser/__tests__/`
**Confidence:** High

The OFX parser supports credit card statements (`<CCSTMTRS>`) as of C99, but no test fixtures use this format. The SGML terminator patterns for CCSTMTRS are untested.

**Fix:** Add OFX test fixture with `<CCSTMTRS>/<CREDITCARDMSGSRSV1>` wrapper.

---

### C9-TE-02 [MEDIUM] No tests for HTML forward-fill with merged cells

**File:** `packages/parser/__tests__/`
**Confidence:** High

The HTML parser forward-fill logic (C99-02/C100-01) is not covered by tests. No test verifies that empty cells in merged rows inherit values from previous rows.

**Fix:** Add HTML test fixture with merged cells spanning multiple rows.

---

## Verdict

**PRIORITIZE:** T6-02 (parity tests) — highest impact for preventing regressions
**ADD:** C9-TE-01, C9-TE-02 (new format coverage)
