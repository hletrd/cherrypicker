# Plan: C32-01 — Report page "+" prefix on positive savings

**Status:** DONE
**Finding:** C32-01 (LOW, High confidence)
**Files:** `apps/web/public/scripts/report.js:63`

## Problem

The report page displays savings without a "+" prefix for positive values: "추가 절약: 5,000원".
The results page (`results.js:14`) and SavingsComparison.svelte both show "+5,000원" for positive savings.
The inconsistency suggests a display bug to the user.

## Implementation

1. In `apps/web/public/scripts/report.js`, modify line 63 to prepend "+" when savingsVsSingleCard >= 0:
   - Before: `summaryTable.appendChild(summaryRow(opt.savingsVsSingleCard >= 0 ? '추가 절약' : '추가 비용', formatWon(opt.savingsVsSingleCard)));`
   - After: compute the display value with prefix, then pass to summaryRow

## Verification

- Open the report page with positive savingsVsSingleCard — should show "+5,000원"
- Open the report page with negative savingsVsSingleCard — should show "-5,000원" with label "추가 비용"
