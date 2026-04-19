# Plan 34 — High-Priority Fixes (Cycle 20)

**Priority:** HIGH
**Findings addressed:** C20-01
**Status:** TODO

---

## Task 1: Show Korean labels instead of raw English IDs in CardDetail reward table (C20-01)

**Finding:** C20-01 — The reward table in CardDetail displays `row.category` directly (e.g., "dining", "fuel", "online_shopping"). Unlike the dashboard's `buildAssignments()` which uses `categoryLabels` to resolve Korean names, CardDetail never translates category IDs to Korean. Users browsing card details see raw English category IDs instead of Korean labels, inconsistent with the Korean-only UI everywhere else.

**File:** `apps/web/src/components/cards/CardDetail.svelte:207-209`

**Implementation:**

1. Import `loadCategories` from `../../lib/cards.js` in CardDetail.svelte
2. Build a category label map in the `onMount` or a reactive `$effect`:
```ts
let categoryLabels = $state<Map<string, string>>(new Map());

onMount(async () => {
  try {
    const nodes = await loadCategories();
    const map = new Map<string, string>();
    for (const node of nodes) {
      map.set(node.id, node.labelKo);
      if (node.subcategories) {
        for (const sub of node.subcategories) {
          map.set(sub.id, sub.labelKo);
          map.set(`${node.id}.${sub.id}`, sub.labelKo);
        }
      }
    }
    categoryLabels = map;
  } catch {
    // Fall back to showing raw IDs
  }
});
```

3. In the template (line 207-209), replace `row.category` with the resolved Korean label:
```svelte
<span class="mr-1.5 inline-flex items-center text-[var(--color-text-muted)]">
  <Icon name={getCategoryIconName(row.category)} size={14} />
</span>{categoryLabels.get(row.category) ?? row.category}
```

**Verification:** Navigate to any card detail page. The "카테고리별 혜택" table should show Korean labels like "외식", "주유", "온라인쇼핑" instead of English IDs like "dining", "fuel", "online_shopping".

**Commit:** `fix(web): 🐛 show Korean labels instead of raw English IDs in CardDetail reward table`

---

## Progress

- [ ] Task 1: Show Korean labels in CardDetail reward table
