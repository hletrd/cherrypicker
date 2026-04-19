# Plan 08 — High-Priority Fixes (Cycle 4)

**Priority:** HIGH
**Findings addressed:** C4-01, C4-04, C4-11, C4-10, C4-08
**Status:** DONE

---

## Task 1: Fix SavingsComparison division by zero (C4-01)

**Finding:** `apps/web/src/components/dashboard/SavingsComparison.svelte:70-73` — `savingsPct` computes `opt.savingsVsSingleCard / opt.bestSingleCard.totalReward * 100`. When `totalReward` is 0 and `savingsVsSingleCard` is also 0, the result is `0/0 = NaN`, which displays as "+NaN%".

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte`

**Implementation:**
1. Replace lines 70-73:
```svelte
let savingsPct = $derived.by(() => {
  if (!opt || !opt.bestSingleCard || !opt.bestSingleCard.totalReward) return 0;
  return Math.round((opt.savingsVsSingleCard / opt.bestSingleCard.totalReward) * 100);
});
```
with:
```svelte
let savingsPct = $derived.by(() => {
  if (!opt || !opt.bestSingleCard) return 0;
  const raw = opt.savingsVsSingleCard / opt.bestSingleCard.totalReward;
  return Number.isFinite(raw) ? Math.round(raw * 100) : 0;
});
```

**Commit:** `fix(web): 🛡️ guard SavingsComparison against division by zero`

---

## Task 2: Fix CategoryBreakdown a11y — keyboard/touch access to tooltip (C4-04)

**Finding:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:147-148` — Tooltip triggered by mouse hover and click, but rows lack `tabindex`, `role="button"`, and keyboard handler. The `role="row"` is incorrect for a standalone interactive element.

**File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte`

**Implementation:**
1. Change the outer `<div>` on line 143 from `role="row"` to `role="button"` with `tabindex="0"`:
```svelte
<div
  class="relative rounded-lg px-3 py-2 ..."
  role="button"
  tabindex="0"
  aria-label={cat.labelKo}
  aria-expanded={hoveredIndex === i}
  onmouseenter={() => (hoveredIndex = i)}
  onmouseleave={() => (hoveredIndex = null)}
  onclick={() => (hoveredIndex = hoveredIndex === i ? null : i)}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hoveredIndex = hoveredIndex === i ? null : i; } }}
>
```
2. Add a visible focus ring to the class list:
```
focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1
```

**Commit:** `fix(web): ♿ add keyboard/touch a11y to CategoryBreakdown tooltips`

---

## Task 3: Add regression test for findCategory fuzzy match (C4-11)

**Finding:** The C3-01 fix changed `findCategory` step 3 to select the shortest keyword, but no test was added.

**File:** `packages/core/__tests__/categorizer.test.ts` (new file)

**Implementation:**
1. Create test file with cases:
   - Exact match returns correct category with confidence 1.0
   - Substring match (keyword in merchant) selects longest keyword with confidence 0.8
   - Reverse fuzzy match (merchant in keyword) selects shortest keyword with confidence 0.6
   - When two keywords both contain the merchant name, the shorter keyword wins
   - No match returns 'uncategorized' with confidence 0.0
   - Category with subcategory is correctly returned
2. Use the `CategoryTaxonomy` class directly with a controlled set of category nodes.

```ts
import { describe, test, expect } from 'bun:test';
import { CategoryTaxonomy } from '../src/categorizer/taxonomy.js';
import type { CategoryNode } from '@cherrypicker/rules';

// Minimal fixture nodes for testing
const fixtureNodes: CategoryNode[] = [
  {
    id: 'transportation',
    labelKo: '교통',
    labelEn: 'Transportation',
    keywords: ['카카오택시', 'UBER택시', '택시', '버스'],
  },
  {
    id: 'dining',
    labelKo: '외식',
    labelEn: 'Dining',
    keywords: ['레스토랑', '식당', '카페'],
    subcategories: [
      {
        id: 'cafe',
        labelKo: '카페',
        labelEn: 'Cafe',
        keywords: ['스타벅스', '커피'],
      },
    ],
  },
];

