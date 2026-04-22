# Review Aggregate -- Cycle 8 (2026-04-22)

**Source reviews (this cycle):**
- `.context/reviews/cycle8-review.md` (0 new findings)

**Prior cycle reviews (still relevant):**
- All cycle 1-94 and cycle 1-7 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-94 findings are confirmed fixed except as noted in the prior aggregate. This cycle verified the following code paths as correct:

| Finding | Status | Evidence |
|---|---|---|
| C1-01 monthlySpending includes refunds | **CONFIRMED FIXED** | `analyzer.ts:329` only accumulates `tx.amount > 0` |
| C1-12 findRule sort instability | **CONFIRMED FIXED** | `reward.ts:87-93` secondary sort by indexOf |
| C1-21 Truncation + reoptimize | **CONFIRMED FIXED** | `store.svelte.ts` recalculates monthlyBreakdown |
| C7-01 TransactionReview fails to sync after page refresh | **CONFIRMED FIXED** | `store.svelte.ts:361` initializes `generation` to 1 when storage has data |
| C92-01/C94-01 formatSavingsValue | **CONFIRMED FIXED** | Centralized in `formatters.ts:215-218` |
| C93-01 {@const} position | **CONFIRMED FIXED** | ReportContent.svelte valid Svelte 5 |
| C1-03/C90-02 KakaoBank WCAG contrast | **CONFIRMED FIXED** | `getIssuerTextColor()` returns `text-gray-900` for kakao/jeju issuers |
| C89-01 classList.toggle without isConnected | **CONFIRMED FIXED** | VisibilityToggle uses `cached && cached.isConnected` guard |
| C89-02 rawPct threshold uses unrounded value | **CONFIRMED FIXED** | CategoryBreakdown uses rounded `pct` for `< 2` threshold |
| C2-01 buildCategoryTable includes refunds | **CONFIRMED FIXED** | `generator.ts:69` now skips `tx.amount <= 0` |
| C3-01 buildCategoryTable summary row count | **CONFIRMED FIXED** | `generator.ts:119` uses `includedCount` |
| C4-01 printSpendingSummary summary row count | **CONFIRMED FIXED** | `summary.ts:69` uses `includedCount` |
| C5-01 performanceExclusions qualifying sum includes negative/zero | **CONFIRMED FIXED** | `analyzer.ts:231` filters `tx.amount > 0` |

---

## New Findings (This Cycle)

No new actionable findings in cycle 8.

### Observations (not actionable)

1. CLI/web savings-rate denominator inconsistency — `comparison.ts:48` uses `totalSpending` while `SavingsComparison.svelte:113` uses `bestSingleCard.totalReward`. Both are valid interpretations; not a bug.
2. HTML report "+0원" edge case — `generator.ts:41-42` shows "+" prefix for zero savings, while web `formatSavingsValue` hides it under 100 won. Cosmetic only.

---

## Still-Open Actionable Items (LOW, carried forward)

| Priority | ID | Finding | Effort | Impact |
|---|---|---|---|---|
| 1 | C1-N01 | formatIssuerNameKo 24-entry hardcoded map drifts from YAML | Medium | Correctness |
| 2 | C1-N02 | CATEGORY_COLORS 84-entry hardcoded map drifts from YAML | Medium | Correctness |
| 3 | C1-N04 | Web parser CSV helpers duplicated from server shared.ts | Large | Maintenance |
| 4 | C89-03 | formatters.ts m! non-null assertion after length check | Small | Type safety |

---

## Summary

Cycle 8 found 0 new actionable findings. All previously identified bugs remain fixed. The four LOW-priority carried-forward items (C1-N01, C1-N02, C1-N04, C89-03) remain open but are maintenance concerns rather than bugs or security issues.
