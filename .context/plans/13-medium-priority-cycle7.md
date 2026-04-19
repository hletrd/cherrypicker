# Plan 13 — Medium-Priority Fixes (Cycle 7)

**Priority:** MEDIUM
**Findings addressed:** C7-11, C7-04, C7-06
**Status:** PENDING

---

## Task 1: Differentiate persistWarning between truncation and corruption (C7-11)

**Finding:** `apps/web/src/lib/store.svelte.ts:215` — `persistWarning` is set to `true` when `result.transactions === undefined` on load. But this could be because (a) the data was truncated (size exceeded), or (b) all transactions failed validation (corruption). The current warning message says "데이터가 커서 거래 내역이 저장되지 않았어요" (data was too large to save), which is misleading for corruption.

**Files:**
- `apps/web/src/lib/store.svelte.ts`
- `apps/web/src/components/dashboard/SpendingSummary.svelte`

**Implementation:**
1. Add a `persistWarningKind` state to the store that distinguishes truncation from corruption:
```ts
type PersistWarningKind = 'truncated' | 'corrupted' | null;
let persistWarningKind = $state<PersistWarningKind>(null);
```

2. Expose it as a getter:
```ts
get persistWarningKind(): PersistWarningKind {
  return persistWarningKind;
},
```

3. In `persistToStorage`, set `persistWarningKind = 'truncated'` when transactions are omitted, and `persistWarningKind = 'corrupted'` in the catch block:
```ts
if (serialized.length > MAX_PERSIST_SIZE) {
  const withoutTxs = { ...persisted, transactions: undefined };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(withoutTxs));
  _persistWarningKind = 'truncated';
} else {
  sessionStorage.setItem(STORAGE_KEY, serialized);
  _persistWarningKind = null;
}
// catch block:
_persistWarningKind = 'corrupted';
```

4. In `loadFromStorage`, if transactions are missing but other data loaded, set the kind based on whether the `transactions` key exists but failed validation:
```ts
let persistWarningKind: PersistWarningKind = null;
if (result !== null && result.transactions === undefined) {
  // Check if the raw data had a transactions key that failed validation
  if (Array.isArray(parsed.transactions)) {
    persistWarningKind = 'corrupted'; // Had transactions but they all failed validation
  } else {
    persistWarningKind = 'truncated'; // No transactions key — was truncated on save
  }
}
```

5. Update SpendingSummary to show different messages:
```svelte
{#if analysisStore.persistWarningKind === 'truncated'}
  <span>데이터가 커서 거래 내역이 저장되지 않았어요. 탭을 닫으면 분석 결과도 사라져요.</span>
{:else if analysisStore.persistWarningKind === 'corrupted'}
  <span>거래 내역을 불러오지 못했어요. 다시 분석해 보세요.</span>
{/if}
```

6. Replace `persistWarning` boolean with `persistWarningKind` in the store API (or keep `persistWarning` as a computed: `persistWarningKind !== null`).

**Commit:** `fix(web): 🛡️ differentiate persistWarning between truncation and data corruption`

---

## Task 2: Guard TransactionReview effect against unnecessary re-syncs (C7-04)

**Finding:** `apps/web/src/components/dashboard/TransactionReview.svelte:125-132` — The `$effect` watches `analysisStore.generation` and `analysisStore.transactions` and overwrites `editedTxs` on any change. After `reoptimize`, the effect fires and overwrites `editedTxs` with `analysisStore.transactions` (which are the same data), causing an unnecessary re-render.

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte`

**Implementation:**
1. Track the last synced generation to avoid re-syncing when the data hasn't actually changed:
```ts
let lastSyncedGeneration = $state(0);

$effect(() => {
  const gen = analysisStore.generation;
  const txs = analysisStore.transactions;
  if (txs.length > 0 && gen !== lastSyncedGeneration) {
    editedTxs = txs.map(tx => ({ ...tx }));
    hasEdits = false;
    lastSyncedGeneration = gen;
  }
});
```

This ensures that the effect only overwrites `editedTxs` when the generation has actually changed, preventing unnecessary re-renders when other reactive updates occur.

**Commit:** `fix(web): 🛡️ guard TransactionReview effect against unnecessary re-syncs`

---

## Task 3: Filter editedTxs to latest month in reoptimize or document behavior (C7-06)

**Finding:** `apps/web/src/lib/analyzer.ts:264-294` — `analyzeMultipleFiles` returns `allTransactions` but only optimizes `latestTransactions`. When the user edits a non-latest-month transaction and clicks "apply edits", `reoptimize` is called with ALL editedTxs, including old-month transactions that were never part of the original optimization.

**File:** `apps/web/src/lib/analyzer.ts` or `apps/web/src/components/dashboard/TransactionReview.svelte`

**Implementation:**
Option A (conservative — document the behavior):
1. Add a comment in `analyzeMultipleFiles` explaining the design:
```ts
// Note: transactions includes ALL months for display/editing, but the
// optimization only covers the latest month. When reoptimize is called
// with edited transactions, it includes all months. This is acceptable
// because non-latest-month transactions still contribute to per-card
// previousMonthSpending calculations and don't distort the optimization
// — they just add more data for the optimizer to consider.
```

Option B (fix — filter in applyEdits):
1. In TransactionReview, filter to only latest-month transactions before calling reoptimize:
```ts
async function applyEdits() {
  reoptimizing = true;
  try {
    // Only reoptimize with transactions from the latest optimized month
    const period = analysisStore.statementPeriod;
    const filtered = period
      ? editedTxs.filter(tx => tx.date.startsWith(period.start.slice(0, 7)))
      : editedTxs;
    await analysisStore.reoptimize(filtered);
    hasEdits = false;
  } finally {
    reoptimizing = false;
  }
}
```

Prefer Option A for this cycle (documentation only) since Option B could break the previousMonthSpending calculation. Revisit with proper testing in a future cycle.

**Commit:** `docs(web): 📝 document all-month transactions behavior in analyzeMultipleFiles`

---

## Progress

- [ ] Task 1: Differentiate persistWarning between truncation and corruption
- [ ] Task 2: Guard TransactionReview effect against unnecessary re-syncs
- [ ] Task 3: Document all-month transactions behavior in analyzeMultipleFiles
