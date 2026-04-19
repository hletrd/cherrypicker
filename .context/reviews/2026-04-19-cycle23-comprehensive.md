# Comprehensive Code Review — Cycle 23

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 23)
**Scope:** Full repository — all packages, apps, and shared code

---

## Methodology

Read every source file in the repository. Cross-referenced with prior cycle 1-22 reviews, deferred items (D-01 through D-105), and the aggregate. Focused on finding genuinely NEW issues not previously reported. Verified that prior cycle 22 findings (C22-01 through C22-03) have been addressed or are still present.

---

## Verification of Cycle 22 Findings

| Finding | Status | Evidence |
|---|---|---|
| C22-01 | **FIXED** | `CategoryBreakdown.svelte:114` now uses `categories.reduce((max, c) => Math.max(max, c.percentage), 1)` — includes "other" in max calculation |
| C22-02 | **FIXED** | `OptimalCardMap.svelte:19` now uses `assignments.reduce((max, a) => Math.max(max, a.rate), 0.001)` |
| C22-03 | **FALSE POSITIVE** | `CardGrid.svelte` never had the `Math.max(...spread)` pattern. Confirmed by code inspection. |

---

## New Findings

### C23-01: `won_per_liter` fuel discount units produce zero reward in `calculateFixedReward`

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/core/src/calculator/reward.ts:141-169`
- **Description:** The `calculateFixedReward` function handles three unit types: `won_per_day`, `mile_per_1500won`, and `null`/`undefined`. Any other unit value falls through to the final `return 0` statement. There are 34 instances of `unit: "won_per_liter"` across 17 card YAML files (e.g., `shinhan/my-car.yaml`, `kb/min-check.yaml`, `lotte/digiloca-auto.yaml`). These fuel discount rules have `fixedAmount` set (e.g., 80 Won per liter) but the `won_per_liter` unit is not handled by `calculateFixedReward`, so the function returns 0 for every fuel transaction. The comment at line 165-167 says "Do not fabricate unit-based reward quantities from missing transaction metadata" — but `won_per_liter` is a well-defined per-transaction discount that depends on `fixedAmount` and the transaction amount (similar to how `mile_per_1500won` works), not on missing transaction metadata like fuel volume.
- **Failure scenario:** A user with a Shinhan My Car card that offers 80 Won/liter fuel discount uploads a statement with fuel transactions. The optimizer assigns fuel spending to this card expecting a reward, but `calculateFixedReward` returns 0 because `won_per_liter` is not a recognized unit. The user sees no fuel discount at all for a card specifically marketed for fuel savings.
- **Fix:** Add a `won_per_liter` case to `calculateFixedReward`. The most reasonable approximation (since we don't have fuel volume in the transaction data) is to treat the fixed amount as a per-transaction discount (same as the `null`/`undefined` case), or alternatively compute it proportionally based on a standard fuel price. The simplest correct approach: `if (tierRate.unit === 'won_per_liter') return fixedAmount;` — this gives the per-transaction discount amount, which matches how Korean card apps typically display it in their per-transaction breakdown.

### C23-02: `SavingsComparison.svelte` displays negative annual savings without sign when `savingsVsSingleCard` is negative

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:175`
- **Description:** Line 175 shows `연간 약 {formatWon(opt.savingsVsSingleCard * 12)} 절약`. When `savingsVsSingleCard` is negative (which is valid — the greedy optimizer is not globally optimal and can produce negative savings vs. the best single card), `formatWon` already formats the negative number with a minus sign due to `toLocaleString('ko-KR')`. However, the label says "절약" (savings) which implies a positive value. A negative number displayed as "-5,000원 절약" is confusing — it should say something like "추가 비용" (additional cost) instead of "절약" (savings). Additionally, line 173 shows `+{formatWon(displayedSavings)}` — the `+` prefix is always shown, even when the value is negative, producing "+-5,000원" which is clearly a display bug.
- **Failure scenario:** The greedy optimizer produces a sub-optimal result where using multiple cards yields less reward than using a single best card. The UI shows "+-5,000원" in the savings card and "연간 약 -60,000원 절약" below it, which is nonsensical.
- **Fix:** In the green savings card (line 173), use `formatWon(displayedSavings)` without the `+` prefix when the value is negative. For line 175, change the label from "절약" to either "절약" when positive or "추가 비용" when negative.

---

## Final Sweep — Cross-File Interactions

1. **`won_per_liter` impact scope:** The 34 YAML instances span 6 issuers (shinhan, kb, lotte, dgb, samsung, hana) and affect both credit and check cards. This is a systematic gap, not an edge case.

2. **Bank name drift (C21-03):** Still present — `ALL_BANKS` in FileDropzone, `formatIssuerNameKo` in formatters.ts, and `BANK_SIGNATURES` in detect.ts are three independent hardcoded lists.

3. **`BankId` type duplication:** `packages/parser/src/types.ts:2` and `apps/web/src/lib/parser/types.ts:2` define identical `BankId` union types. Adding a new bank requires updating both files. Not a runtime bug but a maintenance hazard.

4. **`RawTransaction` / `ParseResult` / `ParseError` / `BankAdapter` type duplication:** Same two files define identical interfaces. Same maintenance risk.

5. **`inferYear` duplication:** The `inferYear` function is independently defined in three places: `apps/web/src/lib/parser/csv.ts:29`, `apps/web/src/lib/parser/pdf.ts:137`, and `apps/web/src/lib/parser/xlsx.ts:183`. All three implementations are identical.

6. **`parseDateToISO` duplication:** Defined in `apps/web/src/lib/parser/csv.ts:39`, `apps/web/src/lib/parser/pdf.ts:146`, and `apps/web/src/lib/parser/xlsx.ts:192`. These are similar but not identical — the CSV version handles more date formats (e.g., YYYYMMDD) than the PDF version.

7. **`parseAmount` inconsistency:** The web CSV parser returns NaN for unparseable amounts (which are then filtered by `isValidAmount`), while the web PDF parser returns 0 (and filters by `amount > 0`). Both approaches work correctly for their contexts, but the inconsistency could confuse future maintainers.

8. **`cachedCoreRules` cache invalidation:** In `apps/web/src/lib/analyzer.ts:47`, `cachedCoreRules` is a module-level variable that persists across optimizer calls. Since the card data comes from static JSON loaded at runtime, this cache is safe within a session. However, if `getAllCardRules()` is called with different parameters or the underlying data changes (e.g., during development with HMR), the cache would be stale. This is an acceptable trade-off for production but worth noting.

9. **CSP `'unsafe-inline'` for scripts:** The Layout.astro CSP header includes `'unsafe-inline'` for `script-src`, with a TODO comment explaining it's required for Astro's Svelte island hydration. This is a known limitation, not a new finding.

10. **`report.js` uses `innerHTML`-adjacent DOM construction:** The `el()` helper in `apps/web/public/scripts/report.js` uses `document.createElement` and `setAttribute`, which is safe against XSS. The data comes from sessionStorage which is same-origin. No issue.

---

## Summary of Active Findings (New in Cycle 23)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C23-01 | MEDIUM | High | `packages/core/src/calculator/reward.ts:141-169` | `won_per_liter` fuel discount units produce zero reward — 34 card YAML rules affected |
| C23-02 | LOW | High | `apps/web/src/components/dashboard/SavingsComparison.svelte:173,175` | Negative savings displayed as "+-X원 절약" — sign and label are wrong when `savingsVsSingleCard < 0` |
