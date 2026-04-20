# Cycle 68 Implementation Plan

## Actionable Fixes (scheduled for implementation this cycle)

### Task 1: Fix server-side PDF `isValidShortDate` parity bug (C68-01)
**Priority:** HIGH (parity bug between server and web parsers)
**Files:** `packages/parser/src/pdf/index.ts:24-31`
**Status:** PENDING

**Problem:** The server-side PDF `isValidShortDate()` uses `day <= 31` while the web-side was upgraded to use `MAX_DAYS_PER_MONTH` in cycle 65 (C65-01). This is a parity bug that can cause different row-identification behavior between server and web PDF parsing.

**Current code (server):**
```ts
function isValidShortDate(cell: string): boolean {
  const match = cell.match(SHORT_MD_DATE_PATTERN);
  if (!match) return false;
  const parts = cell.split(/[.\-\/]/);
  const month = parseInt(parts[0] ?? '', 10);
  const day = parseInt(parts[1] ?? '', 10);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}
```

**Target code (matching web-side):**
```ts
const MAX_DAYS_PER_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isValidShortDate(cell: string): boolean {
  const match = cell.match(SHORT_MD_DATE_PATTERN);
  if (!match) return false;
  const parts = cell.split(/[.\-\/]/);
  const month = parseInt(parts[0] ?? '', 10);
  const day = parseInt(parts[1] ?? '', 10);
  return month >= 1 && month <= 12 && day >= 1 && day <= (MAX_DAYS_PER_MONTH[month] ?? 0);
}
```

**Steps:**
1. [ ] Add `MAX_DAYS_PER_MONTH` constant before `isValidShortDate` (matching `apps/web/src/lib/parser/pdf.ts:32`)
2. [ ] Replace `day <= 31` with `day <= (MAX_DAYS_PER_MONTH[month] ?? 0)` at line 30
3. [ ] Update comment to mention month-aware validation and C68-01
4. [ ] Run `bun test` to verify no regressions
5. [ ] Commit: `fix(parser): 🐛 align server-side PDF isValidShortDate with month-aware day validation`

### Task 2: Reduce greedy optimizer temp array allocations (C68-02)
**Priority:** MEDIUM (LOW severity but straightforward fix that eliminates O(m*n) allocations)
**Files:** `packages/core/src/optimizer/greedy.ts:133`
**Status:** PENDING

**Problem:** `scoreCardsForTransaction()` creates a new spread array `[...currentTransactions, transaction]` for every card on every transaction. This produces O(m*n) temporary array allocations, each copying the card's current transaction list.

**Current code:**
```ts
const before = calculateCardOutput(currentTransactions, previousMonthSpending, rule).totalReward;
const after = calculateCardOutput([...currentTransactions, transaction], previousMonthSpending, rule).totalReward;
```

**Target code (push/pop pattern):**
```ts
const before = calculateCardOutput(currentTransactions, previousMonthSpending, rule).totalReward;
currentTransactions.push(transaction);
const after = calculateCardOutput(currentTransactions, previousMonthSpending, rule).totalReward;
currentTransactions.pop();
```

This is safe because:
1. `calculateCardOutput` only reads the array (it calls `calculateRewards` which iterates transactions)
2. `currentTransactions` is the array reference stored in `assignedTransactionsByCard`
3. After computing `after`, we pop the transaction so the map state is unchanged
4. The `before` computation happens first, so the array is in its original state

**Steps:**
1. [ ] Replace `[...currentTransactions, transaction]` with push/pop pattern
2. [ ] Add comment explaining the push/pop in-place pattern vs spread copy
3. [ ] Run `vitest` and `bun test` to verify no regressions
4. [ ] Commit: `perf(optimizer): ⚡ replace spread copy with push/pop in scoreCardsForTransaction`

---

## Deferred Items (not scheduled for implementation this cycle)

All new findings from the review are either scheduled above or explicitly deferred here:

| Finding | Reason for deferral |
|---|---|
| C67-01 (greedy optimizer O(m*n*k)) | Same class as D-09/D-51/D-86. 12+ cycles have deferred. With 683 cards and <1000 transactions, latency is acceptable. Exit criterion: when optimization latency exceeds 5s or card count exceeds 5000. |
| C67-02 (inferYear timezone-dependent) | Same class as C8-08/D-49. 60 cycles have deferred. Narrow edge case (minutes around midnight, once per year). Exit criterion: when tests become flaky due to date-dependent parsing. |
| C67-03 (CATEGORY_NAMES_KO hardcoded) | Same class as C64-03. TODO comment already acknowledges. CLI path only; web path uses live taxonomy. Exit criterion: when new categories are added without updating the map. |

---

## Archived Plans (fully implemented and done)

All prior cycle plans through cycle 67 are archived (see their respective plan files). This cycle's plan focuses only on the actionable fixes above.
