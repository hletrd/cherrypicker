# Cycle 94 Plan -- Savings Sign-Prefix Unification

## New Findings Addressed

### C94-01: ReportContent uses conditional Math.abs while SavingsComparison uses unconditional (LOW, MEDIUM confidence)

**File:** `ReportContent.svelte:48`, `VisibilityToggle.svelte:97`, `SavingsComparison.svelte:242-244`

**Problem:** The savings sign-prefix logic is triplicated across three components (C92-01). Additionally, within that triplication, ReportContent and VisibilityToggle use a conditional `Math.abs()` pattern (`opt.savingsVsSingleCard < 0 ? Math.abs(x) : x`) while SavingsComparison uses unconditional `Math.abs(x)`. Both are semantically equivalent (Math.abs on a non-negative value returns the same value), but the conditional form is harder to reason about and inconsistent.

**Plan:**
1. Extract a shared `formatSavingsValue(value: number): string` helper in `formatters.ts` that encapsulates the sign-prefix logic: `>= 100` threshold for `+` prefix, and `Math.abs()` for display.
2. Update all three components to use the shared helper, eliminating both the triplication and the style inconsistency.
3. The helper will also simplify the VisibilityToggle DOM-mutating code that directly manipulates textContent.

**Implementation steps:**
1. Add `formatSavingsValue(value: number): string` to `apps/web/src/lib/formatters.ts` -- returns `'+' + formatWon(Math.abs(value))` when `value >= 100`, `formatWon(Math.abs(value))` otherwise.
2. Update `SavingsComparison.svelte:242` -- replace inline `Math.abs(displayedSavings)` + `formatWon()` + `>= 100` threshold with `formatSavingsValue(displayedSavings)`.
3. Update `SavingsComparison.svelte:244` -- same for annual savings.
4. Update `ReportContent.svelte:48` -- replace conditional `Math.abs()` + `formatWon()` with `formatSavingsValue(opt.savingsVsSingleCard)`.
5. Update `VisibilityToggle.svelte:97` -- replace inline sign-prefix + `formatWon()` with `formatSavingsValue(opt.savingsVsSingleCard)`.

**Status:** **PENDING IMPLEMENTATION**

---

### C92-01: Savings sign-prefix logic triplicated across components without shared helper (LOW, MEDIUM confidence)

**Files:** `SavingsComparison.svelte`, `VisibilityToggle.svelte`, `ReportContent.svelte`

**Problem:** The savings display logic (sign-prefix, magnitude, threshold for `+`) is duplicated in three places without a shared helper, making it harder to maintain consistency.

**Plan:** Addressed by C94-01 implementation above -- the shared `formatSavingsValue` helper eliminates the triplication.

**Status:** **PENDING IMPLEMENTATION** (merged with C94-01)

---

## Deferred Findings

All prior deferred findings from cycle 93 remain deferred with the same severity and exit criteria. The only new finding (C94-01) is being addressed this cycle.

### Deferred items (unchanged from prior cycles)

These LOW/MEDIUM items remain deferred per prior cycle decisions:

| Finding | Severity | Exit Criterion |
|---|---|---|
| MerchantMatcher O(n) scan (C33-01) | MEDIUM | Performance bottleneck becomes measurable in profiling; user-reported latency |
| cachedCategoryLabels staleness (C21-02) | MEDIUM | User reports stale labels after redeployment |
| Greedy optimizer O(m*n*k) (C67-01) | MEDIUM | User-reported timeout with large card sets |
| No integration test for multi-file upload (C86-16) | MEDIUM | Manual QA failure or regression in multi-file path |
| loadCategories empty on AbortError (C41-05) | MEDIUM | User reports empty dropdowns after navigation |
| BANK_SIGNATURES duplication (C7-07) | LOW | New bank added and only one location updated |
| CATEGORY_NAMES_KO drift (C64-03) | LOW | YAML taxonomy update breaks CLI display |
| VisibilityToggle DOM mutation (C18-01) | LOW | Svelte 5 deprecates direct DOM manipulation in effects |
| Annual savings *12 projection (C77-02) | LOW | User reports misleading projection (transparently labeled) |
| Mobile menu focus trap (C86-13) | LOW | Accessibility audit finding |
| KakaoBank badge contrast (C90-02) | LOW | Accessibility audit finding |
| All other LOW items from prior cycles | LOW | Per-item exit criteria in aggregate |

---

## Archived Plans (Fully Implemented)

All prior cycle plans through C93 have been fully implemented. The codebase is stable with no regressions.
