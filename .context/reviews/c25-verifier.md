# Cycle 25 — Verifier (2026-05-06)

## Verification Results

### C25-COR01: Server HTML parser forward-fill reset

**Confirmed.** Comparing `apps/web/src/lib/parser/html.ts:163-173` and `packages/parser/src/html/index.ts:156`:

- Web: `if (isSummaryRow(rowText)) { lastDate=''; lastMerchant=''; ...; continue; }`
- Server: `if (isSummaryRow(rowText)) continue;`

The server parser skips summary rows but leaves `last*` variables populated with the previous data row's values. Any subsequent data row with empty merged cells will forward-fill from values that crossed the summary boundary.

**Reproduced with mental model:** A table with merged cells where a summary row sits between two transaction groups would cause the second group's empty cells to forward-fill from the first group instead of being blank (or using the second group's explicit values).

### C25-COR02: reoptimize() stale metadata

**Confirmed.** At `apps/web/src/lib/store.svelte.ts:570-575`:
```typescript
result = {
  ...snapshot,
  transactions: editedTransactions,
  optimization,
  monthlyBreakdown: updatedMonthlyBreakdown,
};
```

The `...snapshot` spread preserves `transactionCount`, `totalTransactionCount`, `statementPeriod`, and `fullStatementPeriod` from the original analysis. If `editedTransactions.length !== snapshot.transactions.length`, `transactionCount` is stale.

### C25-SEC01: Unquoted regex whitespace gap

**Confirmed.** Web line 43: `/\son\w+=[^>\s]*/gi` does not match `onclick = alert(1)`.
Server line 192: `/\son\w+\s*=\s*[^>\s]*/gi` does match it.

**Test:** `"<td onclick = alert(1)>"` — web regex NO match, server regex MATCH.

### C25-PERF01: Greedy double calculation

**Confirmed.** `scoreCardsForTransaction` lines 51-52 call `calculateCardOutput` twice per card. No caching or incremental computation.

## Overall Confidence

| Finding | Confidence |
|---------|------------|
| C25-COR01 | High |
| C25-COR02 | High |
| C25-SEC01 | High |
| C25-PERF01 | High |
| C25-TEST01 | High |
| C25-TEST02 | High |
