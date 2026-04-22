# Review Aggregate -- Cycle 5 (2026-04-22)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-22-cycle5-rpf-review.md` (1 new finding: MEDIUM, fixed)

**Prior cycle reviews (still relevant):**
- All cycle 1-94 and cycle 1-4 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-94 findings are confirmed fixed except as noted in the prior aggregate. This cycle verified the following code paths as correct:

| Finding | Status | Evidence |
|---|---|---|
| C1-01 monthlySpending includes refunds | **CONFIRMED FIXED** | `analyzer.ts:325-327` only accumulates `tx.amount > 0` |
| C1-12 findRule sort instability | **CONFIRMED FIXED** | `reward.ts:87-93` secondary sort by indexOf |
| C1-21 Truncation + reoptimize | **CONFIRMED FIXED** | `store.svelte.ts` recalculates monthlyBreakdown |
| C92-01/C94-01 formatSavingsValue | **CONFIRMED FIXED** | Centralized in `formatters.ts:215-218` |
| C93-01 {@const} position | **CONFIRMED FIXED** | ReportContent.svelte valid Svelte 5 |
| C1-03/C90-02 KakaoBank WCAG contrast | **CONFIRMED FIXED** | `getIssuerTextColor()` returns `text-gray-900` for kakao/jeju issuers; all badge components use it |
| C89-01 classList.toggle without isConnected | **CONFIRMED FIXED** | VisibilityToggle uses `cached && cached.isConnected` guard |
| C89-02 rawPct threshold uses unrounded value | **CONFIRMED FIXED** | CategoryBreakdown uses rounded `pct` for `< 2` threshold |
| C2-01 buildCategoryTable includes refunds | **CONFIRMED FIXED** | `generator.ts:69` now skips `tx.amount <= 0` |
| C3-01 buildCategoryTable summary row count | **CONFIRMED FIXED** | `generator.ts:119` uses `includedCount` |
| C4-01 printSpendingSummary summary row count | **CONFIRMED FIXED** | `summary.ts:69` uses `includedCount` |

---

## New Findings (This Cycle)

| ID | Finding | Severity | File | Confidence | Status |
|---|---|---|---|---|---|
| C5-01 | performanceExclusions qualifying sum includes negative/zero amounts | MEDIUM | `apps/web/src/lib/analyzer.ts:226-232` | High | **FIXED** |

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

This cycle found one MEDIUM-severity bug: the `performanceExclusions` qualifying sum in `optimizeFromTransactions` did not filter out negative/zero-amount transactions, causing 전월실적 (previous month performance) to understate when the user has refunds. This is the same class of bug as C1-01 but in the per-card exclusion path. Fixed by adding `tx.amount > 0` to the filter, matching the convention used everywhere else in the codebase. All gates pass.
