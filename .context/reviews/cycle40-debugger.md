# Debugger Review — CherryPicker Cycle 40

**Reviewer:** debugger
**Scope:** Logic bugs, edge cases, failure modes, data-flow issues
**Date:** 2026-05-06

---

## Summary

Two new edge-case bugs identified in cycle 40. One is a data-validation gap that allows NaN to persist to sessionStorage and crash reoptimize. The other is a parsing edge case with double-negative accounting notation.

| Category | Count | Severity |
|---|---|---|
| New Findings | 2 | 1 Medium, 1 Low |
| Carryover | 3 | — |

---

## NEW FINDINGS

### BUG-40-01: NaN Persists to sessionStorage via `previousMonthSpendingOption`
**File:** `apps/web/src/lib/store.svelte.ts:347`, `apps/web/src/lib/store.svelte.ts:490-492`
**Severity:** Medium | **Confidence:** High

**Trace:**
```
analyze() → store previousMonthSpendingOption = NaN → persistToStorage() → sessionStorage
loadFromStorage() → typeof NaN === 'number' → passes validation
reoptimize() → snapshot.previousMonthSpendingOption = NaN
optimizeFromTransactions() → Number.isFinite(NaN) = false → throws Error
```

**Evidence:**
- `loadFromStorage:347`: `previousMonthSpendingOption: typeof parsed.previousMonthSpendingOption === 'number' ? parsed.previousMonthSpendingOption : undefined`
- `typeof NaN === 'number'` is true in JavaScript, so NaN passes through.
- `reoptimize:581-587`: `previousMonthSpending = snapshot.previousMonthSpendingOption` (no finite guard here).
- `optimizeFromTransactions:228-231`: `Number.isFinite(options.previousMonthSpending)` guard throws Error.
- The error propagates to the catch block: `error = e instanceof Error ? e.message : '재계산 중 문제가 생겼어요'`

**Concrete scenario:** User manually inputs NaN (or a corrupted sessionStorage has NaN). On next visit, editing a category triggers reoptimize, which crashes with "previousMonthSpending must be a non-negative finite number, got NaN" — a raw Error message that leaks internal implementation details.

**Fix:** Add `Number.isFinite()` validation in `loadFromStorage` and `analyze` before storing `previousMonthSpendingOption`.

---

### BUG-40-02: Double-Negative in `parseAmountString`
**File:** `packages/parser/src/csv/shared.ts:165-183`
**Severity:** Low | **Confidence:** High

Input `(-1234)` produces positive `1234` instead of negative `-1234`.

**Trace:**
```
parseAmountString("(-1234)")
  → cleaned = "(-1234)"
  → isNeg = true (parentheses)
  → cleaned = "-1234" (stripped)
  → numMatch = "-1234"
  → n = -1234
  → return isNeg ? -(-1234) : -1234 → 1234 (WRONG)
```

**Fix:** After stripping parentheses, if the inner value starts with `-`, do NOT apply the negation flip.

---

## CARRYOVER (Still Open)

| ID | Severity | File | Description |
|----|----------|------|-------------|
| BUG-3 | Medium | `store.svelte.ts` | Web-side NaN fixed, core-side fixed, but store persistence gap remains |
| BUG-4 | Medium | `xlsx.ts:99` | EUC-KR detection (partially mitigated by small-buffer threshold) |
| BUG-7 | Low | `ofx/index.ts:191` | OFX credits — ParseError now emitted (fixed in C39) |
