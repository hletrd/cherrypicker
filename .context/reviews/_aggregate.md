# Review Aggregate -- Cycle 1 (2026-04-22)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-22-cycle1-comprehensive.md` (4 new findings: all LOW)

**Prior cycle reviews (still relevant):**
- All cycle 1-94 per-agent and aggregate files

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

---

## New Findings (This Cycle)

All new findings are LOW severity:

| ID | Finding | File | Confidence |
|---|---|---|---|
| C1-N01 | formatIssuerNameKo 24-entry hardcoded map drifts from YAML | `formatters.ts:51-79` | High |
| C1-N02 | CATEGORY_COLORS 84-entry hardcoded map drifts from YAML | `CategoryBreakdown.svelte:6-84` | Medium |
| C1-N03 | RAF cancelAnimationFrame(undefined) no-op on fast re-renders | `SavingsComparison.svelte:76-88` | Medium |
| C1-N04 | Web parser CSV helpers duplicated from server shared.ts | `apps/web/src/lib/parser/csv.ts` | High |

---

## Still-Open Actionable Items (LOW, carried forward)

| Priority | ID | Finding | Effort | Impact |
|---|---|---|---|---|
| 1 | C1-03/C90-02 | KakaoBank badge #fee500 (yellow) on white text fails WCAG AA | Small | Accessibility |
| 2 | C89-01 | VisibilityToggle classList.toggle without isConnected guard | Small | Robustness |
| 3 | C89-02 | CategoryBreakdown rawPct < 2 threshold uses unrounded value | Small | Correctness (cosmetic) |
| 4 | C89-03 | formatters.ts m! non-null assertion after length check | Small | Type safety |

---

## Summary

The codebase is stable after 94+ cycles of fixes. All gates pass. No new HIGH or MEDIUM findings. The only truly actionable item is the KakaoBank WCAG contrast fix (C1-03), which is a one-line color change.
