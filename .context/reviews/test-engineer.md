# Test Engineer — cherrypicker (Cycle 20)

**Reviewer:** test-engineer
**Scope:** Test coverage, gaps, regression risks
**Date:** 2026-05-05

---

## Summary

Server-side parser tests are comprehensive. Web-side parser tests remain sparse. Cycle 20 review identifies specific gaps in OFX amount normalization, HTML summary row handling, and regex edge cases.

---

## New Findings

### [C20-TEST01-MEDIUM] No server-side test for OFX full-width amounts

**Files:** `packages/parser/__tests__/ofx.test.ts`
**Confidence:** High

The server-side OFX parser uses minimal `parseOFXAmount` (just strip commas + parseFloat). There are no tests verifying behavior with full-width digits, Won signs, or 마이너스 prefix. If the parser is updated to use `parseAmountString` (recommended by C20-01), tests must cover these formats.

**Fix:** Add test cases for `<TRNAMT>-１，２３４</TRNAMT>`, `<TRNAMT>마이너스1,234</TRNAMT>`, `<TRNAMT>￦1,234</TRNAMT>`.

---

### [C20-TEST02-LOW] No test for OFX extractTag with metacharacter tags

**Files:** `packages/parser/__tests__/ofx.test.ts`
**Confidence:** Medium

No test verifies behavior when OFX content contains tags with regex metacharacters (e.g., `<NAME+>`, `<MEMO.>`). A test would reveal the SyntaxError risk identified in C20-DB02.

**Fix:** Add a defensive test: parse OFX with `<NAME+>STARBUCKS</NAME+>` and verify graceful handling (either extraction or error).

---

### [C20-TEST03-LOW] No test for HTML summary row forward-fill

**Files:** `apps/web/__tests__/`, `packages/parser/__tests__/`
**Confidence:** Medium

No test verifies that summary row amounts are NOT forward-filled to subsequent merged cells. A test with a table containing header → summary row → merged data rows would reveal the C20-DB03 bug.

**Fix:** Add HTML test fixture with subtotal row immediately after header.

---

## Carry-overs

| ID | Severity | Description |
|---|---|---|
| T6-02 | HIGH | No parity tests between server-side and web-side parsers |
| T13-01 | MEDIUM | No web-side tests for HTML, OFX, JSON parsers |

---

## Verdict

**FIX AND SHIP** — C20-TEST01 is the most actionable; it also validates the C20-01 fix.
