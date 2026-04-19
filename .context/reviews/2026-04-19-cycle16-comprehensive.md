# Cycle 16 — Comprehensive Multi-Angle Code Review

**Date:** 2026-04-19
**Reviewer:** All specialist angles (code quality, performance, security, architecture, debugger, test, UI/UX)
**Scope:** Full repository — all packages/core, apps/web, packages/rules, tools

---

## Verification of Prior Cycle Findings

### Previously Fixed (Confirmed in Current Code)

| Finding | Status | Evidence |
|---------|--------|----------|
| C15-01 | FIXED | `greedy.ts:222-224` now does `categoryLabels?.get(r.category) ?? CATEGORY_NAMES_KO[r.category] ?? r.categoryNameKo` in `buildCardResults` |
| C15-05 | FIXED | `SavingsComparison.svelte:22` `CardBreakdown` interface now includes `rate: number` |

### Previously Deferred (Still Deferred)

All prior deferred items (D-01 through D-99) remain unchanged and are documented in `.context/plans/00-deferred-items.md`.

---

## Deep Review — New Findings

### C16-01: `cachedCoreRules` cache ignores `cardIds` filter — stale rules returned

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/analyzer.ts:47, 152-153, 194-196`
- **Description:** In `optimizeFromTransactions`, the function first filters `cardRules` by `options.cardIds` (lines 152-153), but then checks `if (!cachedCoreRules)` and caches the unfiltered `toCoreCardRuleSets(cardRules)` result (lines 194-196). However, the `cachedCoreRules` variable is populated BEFORE the cardIds filter is applied — wait, no. Actually, looking more carefully: `cardRules` at line 194 is the already-filtered list (if `cardIds` is provided). The first call without `cardIds` caches the full list. The second call WITH `cardIds` skips the cache population (because `cachedCoreRules` is already non-null) and uses the stale full list. This means `options.cardIds` is silently ignored on any call after the first.
- **Concrete failure scenario:** User uploads a statement and the initial optimization uses all 683 cards (caching the full list). Then the user applies a `cardIds` filter (e.g., selecting only their own cards). The second optimization call ignores the filter and optimizes against all 683 cards again.
- **Fix:** Either (a) do not cache when `cardIds` is provided, or (b) move the cache before the cardIds filter and always apply the filter after cache retrieval, or (c) remove the cache entirely since `toCoreCardRuleSets` is a simple map that takes < 1ms.
- **Note:** Currently, `cardIds` is never passed from the web UI (the `AnalyzeOptions` interface defines it but no component sets it). This means the bug is latent but not currently triggered.

### C16-02: `categorySpending` in `buildConstraints` uses `tx.category` instead of `categoryKey` — subcategory spending not aggregated correctly

- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/optimizer/constraints.ts:20-23`
- **Description:** `buildConstraints` aggregates `categorySpending` using `tx.category` as the key (line 22-23). This means a transaction with `category: 'dining', subcategory: 'cafe'` contributes to the `dining` total, not the `dining.cafe` total. However, the optimizer and calculator use `buildCategoryKey(tx.category, tx.subcategory)` for everything else (reward calculation, assignment grouping). The `categorySpending` map is labeled "reporting-only" and is only used in tests, but it creates a semantic inconsistency: if anyone relies on `categorySpending` to get per-subcategory totals, they'll get the wrong numbers.
- **Concrete failure scenario:** A developer adds a feature that uses `constraints.categorySpending` to display per-category spending breakdown. Subcategories like `dining.cafe` would be missing from the map — all cafe spending would be lumped under `dining`.
- **Fix:** Change `categorySpending` to use `buildCategoryKey(tx.category, tx.subcategory)` as the key, matching the rest of the system. Or remove `categorySpending` entirely since it's not used by the optimizer (only in tests).

### C16-03: `categorySpending` is dead code in the optimizer — only used in tests

- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/optimizer/constraints.ts:6, 20-23`
- **Description:** The `categorySpending` field in `OptimizationConstraints` is computed by `buildConstraints` but never read by `greedyOptimize` or `ilpOptimize`. It's only accessed in the test file `optimizer.test.ts` (lines 320-321). This is dead weight in the public API — it allocates a Map and iterates all transactions for no runtime benefit.
- **Concrete failure scenario:** No runtime impact, but it adds unnecessary computation and API surface. Removing it would simplify `OptimizationConstraints` and `buildConstraints`.
- **Fix:** Remove `categorySpending` from `OptimizationConstraints` and `buildConstraints`. Update the test to compute it locally if needed.

### C16-04: `buildConstraints` double-counts negative transactions in `categorySpending`

- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/optimizer/constraints.ts:22-23`
- **Description:** `buildConstraints` iterates `preservedTransactions` and sums `tx.amount` into `categorySpending` without checking `tx.amount > 0`. However, `calculateRewards` (line 190) and `greedyOptimize` (line 260) both filter out transactions with `amount <= 0`. This means a refund transaction (negative amount) would be subtracted from the category spending total, creating a discrepancy between `categorySpending` and the actual spending that the optimizer considers.
- **Concrete failure scenario:** A CSV file contains a -50,000 refund. `categorySpending` would show `dining: 100,000 - 50,000 = 50,000`, but the optimizer only sees the 100,000 spending transaction. If `categorySpending` were used for reporting, the displayed total would be wrong.
- **Fix:** Add `if (tx.amount > 0)` guard before the `categorySpending.set()` call, or remove `categorySpending` per C16-03.

### C16-05: `Taxonomy.findCategory` iterates all keywords for every substring search — O(n*m) on every uncategorized merchant

- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/categorizer/taxonomy.ts:68-74, 90-98`
- **Description:** `findCategory` performs two full-keyword-map iterations for substring and fuzzy matching (lines 68-74 and 90-98). The `MerchantMatcher.match` method also iterates `ALL_KEYWORDS` for substring matching (lines 52-68). For each uncategorized merchant name, this means 3 full iterations of the keyword map. With ~2000 keywords and typical transaction counts, this is acceptable, but it could be optimized with a trie or prefix index.
- **Concrete failure scenario:** No current performance issue — the keyword map is small enough. But if the keyword list grows significantly (> 10,000 entries), the per-transaction cost would become noticeable.
- **Fix:** No immediate action needed. If keyword counts grow, implement a trie-based prefix index for substring matching.

### C16-06: `index.astro` has stale fallback values different from `Layout.astro`

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/pages/index.astro:7-9` vs `apps/web/src/layouts/Layout.astro:15-17`
- **Description:** `index.astro` has fallback values `totalCards = 561, totalIssuers = 24, totalCategories = 16`, while `Layout.astro` has `totalCards = 683, totalIssuers = 24, totalCategories = 45`. The cards count differs (561 vs 683) and categories differ (16 vs 45). If `cards.json` is unavailable at build time, the home page shows 561+ cards while the footer shows 683+. This is already tracked as D-44 but the inconsistency between the two files themselves is new.
- **Concrete failure scenario:** Build fails to read `cards.json`. Home page shows "561+ 카드" while the footer on the same page shows "683+ 카드".
- **Fix:** Extract the fallback values to a shared constant, or remove fallbacks and show "—" instead.

### C16-07: `SavingsComparison.svelte` count-up animation `$effect` doesn't clean up properly on rapid re-renders

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:53-69`
- **Description:** The `$effect` at line 53 starts a `requestAnimationFrame` loop for the count-up animation. The cleanup function cancels the animation frame. However, when `opt.savingsVsSingleCard` changes rapidly (e.g., during reoptimize), the effect cleanup and restart can cause a visual flicker because `startVal` is read from the current `displayedSavings` state, which may be mid-animation. The transition from the old value to the new value should ideally start from the current displayed value (which it does), but if the effect is re-triggered before the previous animation completes, the intermediate `displayedSavings` value may be inconsistent.
- **Concrete failure scenario:** User clicks "변경 적용" (reoptimize) while the count-up animation is still playing. The animation restarts from the mid-point value, which may look jerky but is not incorrect.
- **Fix:** No action needed — the behavior is acceptable and the cleanup function correctly cancels the previous animation frame.

---

## Final Sweep — Cross-File Interactions

### C16-08: `buildCategoryKey` is exported from `reward.ts` but only used internally

- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/calculator/reward.ts:28-30`, `packages/core/src/index.ts` (not re-exported)
- **Description:** `buildCategoryKey` is exported from `reward.ts` and imported by `greedy.ts`. However, it's not re-exported from `packages/core/src/index.ts`. This means external consumers can't use the same key-building logic. Since the function is used in two places (reward.ts internally and greedy.ts), the export is correct for internal use. No action needed unless external consumers need it.
- **Fix:** No action needed. If external consumers need `buildCategoryKey`, re-export it from `index.ts`.

