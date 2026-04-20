# Plan: Cycle 12 Fixes

**Date:** 2026-04-20
**Source reviews:** `.context/reviews/2026-04-20-cycle12-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Tasks

### 1. [LOW] Remove redundant Object.is(-0) guard in SavingsComparison (C12-04)

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:203`
**Problem:** The template renders `{Object.is(displayedSavings, -0) || displayedSavings >= 0 ? '+' : ''}{formatWon(displayedSavings)}`. The `Object.is(displayedSavings, -0)` check is redundant because `formatWon` already normalizes negative zero at line 8 (`if (amount === 0) amount = 0`). The `Object.is` check adds a dependency on JavaScript's negative-zero semantics that is fragile and confusing for maintainers.
**Fix:** Replace the prefix expression with `displayedSavings >= 0 ? '+' : ''` since `formatWon` handles the negative-zero normalization internally. Add a comment explaining that `formatWon` normalizes -0 to +0.
**Status:** DONE

### 2. [LOW] Lower OptimalCardMap maxRate floor from 0.005 to 0.001 for better proportional bars at low rates (C12-01)

**File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:17-25`
**Problem:** The `maxRate` derived value uses a floor of 0.005 (0.5%). When the maximum rate is between 0.1% and 0.5%, the floor makes the denominator larger than the actual max rate, causing all bars to appear wider than their actual proportion. For example, a 0.3% rate fills 60% of the bar (0.003/0.005 * 100) instead of the correct 100%.
**Fix:** Lower the floor from 0.005 to 0.001 (0.1%). This still prevents division-by-zero and invisible bars while giving more accurate proportional representation for low-rate scenarios. Update the comment to reflect the new threshold:
```ts
return computed > 0.001 ? computed : 0.001;
```
**Status:** DONE

### 3. [CARRY-OVER] Fix build-stats.ts misleading error message for malformed JSON (C3-01 / Plan c3 Task 4)

**File:** `apps/web/src/lib/build-stats.ts:25-31`
**Problem:** The `catch (err)` block now differentiates SyntaxError from other errors (partially fixed), but the non-SyntaxError path still uses a generic "cards.json not found" message. The code at lines 29-31 correctly identifies ENOENT vs EACCES vs other, but the `reason` variable only covers three cases. If the error has no `code` property, `reason` falls to 'unreadable' which is misleading.
**Fix:** This was already partially fixed in an earlier cycle. Verify the current implementation and confirm it's correct. If so, mark as DONE.
**Status:** DONE (verified -- build-stats.ts already has proper error differentiation at lines 26-31)

---

## Deferred Items (not implemented this cycle)

| Finding | Reason for deferral | Exit criterion |
|---|---|---|
| C12-02 | NOT a finding -- downgraded to observation. Existing NaN guard in SpendingSummary is correct. | N/A |
| C12-03 | NOT a new finding -- already tracked as D-109 | See D-109 |
| C8-01 | MEDIUM severity but removing dead code requires UX decision about AI categorization; deferring per D-10/D-68 | Self-hosted AI runtime implementation decision |
| C4-10 | MEDIUM severity; E2E test infrastructure change; out of scope | E2E test framework refactor |
| C4-11 | MEDIUM severity; requires new test infrastructure; out of scope | Test coverage sprint |
| D-106 | LOW severity; bare catch in tryStructuredParse is acceptable since any parsing error should result in null return | PDF parser error handling refactor |
| D-110 | LOW severity; by design -- optimization only applies to latest month | Multi-month optimization feature |
