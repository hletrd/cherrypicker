# Cycle 78 Implementation Plan

**Date:** 2026-04-22
**Status:** In Progress

---

## Task 1: Fix `SpendingSummary.dismissed` state not reset on `analysisStore.reset()`

**Finding:** C78-01 (MEDIUM / HIGH), upgraded from C76-03
**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:7-8`

**Problem:** The `dismissed` state variable controls whether the data-loss warning banner is hidden. When `analysisStore.reset()` is called, the store clears `cherrypicker:analysis` from sessionStorage but does NOT clear `cherrypicker:dismissed-warning`. After reset+re-upload, the warning stays hidden even though there is a fresh analysis result that could also be lost.

**Fix:** Two-part fix:
1. In `SpendingSummary.svelte`, watch `analysisStore.generation` changes and reset `dismissed = false` when the generation increments (indicating a new analysis result).
2. In `store.svelte.ts` `clearStorage()`, also remove the `cherrypicker:dismissed-warning` key from sessionStorage so that a full reset also resets the dismissal state.

**Implementation:**

In `apps/web/src/components/dashboard/SpendingSummary.svelte`, add a reactive block after `let dismissed = $state(false);`:

```svelte
  // Reset dismissal when a new analysis result is produced, so the user
  // is re-warned about the new data being at risk of loss (C78-01).
  $effect(() => {
    if (analysisStore.generation > 0) {
      dismissed = false;
    }
  });
```

In `apps/web/src/lib/store.svelte.ts` `clearStorage()`, add removal of the dismissal key:

```typescript
function clearStorage(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem('cherrypicker:dismissed-warning');
    }
  } catch (err) {
    // ... existing error handling
  }
}
```

---

## Task 2: Fix `parseGenericCSV` default `headerIdx` when no header keywords found

**Finding:** C78-03 (LOW / MEDIUM)
**File:** `apps/web/src/lib/parser/csv.ts:145-168`

**Problem:** The `parseGenericCSV` function defaults `headerIdx = 0` (line 154). If NO row in the first 20 lines passes the header keyword check, the parser falls through with `headerIdx = 0` -- treating the first line as the header regardless of whether it's a metadata row. Bank-specific adapters return an error when no header is found; the generic parser should do the same.

**Fix:** Change the default `headerIdx` from `0` to `-1`. After the loop, if `headerIdx` is still `-1`, return an error result indicating that the header could not be found.

**Implementation:**

Replace line 154:
```typescript
  let headerIdx = 0;
```
With:
```typescript
  let headerIdx = -1;
```

After the loop (after line 168), add:
```typescript
  if (headerIdx === -1) {
    return { bank, format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
  }
```

---

## Task 3: Run quality gates (eslint, tsc --noEmit, vitest, bun test)

**Requirement:** All gates must pass before cycle completion.

---

## Deferred Items (this cycle)

The following findings from this cycle's review are deferred per the repo's rules:

### C78-02: FALLBACK_CATEGORIES leading-space labels in categoryMap
- **Severity:** LOW / HIGH
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:36-65`
- **Reason for deferral:** Same as C75-02/C76-02. The leading spaces are intentional for visual hierarchy in the dropdown. Search matching works correctly (`includes()` matches substrings with leading spaces). Browser rendering of leading spaces in `<option>` is inconsistent but does not cause functional issues.
- **Exit criterion:** If a browser is found that completely ignores leading spaces in `<option>` elements, switch to CSS-based indentation or Unicode em-spaces.

### C77-02: Annual savings projection uses simple *12 multiplication
- **Severity:** LOW / MEDIUM
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:60-71`
- **Reason for deferral:** Known issue flagged by 17+ prior cycles. The label "최근 월 기준 단순 연환산" makes the approximation transparent.
- **Exit criterion:** If user feedback indicates the simple projection is misleading, switch to a weighted average across all uploaded months.

### C67-01/C74-06: Greedy optimizer O(m*n*k) quadratic behavior
- **Severity:** MEDIUM / HIGH
- **File:** `packages/core/src/optimizer/greedy.ts`
- **Reason for deferral:** Known architectural issue deferred by 11+ prior cycles. For typical use cases (< 1000 transactions, < 10 cards), the optimizer completes in < 1s. Optimization would require incremental reward tracking, which adds significant complexity.
- **Exit criterion:** If optimization latency exceeds 5s for typical inputs, implement incremental scoring with per-card result caching.

### C66-02/C33-02: cachedCategoryLabels stale across redeployments
- **Severity:** MEDIUM / HIGH
- **File:** `apps/web/src/lib/store.svelte.ts:375`
- **Reason for deferral:** Known issue deferred by 21+ prior cycles. The cache is invalidated on `store.reset()` and when `loadCategories()` returns an empty array. Staleness across redeployments is a narrow edge case that requires the user to keep a tab open across a redeployment.
- **Exit criterion:** If users report stale category labels after redeployment, add a deployment-version check to invalidate the cache.

### C66-03/C33-01: MerchantMatcher substring scan O(n) per transaction
- **Severity:** MEDIUM / HIGH
- **File:** `packages/core/src/categorizer/matcher.ts`
- **Reason for deferral:** Known architectural issue deferred by 18+ prior cycles. For typical use cases (< 1000 transactions, < 2000 keywords), the categorization completes in < 500ms. A trie-based prefix index would optimize this but adds significant complexity.
- **Exit criterion:** If keyword count exceeds 10,000 or categorization latency exceeds 2s, implement a trie-based prefix index.

---

## Progress

- [x] Task 1: Fix SpendingSummary dismissed state reset
- [x] Task 2: Fix parseGenericCSV default headerIdx
- [x] Task 3: Quality gates -- all pass (vitest: 189/189, bun test: 57/57, astro check: 0 errors)
