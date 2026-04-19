# Plan 30 — High-Priority Fixes (Cycle 18)

**Priority:** HIGH
**Findings addressed:** C18-01, C18-02
**Status:** TODO

---

## Task 1: Fix empty previousSpending conversion from '' to 0 instead of undefined (C18-01)

**Finding:** C18-01 — When the user leaves the "전월 카드 이용액" input empty, `Number('')` returns `0`, not `NaN`. Since `Number.isFinite(0)` is true, the expression `Number.isFinite(v) && v >= 0 ? v : undefined` evaluates to `0` instead of `undefined`. This causes tiered cards to get `previousMonthSpending: 0`, which means no performance tier matches, resulting in 0 reward for ALL categories — silently. The placeholder text says "입력하지 않으면 50만원으로 계산해요" but the actual behavior sends 0.

**File:** `apps/web/src/components/upload/FileDropzone.svelte:200`

**Implementation:**

Check for empty string before Number conversion:

```ts
previousMonthSpending: (() => {
  const v = previousSpending.trim();
  if (v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
})(),
```

This ensures:
- Empty string → `undefined` (triggers auto-calculation in analyzer.ts)
- "0" → `0` (explicit zero, valid input)
- "500000" → `500000` (normal input)
- "abc" → `undefined` (invalid input, treated as not provided)

**Commit:** `fix(web): 🐛 treat empty previousSpending as undefined to avoid zero-tier default`

---

## Task 2: Fix TransactionReview dropdown duplicate option values (C18-02)

**Finding:** C18-02 — When a category ID (e.g., "cafe") exists as both a standalone category and a subcategory, the `<select>` has two `<option>` elements with the same value. The `changeCategory` function always maps the ID to the parent via `subcategoryToParent`, which may be incorrect for standalone categories that share the same ID.

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:52-65,287`

**Implementation:**

Use fully-qualified subcategory IDs (e.g., "dining.cafe") as option values for subcategories:

```ts
for (const node of nodes) {
  options.push({ id: node.id, label: node.labelKo });
  if (node.subcategories) {
    for (const sub of node.subcategories) {
      const fqId = `${node.id}.${sub.id}`;
      options.push({ id: fqId, label: `  ${sub.labelKo}` });
      parentMap.set(fqId, node.id);
    }
  }
}
```

Then update the `<select>` value binding and `changeCategory`:

```svelte
<select
  value={tx.subcategory ? `${tx.category}.${tx.subcategory}` : tx.category}
  ...
>
```

```ts
function changeCategory(txId: string, newCategory: string) {
  const tx = editedTxs.find(t => t.id === txId);
  if (tx) {
    const parentCategory = subcategoryToParent.get(newCategory);
    if (parentCategory) {
      // Fully-qualified subcategory ID — extract parent and sub
      const subId = newCategory.split('.')[1] ?? newCategory;
      tx.category = parentCategory;
      tx.subcategory = subId;
    } else {
      // Top-level category
      tx.category = newCategory;
      tx.subcategory = undefined;
    }
    tx.confidence = 1.0;
    hasEdits = true;
  }
}
```

**Commit:** `fix(web): 🐛 use fully-qualified subcategory IDs in TransactionReview dropdown to avoid duplicate values`

---

## Progress

- [x] Task 1: Fix empty previousSpending conversion
- [x] Task 2: Fix TransactionReview dropdown duplicate option values
