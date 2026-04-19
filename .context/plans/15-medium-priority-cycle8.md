# Plan 15 — Medium-Priority Fixes (Cycle 8)

**Priority:** MEDIUM
**Findings addressed:** C8-01, C8-09
**Status:** DONE

---

## Task 1: Add NaN guard to SpendingSummary.formatPeriod (C8-01)

**Finding:** `apps/web/src/components/dashboard/SpendingSummary.svelte:17-23` — The `formatPeriod` function splits period dates on `-` and calls `parseInt(sm, 10)` / `parseInt(em, 10)` without checking if the parts are valid numeric strings. A malformed date like "2026-ab-15" would pass the truthy check but produce "NaN월" in the output.

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte`

**Implementation:**
1. Add a NaN guard after the truthy check:
```ts
function formatPeriod(period: { start: string; end: string } | undefined): string {
  if (!period) return '-';
  const [sy, sm] = period.start.split('-');
  const [ey, em] = period.end.split('-');
  if (!sy || !sm || !ey || !em) return '-';
  const smNum = parseInt(sm, 10);
  const emNum = parseInt(em, 10);
  if (Number.isNaN(smNum) || Number.isNaN(emNum)) return '-';
  const startStr = `${sy}년 ${smNum}월`;
  const endStr = `${ey}년 ${emNum}월`;
  return startStr === endStr ? startStr : `${startStr} ~ ${endStr}`;
}
```

**Commit:** `fix(web): 🛡️ add NaN guard to SpendingSummary formatPeriod date parsing`

---

## Task 2: Pass prebuilt category labels through reoptimize (C8-09)

**Finding:** `apps/web/src/lib/analyzer.ts:172-184` — When `prebuiltCategoryLabels` is not provided (which happens when `optimizeFromTransactions` is called from `reoptimize`), the function fetches categories via `loadCategories()` and rebuilds the labels map on every call. During reoptimize, this means a redundant map rebuild.

**Files:**
- `apps/web/src/lib/store.svelte.ts`
- `apps/web/src/lib/analyzer.ts`

**Implementation:**
1. Add a `categoryLabels` field to the store to cache the labels map:
```ts
// In createAnalysisStore():
let cachedCategoryLabels: Map<string, string> | undefined;
```

2. In the `analyze` method, save the category labels after analysis:
```ts
// The analyzeMultipleFiles function already builds the labels.
// We need to expose them from the analyzer.
```

Actually, the cleaner approach is to have `analyzeMultipleFiles` return the labels alongside the result, then cache them in the store. But `analyzeMultipleFiles` already builds labels internally and passes them to `optimizeFromTransactions`. The simplest fix is:

1. Export `loadCategories` (already imported) in the store and cache the labels:
```ts
// In createAnalysisStore():
let cachedCategoryLabels: Map<string, string> | undefined;

async function getCategoryLabels(): Promise<Map<string, string>> {
  if (cachedCategoryLabels) return cachedCategoryLabels;
  const nodes = await loadCategories();
  const labels = new Map<string, string>();
  for (const node of nodes) {
    labels.set(node.id, node.labelKo);
    if (node.subcategories) {
      for (const sub of node.subcategories) {
        labels.set(sub.id, sub.labelKo);
      }
    }
  }
  cachedCategoryLabels = labels;
  return labels;
}
```

2. In `reoptimize`, pass the cached labels:
```ts
async reoptimize(editedTransactions: CategorizedTx[], options?: AnalyzeOptions): Promise<void> {
  loading = true;
  error = null;
  try {
    const categoryLabels = await getCategoryLabels();
    const optimization = await optimizeFromTransactions(editedTransactions, options, categoryLabels);
    if (result) {
      result = { ...result, transactions: editedTransactions, optimization };
      generation++;
      persistToStorage(result);
      persistWarningKind = _persistWarningKind;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : '재계산 중 문제가 생겼어요';
  } finally {
    loading = false;
  }
},
```

3. Clear the cache in `reset()`:
```ts
reset(): void {
  // ... existing resets ...
  cachedCategoryLabels = undefined;
},
```

**Commit:** `perf(web): ⚡ cache category labels in store and pass through reoptimize`

---

## Progress

- [x] Task 1: Add NaN guard to formatPeriod
- [x] Task 2: Cache category labels and pass through reoptimize
