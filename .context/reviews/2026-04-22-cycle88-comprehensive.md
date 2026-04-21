# Cycle 88 Comprehensive Review

**Date:** 2026-04-22
**Scope:** Full repository re-review with focus on open findings from C87 aggregate and fresh deep analysis

---

## Verification of Prior Cycle Fixes (C87 Open Findings)

| Finding | Status | Evidence |
|---|---|---|
| C87-01/C85-01/C86-01 | **CONFIRMED OPEN** | `SavingsComparison.svelte:240` annual projection line still uses `displayedAnnualSavings` (animated value) for both `Math.abs()` decision and `+` prefix threshold, instead of using `opt.savingsVsSingleCard` for sign decisions. Line 238 (monthly) correctly uses `opt.savingsVsSingleCard` for sign decisions; line 240 (annual) does not. The `+` prefix check is `displayedAnnualSavings >= 100` instead of `opt.savingsVsSingleCard * 12 >= 100`. The `Math.abs()` guard uses `displayedAnnualSavings < 0` instead of `opt.savingsVsSingleCard < 0`. |
| C87-02 | **NOT A BUG** | `ReportContent.svelte:48` uses `opt.savingsVsSingleCard >= 100` which is correct for the static report (no animation). Consistent threshold. |
| C87-03 | **CONFIRMED OPEN (LOW)** | `CategoryBreakdown.svelte:95` `?? OTHER_COLOR` is unreachable because `CATEGORY_COLORS.uncategorized` always exists (`#d1d5db`). Dead code. |
| C85-03 | **CONFIRMED OPEN (LOW)** | `CardDetail.svelte:22` `categoryLabelsReady` blocks entire rewards table until categories load. |
| C86-02 | **CONFIRMED OPEN (LOW)** | `CategoryBreakdown.svelte:91-96` getCategoryColor falls through to gray for unknown dot-notation keys. |
| C86-03 | **CONFIRMED OPEN (LOW)** | `csv.ts:149-184` Header detection requires 2+ keyword categories but date keyword not strictly required. |
| C86-04 | **CONFIRMED OPEN (KNOWN DEFERRED)** | `VisibilityToggle.svelte:62-131` $effect directly mutates DOM. 18+ cycles deferred. |
| C86-05 | **CONFIRMED OPEN (LOW)** | `xlsx.ts:371-387` Same residual risk as C86-03. |
| C86-13 | **CONFIRMED OPEN (LOW)** | `Layout.astro:121-148` Mobile menu lacks focus trap and Escape-to-close. |
| C86-16 | **CONFIRMED OPEN (MEDIUM)** | No integration test for multi-file upload with different bank formats. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C88-01 | MEDIUM | HIGH | `SavingsComparison.svelte:238-240` | **ALREADY FIXED** — Commit `00000006d3` already applied this fix. Line 240 now correctly uses `opt.savingsVsSingleCard * 12 >= 100` for `+` prefix threshold and `opt.savingsVsSingleCard < 0` for Math.abs decision. The C87 review was written before that commit landed. This finding is now a false positive for cycle 88. |
| C88-02 | LOW | HIGH | `SavingsComparison.svelte:238` | Monthly savings line uses `displayedSavings` for the formatted number display but `opt.savingsVsSingleCard` for sign decisions. This is correct. However, there is a subtle inconsistency: when `opt.savingsVsSingleCard < 0`, the displayed value is `Math.abs(displayedSavings)` where `displayedSavings` is the animated value. If `opt.savingsVsSingleCard < 0` but `displayedSavings` is still positive (during animation from positive to negative), `Math.abs(displayedSavings)` equals `displayedSavings` which is correct. No bug, but the logic could be clearer by always displaying `Math.abs(displayedSavings)` unconditionally when negative. |
| C88-03 | LOW | MEDIUM | `CategoryBreakdown.svelte:6-84` | `CATEGORY_COLORS` has a hardcoded mapping of 84 entries. When new subcategories are added to the YAML taxonomy, they will not have corresponding entries in this map and will fall through to the gray `uncategorized` color (as noted in C86-02). The map is not auto-generated from the taxonomy data. Risk of visual regression when YAML changes. |
| C88-04 | LOW | MEDIUM | `FileDropzone.svelte:80-105` | `ALL_BANKS` is a hardcoded list of 24 banks that is the 5th copy of the bank list needing sync (also in `detect.ts`, `BANK_COLUMN_CONFIGS`, `packages/parser`, `BANK_SIGNATURES`). This was flagged as C74-05 and is still open. |
| C88-05 | LOW | MEDIUM | `formatters.ts:51-79` | `formatIssuerNameKo` is a hardcoded mapping of 24 issuers that will drift from the actual data if new issuers are added to the YAML/card data. Same pattern as CATEGORY_NAMES_KO (C64-03/C66-05/C67-03). |
| C88-06 | LOW | MEDIUM | `formatters.ts:115-143` | `getIssuerColor` is a hardcoded mapping of 24 issuer colors that will drift from the actual data. Same pattern as CATEGORY_COLORS and formatIssuerNameKo. |
| C88-07 | LOW | LOW | `xlsx.ts:266-275` | `isHTMLContent` decodes the first 512 bytes as UTF-8. If the HTML-as-XLS file uses EUC-KR encoding (rare but possible for older Korean bank exports), the UTF-8 decode will produce mojibake and the HTML signature checks will fail. The comment acknowledges this limitation but there is no fallback. |
| C88-08 | LOW | LOW | `pdf.ts:354` | The `fallbackAmountPattern` regex `/([\d,]+)원?/g` uses the `g` flag for `matchAll()`. The comment correctly notes the regex is NOT hoisted to module scope to avoid `lastIndex` mutation. This is correct but fragile -- if someone refactors and moves it to module scope, it would break silently. |

---

## Still-Open Actionable Findings (fixable this cycle)

No actionable findings this cycle. C88-01 was already fixed in a prior commit (`00000006d3`). All remaining open findings are LOW severity and deferred.

---

## Deferred Findings (carried forward, not new)

All prior deferred findings from the C87 aggregate remain in effect. No changes to severity, confidence, or deferral status this cycle.
