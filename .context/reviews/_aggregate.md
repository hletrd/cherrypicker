# Review Aggregate -- Cycle 3 (2026-04-22)

**Source reviews (this cycle):**
- `.context/reviews/cycle3-review.md` (1 new finding: LOW, fixed)

**Prior cycle reviews (still relevant):**
- All cycle 1-94 and cycle 1-2 per-agent and aggregate files

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

---

## New Findings (This Cycle)

All new findings are LOW severity:

| ID | Finding | File | Confidence | Status |
|---|---|---|---|---|
| C3-01 | buildCategoryTable summary row count includes skipped transactions | `packages/viz/src/report/generator.ts:119` | High | **FIXED** |

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

The codebase is stable after 94+ cycles of fixes. All gates pass. No new HIGH or MEDIUM findings. The one new finding (C3-01) was a LOW-severity bug in the HTML report generator where the summary row count included skipped (negative/zero amount) transactions, making it inconsistent with the total amount. This has been fixed by tracking an `includedCount` that only increments for transactions passing the filter. The remaining open items are all LOW-severity drift/maintenance concerns.
