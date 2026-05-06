# Cycle 25 — Test Engineer (2026-05-06)

## Finding 1: Missing server-side test for summary row forward-fill reset [C25-TEST01] — LOW

**File:** `packages/parser/__tests__/html.test.ts`

The web-side parser has test `does not forward-fill summary row amounts to merged cells (C20-TEST03)` at `apps/web/__tests__/parser-html.test.ts:212` which verifies that summary rows reset forward-fill state. The server-side test file has `prevents summary row values from contaminating forward-fill` at line 208, but this only tests per-cell `isSummaryRow` guards — NOT the row-level forward-fill reset behavior.

Since the server parser LACKS the reset logic (see C25-COR01), there is no test coverage for the correct behavior.

**Fix:** Add a server-side test matching C20-TEST03 that verifies:
1. A summary row between two data groups resets forward-fill state
2. Merged cells after a summary row do NOT pick up values from before the summary row

## Finding 2: Missing web-side test for unquoted event handlers with whitespace [C25-TEST02] — LOW

**File:** `apps/web/__tests__/parser-html.test.ts`

C24-TEST01 added tests for quoted event handlers with whitespace around `=` (`onclick = "alert(1)"`). There is no test for unquoted handlers with whitespace (`onclick = alert(1)`).

Since the web-side unquoted regex at `apps/web/src/lib/parser/html.ts:43` still lacks `\s*` around `=`, this gap means the bug is not caught by tests.

**Fix:** Add test cases for:
- `<td onclick =alert(1)>value</td>`
- `<td onclick= alert(1)>value</td>`
- `<td onclick = alert(1)>value</td>`
- `<td onerror =foo(bar)>value</td>`

## Finding 3: Missing test for reoptimize() metadata consistency [C25-TEST03] — LOW

**File:** `apps/web/src/lib/store.svelte.ts`

There is no test verifying that `reoptimize()` updates `transactionCount`, `totalTransactionCount`, `statementPeriod`, or `fullStatementPeriod` after transaction edits. If a user adds/deletes transactions and calls reoptimize, these fields could be stale.

**Fix:** Add a unit test for `reoptimize()` that:
1. Sets up an initial analysis result
2. Calls `reoptimize()` with edited transactions (different count, different date range)
3. Verifies the store's `transactionCount`, `totalTransactionCount`, `statementPeriod`, and `fullStatementPeriod` reflect the edited data
