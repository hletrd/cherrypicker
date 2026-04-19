# Cycle 15 — Comprehensive Multi-Angle Code Review

**Date:** 2026-04-19
**Reviewer:** All specialist angles (code quality, performance, security, architecture, debugger, test, UI/UX)
**Scope:** Full repository — all packages/core, apps/web, packages/rules, tools

---

## Verification of Prior Cycle Findings

### Previously Fixed (Confirmed in Current Code)

| Finding | Status | Evidence |
|---------|--------|----------|
| C14-01 | FIXED | `greedy.ts:117` now uses `buildCategoryKey(assignment.tx.category, assignment.tx.subcategory)` for grouping key — subcategory breakdown preserved |
| C14-09 | RESOLVED | `reward.ts:113-120` has clear comment explaining mileage rate convention (Won-equivalent percentage) |

### Previously Deferred (Still Deferred)

All prior deferred items (D-01 through D-99) remain unchanged and are documented in `.context/plans/00-deferred-items.md`.

---

## Deep Review — New Findings

### C15-01: `categoryNameKo` in `calculateRewards` always set to `categoryKey` instead of looking up Korean label

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/core/src/calculator/reward.ts:201`
- **Description:** In `calculateRewards`, when creating the bucket for a category, `categoryNameKo` is set to the raw `categoryKey` string (e.g., `"dining.cafe"` or `"dining"`). The Korean label is never looked up. This means `CardRewardResult.byCategory[].categoryNameKo` always returns the English category key instead of a Korean label. The `buildAssignments` function in `greedy.ts` correctly looks up `categoryLabels?.get(categoryKey)`, but `buildCardResults` at `greedy.ts:186` passes the `output.rewards` directly from `calculateRewards` without replacing `categoryNameKo`. As a result, `CardRewardResult.byCategory[].categoryNameKo` shows "dining.cafe" instead of "카페" in the card detail breakdown.
- **Concrete failure scenario:** A user views the card detail breakdown on the dashboard. The `CardRewardResult.byCategory` entries show `categoryNameKo: "dining.cafe"` instead of `categoryNameKo: "카페"`. The assignment view shows correct Korean labels because `buildAssignments` does the lookup, but the per-card breakdown does not.
- **Fix:** Either pass `categoryLabels` into `calculateRewards` (changing its signature), or post-process `categoryNameKo` in `buildCardResults` by looking up labels from `constraints.categoryLabels`. The simpler fix is option B — in `buildCardResults`, replace `categoryNameKo` with the label lookup.

### C15-02: `buildAssignments` uses `CATEGORY_NAMES_KO` fallback that doesn't include subcategory keys

- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/optimizer/greedy.ts:7-50, 128`
- **Description:** `buildAssignments` at line 128 has a fallback chain: `categoryLabels?.get(categoryKey) ?? categoryLabels?.get(assignment.tx.category) ?? CATEGORY_NAMES_KO[categoryKey] ?? CATEGORY_NAMES_KO[assignment.tx.category] ?? categoryKey`. The `CATEGORY_NAMES_KO` map (lines 7-50) only contains flat category IDs like `"dining"`, `"cafe"`, `"supermarket"`. It does not contain subcategory key forms like `"dining.cafe"` or `"grocery.supermarket"`. So when `categoryLabels` is not provided, the first `CATEGORY_NAMES_KO[categoryKey]` lookup for a subcategory like `"dining.cafe"` will fail, but the second fallback `CATEGORY_NAMES_KO[assignment.tx.category]` will match `"dining"` — giving the parent category name instead of the subcategory name. This is a minor issue because `categoryLabels` is always provided in the web app, but the core package's standalone behavior has this limitation.
- **Concrete failure scenario:** The CLI tool (`tools/cli`) uses `greedyOptimize` without `categoryLabels`. A subcategory assignment like `dining.cafe` would show `categoryNameKo: "외식"` instead of `"카페"`.
- **Fix:** Add subcategory key entries to `CATEGORY_NAMES_KO` (e.g., `"dining.cafe": "카페"`), or change the fallback to use the subcategory name directly when the dot-notation key is not found.

