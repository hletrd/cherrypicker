# Performance Reviewer — Cycle 2 Deep Review (2026-04-24)

Reviewed all source files for CPU, memory, and responsiveness concerns.

## New Findings

### C2-P01: `scoreCardsForTransaction` creates `new Map()` in `buildConstraints` for every card on every transaction
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `packages/core/src/optimizer/greedy.ts:275-277` and `packages/core/src/optimizer/constraints.ts`
- **Description:** `greedyOptimize` creates a `cardPreviousSpending` Map from `constraints.cards.map()` on every call. This is a shallow Map creation from an array — O(n) where n is the number of cards. Then `scoreCardsForTransaction` calls `calculateCardOutput` twice per card per transaction, each of which constructs a new `CalculationInput` object. For typical usage (< 1000 transactions, < 10 cards selected for optimization), this is negligible. Previously tracked as D-09/D-51/D-86. No change in status.
- **Fix:** Defer. Only optimize if transaction count exceeds 10,000.

## No New Findings

After thorough review of all source files, no new performance findings beyond what is already tracked in the deferred items (D-09, D-51, D-86, P1-01, P8-02). The codebase's performance profile is adequate for its use case (personal finance tool, < 1000 transactions typical).

The cycle 1 fixes (C1-02 — limiting `detectCSVDelimiter` to 30 lines) were verified as correctly implemented in both `packages/parser/src/detect.ts:151` and `apps/web/src/lib/parser/detect.ts:175`.
