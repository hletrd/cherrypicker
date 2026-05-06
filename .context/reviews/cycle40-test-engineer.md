# Test Engineering Review — CherryPicker Cycle 40

**Reviewer:** test-engineer
**Scope:** Test coverage, edge cases, parity tests, missing test paths
**Date:** 2026-05-06

---

## Summary

Two coverage gaps identified: web-side parser parity and a specific amount parsing edge case. Prior coverage gaps remain unaddressed.

| Category | Count | Severity |
|---|---|---|
| New Coverage Gaps | 2 | Low |
| Carryover | 5 | — |

---

## NEW COVERAGE GAPS

### TE-40-01: Parity Tests Only Cover Server-Side Parsers
**File:** `packages/parser/__tests__/non-spending-parity.test.ts`
**Severity:** Low | **Confidence:** Medium

The parity tests added in C39 only exercise server-side parsers (`packages/parser/src/*`). The web-side parsers in `apps/web/src/lib/parser/*.ts` have identical logic (per parity comments) but no automated verification. A regression in the web-side copy would not be caught.

**Fix:** Add web-side parity tests following the same pattern, or unify parser code to eliminate the duplication.

---

### TE-40-02: No Test for `parseAmountString` Double-Negative
**File:** `packages/parser/src/csv/shared.ts:165-183`
**Severity:** Low | **Confidence:** High

Input `(-1234)` incorrectly returns positive `1234`. No existing test covers this edge case.

**Fix:** Add a test case for `(-1234)`, `(-0)`, and `(-1234원)`.

---

## CARRYOVER

| ID | Severity | File | Description |
|----|----------|------|-------------|
| TE-37-01 | Medium | `ofx/index.ts:29-31` | No tests for OFX CCSTMTRS |
| TE-37-02 | Medium | `html.ts` | No tests for HTML forward-fill (web-side) |
| TE-37-05 | Low | `ofx/index.ts:88-115` | No tests for OFX timezone conversion |
| TE-01 | Medium | `analyzer.ts` | No tests for `toCoreCardRuleSets` adapter |
| TE-02 | Medium | `analyzer.ts` | No tests for multi-file analyze |
