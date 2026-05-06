# Cycle 40 High Priority Implementation Plan

**Source:** `.context/reviews/cycle40-aggregate.md`, individual cycle40 review files
**Date:** 2026-05-06
**Status:** Pending

---

## Task 1: Fix NaN persistence in sessionStorage via loadFromStorage validation

**Finding:** BUG-40-01 / CR-40-01 / SEC-40-01 / C40-CRIT01
**File:** `apps/web/src/lib/store.svelte.ts:347`, `apps/web/src/lib/store.svelte.ts:490-492`
**Severity:** Medium
**Confidence:** High

**Change:** Replace `typeof === 'number'` with `Number.isFinite()` in `loadFromStorage` for `previousMonthSpendingOption`. Add the same guard in `analyze()` before storing.

```typescript
// In loadFromStorage (around line 347):
previousMonthSpendingOption:
  typeof parsed.previousMonthSpendingOption === 'number' &&
  Number.isFinite(parsed.previousMonthSpendingOption)
    ? parsed.previousMonthSpendingOption
    : undefined,

// In analyze() (around line 490):
if (
  options?.previousMonthSpending !== undefined &&
  Number.isFinite(options.previousMonthSpending) &&
  options.previousMonthSpending >= 0
) {
  analysisResult.previousMonthSpendingOption = options.previousMonthSpending;
}
```

**Risk:** Low — adds validation, no logic change
**Tests:** Add test for NaN in sessionStorage load; verify existing tests pass
**Gate:** Run after implementation

---

## Task 2: Fix parseAmountString double-negative bug

**Finding:** BUG-40-02 / CR-40-02 / TE-40-02
**File:** `packages/parser/src/csv/shared.ts:165-183`
**Severity:** Low
**Confidence:** High

**Change:** After stripping parentheses, check if the inner value already starts with `-` and avoid double negation.

```typescript
const isNeg = (cleaned.startsWith('(') && cleaned.endsWith(')')) || isManeuners || hasTrailingMinus;
if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
  cleaned = cleaned.slice(1, -1);
  // Parentheses indicate accounting-style negatives. If the inner value
  // is already negative (e.g., "(-1234)"), don't double-negate.
  if (cleaned.startsWith('-')) {
    isNeg = false;
  }
}
```

Note: `isNeg` must use `let` instead of `const` to allow reassignment.

**Risk:** Low — fixes edge case, preserves all other behavior
**Tests:** Add tests for `(-1234)`, `(-0)`, `(-1234원)`
**Gate:** Run after implementation

---

## Deferred from Cycle 40

| ID | Severity | Reason | Exit Criterion |
|----|----------|--------|----------------|
| CR-40-03 | Low | OFX mixed-format SGML fallback is edge case, no real-world reports | Parser unification cycle |
| U-DES-40-01 | Low | Error message UX requires Korean translation convention review | UX enhancement cycle |
| TE-40-01 | Low | Web-side parity tests require test infrastructure for browser parsers | Test infrastructure cycle |
| ARCH-40-01 | Low | parseAmountString refactoring is cosmetic | Parser API refactor cycle |
| DOC-40-01 | Low | JSDoc clarification is cosmetic | Documentation cycle |
| C40-CRIT02 | Low | Cycle reference cleanup is cosmetic | Cleanup cycle |

---

## Implementation Order

1. Task 1 (NaN persistence fix) — store validation
2. Task 2 (double-negative fix) — parser edge case
3. Run gates after each task
4. Commit each task separately with semantic messages
