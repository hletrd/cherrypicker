# Plan 20 — High-Priority Fixes (Cycle 11)

**Priority:** HIGH
**Findings addressed:** C11-12, C11-17, C11-16
**Status:** PENDING

---

## Task 1: Recalculate `monthlyBreakdown` after reoptimize (C11-12)

**Finding:** `apps/web/src/lib/store.svelte.ts:334-363` — When `reoptimize` is called, it filters transactions to the latest month before optimization, then updates `result = { ...result, transactions: editedTransactions, optimization }`. However, `monthlyBreakdown` is carried over from the original `analyzeMultipleFiles` result and is never recalculated from `editedTransactions`. If the user edits transaction amounts in a non-latest month, the `monthlyBreakdown` for that month shows stale spending totals.

**Files:**
- `apps/web/src/lib/store.svelte.ts`

**Implementation:**
1. After the optimization is computed in `reoptimize`, recalculate `monthlyBreakdown` from `editedTransactions`:
```ts
const monthlySpending = new Map<string, number>();
const monthlyTxCount = new Map<string, number>();
for (const tx of editedTransactions) {
  const month = tx.date.slice(0, 7);
  monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + Math.abs(tx.amount));
  monthlyTxCount.set(month, (monthlyTxCount.get(month) ?? 0) + 1);
}
const updatedMonthlyBreakdown = [...monthlySpending.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([month, spending]) => ({
    month,
    spending,
    transactionCount: monthlyTxCount.get(month) ?? 0,
  }));
```

2. Include `updatedMonthlyBreakdown` in the updated result:
```ts
result = {
  ...result,
  transactions: editedTransactions,
  optimization,
  monthlyBreakdown: updatedMonthlyBreakdown,
};
```

**Commit:** `fix(web): 🛡️ recalculate monthlyBreakdown after reoptimize to prevent stale data`

---

## Task 2: Fix category select to correctly set subcategory (C11-17)

**Finding:** `apps/web/src/components/dashboard/TransactionReview.svelte:153-161` — When a user changes a transaction's category via the `<select>`, `changeCategory` sets `tx.category = newCategory` and `tx.subcategory = undefined`. The `categoryOptions` array includes both parent categories and subcategories in a flat list with subcategories indented by spaces. When a subcategory ID (e.g., `cafe`) is selected, `tx.category` is set to `cafe` instead of `dining` with `subcategory: 'cafe'`. This is incorrect — subcategories should set both the parent `category` and child `subcategory`.

**Files:**
- `apps/web/src/components/dashboard/TransactionReview.svelte`

**Implementation:**
1. Store a mapping from subcategory ID to its parent category ID during the `onMount` category loading:
```ts
let subcategoryToParent = $state<Map<string, string>>(new Map());

// In onMount, after building categoryOptions:
const parentMap = new Map<string, string>();
for (const node of nodes) {
  if (node.subcategories) {
    for (const sub of node.subcategories) {
      parentMap.set(sub.id, node.id);
    }
  }
}
subcategoryToParent = parentMap;
```

2. Update `changeCategory` to check if the selected ID is a subcategory:
```ts
function changeCategory(txId: string, newCategory: string) {
  const tx = editedTxs.find(t => t.id === txId);
  if (tx) {
    const parentCategory = subcategoryToParent.get(newCategory);
    if (parentCategory) {
      tx.category = parentCategory;
      tx.subcategory = newCategory;
    } else {
      tx.category = newCategory;
      tx.subcategory = undefined;
    }
    tx.confidence = 1.0;
    hasEdits = true;
  }
}
```

3. Also update the `<select>` `value` binding to reflect the current category+subcategory correctly:
```ts
// In the select element, use the effective value:
value={tx.subcategory ?? tx.category}
```

**Commit:** `fix(web): 🛡️ correctly set category and subcategory when user selects subcategory in TransactionReview`

---

## Task 3: Fix "전월실적 0원" for single-month data (C11-16)

**Finding:** `apps/web/src/components/dashboard/SpendingSummary.svelte:104` — When only one month of data is uploaded, `monthlyBreakdown.length` is 1, and `monthlyBreakdown[length - 2]` is `undefined`. The optional chaining returns `0`, causing the UI to show "전월실적 0원 기준" which is misleading.

**Files:**
- `apps/web/src/components/dashboard/SpendingSummary.svelte`

**Implementation:**
1. Check if `monthlyBreakdown.length >= 2` before showing the previous month spending line:
```svelte
{#if analysisStore.result?.monthlyBreakdown && analysisStore.result.monthlyBreakdown.length > 1}
  <div class="col-span-full mt-2 rounded-lg bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
    {analysisStore.result.monthlyBreakdown.length}개월 데이터 분석 ·
    전월실적 {formatWon(analysisStore.result.monthlyBreakdown[analysisStore.result.monthlyBreakdown.length - 2]?.spending ?? 0)} 기준
  </div>
{/if}
```

This is already guarded by `length > 1` in the template (line 101), but let me verify the exact condition:

Looking at the code again at line 101: `{#if analysisStore.result?.monthlyBreakdown && analysisStore.result.monthlyBreakdown.length > 1}` — this already guards against showing the line for single-month data. So the "전월실적 0원" issue only occurs if `monthlyBreakdown.length > 1` but the second-to-last month has 0 spending, which is a valid display.

Wait — re-reading the finding more carefully: the condition at line 101 already checks `length > 1`. So for single-month data, the line is hidden. The issue description may have been incorrect. Let me verify by re-reading the code.

After re-reading: The condition `analysisStore.result.monthlyBreakdown.length > 1` at line 101 correctly hides the previous-month spending line for single-month data. So C11-16 as described is actually already handled by the existing code. The finding was based on a misreading.

**Status:** No code change needed — the existing guard at line 101 already prevents this issue. Marking as no-op.

**Commit:** (no separate commit needed — already handled by existing code)

---

## Progress

- [x] Task 1: Recalculate monthlyBreakdown after reoptimize — Committed (0000000f2d3f09a8)
- [x] Task 2: Fix category select subcategory handling — Committed (00000002ba1cf2c2)
- [x] Task 3: Already handled by existing code — no change needed
