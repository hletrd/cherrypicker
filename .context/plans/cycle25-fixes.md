# Cycle 25 Implementation Plan

**Date:** 2026-05-06
**Source reviews:** `.context/reviews/c25-aggregate.md`, `.context/reviews/c25-{code-reviewer,security-reviewer,perf-reviewer,test-engineer,architect,debugger,critic,verifier,tracer,designer,document-specialist}.md`
**Status:** In Progress

---

## Task 1: Add forward-fill reset on summary rows to server HTML parser [C25-COR01] — MEDIUM

- **Files:** `packages/parser/src/html/index.ts:156`
- The server-side HTML parser skips summary rows via `continue` but does not reset forward-fill state. The web-side parser has had this reset since C20-04.
- **Change:** Wrap the `continue` in a block that resets `lastDate`, `lastMerchant`, `lastCategory`, `lastInstallments`, `lastMemo`, `lastAmount` to `''` before continuing.
- Add comment matching web-side: `// Reset forward-fill state so summary row values don't propagate to merged data cells below (C25-COR01).`

## Task 2: Recompute metadata fields in reoptimize() [C25-COR02] — MEDIUM

- **Files:** `apps/web/src/lib/store.svelte.ts:570-575`
- The `result` object rebuilt in `reoptimize()` preserves stale `transactionCount`, `totalTransactionCount`, `statementPeriod`, and `fullStatementPeriod` from `snapshot`.
- **Change:** Before constructing `result`, compute:
  - `transactionCount = editedTransactions.length`
  - `totalTransactionCount = editedTransactions.length` (same semantics in reoptimize context)
  - `statementPeriod` from min/max dates of `editedTransactions`
  - `fullStatementPeriod` from min/max dates of `editedTransactions`
- Include these fields explicitly in the `result = { ... }` assignment.

## Task 3: Fix unquoted event handler regex whitespace on web [C25-SEC01] — LOW

- **Files:** `apps/web/src/lib/parser/html.ts:43`
- C24-SEC01 fixed the quoted pattern but missed the unquoted pattern.
- **Change:** `.replace(/\son\w+=[^>\s]*/gi, '')` -> `.replace(/\son\w+\s*=\s*[^>\s]*/gi, '')`
- This achieves parity with `packages/parser/src/csv/shared.ts:192`.

## Task 4: Add server test for summary row forward-fill reset [C25-TEST01] — LOW

- **Files:** `packages/parser/__tests__/html.test.ts`
- Add test matching web-side C20-TEST03: a summary row between two data groups with merged cells should reset forward-fill state, preventing summary values from propagating to subsequent rows.
- Verify: merged cells after a summary row do NOT pick up values from before the summary row.

## Task 5: Add web test for unquoted event handlers with whitespace [C25-TEST02] — LOW

- **Files:** `apps/web/__tests__/parser-html.test.ts`
- Add test cases under the existing `normalizeHTML` describe block:
  - `<td onclick =alert(1)>value</td>` -> `<td>value</td>`
  - `<td onclick= alert(1)>value</td>` -> `<td>value</td>`
  - `<td onclick = alert(1)>value</td>` -> `<td>value</td>`
  - `<td onerror =foo(bar)>value</td>` -> `<td>value</td>`

## Task 6: Add reoptimize metadata consistency test [C25-TEST03] — LOW

- **Files:** `apps/web/__tests__/store.test.ts` (or appropriate test file)
- **Note:** This test requires mocking the store's dependencies (`optimizeFromTransactions`, `getCategoryLabels`). If no store test file exists or mocking is prohibitively complex, defer to next cycle.
- **Change:** Verify that after calling `reoptimize()` with edited transactions having a different count and date range, the store's `transactionCount`, `totalTransactionCount`, `statementPeriod`, and `fullStatementPeriod` reflect the edited data.

---

## Deferred Items

| Finding | Severity | Confidence | Reason for deferral | Exit criterion |
|---------|----------|------------|---------------------|----------------|
| C25-PERF01 | LOW | High | Greedy optimizer double calculation requires architectural change (incremental rewards or caching). Complexity outweighs benefit for typical statement sizes. | User reports slow optimization on statements > 1000 transactions |
| C25-ARCH01 | LOW | High | Parser duplication is A-ARCH-01 carry-over. Requires shared module with Buffer/TextEncoder abstraction. | A-ARCH-01 shared module is implemented |
| C25-TEST03 | LOW | Medium | Store unit test may require complex mocking. If existing test infrastructure is insufficient, defer. | `store.svelte.ts` has testable exports or dedicated test file |

---

## Gate Results (to be filled after implementation)

- `npm run lint`: TBD
- `npm run typecheck`: TBD
- `bun run test`: TBD
