# Cycle 4 Fixes (2026-04-22)

## C4-01: Terminal summary row count includes skipped transactions

**File:** `packages/viz/src/terminal/summary.ts:65`

**Problem:** `printSpendingSummary` uses `transactions.length` in the summary (합계) row count, but the loop above skips `tx.amount <= 0` transactions. The displayed count includes skipped transactions (refunds, balance inquiries), making it inconsistent with `grandTotal` which only sums positive amounts. Same bug as C3-01 in the HTML report generator, which was fixed but missed in the terminal path.

**Fix:** Track `includedCount` that only increments for transactions passing the `tx.amount <= 0` filter, then use `includedCount` instead of `transactions.length` in the summary row.

**Status:** FIXED
