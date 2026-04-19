# Plan 27 — Medium-Priority Fixes (Cycle 16)

**Priority:** MEDIUM
**Findings addressed:** C16-02, C16-08, C16-09
**Status:** TODO

---

## Task 1: N/A — C16-02 is superseded by C16-03 (categorySpending removal)

C16-02 (categorySpending using tx.category instead of categoryKey) is moot if Task 2 in Plan 26 removes categorySpending entirely. If Plan 26 Task 2 is not implemented, fix the key in `buildConstraints` to use `buildCategoryKey(tx.category, tx.subcategory)`.

---

## Task 2: Re-export `buildCategoryKey` from `@cherrypicker/core` index (C16-08)

**Finding:** C16-08 — `buildCategoryKey` is exported from `reward.ts` but not re-exported from `packages/core/src/index.ts`. External consumers can't use the same key-building logic.

**File:** `packages/core/src/index.ts`

**Implementation:**

Add `buildCategoryKey` to the re-exports:

```ts
export { calculateRewards, buildCategoryKey } from './calculator/reward.js';
```

**Commit:** `feat(core): ✨ re-export buildCategoryKey from package index`

---

## Task 3: Tighten `conditions` typing in web `CardRuleSet` (C16-09)

**Finding:** C16-09 — `conditions` is typed as `Record<string, unknown>` in the web `CardRuleSet` but `RewardConditions` in the rules package.

**File:** `apps/web/src/lib/cards.ts:35`

**Implementation:**

Replace the loose `conditions` type with a local interface that matches the rules schema:

```ts
interface WebRewardConditions {
  minTransaction?: number;
  excludeOnline?: boolean;
  specificMerchants?: string[];
  note?: string;
  [key: string]: unknown;
}
```

Then use it in the `rewards` array:

```ts
conditions?: WebRewardConditions;
```

**Commit:** `fix(web): 🐛 tighten conditions typing in CardRuleSet to match rules schema`

---

## Progress

- [x] Task 1: N/A (superseded by Plan 26 Task 2)
- [x] Task 2: Re-export buildCategoryKey from core index
- [x] Task 3: Tighten conditions typing in web CardRuleSet
