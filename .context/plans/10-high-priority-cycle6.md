# Plan 10 — High-Priority Fixes (Cycle 6)

**Priority:** HIGH
**Findings addressed:** C6-07, C6-01, C6-02
**Status:** DONE

---

## Task 1: Fix AI categorizer not clearing subcategory (C6-07)

**Finding:** `TransactionReview.svelte:99-104` — The AI categorizer sets `tx.category = result.category` and `tx.confidence = result.confidence` but does NOT clear `tx.subcategory`, leaving a stale subcategory that corrupts optimizer scoring. This is the same class of bug as C-01 (manual `changeCategory`), which was fixed in Plan 01.

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte`

**Implementation:**
1. After `tx.category = result.category;` on line 102, add `tx.subcategory = undefined;`
2. This matches the pattern in `changeCategory()` at line 153

```ts
// Change from:
tx.category = result.category;
tx.confidence = result.confidence;

// To:
tx.category = result.category;
tx.subcategory = undefined;
tx.confidence = result.confidence;
```

**Commit:** `fix(web): 🐛 clear stale subcategory when AI categorizer changes category`

---

## Task 2: Remove redundant `rate` field from CardBreakdown initialization (C6-01)

**Finding:** `SavingsComparison.svelte:33-40` — When accumulating spending/reward per card, the initial `rate: a.rate` is stored from the first assignment. This rate is stale and misleading — it's always overwritten by the `.map()` at line 42-45. The redundant field is a fragile pattern that could cause bugs if the `.map()` is ever removed.

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte`

**Implementation:**
1. Remove `rate` from the `CardBreakdown` interface (line 21)
2. Remove `rate: a.rate,` from the `map.set()` call (line 38)
3. Keep the rate computation in the `.map()` at line 42-45

```ts
// CardBreakdown interface — remove rate:
interface CardBreakdown {
  cardId: string;
  cardName: string;
  spending: number;
  reward: number;
}

// map.set — remove rate:
map.set(a.assignedCardId, {
  cardId: a.assignedCardId,
  cardName: a.assignedCardName,
  spending: a.spending,
  reward: a.reward,
});

// .map — compute rate only here (unchanged):
return [...map.values()].map(entry => ({
  ...entry,
  rate: entry.spending > 0 ? entry.reward / entry.spending : 0,
})).sort((a, b) => b.reward - a.reward);
```

**Commit:** `refactor(web): ♻️ remove redundant rate field from CardBreakdown initialization`

---

## Task 3: Add persistWarning indicator when transactions are truncated (C6-02)

**Finding:** `store.svelte.ts:96-125` — When the serialized payload exceeds `MAX_PERSIST_SIZE`, transactions are silently omitted from sessionStorage. After page reload, the optimization results are shown but TransactionReview is empty, with no explanation. This extends C5-07.

**Files:**
- `apps/web/src/lib/store.svelte.ts`
- `apps/web/src/components/dashboard/SpendingSummary.svelte`

**Implementation:**
1. Add a `persistWarning` state to the store:
```ts
let persistWarning = $state(false);
```

2. Expose it as a getter:
```ts
get persistWarning(): boolean {
  return persistWarning;
},
```

3. Set `persistWarning = true` in `persistToStorage` when transactions are omitted or when the save fails:
```ts
if (serialized.length > MAX_PERSIST_SIZE) {
  const withoutTxs: PersistedAnalysisResult = { ...persisted, transactions: undefined };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(withoutTxs));
  persistWarning = true; // Data was truncated
} else {
  sessionStorage.setItem(STORAGE_KEY, serialized);
  persistWarning = false; // Full save succeeded
}
```

4. In the catch block, set `persistWarning = true`:
```ts
catch {
  persistWarning = true;
}
```

5. In `loadFromStorage`, if transactions are missing from the loaded data, set a flag that the store can read (since `loadFromStorage` runs before the store is created, we need a different approach — set the warning in `setResult` or `analyze` when they detect missing transactions from storage).

Better approach: Check in `createAnalysisStore` after `loadFromStorage()`:
```ts
let result = $state<AnalysisResult | null>(loadFromStorage());
let persistWarning = $state(result !== null && result.transactions === undefined);
```

6. In `SpendingSummary.svelte`, show a warning banner when `analysisStore.persistWarning` is true:
```svelte
{#if analysisStore.persistWarning}
  <div class="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 border border-amber-200">
    <span>데이터가 커서 거래 내역이 저장되지 않았어요. 탭을 닫으면 분석 결과도 사라져요.</span>
  </div>
{/if}
```

7. Clear `persistWarning` after a successful full save (when `analyze` or `reoptimize` completes with a save that includes transactions).

**Commit:** `fix(web): 🛡️ add persistWarning indicator when sessionStorage data is truncated`

---

## Progress

- [x] Task 1: Fix AI categorizer subcategory clearing — `000000040ddb0539f497cf9e863c06c9e3233464`
- [x] Task 2: Remove redundant CardBreakdown rate field — `000000063151fcfcd63dcb67c44d3c89cb3259fa`
- [x] Task 3: Add persistWarning indicator — `0000000cccc1cf58add70cace6b09430cce7b142`
