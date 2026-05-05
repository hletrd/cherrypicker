# Cycle 7 Test Engineering Review

**Date:** 2026-05-05
**Scope:** Test coverage gaps post-Cycle-6
**Reviewer:** test-engineer

---

## Summary

All 10 test suites pass (0 failures). However, T6-03 from Cycle 6 remains unaddressed, and new parity test gaps have emerged from the Cycle 6 fixes.

---

## MEDIUM

### T7-TE-01: No tests for JSON negative amount preservation

**File:** `packages/parser/__tests__/json.test.ts`
**Confidence:** High

T6-03 (Cycle 6) remains open. The server-side JSON parser now preserves negative amounts (commit `fcd398b`), but no test verifies this. The only protection is code review — a future refactor could regress this silently.

**Fix:** Add test:
```ts
const result = parseJSON(JSON.stringify([{ date: '2024-01-15', merchant: 'Refund', amount: -15000 }]));
expect(result.transactions[0].amount).toBe(-15000);
```

### T7-TE-02: No parity tests for web-side JSON negative amounts

**File:** `apps/web/src/lib/parser/json.ts`
**Confidence:** High

The web-side JSON parser still takes `Math.abs()` (C7-CR-01). Even after fixing, there are no automated parity tests that verify server and web parsers produce identical outputs for the same inputs.

**Fix:** Add a shared parity test suite that runs the same inputs through both server and web parsers and asserts equality.

### T7-TE-03: No tests for web-side HTML amount handling

**File:** `apps/web/src/lib/parser/html.ts`
**Confidence:** Medium

The web-side HTML parser converts negative amounts to positive via `Math.abs()` (C7-CR-02). No test covers this behavior.

### T7-TE-04: Path validation tests don't cover symlink without mustExist

**File:** `tools/cli/__tests__/commands.test.ts`
**Confidence:** Low

Existing tests cover symlink rejection when `mustExist: true`. No test verifies behavior when `mustExist: false` and path is a symlink.

---

## LOW

### T7-TE-05: `parse-error.test.ts` may still be vacuous

**File:** `packages/parser/__tests__/parse-error.test.ts`
**Confidence:** Low

T6-01 from Cycle 6 noted the ParseError test was vacuous. After the class refactor (commit `c55005d`), tests should verify `instanceof ParseError`, `instanceof Error`, and property population. Need to verify test quality.

---

## Verified

| Suite | Tests | Status |
|-------|-------|--------|
| `@cherrypicker/cli:test` | 17 pass | Green |
| All packages | 10 suites | Green (cached) |