describe('CategoryTaxonomy.findCategory', () => {
  const taxonomy = new CategoryTaxonomy(fixtureNodes);

  test('exact match returns correct category', () => {
    const result = taxonomy.findCategory('스타벅스');
    expect(result.category).toBe('dining');
    expect(result.subcategory).toBe('cafe');
    expect(result.confidence).toBe(1.0);
  });

  test('substring match selects longest keyword', () => {
    // "스타벅스 강남점" contains "스타벅스"
    const result = taxonomy.findCategory('스타벅스 강남점');
    expect(result.category).toBe('dining');
    expect(result.confidence).toBe(0.8);
  });

  test('reverse fuzzy match selects shortest keyword that contains merchant', () => {
    // "택시" is contained in both "카카오택시" and "UBER택시" and "택시"
    // Shortest keyword "택시" should win → category: transportation
    const result = taxonomy.findCategory('택시');
    expect(result.category).toBe('transportation');
    expect(result.confidence).toBe(0.6);
  });

  test('no match returns uncategorized', () => {
    const result = taxonomy.findCategory('ㅂㅈㄷㄱ');
    expect(result.category).toBe('uncategorized');
    expect(result.confidence).toBe(0.0);
  });
});
```

**Commit:** `test(core): ✅ add regression tests for findCategory fuzzy match selection`

---

## Task 4: Add pre-build check to E2E test setup (C4-10)

**Finding:** `e2e/core-regressions.spec.js:16-24` — E2E test imports from `packages/core/dist/` which may be stale or missing.

**File:** `e2e/core-regressions.spec.js`

**Implementation:**
1. Add a check in `test.beforeAll` that verifies the dist files exist and warns if they're older than the source files:
```js
const fs = require('node:fs');
const path = require('node:path');

test.beforeAll(async () => {
  // Verify dist/ exists and warn if stale
  const distDir = path.join(repoRoot, 'packages/core/dist');
  if (!fs.existsSync(distDir)) {
    throw new Error(
      'packages/core/dist/ not found. Run `bun run build` in packages/core before E2E tests.'
    );
  }
  const matcherDist = path.join(distDir, 'categorizer/matcher.js');
  const matcherSrc = path.join(repoRoot, 'packages/core/src/categorizer/matcher.ts');
  if (fs.existsSync(matcherDist) && fs.existsSync(matcherSrc)) {
    const distMtime = fs.statSync(matcherDist).mtimeMs;
    const srcMtime = fs.statSync(matcherSrc).mtimeMs;
    if (srcMtime > distMtime) {
      console.warn(
        '[E2E WARNING] packages/core/src is newer than dist/. Run `bun run build` to get current code.'
      );
    }
  }
  // ... existing imports
});
```

**Commit:** `fix(e2e): 🛡️ add dist staleness check before E2E regression tests`

---

## Task 5: Add generation counter to prevent over-broad editedTxs re-sync (C4-08)

**Finding:** `apps/web/src/components/dashboard/TransactionReview.svelte:124-129` — The `$effect` re-syncs `editedTxs` whenever `analysisStore.transactions` changes, which may fire on reactive updates that don't represent new data uploads.

**Files:**
- `apps/web/src/lib/store.svelte.ts`
- `apps/web/src/components/dashboard/TransactionReview.svelte`

**Implementation:**
1. Add a `generation` counter to the store:
```ts
// In createAnalysisStore():
let generation = $state(0);
```
2. Increment on `setResult` and `analyze`:
```ts
setResult(r: AnalysisResult): void {
  result = r;
  generation++;
  error = null;
  persistToStorage(r);
},
```
3. Expose the generation:
```ts
get generation(): number {
  return generation;
},
```
4. In `TransactionReview.svelte`, depend on the generation counter:
```ts
$effect(() => {
  const gen = analysisStore.generation;
  const txs = analysisStore.transactions;
  if (txs.length > 0) {
    editedTxs = txs.map(tx => ({ ...tx }));
    hasEdits = false;
  }
});
```
This way, `editedTxs` only re-syncs when the generation actually changes (new upload), not on every reactive update.

**Commit:** `fix(web): 🔄 add generation counter to prevent over-broad editedTxs re-sync`

---

## Progress

- [x] Task 1: Fix SavingsComparison division by zero
- [x] Task 2: Fix CategoryBreakdown a11y
- [x] Task 3: Add findCategory regression test
- [x] Task 4: Add E2E dist staleness check
- [x] Task 5: Add generation counter for editedTxs sync
