# Cycle 89 Comprehensive Review

**Date:** 2026-04-22
**Scope:** Full repository re-review with focus on open findings from C88 aggregate and fresh deep analysis

---

## Verification of Prior Cycle Fixes (C88 Open Findings)

| Finding | Status | Evidence |
|---|---|---|
| C88-01 | **CONFIRMED FIXED** | `SavingsComparison.svelte:238-240` now correctly uses `opt.savingsVsSingleCard` for sign decisions (`>= 100` threshold and `< 0` for Math.abs). Commit `00000006d3`. |
| C88-02 | **NOT A BUG** | Monthly savings display correctly uses `opt.savingsVsSingleCard` for sign decisions and `displayedSavings` for the animated display value. This is correct by design. |
| C88-03 | **CONFIRMED OPEN (LOW)** | `CategoryBreakdown.svelte:6-84` CATEGORY_COLORS hardcoded 84-entry map not auto-generated from YAML taxonomy. Same as C86-02. |
| C88-04 | **CONFIRMED OPEN (LOW)** | `FileDropzone.svelte:80-105` ALL_BANKS is 5th copy of bank list. Same as C74-05. |
| C88-05 | **CONFIRMED OPEN (LOW)** | `formatters.ts:51-79` formatIssuerNameKo hardcoded map will drift. Same as C64-03. |
| C88-06 | **CONFIRMED OPEN (LOW)** | `formatters.ts:115-143` getIssuerColor hardcoded map will drift. Same pattern. |
| C88-07 | **CONFIRMED OPEN (LOW)** | `xlsx.ts:266-275` isHTMLContent only checks UTF-8 decoding. Known limitation. |
| C88-08 | **CONFIRMED OPEN (LOW)** | `pdf.ts:354` fallbackAmountPattern `g` flag fragile if refactored to module scope. |
| C88-09 | **CONFIRMED OPEN (MEDIUM)** | No integration test for multi-file upload. Same as C86-16. |
| C88-10 | **CONFIRMED OPEN (LOW)** | No test for SavingsComparison sign-prefix behavior. |
| C88-11 | **CONFIRMED OPEN (LOW)** | Mobile menu lacks focus trap and Escape-to-close. Same as C86-13. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C89-01 | LOW | MEDIUM | `VisibilityToggle.svelte:70-71` | `cachedDataEl.classList.toggle('hidden', !hasData)` operates on DOM directly. While this is the known deferred C86-04 pattern, I note a new subtlety: if `hasData` transitions from `true` to `false` during Astro View Transition teardown, the `isConnected` check in `getOrRefreshElement` (line 31) prevents stale refs from being used, but the toggle call on line 70 still fires against a potentially disconnected element. The `isConnected` guard in the cleanup function (line 123) prevents the inverse problem, but the forward-direction toggle on line 70 has no such guard. In practice, `classList.toggle` on a disconnected element is a no-op (no visible effect), so this is not a user-facing bug, but it represents unnecessary work during page transitions. |
| C89-02 | LOW | LOW | `CategoryBreakdown.svelte:143-158` | When `others.length > 0`, the "other" category aggregates sub-2% categories. The `otherPct` is calculated using `(otherTotal / totalSpending)` but individual subcategory percentages (line 155) use the same denominator, meaning they sum correctly. No bug, but the `rawPct < 2` threshold (line 129) uses the unrounded raw percentage, while the displayed percentage uses `pct` (rounded to 1 decimal). A category with `rawPct = 1.95` rounds to `2.0` visually but is still grouped into "other" because `1.95 < 2`. This is the known threshold design choice (noted in the comment at line 126-128). |
| C89-03 | LOW | MEDIUM | `formatters.ts:155-157` | `formatYearMonthKo` uses `parseInt(m!, 10)` where `m` comes from `parts[1]`. The non-null assertion `m!` is safe because `parts.length >= 2` is checked on line 153, but the `parseInt` call on a potentially empty string (e.g., "2026-") returns `NaN`, which is correctly handled by the `Number.isNaN(mNum)` guard on line 156. No bug, just noting the defensive chain works. |

---

## Still-Open Actionable Findings (fixable this cycle)

No actionable findings this cycle. All open findings are LOW severity and deferred, carried forward from prior cycles.

---

## Deferred Findings (carried forward, not new)

All prior deferred findings from the C88 aggregate remain in effect. No changes to severity, confidence, or deferral status this cycle.
