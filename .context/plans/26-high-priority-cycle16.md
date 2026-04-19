# Plan 26 — High-Priority Fixes (Cycle 16)

**Priority:** HIGH
**Findings addressed:** C16-01
**Status:** TODO

---

## Task 1: Fix `cachedCoreRules` cache to respect `cardIds` filter

**Finding:** C16-01 — `cachedCoreRules` in `optimizeFromTransactions` caches the unfiltered card rules on first call. When a subsequent call provides `options.cardIds`, the cached full list is returned instead of the filtered list, silently ignoring the filter.

**File:** `apps/web/src/lib/analyzer.ts:47, 152-153, 194-196`

**Implementation:**

The simplest and most correct fix is to always cache the unfiltered list, but apply the `cardIds` filter AFTER retrieving from cache. This way:
1. The cache stores the full 683-card rules (never stale)
2. The `cardIds` filter is applied on every call, not cached

**Specific changes:**

In `analyzer.ts`, restructure `optimizeFromTransactions`:

```ts
// Cache the FULL unfiltered rules (never stale since cards.json doesn't change)
if (!cachedCoreRules) {
  cachedCoreRules = toCoreCardRuleSets(await getAllCardRules());
}
let coreRules = cachedCoreRules;

// Apply cardIds filter AFTER cache retrieval
if (options?.cardIds && options.cardIds.length > 0) {
  const idSet = new Set(options.cardIds);
  coreRules = coreRules.filter(r => idSet.has(r.card.id));
}

const optimizationResult = greedyOptimize(constraints, coreRules);
```

Also remove the earlier `cardRules` filter (lines 152-153) since the filter is now applied after conversion.

**Important:** Move `let cardRules = await getAllCardRules();` before the cache check, and use it for cache population. Remove the `cardIds` filter from the pre-conversion `cardRules`.

**Commit:** `fix(core): 🐛 fix cachedCoreRules ignoring cardIds filter in optimizeFromTransactions`

---

## Task 2: Remove dead `categorySpending` from `OptimizationConstraints` (C16-03/C16-04)

**Finding:** C16-03 and C16-04 — `categorySpending` is dead code (only used in tests) and incorrectly includes negative transaction amounts.

**File:** `packages/core/src/optimizer/constraints.ts:6,20-23`

**Implementation:**

1. Remove `categorySpending` from the `OptimizationConstraints` interface (line 6)
2. Remove the `categorySpending` computation from `buildConstraints` (lines 20-23)
3. Remove the `categorySpending` from the return value (line 32)
4. Update the test file `packages/core/__tests__/optimizer.test.ts` to remove the `categorySpending` tests (lines 311-321) or update them to test locally

**Commit:** `refactor(core): ♻️ remove dead categorySpending from OptimizationConstraints`

---

## Task 3: Sync stale fallback values in `index.astro` with `Layout.astro` (C16-06)

**Finding:** C16-06 — Home page has fallback values `561 cards, 16 categories` while layout has `683 cards, 45 categories`.

**File:** `apps/web/src/pages/index.astro:7-9`

**Implementation:**

1. Update the fallback values in `index.astro` to match `Layout.astro`:
```ts
let totalCards = 683;
let totalIssuers = 24;
let totalCategories = 45;
```

**Commit:** `fix(web): 🐛 sync stale fallback card stats in home page with layout`

---

## Progress

- [x] Task 1: Fix cachedCoreRules cache to respect cardIds filter
- [x] Task 2: Remove dead categorySpending from OptimizationConstraints
- [x] Task 3: Sync stale fallback values in index.astro
