# Test Engineer — cherrypicker (Cycle 24)

**Reviewer:** test-engineer
**Scope:** Test coverage gaps, flaky tests, TDD opportunities
**Date:** 2026-05-06

---

## Summary

Cycle 23 added HTML sanitization tests. Cycle 24 finds 2 new test gaps.

---

## New Findings

### [C24-TEST01-LOW] No test for event handler with spaces around equals sign

**Files:** `apps/web/__tests__/parser-html.test.ts`
**Confidence:** High

The C23-SEC01 fix added tests for quoted and unquoted event handlers, but no test covers the whitespace-variant: `onclick = "alert(1)"`. This gap allowed C24-SEC01 to go undetected.

**Fix:** Add test case: `expect(normalizeHTML('<div onclick = "alert(1)">')).not.toContain('onclick')`.

---

### [C24-TEST02-LOW] No test for store totalTransactionCount consistency after truncation

**Files:** `apps/web/__tests__/` (none cover this)
**Confidence:** Medium

C22-DEBUG01 fixed `totalTransactionCount` to 0 on truncation, but there is no automated test verifying that `loadFromStorage` returns consistent `transactionCount` and `totalTransactionCount` when `_truncatedTxCount` is present.

**Fix:** Add unit test for `persistToStorage` + `loadFromStorage` round-trip with oversized data.

---

## Verified Fixed

| Finding | Status | Evidence |
|---------|--------|----------|
| C22-TEST01: HTML sanitization tests | FIXED | 7 tests added covering script/style/iframe/event handlers |
| C23-TEST01: Event handlers with spaces | FIXED | Tests added for quoted event handlers |

---

## Carry-overs

- C22-TEST02: SessionStorage truncation path (LOW) — still deferred
- T6-02: No parity tests between server and web parsers (HIGH) — unchanged
