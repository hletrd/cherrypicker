# Plan 07 — Medium-Priority Fixes (Cycle 3)

**Priority:** MEDIUM
**Findings addressed:** C3-07, C3-01, C3-02, C3-03/C3-A01, C3-D01, C3-D06, C3-S01, C3-T03, C3-T04, C3-T05, C3-U02
**Status:** Complete

---

## Task 1: Fix `editedTxs` sync to re-run on store result change (C3-07)

**Finding:** `apps/web/src/components/dashboard/TransactionReview.svelte:124-129` — The `$effect` block syncs `editedTxs` from `analysisStore.transactions` only when `editedTxs.length === 0`. After re-upload, old edits persist.

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte`

**Implementation:**
1. Track a generation counter from the store. Add a `generation` field to `AnalysisResult` that increments each time `setResult` is called.
2. In the `$effect`, depend on the generation counter:
```ts
$effect(() => {
  const gen = analysisStore.result?.generation;
  const txs = analysisStore.transactions;
  // Always re-sync when generation changes (new upload)
  if (txs.length > 0) {
    editedTxs = txs.map(tx => ({ ...tx }));
    hasEdits = false;
  }
});
```
3. Alternative (simpler): Reset `editedTxs` to empty array when `analysisStore.loading` transitions from true to false, so the effect re-triggers.

**Commit:** `fix(web): 🔄 re-sync edited transactions after new file upload`

---

## Task 2: Fix `findCategory` fuzzy match to select best match (C3-01)

**Finding:** `packages/core/src/categorizer/taxonomy.ts:85-89` — Step 3 (reverse fuzzy match) returns the first match instead of the best (shortest keyword that contains the merchant name).

**File:** `packages/core/src/categorizer/taxonomy.ts`

**Implementation:**
1. Replace the early return in step 3 with a best-match selection:
```ts
// 3. Fuzzy match — keyword contains merchant name (partial reverse)
let bestFuzzy: { category: string; subcategory?: string; kwLen: number } | undefined;
for (const [kw, mapping] of this.keywordMap) {
  if (kw.includes(lower)) {
    // Prefer the shortest keyword that contains the merchant name
    // (shorter keyword = tighter fit, more likely correct)
    if (!bestFuzzy || kw.length < bestFuzzy.kwLen) {
      bestFuzzy = { ...mapping, kwLen: kw.length };
    }
  }
}
if (bestFuzzy) {
  return {
    category: bestFuzzy.category,
    subcategory: bestFuzzy.subcategory,
    confidence: 0.6,
  };
}
```

**Commit:** `fix(core): 🎯 select best fuzzy match in findCategory instead of first match`

---

## Task 3: Add warning for rules with null rate and null fixedAmount (C3-02)

**Finding:** `packages/core/src/calculator/reward.ts:113-117` — When `normalizeRate` returns null and there is no `fixedAmount`, the code silently produces 0 reward with no indication of misconfiguration.

**File:** `packages/core/src/calculator/reward.ts`

**Implementation:**
1. Add a `console.warn` when a rule is matched but produces no reward due to missing rate and fixedAmount:
```ts
if (normalizedRate !== null && normalizedRate > 0) {
  // ... existing percentage reward logic
} else if (hasFixedReward) {
  // ... existing fixed reward logic
} else {
  // Rule has neither rate nor fixed amount — likely a misconfiguration
  if (rule.category !== '*') {
    console.warn(`[cherrypicker] Rule for "${buildRuleKey(rule)}" tier "${tierId}" has no rate or fixedAmount — producing 0 reward`);
  }
  rawReward = 0;
  ruleResult = applyMonthlyCap(0, monthlyCap, currentRuleMonthUsed);
}
```

**Commit:** `fix(core): ⚠️ warn when reward rule has neither rate nor fixedAmount`

---

## Task 4: Pass category labels from taxonomy to optimizer (C3-03/C3-A01)

**Finding:** `packages/core/src/optimizer/greedy.ts:7-50` — `CATEGORY_NAMES_KO` is hardcoded and incomplete. The optimizer should receive category labels from its callers.

**Files:**
- `packages/core/src/optimizer/greedy.ts`
- `packages/core/src/optimizer/constraints.ts`
- `apps/web/src/lib/analyzer.ts`

**Implementation:**
1. Add `categoryLabels: Map<string, string>` to `OptimizationConstraints`:
```ts
export interface OptimizationConstraints {
  cards: { cardId: string; previousMonthSpending: number }[];
  transactions: CategorizedTransaction[];
  categorySpending: Map<string, number>;
  categoryLabels?: Map<string, string>; // Optional: category ID → Korean label
}
```
2. In `buildAssignments`, use `constraints.categoryLabels` instead of `CATEGORY_NAMES_KO`:
```ts
categoryNameKo: constraints.categoryLabels?.get(assignment.tx.category) ?? assignment.tx.category,
```
3. In `analyzer.ts`, build the `categoryLabels` map from the loaded taxonomy and pass it to `buildConstraints`:
```ts
const categoryLabels = new Map<string, string>();
const nodes = await loadCategories();
for (const node of nodes) {
  categoryLabels.set(node.id, node.labelKo);
  if (node.subcategories) {
    for (const sub of node.subcategories) {
      categoryLabels.set(sub.id, sub.labelKo);
    }
  }
}
```
4. Keep `CATEGORY_NAMES_KO` as a fallback for callers who don't provide labels (backward compatibility).

**Commit:** `refactor(core): 🔄 pass category labels from taxonomy to optimizer`

---

## Task 5: Validate `monthlyBreakdown` shape in `loadFromStorage` (C3-D01)

**Finding:** `apps/web/src/lib/store.svelte.ts:140` — `monthlyBreakdown` is passed through without validation. Corrupted data could cause runtime errors.

**File:** `apps/web/src/lib/store.svelte.ts`

**Implementation:**
1. Add validation for `monthlyBreakdown` in `loadFromStorage`:
```ts
monthlyBreakdown: Array.isArray(parsed.monthlyBreakdown)
  ? parsed.monthlyBreakdown.map((item: any) => ({
      month: typeof item?.month === 'string' ? item.month : '',
      spending: typeof item?.spending === 'number' ? item.spending : 0,
      transactionCount: typeof item?.transactionCount === 'number' ? item.transactionCount : 0,
    }))
  : undefined,
