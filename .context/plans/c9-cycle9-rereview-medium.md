# Plan -- Medium-Priority Fixes (Cycle 9 Re-Re-Review)

**Priority:** MEDIUM
**Findings addressed:** C8-10, C9R-03
**Status:** DONE

---

## Task 1: Add explicit NaN guard to csv.ts installment parsing (C8-10)

**Finding:** `apps/web/src/lib/parser/csv.ts` -- Every bank adapter parses installments with `const inst = parseInt(cells[installmentsCol] ?? '', 10)` and then checks `if (inst > 1)`. If `parseInt` returns `NaN`, the comparison `NaN > 1` evaluates to `false`, so NaN is implicitly filtered. This relies on `NaN > 1 === false` which is fragile -- a future developer might change the condition to `inst >= 1` which would pass NaN through.

**File:** `apps/web/src/lib/parser/csv.ts`

**Implementation:**
1. Find all installment parsing patterns in bank adapters (lines ~257, 334, 399, 465, 531, 596, 661, 727, 792, 858, 923)
2. Add explicit NaN guard to each:
   ```ts
   const inst = parseInt(cells[installmentsCol] ?? '', 10);
   if (!Number.isNaN(inst) && inst > 1) tx.installments = inst;
   ```

**Commit:** `fix(parser): 🛡️ add explicit NaN guard to csv.ts installment parsing`

---

## Task 2: Handle negative amounts (refunds) in PDF parser (C9R-03)

**Finding:** `apps/web/src/lib/parser/pdf.ts:207-213,262,362` -- `parseAmount` returns 0 for unparseable amounts. Both structured and fallback parsers skip transactions with `amount <= 0` or `amount > 0`, meaning refund transactions (negative amounts) are silently dropped. Korean credit card statements can include refund/cancellation entries.

**File:** `apps/web/src/lib/parser/pdf.ts`

**Implementation:**
1. In the structured parser (line 262), change the filter to allow negative amounts:
   ```ts
   // Old: if (amount <= 0 || (!merchant && amount === 0)) continue;
   // New: Skip only zero-amount rows; negative amounts are valid refunds
   if (amount === 0) continue;
   if (!merchant && amount === 0) continue;
   ```
   Actually, keep the original logic for amount === 0 with no merchant (data row), but allow negative amounts:
   ```ts
   if (amount === 0) continue;  // skip zero-amount data rows
   if (!merchant && amount === 0) continue;  // skip rows without merchant AND zero amount
   ```

2. In the fallback parser (line 362), change the filter:
   ```ts
   // Old: if (amount > 0) {
   // New: if (amount !== 0) {
   if (amount !== 0) {
     fallbackTransactions.push({...});
   }
   ```

**Note:** The `RawTransaction` type already supports negative amounts via the `amount: number` field. The downstream analyzer uses `Math.abs(tx.amount)` for spending calculations (see `analyzer.ts:304`), so negative amounts are handled correctly in the optimization pipeline. They just need to be allowed through the parser.

**Commit:** `fix(parser): 🛡️ allow negative amounts (refunds) in PDF parser`

---

## Progress

- [x] Task 1: Add NaN guard to csv.ts installment parsing (ALREADY FIXED in prior cycle — !Number.isNaN(inst) guard present)
- [x] Task 2: Handle negative amounts in PDF parser (commit: 000000000e)
