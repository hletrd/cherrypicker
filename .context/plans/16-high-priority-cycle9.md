# Plan 16 — High-Priority Fixes (Cycle 9)

**Priority:** HIGH
**Findings addressed:** C9-05, C9-01
**Status:** DONE

---

## Task 1: Add error feedback when `reoptimize` silently discards edits due to null result (C9-05)

**Finding:** `apps/web/src/lib/store.svelte.ts:334-351` — In `reoptimize()`, the optimization is only applied `if (result)` at line 340. If `result` is null (e.g., store was reset between user clicking "변경 적용" and reoptimize completing), the method silently does nothing — no error is set, and `hasEdits` in `TransactionReview.svelte` is set to false regardless, making the user think their edits were applied when they weren't.

**Files:**
- `apps/web/src/lib/store.svelte.ts`
- `apps/web/src/components/dashboard/TransactionReview.svelte`

**Implementation:**
1. In `reoptimize()`, add error feedback when `result` is null:
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
    } else {
      // Store was reset while reoptimizing — cannot apply edits
      error = '분석 결과가 없어요. 다시 분석해 보세요.';
    }
  } catch (e) {
    error = e instanceof Error ? e.message : '재계산 중 문제가 생겼어요';
  } finally {
    loading = false;
  }
},
```

2. In `TransactionReview.svelte`, check for error after reoptimize and restore `hasEdits`:
```ts
async function applyEdits() {
  reoptimizing = true;
  try {
    await analysisStore.reoptimize(editedTxs);
    if (analysisStore.error) {
      // Reoptimize failed — keep edits visible so user can retry
      hasEdits = true;
    } else {
      hasEdits = false;
    }
  } finally {
    reoptimizing = false;
  }
}
```

**Commit:** `fix(web): 🛡️ add error feedback when reoptimize discards edits due to null result`

---

## Task 2: Fix `toCoreCardRuleSets` cache to actually work — remove reference equality check (C9-01)

**Finding:** `apps/web/src/lib/analyzer.ts:191-194` — The cache check `cachedRulesRef !== cardRules` compares by reference. When `getAllCardRules()` is called, it returns `data.issuers.flatMap(issuer => issuer.cards)`, which creates a new array every time. This means the cache never actually hits, and the O(n*m) `toCoreCardRuleSets` transformation runs on every `optimizeFromTransactions` call.

**File:** `apps/web/src/lib/analyzer.ts`

**Implementation:**
1. Simplify the cache to always cache the first result and never invalidate (since `cards.json` data doesn't change within a session):
```ts
// Cache for toCoreCardRuleSets — rules from static JSON don't change per session
let cachedCoreRules: CoreCardRuleSet[] | null = null;

function toCoreCardRuleSets(rules: CardRuleSet[]): CoreCardRuleSet[] {
  return rules.map((rule) => ({
    // ... same transformation as before
  }));
}
```

2. Update the cache usage to skip the reference check:
```ts
// cardRules from static JSON are validated and narrowed to the core
// CardRuleSet shape via the adapter function. Cache the result since
// the rules don't change within a session.
if (!cachedCoreRules) {
  cachedCoreRules = toCoreCardRuleSets(cardRules);
}
const optimizationResult = greedyOptimize(constraints, cachedCoreRules);
```

3. Remove the `cachedRulesRef` variable entirely since it's no longer needed.

**Commit:** `perf(web): ⚡ fix toCoreCardRuleSets cache to actually cache — remove reference equality check`

---

## Progress

- [x] Task 1: Add error feedback when reoptimize discards edits
- [x] Task 2: Fix toCoreCardRuleSets cache reference equality