```

**Commit:** `fix(web): 🛡️ validate monthlyBreakdown shape when loading from sessionStorage`

---

## Task 6: Remove env var name from LLM fallback error message (C3-S01)

**Finding:** `packages/parser/src/pdf/llm-fallback.ts:39-41` — Error message reveals `ANTHROPIC_API_KEY` env var name.

**File:** `packages/parser/src/pdf/llm-fallback.ts`

**Implementation:**
1. Change line 40 from:
```ts
throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. LLM 폴백을 사용할 수 없습니다.');
```
to:
```ts
throw new Error('API 키가 설정되지 않아 LLM 폴백을 사용할 수 없습니다.');
```

**Commit:** `fix(parser): 🔒 remove env var name from LLM fallback error message`

---

## Task 7: Add unit tests for `toCoreCardRuleSets` type adapter (C3-T05)

**Finding:** `apps/web/src/lib/analyzer.ts:42-63` — The type adapter that narrows web CardRuleSet to core CardRuleSet has no tests.

**File:** `apps/web/__tests__/analyzer-adapter.test.ts` (new file) or add to existing test

**Implementation:**
1. Create test file with cases:
   - Valid source values ('manual', 'llm-scrape', 'web') pass through
   - Unknown source value falls back to 'web'
   - Valid reward types ('discount', 'points', 'cashback', 'mileage') pass through
   - Unknown reward type falls back to 'discount'
   - Null/undefined unit is normalized to null
   - All other fields are preserved unchanged

**Commit:** `test(web): ✅ add unit tests for toCoreCardRuleSets type adapter`

---

## Task 8: Improve bank selector UX for mobile (C3-U02)

**Finding:** `apps/web/src/components/upload/FileDropzone.svelte:324-346` — 25 bank buttons in a flex-wrap layout is overwhelming on mobile.

**File:** `apps/web/src/components/upload/FileDropzone.svelte`

**Implementation:**
1. Show top 8 banks (by popularity: hyundai, kb, samsung, shinhan, lotte, hana, woori, nh) + auto-detect
2. Add a "더보기" (show more) button that reveals the remaining banks
3. Use a compact 3-column grid layout on mobile instead of flex-wrap pills

```svelte
let showAllBanks = $state(false);
const TOP_BANKS = ALL_BANKS.slice(0, 8);
const displayedBanks = $derived(showAllBanks ? ALL_BANKS : TOP_BANKS);
```

**Commit:** `fix(web): 📱 improve bank selector UX with collapsible list on mobile`

---

## Progress

- [x] Task 1: Fix editedTxs sync after re-upload
- [x] Task 2: Fix findCategory fuzzy match selection
- [x] Task 3: Add warning for rules with null rate and fixedAmount
- [x] Task 4: Pass category labels from taxonomy to optimizer
- [x] Task 5: Validate monthlyBreakdown in loadFromStorage
- [x] Task 6: Remove env var name from LLM error message
- [x] Task 7: Add tests for toCoreCardRuleSets adapter
- [x] Task 8: Improve bank selector UX for mobile
