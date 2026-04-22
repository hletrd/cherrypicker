# Cycle 2 Review (2026-04-22)

**Reviewer**: general-purpose agent (fresh deep review)
**Scope**: packages/core/src/, packages/parser/src/, packages/rules/src/, packages/viz/src/, apps/web/src/, tools/cli/src/, tools/scraper/src/

---

## Summary

The codebase is highly mature after 94+ prior cycles plus cycle 1. All prior findings from the aggregate have been verified as fixed or are correctly carried forward. One new actionable finding was identified in the HTML report generator.

---

## New Findings

### C2-01: buildCategoryTable includes negative/zero amounts in totals (LOW)

**File**: `packages/viz/src/report/generator.ts:69-83`
**Confidence**: HIGH

`buildCategoryTable()` sums `tx.amount` for ALL transactions in its input, including negative amounts (refunds) and zero-amount rows. This produces incorrect category spending totals and an incorrect grand total in the HTML report when the input contains refunds.

The optimizer correctly filters to positive-only amounts (via `greedyOptimize` line 285), but the report's `buildCategoryTable` is called with the raw categorized transaction list, not the optimizer's filtered output.

**Impact**: HTML report shows lower-than-actual spending when refunds exist. Web path is unaffected (all web components derive from optimizer output).

**Fix**: Add `if (tx.amount <= 0) continue;` guard at the top of the transaction loop in `buildCategoryTable()`.

---

## Verified: Prior Findings Still Correct

| Finding | Status | Evidence |
|---|---|---|
| C1-N01 formatIssuerNameKo drifts from YAML | STILL OPEN (LOW) | 24-entry hardcoded map in `formatters.ts:52-77` |
| C1-N02 CATEGORY_COLORS drifts from YAML | STILL OPEN (LOW) | 84-entry hardcoded map in `CategoryBreakdown.svelte:6-84` |
| C1-N03 RAF cancelAnimationFrame(undefined) | NOT A BUG | Effect cleanup returns `() => { cancelled = true; cancelAnimationFrame(rafId); }` — `rafId` is always assigned before cleanup runs because the first `requestAnimationFrame(tick)` on line 87 assigns before the effect can clean up |
| C1-N04 Web CSV helpers duplicated from server | STILL OPEN (LOW) | Documented at `apps/web/src/lib/parser/csv.ts:29-34` |
| C1-03/C90-02 KakaoBank WCAG contrast | **CONFIRMED FIXED** | `getIssuerTextColor()` returns `text-gray-900` for kakao/jeju issuers |
| C89-01 classList.toggle without isConnected | **CONFIRMED FIXED** | VisibilityToggle uses `cached && cached.isConnected` guard at lines 70-71 |
| C89-02 rawPct threshold uses unrounded value | **CONFIRMED FIXED** | CategoryBreakdown uses rounded `pct` for the `< 2` threshold at line 128 |
| C89-03 non-null assertion after length check | STILL OPEN (LOW) | date-utils.ts uses `fullMatch[N]!` after successful regex match — safe but verbose |

---

## Aggregate Note

C1-03/C90-02 should be removed from the "Still-Open" list in `_aggregate.md` — the fix (`getIssuerTextColor` returning dark text for kakao/jeju) is in place and all badge-rendering components use it.