### C16-09: `RewardRule.conditions` typed as `Record<string, unknown>` in web but `RewardConditions` in core

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/cards.ts:35` vs `packages/rules/src/schema.ts:23-28`
- **Description:** The web `CardRuleSet` interface types `conditions` as `Record<string, unknown>` (line 35), while the rules package's schema types it as `RewardConditions` with specific fields (`minTransaction`, `excludeOnline`, `specificMerchants`, `note`). The `toCoreCardRuleSets` adapter in `analyzer.ts` passes `conditions` through as-is, relying on the Zod schema to have already validated it. This is safe because the data comes from `cards.json` which is validated at build time. But the loose typing in the web interface means TypeScript won't catch direct access to `conditions.minTransaction` in web code.
- **Concrete failure scenario:** A web component tries to access `rule.conditions?.minTransaction` and TypeScript doesn't type-check it. The value exists at runtime but the type doesn't reflect it.
- **Fix:** Import and use the `RewardConditions` type from `@cherrypicker/rules` in the web `CardRuleSet` interface, or add a local type that matches.

---

## Summary of New Findings

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C16-01 | MEDIUM | High | `analyzer.ts:47,152-153,194-196` | `cachedCoreRules` cache ignores `cardIds` filter — stale full rules returned on subsequent filtered calls |
| C16-02 | LOW | High | `constraints.ts:20-23` | `categorySpending` uses `tx.category` instead of `categoryKey` — subcategory spending not aggregated correctly |
| C16-03 | LOW | High | `constraints.ts:6,20-23` | `categorySpending` is dead code — only used in tests, adds unnecessary computation and API surface |
| C16-04 | LOW | High | `constraints.ts:22-23` | `categorySpending` double-counts negative transactions — refund amounts subtracted from totals |
| C16-05 | LOW | High | `taxonomy.ts:68-74,90-98` | `findCategory` iterates all keywords for every substring/fuzzy search — O(n*m) per uncategorized merchant |
| C16-06 | LOW | High | `index.astro:7-9` vs `Layout.astro:15-17` | Stale fallback values differ between home page (561 cards, 16 categories) and layout (683 cards, 45 categories) |
| C16-07 | LOW | Medium | `SavingsComparison.svelte:53-69` | Count-up animation `$effect` can flicker on rapid re-renders during reoptimize |
| C16-08 | LOW | High | `reward.ts:28-30` | `buildCategoryKey` not re-exported from `index.ts` — external consumers can't use same key logic |
| C16-09 | LOW | Medium | `cards.ts:35` vs `schema.ts:23-28` | `conditions` typed as `Record<string, unknown>` in web but `RewardConditions` in core — loose typing |

---

## Actionable Findings

### MEDIUM (should fix this cycle)
1. C16-01: Fix `cachedCoreRules` cache to not ignore `cardIds` filter — either skip cache when filtering, or apply filter after cache retrieval

### LOW (defer or accept)
- C16-02 (categorySpending key mismatch — reporting-only), C16-03 (categorySpending dead code — minor cleanup), C16-04 (categorySpending negative amounts — extends C16-03), C16-05 (substring O(n*m) — acceptable at current scale), C16-06 (stale fallbacks — extends D-44), C16-07 (animation flicker — acceptable), C16-08 (buildCategoryKey not exported — minor API gap), C16-09 (loose conditions typing — safe due to Zod validation)
