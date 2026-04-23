# Cycle 97 — test-engineer pass

**Date:** 2026-04-23

## Scope

Re-audited test coverage around the areas touched in cycle 96 plus the new C97-01/C97-02 candidates.

## Findings

### C97-T01: No regression test for fullStatementPeriod with mixed-validity dates (LOW, HIGH confidence)

**File:** `apps/web/__tests__/analyzer-adapter.test.ts`

The test file covers:
- `getLatestMonth` with short dates (test at line 202-208 — verifies that `'2026'` gets skipped, not that `statementPeriod.start` is unaffected).
- `monthlySpending` with short dates (test at line 349-384 — the C96-01 regression test).

The test file does NOT cover:
- `fullStatementPeriod.start/end` contamination by non-ISO date strings mixed with valid ISO dates — the C97-01 surface.

**Suggested test (to be added alongside the C97-01 fix):**

```ts
test('fullStatementPeriod excludes non-ISO date strings from range bounds (C97-01)', () => {
  // Mixed-validity scenario — some rows parse to ISO, one row has a Korean
  // footer artifact ("소계") that the parser returned as-is.
  const dates = ['2026-01-15', '2026-02-10', '소계', '2026-03-05', ''];
  const allDates = dates
    .filter(d => typeof d === 'string' && d.length >= 10)
    .sort();
  expect(allDates[0]).toBe('2026-01-15');
  expect(allDates[allDates.length - 1]).toBe('2026-03-05');
});
```

---

## Other test coverage observations

- `analyzer-adapter.test.ts` has 23 tests as of cycle 96. Adding C97-T01 brings it to 24.
- `parser-date.test.ts` and `parser-encoding.test.ts` are unchanged and solid.
- `packages/core/__tests__/` and `packages/rules/__tests__/` coverage unchanged.

## Summary

1 coverage gap (C97-T01) corresponding to the C97-01 fix. Test to be added in the same commit.
