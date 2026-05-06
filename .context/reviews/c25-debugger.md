# Cycle 25 — Debugger (2026-05-06)

## Finding 1: Server HTML parser forward-fill state not reset on summary rows [C25-COR01] — MEDIUM

**File:** `packages/parser/src/html/index.ts:156`

When a summary row is detected, the server parser executes `continue` without resetting forward-fill state. This is a behavioral difference from the web parser which resets all six `last*` variables.

**Reproduction scenario:**
1. Parse an HTML table with merged cells where a summary row sits between two data groups
2. The summary row's text (e.g., "합계") is skipped by `isSummaryRow(rowText)` at line 156
3. The per-cell forward-fill guards (lines 166-169, 175-178, etc.) prevent individual summary cells from updating `last*` values
4. BUT if the summary row has EMPTY cells in merged columns, those empty cells will use the LAST `last*` value (which may be from the PREVIOUS data group)
5. Crucially, if a subsequent data row also has empty merged cells, it will forward-fill from the same `last*` values — but these are the values from BEFORE the summary row, not after

Wait — actually the web parser's reset is MORE important. Consider:
- Data row A: merchant=Starbucks
- Summary row: merchant=합계 (skipped at row level)
- Data row B: merchant= (empty, should forward-fill)

Without reset, `lastMerchant` still = "Starbucks" from row A, so row B gets "Starbucks". That's actually CORRECT behavior.

But consider:
- Data row A: merchant=Starbucks
- Summary row: merchant=합계 (row-level skip, no reset)
- Data row B has an EXPLICIT merchant=Different
- Data row C: merchant= (empty, forward-fill)

With reset: row C gets "Different". Without reset: row C ALSO gets "Different" (because row B updated `lastMerchant`).

The reset matters when the summary row has NO merged cells but a subsequent row has empty cells that should NOT forward-fill past the summary boundary. Actually, the real bug is more subtle:

Consider a table where the summary row itself has non-empty cells that pass the per-cell `isSummaryRow` guard (because individual cells like "2024-01-15" aren't summary text), but the ROW as a whole is a summary. Without reset, those non-summary cells in the summary row update `last*` values, which then forward-fill into subsequent data rows.

**Fix:** Reset all six `last*` variables before `continue` at line 156.

## Finding 2: reoptimize() stale metadata [C25-COR02] — MEDIUM

**File:** `apps/web/src/lib/store.svelte.ts:570-575`

The `result` object rebuilt in `reoptimize()` inherits `transactionCount`, `totalTransactionCount`, `statementPeriod`, and `fullStatementPeriod` from `snapshot` (the pre-edit state). If the user added or removed transactions during editing, these fields are stale.

This could cause UI display issues where `transactionCount` shows N but the actual transaction list has M items.

**Fix:** Recompute these fields from `editedTransactions` before building the new result.
