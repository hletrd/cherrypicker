# Cycle 25 — Code Reviewer (2026-05-06)

## Finding 1: Server HTML parser missing forward-fill reset on summary rows [C25-COR01] — MEDIUM

**File:** `packages/parser/src/html/index.ts:156`
**Line:** 156: `if (isSummaryRow(rowText)) continue;`

The server-side HTML parser skips summary rows but does NOT reset the forward-fill state variables (`lastDate`, `lastMerchant`, `lastCategory`, `lastInstallments`, `lastMemo`, `lastAmount`). The web-side parser at `apps/web/src/lib/parser/html.ts:163-173` correctly resets all six variables before `continue`.

This means if a summary row appears between two data rows with merged cells, the summary row's values could forward-fill into subsequent data rows. For example:
- Row 1: date=2024-01-15, merchant=Starbucks, amount=5000
- Row 2: (summary) date=, merchant=합계, amount=999999  
- Row 3: (merged) date=, merchant=, amount=12000

On the web parser, Row 3 gets no forward-fill for merchant (reset to ''). On the server parser, Row 3 would get merchant='합계'.

**Fix:** Add the same reset block before `continue` in `packages/parser/src/html/index.ts:156`.

## Finding 2: reoptimize() rebuilds result without updating counts/periods [C25-COR02] — MEDIUM

**File:** `apps/web/src/lib/store.svelte.ts:570-575`

The `reoptimize()` method rebuilds `result` from `snapshot` with new `transactions`, `optimization`, and `monthlyBreakdown`, but does NOT recompute:
- `transactionCount` — should be `editedTransactions.length`
- `totalTransactionCount` — if transactions were added/removed during editing, this is stale
- `statementPeriod` — could change if date range of edited transactions changed
- `fullStatementPeriod` — same

The getters fall back gracefully (`totalTransactionCount ?? transactionCount ?? 0`), but the stored values are misleading if the user added/removed transactions.

**Fix:** Recompute these four fields from `editedTransactions` before assigning to `result`.

## Finding 3: Web normalizeHTML unquoted regex still missing whitespace [C25-SEC01] — LOW

**File:** `apps/web/src/lib/parser/html.ts:43`
**Current:** `.replace(/\son\w+=[^>\s]*/gi, '')`
**Server parity:** `packages/parser/src/csv/shared.ts:192` uses `.replace(/\son\w+\s*=\s*[^>\s]*/gi, '')`

The unquoted event handler regex lacks `\s*` around `=`. An attribute like `onclick = alert(1)` (with spaces, no quotes) would NOT be stripped on the web but WOULD be stripped on the server. C24 claimed to fix this but only fixed the quoted pattern at line 42.

**Fix:** Add `\s*` around `=` in the unquoted pattern: `/\son\w+\s*=\s*[^>\s]*/gi`.

## Finding 4: Greedy optimizer recalculates card outputs twice per transaction [C25-PERF01] — LOW

**File:** `packages/core/src/optimizer/greedy.ts:51-52`

`scoreCardsForTransaction` calls `calculateCardOutput` twice per card per transaction:
```typescript
const before = calculateCardOutput(currentTransactions, previousMonthSpending, rule).totalReward;
const after = calculateCardOutput([...currentTransactions, transaction], previousMonthSpending, rule).totalReward;
```

This is O(cards * transactions) with double compute. For 10 cards and 1000 transactions, that's 20,000 full reward calculations.

**Fix:** Not a simple fix — requires incremental reward computation or caching. Mark as deferred optimization.
