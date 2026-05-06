# Cycle 25 — Tracer (2026-05-06)

## Trace: Server HTML parser forward-fill on summary rows

**Path:** `parseHTML(content)` -> `parseHTMLSheet(sheet, bank)` -> loop rows -> `isSummaryRow(rowText)` -> `continue`

**File:** `packages/parser/src/html/index.ts:151-256`

When a summary row is encountered at line 156:
1. `rowText` is built from all cells
2. `isSummaryRow(rowText)` returns true (matches 합계/총합계/소계/etc.)
3. Execution jumps to next iteration via `continue`
4. The six `last*` variables (lines 138-143) are NOT modified
5. Next data row with empty cells uses these unreset values

**Root cause:** The web-side fix from C20-04 (reset forward-fill state on summary rows) was never ported to the server-side HTML parser added in C98.

## Trace: reoptimize() result construction

**Path:** `reoptimize(editedTransactions, options)` -> build `updatedMonthlyBreakdown` -> compute `previousMonthSpending` -> call `optimizeFromTransactions` -> construct `result`

**File:** `apps/web/src/lib/store.svelte.ts:469-575`

At line 570-575, the new `result` is built from `snapshot` (pre-edit state) with only three fields overridden:
- `transactions: editedTransactions`
- `optimization`
- `monthlyBreakdown: updatedMonthlyBreakdown`

The `...snapshot` spread preserves:
- `transactionCount` (from original analysis)
- `totalTransactionCount` (from original analysis)
- `statementPeriod` (from original analysis)
- `fullStatementPeriod` (from original analysis)

**Root cause:** `reoptimize()` was implemented to update optimization results after category edits, but the metadata fields that depend on the transaction set were not recomputed.

## Trace: Web normalizeHTML unquoted regex

**Path:** `normalizeHTML(html)` -> line 43 -> `.replace(/\son\w+=[^>\s]*/gi, '')`

**Pattern analysis:**
- `\son\w+` matches ` onclick`, ` onerror`, etc.
- `=` matches literal equals
- `[^>\s]*` matches the attribute value (non-greedy, stops at space or >)

**Missing:** `\s*` before and after `=`.
**Input:** `<td onclick = alert(1)>value</td>`
- Regex engine: ` onclick` matched, then ` = alert(1)` — the `=` is preceded by space, so `\son\w+` consumes ` onclick`, then `=` expects literal `=` but finds ` =` (space then equals). Match fails.

**Server-side trace:** `packages/parser/src/csv/shared.ts:192` has `\s*` around `=`, so the same input matches.

**Root cause:** C24-SEC01 fix only updated the quoted pattern (line 42) but not the unquoted pattern (line 43).
