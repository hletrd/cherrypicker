# Cycle 87 Comprehensive Review

**Date:** 2026-04-22
**Scope:** Full repository re-review with focus on open findings from C86 aggregate

---

## Verification of Prior Cycle Fixes (C86 Open Findings)

| Finding | Status | Evidence |
|---|---|---|
| C85-01/C86-01 | **CONFIRMED OPEN** | `SavingsComparison.svelte:240` annual projection line still uses `displayedAnnualSavings` (animated value) for `Math.abs()` and `+` prefix decision instead of `opt.savingsVsSingleCard * 12` (final target). During animation from positive to negative savings, can briefly show wrong sign on annual line. |
| C85-02 | **CONFIRMED OPEN** | `SavingsComparison.svelte:240` annual projection `+` prefix uses `displayedAnnualSavings >= 100` (animated threshold) instead of `opt.savingsVsSingleCard * 12 >= 100` (final target). Animation values < 100 can hide the `+` prefix even when final value is >= 100. |
| C85-03 | **CONFIRMED OPEN** | `CardDetail.svelte:22` `categoryLabelsReady` blocks entire rewards table from rendering until categories load. Minor UX issue but not a bug. |
| C86-01 | **DUPLICATE of C85-01** | Same root cause: animated value used for sign decision on annual line. |
| C86-02 | **CONFIRMED OPEN** | `CategoryBreakdown.svelte:91-96` `getCategoryColor()` falls through to `uncategorized` color for unknown dot-notation keys. Any new YAML subcategory without a CATEGORY_COLORS entry gets `#d1d5db` instead of a meaningful color. |
| C86-03 | **CONFIRMED OPEN (LOW)** | `csv.ts:149-184` Generic CSV header detection now requires 2+ keyword categories (C86-03 fix applied). But the check only verifies category count, not that a date keyword is present. A row with merchant+amount keywords but no date keyword could still match. |
| C86-04 | **CONFIRMED OPEN (KNOWN DEFERRED)** | `VisibilityToggle.svelte:62-131` $effect directly mutates DOM. 18+ cycles deferred. |
| C86-05 | **CONFIRMED OPEN (LOW)** | `xlsx.ts:371-387` XLSX header detection now requires 2+ keyword categories matching CSV. Same residual risk as C86-03: date keyword not strictly required. |
| C86-07 | **FIXED** | `SavingsComparison.svelte:152` now hides bar comparison when both rewards are zero: `{#if opt.totalReward > 0 \|\| (opt.bestSingleCard && opt.bestSingleCard.totalReward > 0)}`. |
| C86-08 | **FIXED** | `TransactionReview.svelte:294-300` now uses `<optgroup>` for category dropdown hierarchy. Leading-space indentation eliminated. |
| C86-13 | **CONFIRMED OPEN (LOW)** | `Layout.astro:121-148` Mobile menu lacks focus trap and Escape-to-close. |
| C86-16 | **CONFIRMED OPEN (MEDIUM)** | No integration test for multi-file upload with different bank formats. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C87-01 | MEDIUM | HIGH | `SavingsComparison.svelte:240` | Annual projection sign-prefix uses animated intermediate value `displayedAnnualSavings` for both `Math.abs()` decision and `+` prefix threshold, instead of using the final target value `opt.savingsVsSingleCard * 12`. This is the same root cause as C85-01/C86-01 but explicitly: the monthly line (238) correctly uses `opt.savingsVsSingleCard` for sign decisions, while the annual line uses `displayedAnnualSavings` for sign decisions. The animated `displayedAnnualSavings` value is only correct for the formatted number display, not for the sign prefix or Math.abs decisions. Fix: use `opt.savingsVsSingleCard` (not the animated annual value) for all sign-related decisions on line 240, matching line 238's pattern. |
| C87-02 | LOW | HIGH | `ReportContent.svelte:48` | Report savings line uses `opt.savingsVsSingleCard >= 100` for `+` prefix. While this is correct for the static report (no animation), the threshold of 100 won is inconsistent with SavingsComparison's `displayedSavings >= 100` which uses an animated value. Should use a consistent threshold (100 is fine, but should be documented as the canonical threshold). Not a bug, just a consistency note. |
| C87-03 | LOW | MEDIUM | `CategoryBreakdown.svelte:91-96` | `getCategoryColor()` has a 3-level fallback chain: exact match -> leaf ID -> `CATEGORY_COLORS.uncategorized` -> `OTHER_COLOR`. The `uncategorized` key exists in CATEGORY_COLORS with value `#d1d5db`, and OTHER_COLOR is `#cbd5e1`. These two grays are very close (only 6 units apart in any channel), making the final fallback effectively dead code. Not a bug but the `?? OTHER_COLOR` is unreachable. |

---

## Still-Open Actionable Findings (fixable this cycle)

These are findings that are both confirmed open AND feasible to fix without architectural changes:

1. **C87-01/C85-01/C86-01**: SavingsComparison annual projection sign-prefix bug (MEDIUM, HIGH confidence) -- straightforward fix: use `opt.savingsVsSingleCard` for sign decisions on annual line, matching monthly line pattern.

---

## Deferred Findings (carried forward, not new)

All prior deferred findings from the C86 aggregate remain in effect. No changes to severity, confidence, or deferral status this cycle.
