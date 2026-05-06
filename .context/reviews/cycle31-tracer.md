# Cycle 31 Tracer Review

**Scope:** Causal tracing of suspicious flows, competing hypotheses for failures, and data-flow analysis.

---

## Flow Analysis

### Flow 1: HTML Parser Forward-Fill State Propagation

**Path:** `parseHTML` -> `parseHTMLSheet` -> forward-fill loop -> `transactions.push(tx)`

**Hypothesis:** Forward-fill state could propagate across blank rows between unrelated data sections.

**Evidence:**
- Blank rows are skipped: `if (row.every((c) => !c)) continue;`
- But forward-fill state (`lastDate`, `lastMerchant`, etc.) is NOT reset on blank rows
- If a data section ends, followed by blank rows, followed by another data section with empty cells, the first section's values would forward-fill into the second

**Likelihood:** Low — Korean bank HTML exports typically don't have multiple data sections in one table.
**Impact:** Medium — could cause incorrect merchant/date assignments.

**Fix:** Reset forward-fill state on blank rows, or validate that consecutive data rows are part of the same logical group.

### Flow 2: Store Load -> Reoptimize Staleness

**Path:** `loadFromStorage` -> `setResult` -> `reoptimize` (on category edit)

**Hypothesis:** If the user loads old data from sessionStorage and edits categories, `reoptimize` uses stale `previousMonthSpendingOption` and `cardIdsOption`.

**Evidence:**
- `loadFromStorage` restores `previousMonthSpendingOption` and `cardIdsOption` from persisted data
- `reoptimize` passes these values to `optimizeFromTransactions`
- If the user originally analyzed with a specific `previousMonthSpending` value that is no longer relevant, the reoptimization uses the stale value

**Likelihood:** Medium — this is the exact scenario described in D-30 (deferred)
**Impact:** Medium — could produce incorrect optimization results based on stale baseline spending.

**Fix:** Either clear `previousMonthSpendingOption` on load, or add a timestamp/version check.

### Flow 3: JSON Parser Wrapper Key Detection

**Path:** `parseJSON` -> wrapper key loop -> `findField` -> `parseDateStringToISO`

**Hypothesis:** A malicious JSON payload could use a wrapper key like `data` containing non-transaction objects, causing `parseTransactionObject` to process invalid items.

**Evidence:**
- Wrapper keys include common names like `data`, `items`, `records`
- The code checks `Array.isArray(obj[key])` but doesn't verify array element types before processing
- `parseTransactionObject` returns `null` for non-matching objects, so invalid items are silently skipped
- No error is reported for objects that don't match transaction patterns

**Verdict:** Safe — non-matching objects are silently skipped without corrupting data. But users might wonder why some objects were ignored.

---

## Prior Open Findings

| Finding | Status | Traced Flow |
|---|---|---|
| D-30 | OPEN (MEDIUM) | Store load -> reoptimize staleness confirmed above |
| D-27 | OPEN (LOW) | Multi-file upload transaction IDs are actually unique in merged array |
| C22-05 | OPEN (LOW) | TransactionReview changeCategory does O(n) copy — acceptable for < 1000 txs |

---

## Final Sweep

1. No circular data flows detected
2. All async flows properly propagate errors
3. No unhandled promise rejections in new code
4. State mutations are centralized in store.svelte.ts
