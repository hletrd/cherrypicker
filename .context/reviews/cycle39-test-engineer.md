# Test Engineering Review — CherryPicker Cycle 39

**Reviewer:** test-engineer (manual, Agent tool unavailable)
**Date:** 2026-05-06
**Cycle:** 39 / 100
**HEAD:** d265c46

---

## Findings

### TE-39-01 — Medium — No tests for web-side HTML parser forward-fill

**File:** `apps/web/src/lib/parser/html.ts`

The web-side HTML parser includes forward-fill logic for merged cells (lines 152-158, 196-248). This logic was added in cycle 38/39 for parity with the server-side parser. The server-side HTML parser in `packages/parser/src/html/index.ts` has tests, but there are no corresponding tests for the web-side implementation.

**Risk:** The web-side implementation uses `TextEncoder` and `xlsx.read({ type: 'array' })` instead of `Buffer` and `xlsx.read({ type: 'buffer' })`. These API differences could cause subtle behavioral differences in how merged cells are handled.

**Fix:** Add web-side HTML parser tests covering:
- Forward-fill across merged cells
- Blank row reset behavior
- Summary row filtering
- Non-spending amount ParseError emission

**Confidence:** High

---

### TE-39-02 — Medium — No parity tests for all parsers' non-spending amount handling

**File:** Various parser test files

Cycle 38 added ParseError emission for non-spending amounts (<= 0) across all parsers. However, there is no centralized test that verifies ALL parsers (CSV, XLSX, HTML, JSON, OFX, PDF) behave consistently when encountering:
- Zero amounts
- Negative amounts
- Refunds/credits

**Risk:** Parser inconsistency could resurface if one parser is modified without updating others.

**Fix:** Create a parameterized test that runs the same input through all parsers and verifies identical error behavior.

**Confidence:** High

---

### TE-39-03 — Low — JSON parser case-insensitive field matching untested

**File:** `packages/parser/src/json/index.ts:75-79`

The case-insensitive fallback in `findField` was added to fix C32-V09 (non-deterministic field matching). There are no explicit tests verifying that:
- `"Amount"` matches when `AMOUNT_ALIASES` contains `"amount"`
- The FIRST alias in priority order wins when multiple case-insensitive matches exist

**Fix:** Add tests for mixed-case field names and priority ordering.

**Confidence:** Medium

---

## Carryover Status

| ID | Status | Notes |
|----|--------|-------|
| TE-37-01 | OPEN | No tests for OFX CCSTMTRS (credit card) parsing |
| TE-37-02 | OPEN | No tests for HTML forward-fill logic (server-side has some; web-side has none) |
| TE-37-03 | FIXED | JSON negative amount handling tested via ParseError behavior |
| TE-37-04 | OPEN | No parity tests for HTML/OFX/JSON across server/web |
| TE-37-05 | OPEN | No tests for OFX timezone conversion |
