# Cycle 91 Comprehensive Review

**Date:** 2026-04-22
**Scope:** Full repository re-review with focus on fresh findings and verification of open items from C90 aggregate

---

## Verification of Prior Cycle Fixes (C90 Open Findings)

| Finding | Status | Evidence |
|---|---|---|
| C89-01 | **CONFIRMED OPEN (LOW)** | `VisibilityToggle.svelte:70-71` forward-direction `classList.toggle` still has no `isConnected` guard. Cleanup function at line 123 has the guard. `classList.toggle` on a disconnected element is a no-op, so no user-facing bug. |
| C89-02 | **CONFIRMED OPEN (LOW)** | `CategoryBreakdown.svelte:129` `rawPct < 2` threshold uses unrounded value while displayed pct is rounded. Known design choice documented in code comment. |
| C89-03 | **CONFIRMED OPEN (LOW)** | `formatters.ts:155-157` `formatYearMonthKo` uses `m!` non-null assertion after length check. Defensive chain works via `Number.isNaN` guard. |
| C90-02 | **CONFIRMED OPEN (LOW)** | KakaoBank issuer badge uses `#fee500` (yellow) background with white text -- fails WCAG AA contrast. Same root cause as C4-09/C8-05. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C91-01 | MEDIUM | HIGH | `SavingsComparison.svelte:238,240` | During savings animation transition from negative to positive (or vice versa), `displayedSavings` passes through values with the wrong sign relative to the final target. When `opt.savingsVsSingleCard >= 0` (final is positive) but `displayedSavings < 0` (still animating from a previous negative value), the code uses `displayedSavings` directly instead of `Math.abs(displayedSavings)`, causing `formatWon()` to render "-X원" under the "추가 절약" label. The same issue exists on line 240 for `displayedAnnualSavings`. The direction label always uses the FINAL target for its decision, but the number display uses the animated intermediate value without ensuring its sign matches the label. |

### C91-01 Detailed Analysis

**Root cause:** Lines 238 and 240 use `opt.savingsVsSingleCard < 0 ? Math.abs(displayedSavings) : displayedSavings` for the display value. This applies `Math.abs` only when the FINAL target is negative, but during animation from a negative to a positive target, `displayedSavings` is still negative while `opt.savingsVsSingleCard` is already positive, so `Math.abs` is not applied.

**Concrete failure scenario:**
1. User uploads a statement where cherry-picking costs 5,000 won/month (suboptimal, `savingsVsSingleCard = -5000`)
2. User edits categories and re-optimizes; cherry-picking now saves 50,000 won/month (`savingsVsSingleCard = 50000`)
3. The 600ms animation starts from `lastTargetSavings = -5000` to `target = 50000`
4. During the first ~60ms, `displayedSavings` is around -3000 (still negative)
5. `opt.savingsVsSingleCard < 0` is false (final is positive), so `displayedSavings` is used directly
6. `formatWon(-3000)` renders "-3,000원" under the "추가 절약" label
7. The display shows "추가 절약\n-3,000원" for ~60ms -- contradictory

**Fix:** Since the direction is always communicated by the label ("추가 절약" vs "추가 비용"), always show the absolute value of the animated number:

Line 238: Change `opt.savingsVsSingleCard < 0 ? Math.abs(displayedSavings) : displayedSavings` to `Math.abs(displayedSavings)`

Line 240: Change `opt.savingsVsSingleCard < 0 ? Math.abs(displayedAnnualSavings) : displayedAnnualSavings` to `Math.abs(displayedAnnualSavings)`

This is safe because:
- When final is positive, label says "추가 절약" -- we want magnitude (abs is correct)
- When final is negative, label says "추가 비용" -- we want magnitude (abs is also correct)
- During normal animation (positive to positive), `displayedSavings` is positive, so abs is a no-op

---

## Cross-File Interaction Review

### 1. Parser Chain Consistency (re-verified)
All three parsers (CSV, XLSX, PDF) delegate date parsing to `date-utils.ts` via `parseDateStringToISO()`. Amount parsing follows consistent patterns:
- CSV: `parseAmount()` returns `number | null`, `isValidAmount()` type guard filters zero/negative
- XLSX: `parseAmount()` returns `number | null`, inline `if (amount <= 0) continue`
- PDF: `parseAmount()` returns `number | null`, inline `if (amount > 0)` filter

All three paths correctly skip zero/negative amounts. No divergence found.

### 2. Store Consistency (re-verified)
`analysisStore.reoptimize()` captures a `snapshot` at function entry to prevent reactive variable changes during async gaps (C81-01). The snapshot is used for `...snapshot` spread at the end. The `previousMonthSpendingOption` is correctly preserved from the snapshot. No race condition found.

### 3. Animation Sign Consistency (NEW - C91-01)
The SavingsComparison animation uses `displayedSavings` (animated intermediate value) for the number display while using `opt.savingsVsSingleCard` (final target) for sign/label decisions. This creates a window where the displayed number contradicts the direction label. See C91-01 above.

### 4. Category Label Caching (known deferred)
`cachedCategoryLabels` in `store.svelte.ts:378` is not invalidated on Astro View Transitions (C70-02). The cache is reset only on `store.reset()`. Same as prior cycles.

### 5. Session Storage Persistence (re-verified)
`persistToStorage()` correctly handles size limits, quota exceeded errors, non-quota errors, schema versioning, and validation on load. No new issues found.

---

## Still-Open Actionable Findings (fixable this cycle)

| ID | Severity | Description | Action |
|---|---|---|---|
| C91-01 | MEDIUM | SavingsComparison animated display sign contradicts label during transition | Apply `Math.abs()` unconditionally to displayed animated values |

---

## Deferred Findings (carried forward, not new)

All prior deferred findings from the C90 aggregate remain in effect. No changes to severity, confidence, or deferral status this cycle. The following remain the highest-priority deferred items by severity:

| ID | Severity | Description |
|---|---|---|
| C86-16/C88-09 | MEDIUM | No integration test for multi-file upload |
| C67-01/C74-06 | MEDIUM | Greedy optimizer O(m*n*k) quadratic behavior |
| C33-01/C66-02/C86-12 | MEDIUM | MerchantMatcher substring scan O(n) per transaction |
| C21-02/C33-02/C86-11 | MEDIUM | cachedCategoryLabels stale across redeployments |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
