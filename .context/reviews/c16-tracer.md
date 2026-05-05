# Cycle 16 — Tracer Review

**Date:** 2026-05-06
**Scope:** Causal tracing of data flows

## Findings

### C16-TR01 [MEDIUM] — Refund transactions are lost in the persistence-restore flow
- **Flow:** Parser (CSV/JSON/etc.) → `parseFile` → `analyzeMultipleFiles` → `result.transactions` → `persistToStorage` → sessionStorage → `loadFromStorage` → `isOptimizableTx` → filtered transactions
- **Issue:** The parsers correctly produce negative-amount transactions. `analyzeMultipleFiles` passes them through. `persistToStorage` serializes them. But `loadFromStorage` calls `isOptimizableTx` which filters them out at line 278-279.
- **Root cause:** The persistence layer conflates "optimizable" (for the optimizer) with "displayable" (for the UI). Refunds are not optimizable but they ARE displayable.
- **Fix:** Separate the concepts: persist ALL transactions, filter for optimization only in the optimizer, display all valid transactions.
- **Confidence:** High

### C16-TR02 [LOW] — `previousMonthSpending` calculation excludes refunds
- **Flow:** Category edit → `reoptimize` → monthlySpending Map → `previousMonthSpending` → optimizer → performance tier selection
- **Issue:** `reoptimize` at line 519 filters `tx.amount > 0` when building monthlySpending. Refunds reduce gross spending but are excluded.
- **Impact:** Users with refunds get a lower previousMonthSpending, potentially qualifying for a worse performance tier than they should.
- **Fix:** Include refunds in monthlySpending or document the net-spending behavior explicitly.
- **Confidence:** Medium

## Summary
One MEDIUM flow break (refund loss on restore) and one LOW flow issue (refund exclusion in spending calculation).
