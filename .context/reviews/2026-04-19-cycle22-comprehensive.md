# Comprehensive Code Review — Cycle 22

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 22)
**Scope:** Full repository — all packages, apps, and shared code

---

## Methodology

Read every source file in the repository. Cross-referenced with prior cycle 1-21 reviews, deferred items (D-01 through D-105), and the aggregate. Focused on finding genuinely NEW issues not previously reported. Verified that prior cycle 21 findings (C21-02 through C21-06) have been addressed or are still present.

---

## Verification of Cycle 21 Findings

| Finding | Status | Evidence |
|---|---|---|
| C21-02 | DEFERRED | LOW — inconsistent rate formatting precision between `formatRate` and `formatRatePrecise` |
| C21-03 | DEFERRED (D-42/D-57) | LOW — third copy of bank names |
| C21-04 | **FIXED** | `CardGrid.svelte:63-65` now includes `|| a.annualFee.international - b.annualFee.international` as secondary sort key |
| C21-05 | **FIXED** | `pdf.ts:86-89` now uses `consecutiveBlankLines >= 2` threshold instead of breaking on first blank line |
| C21-06 | **FIXED** | `pdf.ts:26` now uses `lines.reduce((max, l) => Math.max(max, l.length), 0)` instead of `Math.max(...spread)` |

---

## New Findings

### C22-01: `CategoryBreakdown.svelte` bar overflow when "other" combined percentage exceeds top individual category

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:114,170`
- **Description:** The `maxPercentage` is derived from `categories[0].percentage` (line 114), which is the highest individual category percentage. However, the "other" combined category is pushed to the end of the `main` array (line 95-108) and can have a higher percentage than any individual category. The bar width is calculated as `(cat.percentage / maxPercentage) * 100` (line 170), so if "other" exceeds the top individual category, its bar overflows the container.
- **Failure scenario:** A user has 20 small spending categories each at 1.9% of total (just under the 2% threshold). They get combined into "other" at 38%. The top individual category is "dining" at 5%. `maxPercentage = 5`, so "other" bar width = (38/5)*100 = 760%, massively overflowing the container div.
- **Fix:** Compute `maxPercentage` as `Math.max(...categories.map(c => c.percentage))` (or use reduce to avoid the spread pattern), or use the overall maximum including "other".

### C22-02: `OptimalCardMap.svelte` uses `Math.max(...spread)` with assignments — same stack overflow risk as D-73/D-89

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:19`
- **Description:** `Math.max(...assignments.map((a) => a.rate), 0.001)` spreads all rate values as arguments. For an extremely large number of category assignments (theoretically > 100K), this would cause a stack overflow. This is the same class as D-73/D-89/C21-06 but in a different component. The pdf.ts instance was fixed in a prior cycle, but this Svelte component instance was not.
- **Failure scenario:** An edge case with hundreds of thousands of category assignments causes a RangeError. Typical usage has < 50 assignments so this is not a realistic concern in practice.
- **Fix:** Replace with `assignments.reduce((max, a) => Math.max(max, a.rate), 0.001)`.

### C22-03: `CardGrid.svelte` uses `Math.max(...spread)` with assignments — same stack overflow risk

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/cards/CardGrid.svelte:19`
- **Description:** `Math.max(...assignments.map((a) => a.rate), 0.001)` — same issue as C22-02 in a different component.
- **Failure scenario:** Same as C22-02 — theoretical only.
- **Fix:** Replace with `assignments.reduce((max, a) => Math.max(max, a.rate), 0.001)`.

---

## Final Sweep — Cross-File Interactions

1. **CardGrid fee sort (C20-06/C21-04):** Confirmed FIXED. Both fee-asc and fee-desc sorts now include `a.annualFee.international` as a secondary sort key.

2. **PDF parseTable early exit (C21-05):** Confirmed FIXED. The `consecutiveBlankLines` counter resets on non-blank lines and only breaks after 2+ consecutive blanks with 3+ collected table lines.

3. **PDF Math.max spread (C21-06):** Confirmed FIXED. Now uses `lines.reduce()`.

4. **Category labels consistency:** All four locations that build `categoryLabels` Maps (`store.svelte.ts:247-261`, `analyzer.ts:191-204`, `analyzer.ts:249-263`, `CardDetail.svelte:22-31`) include both short IDs, subcategory IDs, and dot-notation keys. Consistent.

5. **Session storage validation:** `isValidTx` in `store.svelte.ts:139-151` correctly validates `Number.isFinite(tx.amount)` and `tx.amount > 0`. NaN and negative values are rejected.

6. **Global cap over-count correction in reward.ts:** The `overcount` calculation (line 289-290) correctly rolls back the rule-level tracker when the global cap clips a reward.

7. **Bank name drift risk (C21-03):** Still present — `ALL_BANKS` in FileDropzone, `formatIssuerNameKo` in formatters.ts, and `BANK_SIGNATURES` in detect.ts are three independent hardcoded lists that must be kept in sync. Any new bank requires updating all three.

---

## Summary of Active Findings (New in Cycle 22)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C22-01 | MEDIUM | High | `CategoryBreakdown.svelte:114,170` | "Other" combined bar can overflow when its percentage exceeds top individual category |
| C22-02 | LOW | High | `OptimalCardMap.svelte:19` | `Math.max(...spread)` stack overflow risk (same class as D-73/D-89) |
| C22-03 | LOW | High | `CardGrid.svelte:19` | `Math.max(...spread)` stack overflow risk (same class as D-73/D-89) |
