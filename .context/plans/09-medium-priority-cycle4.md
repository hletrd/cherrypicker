# Plan 09 — Medium-Priority Fixes (Cycle 4)

**Priority:** MEDIUM
**Findings addressed:** C4-12, C4-05, C4-02, C4-03, C4-15
**Status:** DONE

---

## Task 1: Fix parseInt -> Number with isFinite guard (C4-12, promotes D-28)

**Finding:** `apps/web/src/components/upload/FileDropzone.svelte:200` — `parseInt(previousSpending, 10)` produces NaN for edge inputs like "1e5" on iOS Safari. `parseInt("1e5", 10)` returns 1 instead of 100000.

**File:** `apps/web/src/components/upload/FileDropzone.svelte`

**Implementation:**
1. Change line 200 from:
```ts
previousMonthSpending: previousSpending ? parseInt(previousSpending, 10) : undefined,
```
to:
```ts
previousMonthSpending: (() => { const v = Number(previousSpending); return Number.isFinite(v) && v >= 0 ? v : undefined; })(),
```
Or more readably, extract to a helper:
```ts
function parseSpendingValue(raw: string): number | undefined {
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : undefined;
}
```
Then:
```ts
previousMonthSpending: parseSpendingValue(previousSpending),
```

**Commit:** `fix(web): 🛡️ use Number() with isFinite guard instead of parseInt for spending input`

**Deferred item update:** D-28 should be closed as implemented.

---

## Task 2: Pass categoryLabels into buildConstraints instead of mutating (C4-05)

**Finding:** `apps/web/src/lib/analyzer.ts:164-177` — `constraints.categoryLabels` is set by mutating the object after `buildConstraints` returns.

**Files:**
- `packages/core/src/optimizer/constraints.ts`
- `apps/web/src/lib/analyzer.ts`

**Implementation:**
1. Add `categoryLabels` parameter to `buildConstraints`:
```ts
export function buildConstraints(
  transactions: CategorizedTransaction[],
  cardPreviousSpending: Map<string, number>,
  categoryLabels?: Map<string, string>,
): OptimizationConstraints {
  // ... existing logic ...
  return { cards, transactions: preservedTransactions, categorySpending, categoryLabels };
}
```
2. In `analyzer.ts`, pass `categoryLabels` to `buildConstraints`:
```ts
const constraints = buildConstraints(categorized, cardPreviousSpending, categoryLabels);
```
3. Move the `categoryLabels` construction before the `buildConstraints` call (currently it's after).

**Commit:** `refactor(core): 🔄 pass categoryLabels into buildConstraints instead of mutating`

---

## Task 3: Eliminate redundant loadCategories() call (C4-02)

**Finding:** `apps/web/src/lib/analyzer.ts:88,167` — `loadCategories()` is called in both `parseAndCategorize` and `optimizeFromTransactions`, constructing the categoryLabels map twice.

**File:** `apps/web/src/lib/analyzer.ts`

**Implementation:**
1. Refactor so that `parseAndCategorize` returns the `categoryNodes` alongside the transactions:
```ts
export async function parseAndCategorize(
  file: File,
  options?: AnalyzeOptions,
): Promise<{ transactions: CategorizedTx[]; bank: string | null; format: string; statementPeriod?: { start: string; end: string }; parseErrors: { line?: number; message: string; raw?: string }[]; categoryNodes: CategoryNode[] }> {
```
2. In `analyzeMultipleFiles`, use the returned `categoryNodes` to build `categoryLabels` once and pass it to `optimizeFromTransactions`.
3. In `optimizeFromTransactions`, remove the `loadCategories()` call if `categoryLabels` is already provided.

**Commit:** `perf(web): ⚡ eliminate redundant loadCategories() call in optimization flow`

---

## Task 4: Compute monthlyBreakdown in single pass (C4-03)

**Finding:** `apps/web/src/lib/analyzer.ts:267-271` — `monthlyBreakdown` uses O(n*m) filter per month instead of single-pass counter.

**File:** `apps/web/src/lib/analyzer.ts`

**Implementation:**
1. Add a parallel transaction count map alongside `monthlySpending`:
```ts
const monthlyTxCount = new Map<string, number>();
for (const tx of allTransactions) {
  const month = tx.date.slice(0, 7);
  monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + Math.abs(tx.amount));
  monthlyTxCount.set(month, (monthlyTxCount.get(month) ?? 0) + 1);
}
```
2. Change the `monthlyBreakdown` construction from:
```ts
monthlyBreakdown: [...monthlySpending.entries()].map(([month, spending]) => ({
  month,
  spending,
  transactionCount: allTransactions.filter(tx => tx.date.startsWith(month)).length,
})),
```
to:
```ts
monthlyBreakdown: [...monthlySpending.entries()].map(([month, spending]) => ({
  month,
  spending,
  transactionCount: monthlyTxCount.get(month) ?? 0,
})),
```

**Commit:** `perf(web): ⚡ compute monthlyBreakdown transaction counts in single pass`

---

## Task 5: Cache toCoreCardRuleSets result (C4-15)

**Finding:** `apps/web/src/lib/analyzer.ts:181` — `toCoreCardRuleSets` creates new array copies on every optimization call.

**File:** `apps/web/src/lib/analyzer.ts`

**Implementation:**
1. Add a cache variable:
```ts
let cachedCoreRules: CoreCardRuleSet[] | null = null;
let cachedRulesRef: CardRuleSet[] | null = null;
```
2. Before calling `toCoreCardRuleSets`, check if the rules have changed:
```ts
function getCachedCoreRules(rules: CardRuleSet[]): CoreCardRuleSet[] {
  // Since rules come from a static JSON fetch, the reference changes only on reload
  if (cachedRulesRef === rules && cachedCoreRules) return cachedCoreRules;
  cachedCoreRules = toCoreCardRuleSets(rules);
  cachedRulesRef = rules;
  return cachedCoreRules;
}
```
3. Use `getCachedCoreRules(cardRules)` instead of `toCoreCardRuleSets(cardRules)`.

**Commit:** `perf(web): ⚡ cache toCoreCardRuleSets result across optimization calls`

---

## Progress

- [x] Task 1: Fix parseInt -> Number with isFinite guard
- [x] Task 2: Pass categoryLabels into buildConstraints
- [x] Task 3: Eliminate redundant loadCategories() call
- [x] Task 4: Compute monthlyBreakdown in single pass
- [x] Task 5: Cache toCoreCardRuleSets result
