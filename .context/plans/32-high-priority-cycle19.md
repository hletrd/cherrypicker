# Plan 32 — High-Priority Fixes (Cycle 19)

**Priority:** HIGH
**Findings addressed:** C19-01, C19-02
**Status:** TODO

---

## Task 1: Fix reoptimize previousMonthSpending computed from same month instead of previous month (C19-01)

**Finding:** C19-01 — When `reoptimize` is called with edited transactions, it filters to the latest month for optimization but passes no `previousMonthSpending` to `optimizeFromTransactions`. This causes the function to compute `previousMonthSpending` from the *same* transactions being optimized, creating a circular dependency. The initial `analyzeMultipleFiles` flow correctly uses the previous month's spending for tier qualification, but `reoptimize` has no equivalent.

**File:** `apps/web/src/lib/store.svelte.ts:336-348`, `apps/web/src/lib/analyzer.ts:170-185`

**Implementation:**

In `store.svelte.ts`, inside the `reoptimize` method, compute `previousMonthSpending` from the `result.monthlyBreakdown` data (which reflects per-month spending from the original analysis or previous edits):

```ts
async reoptimize(editedTransactions: CategorizedTx[], options?: AnalyzeOptions): Promise<void> {
  loading = true;
  error = null;
  try {
    const categoryLabels = await getCategoryLabels();
    const latestMonth = getLatestMonth(editedTransactions);
    const latestTransactions = latestMonth
      ? editedTransactions.filter(tx => tx.date.startsWith(latestMonth))
      : editedTransactions;

    // Compute previousMonthSpending from monthlyBreakdown to match
    // the initial analysis behavior (previous month's spending determines
    // performance tier, not the same month being optimized).
    let previousMonthSpending: number | undefined;
    if (result?.monthlyBreakdown && latestMonth) {
      const months = result.monthlyBreakdown.map(m => m.month).sort();
      const latestIdx = months.indexOf(latestMonth);
      if (latestIdx > 0) {
        const prevMonth = months[latestIdx - 1];
        const prevData = result.monthlyBreakdown.find(m => m.month === prevMonth);
        previousMonthSpending = prevData?.spending;
      }
    }

    const optimization = await optimizeFromTransactions(latestTransactions, {
      ...options,
      previousMonthSpending,
    }, categoryLabels);
    // ... rest unchanged
```

**Verification:** After fix, upload January+February statements. Edit a February transaction. The reoptimized result should use January spending for tier qualification, matching the initial analysis behavior.

**Commit:** `fix(web): 🐛 compute reoptimize previousMonthSpending from previous month, not same month`

---

## Task 2: Add dot-notation subcategory keys to categoryLabels Map (C19-02)

**Finding:** C19-02 — `getCategoryLabels` in `store.svelte.ts` sets `labels.set(sub.id, sub.labelKo)` but the optimizer uses `buildCategoryKey(category, subcategory)` which produces dot-notation keys like `"dining.cafe"`. The Map lookup `categoryLabels.get("dining.cafe")` returns `undefined` because the Map only has `"cafe"`. New subcategories from the taxonomy will display raw keys instead of Korean labels.

**Files:**
- `apps/web/src/lib/store.svelte.ts:244-258`
- `apps/web/src/lib/analyzer.ts:192-199` (inline label building in `optimizeFromTransactions`)
- `apps/web/src/lib/analyzer.ts:244-255` (inline label building in `analyzeMultipleFiles`)

**Implementation:**

1. In `store.svelte.ts` `getCategoryLabels`:
```ts
for (const node of nodes) {
  labels.set(node.id, node.labelKo);
  if (node.subcategories) {
    for (const sub of node.subcategories) {
      labels.set(sub.id, sub.labelKo);
      labels.set(`${node.id}.${sub.id}`, sub.labelKo);  // dot-notation key for optimizer
    }
  }
}
```

2. In `analyzer.ts` `optimizeFromTransactions` (line 192-199):
```ts
for (const node of categoryNodes) {
  categoryLabels.set(node.id, node.labelKo);
  if (node.subcategories) {
    for (const sub of node.subcategories) {
      categoryLabels.set(sub.id, sub.labelKo);
      categoryLabels.set(`${node.id}.${sub.id}`, sub.labelKo);
    }
  }
}
```

3. In `analyzer.ts` `analyzeMultipleFiles` (line 244-255):
```ts
for (const node of parsed.categoryNodes) {
  categoryLabels.set(node.id, node.labelKo);
  if (node.subcategories) {
    for (const sub of node.subcategories) {
      categoryLabels.set(sub.id, sub.labelKo);
      categoryLabels.set(`${node.id}.${sub.id}`, sub.labelKo);
    }
  }
}
```

**Verification:** Add a new subcategory to categories.yaml and verify that the dashboard shows the Korean label instead of the raw key.

**Commit:** `fix(web): 🐛 add dot-notation subcategory keys to categoryLabels Map for optimizer lookups`

---

## Progress

- [ ] Task 1: Fix reoptimize previousMonthSpending
- [ ] Task 2: Add dot-notation subcategory keys to categoryLabels
