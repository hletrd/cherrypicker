# Cycle 3 Plan — C3-01

## C3-01: Report generator summary row count includes skipped transactions (LOW)

**File:** `packages/viz/src/report/generator.ts:119`

**Problem:** The summary row in `buildCategoryTable` uses `transactions.length` for the transaction count, but the loop above skips `tx.amount <= 0` transactions (refunds, balance inquiries). This means the displayed count is inconsistent with `grandTotal` which only sums positive amounts. For example, if there are 100 transactions but 5 are refunds, the count shows 100 but the total reflects only 95 transactions' spending.

**Fix:** Track an `includedCount` variable that increments only for transactions that pass the filter, and use it instead of `transactions.length` in the summary row.

**Status:** FIXED