### C15-03: `SavingsComparison.svelte` `singleBarWidth` calculation is misleading when cherry-pick reward is less than single card

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:78-82`
- **Description:** `singleBarWidth` computes `opt.bestSingleCard.totalReward / opt.totalReward * 100`. This assumes cherry-pick reward is always >= single card reward. When `opt.savingsVsSingleCard` is negative (which shouldn't normally happen but is theoretically possible if greedy performs worse), the bar width exceeds 100% and is clamped to 100 by `Math.min`. The visual would show the single-card bar as 100% while the cherry-pick bar is also 100%, which is visually identical and misleading. More importantly, when the savings are exactly 0 (cherry-pick = single card), `singleBarWidth` correctly returns 100%, but the comparison section still shows redundant identical bars.
- **Concrete failure scenario:** A user has all transactions in a single category. Cherry-pick assigns them all to the same best card. `singleBarWidth` = 100%. Both bars are full width, making the comparison visually unhelpful.
- **Fix:** This extends D-70/C9-02. When savings are 0 or negative, show a "동일" message instead of the bar comparison. Low priority.

### C15-04: `OptimalCardMap.svelte` `toggleRow` uses `a.category` as the expanded row key — but category values are now `categoryKey` format with dots

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:31-38, 89, 97`
- **Description:** After the C14-01 fix, `a.category` values in assignments use the `categoryKey` format (e.g., `"dining.cafe"`). The `expandedRows` Set stores these keys. The `toggleRow` function and `onclick` handler use `a.category` correctly. This works fine — no bug. However, the `aria-label` at line 95 uses `${a.categoryNameKo}` which should be the Korean label. If `categoryNameKo` is correctly populated (which it is when `categoryLabels` is provided), this is fine. If not (standalone CLI), the aria-label would show the English key. This is a minor accessibility concern that's already covered by the `categoryLabels` path in the web app.
- **Concrete failure scenario:** Not a current bug in the web app — only affects the standalone CLI case.
- **Fix:** No action needed for the web app. The CLI case is covered by C15-02.

### C15-05: `CardBreakdown.rate` property is added at runtime but not in the `CardBreakdown` interface

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:22-26, 42`
- **Description:** The `CardBreakdown` interface (lines 22-26) defines `cardId`, `cardName`, `spending`, `reward`. But at line 42, `rate` is added as a spread property: `{ ...entry, rate: ... }`. The TypeScript type for `cardBreakdown` doesn't include `rate`, so the template at line 223 (`{formatRate(card.rate)}`) relies on runtime behavior. This works because the `.map()` at line 40 adds the `rate` property, but TypeScript may not correctly type-check `card.rate`.
- **Concrete failure scenario:** TypeScript compilation may flag `card.rate` as a type error if strict type checking is enabled, or may not catch a typo in `card.ratee`.
- **Fix:** Add `rate: number` to the `CardBreakdown` interface definition.

---

## Final Sweep — Cross-File Interactions

### C15-06: `calculateRewards` creates bucket objects with `?? { ... }` pattern that can lead to stale reference

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `packages/core/src/calculator/reward.ts:197-207`
- **Description:** The bucket creation uses `categoryRewards.get(categoryKey) ?? { category: categoryKey, ... }`. This works correctly because the `??` returns the existing object when the key is present. However, if `categoryRewards.get(categoryKey)` returns a falsy value that isn't `undefined` (which can't happen with Map), a new bucket would be created. This is a theoretical concern — JavaScript Map.get returns `undefined` for missing keys, so the `??` operator always works correctly. The existing `categoryRewards.set(categoryKey, bucket)` calls at lines 212, 219, 293 ensure the bucket is always stored after creation.
- **Concrete failure scenario:** Not a current bug — the `??` pattern is safe for Map.get.
- **Fix:** No action needed.

---

## Summary of New Findings

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C15-01 | MEDIUM | High | `reward.ts:201` | `categoryNameKo` in `calculateRewards` is always set to `categoryKey` (English) — per-card breakdown shows English keys instead of Korean labels |
| C15-02 | LOW | High | `greedy.ts:7-50, 128` | `CATEGORY_NAMES_KO` fallback doesn't include subcategory key format — CLI shows parent category name for subcategories |
| C15-03 | LOW | High | `SavingsComparison.svelte:78-82` | `singleBarWidth` is misleading when cherry-pick reward equals or is less than single card — extends D-70/C9-02 |
| C15-04 | LOW | Medium | `OptimalCardMap.svelte:89,97` | Category key format now uses dots after C14-01 fix — no actual bug but aria-label uses English key when labels unavailable |
| C15-05 | LOW | High | `SavingsComparison.svelte:22-26, 42` | `CardBreakdown` interface missing `rate` property that's added at runtime |
| C15-06 | LOW | Medium | `reward.ts:197-207` | Bucket creation with `?? { ... }` pattern — theoretically safe, confirmed correct for Map.get |

---

## Actionable Findings

### HIGH (should fix this cycle)
1. C15-01: Fix `categoryNameKo` in per-card breakdown by looking up Korean labels in `buildCardResults`

### LOW (defer or accept)
- C15-02 (CATEGORY_NAMES_KO fallback for subcategories — CLI-only), C15-03 (bar comparison when savings=0 — extends D-70), C15-04 (aria-label with categoryKey — covered by categoryLabels), C15-05 (missing rate type — cosmetic), C15-06 (bucket pattern — confirmed correct)
