# Plan 24 — High-Priority Fixes (Cycle 15)

**Priority:** HIGH
**Findings addressed:** C15-01
**Status:** DONE

---

## Task 1: Fix `categoryNameKo` in per-card breakdown — look up Korean labels in `buildCardResults`

**Finding:** C15-01 — `calculateRewards` sets `categoryNameKo` to the raw `categoryKey` string (e.g., `"dining.cafe"`) instead of looking up the Korean label. The `CardRewardResult.byCategory[].categoryNameKo` field always contains the English key. The assignment view is correct because `buildAssignments` does the label lookup, but the per-card breakdown shows English keys.

**File:** `packages/core/src/optimizer/greedy.ts` (in `buildCardResults`)

**Implementation:**
1. In `buildCardResults` (line 172), pass `categoryLabels` as an additional parameter.
2. After creating `cardResults`, iterate over each `CardRewardResult.byCategory` entry and replace `categoryNameKo` with the label lookup: `categoryLabels?.get(entry.category) ?? entry.categoryNameKo`.
3. The `categoryLabels` Map is already available in `greedyOptimize` via `constraints.categoryLabels`.

**Specific changes:**

In `greedy.ts`, modify `buildCardResults` function signature to accept `categoryLabels`:
```ts
function buildCardResults(
  cardRules: CardRuleSet[],
  cardPreviousSpending: Map<string, number>,
  assignedTransactionsByCard: Map<string, CategorizedTransaction[]>,
  categoryLabels?: Map<string, string>,
): CardRewardResult[] {
```

After computing `byCategory` (line 186), add label lookup:
```ts
const byCategory: CategoryReward[] = output.rewards.map(r => ({
  ...r,
  categoryNameKo: categoryLabels?.get(r.category) ?? CATEGORY_NAMES_KO[r.category] ?? r.categoryNameKo,
}));
```

Update the call site in `greedyOptimize` (line 254):
```ts
const cardResults = buildCardResults(cardRules, cardPreviousSpending, assignedTransactionsByCard, constraints.categoryLabels);
```

**Commit:** `fix(core): 🐛 use Korean labels in per-card reward breakdown instead of English category keys`

---

## Task 2: Add `rate` property to `CardBreakdown` interface in SavingsComparison

**Finding:** C15-05 — The `CardBreakdown` interface is missing the `rate` property that is added at runtime.

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:22-26`

**Implementation:**
1. Add `rate: number` to the `CardBreakdown` interface:
```ts
interface CardBreakdown {
  cardId: string;
  cardName: string;
  spending: number;
  reward: number;
  rate: number;
}
```

**Commit:** `fix(web): 🐛 add rate property to CardBreakdown interface for type safety`

---

## Progress

- [x] Task 1: Fix categoryNameKo in per-card breakdown — Committed (0000000d1)
- [x] Task 2: Add rate property to CardBreakdown interface — Committed (0000000f5)
