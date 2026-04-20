# Plan -- Cycle 31 Fixes

**Source findings:** C31-01 (LOW, High), C31-02 (LOW, Medium)

---

## Task 1: Add console.warn logging to SpendingSummary dismiss catch (C31-01)

**Finding:** C31-01
**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:147`

### Problem

The dismiss button's onclick handler at line 147 has:
```typescript
try { sessionStorage.setItem('cherrypicker:dismissed-warning', '1'); } catch { /* non-critical: dismissal just won't persist across loads */ }
```

After the C27-01/C30-03 fix, `loadFromStorage`'s inner catch and `clearStorage` both log `console.warn` when sessionStorage is available but the operation fails. This dismiss catch does NOT log a warning, making it inconsistent with the established pattern.

### Implementation

1. Open `apps/web/src/components/dashboard/SpendingSummary.svelte`
2. At line 147, change the catch from:
   ```typescript
   catch { /* non-critical: dismissal just won't persist across loads */ }
   ```
   to:
   ```typescript
   catch (err) {
     // Dismissal won't persist -- non-critical, but log when sessionStorage
     // is available and the failure isn't an expected SSR/sandbox scenario,
     // matching the pattern in clearStorage() (C24-02/C27-01/C30-03/C31-01).
     if (typeof sessionStorage !== 'undefined') {
       console.warn('[cherrypicker] Failed to persist dismiss state:', err);
     }
   }
   ```

### Exit Criterion

- Dismiss catch logs console.warn when sessionStorage is available but setItem fails
- Consistent with clearStorage and loadFromStorage error-logging patterns
- Still silently ignores errors in SSR/sandboxed environments where sessionStorage is unavailable

---

## Task 2: Remove redundant Map.set() call in greedyOptimize (C31-02)

**Finding:** C31-02
**Severity:** LOW
**Confidence:** Medium
**File:** `packages/core/src/optimizer/greedy.ts:289-290`

### Problem

At line 289-290:
```typescript
const currentTransactions = assignedTransactionsByCard.get(best.cardId) ?? [];
currentTransactions.push(transaction);
assignedTransactionsByCard.set(best.cardId, currentTransactions);
```

When `get()` returns an existing array, `push()` mutates it in-place (same reference in the map). The subsequent `.set()` is then a no-op. Only on first insertion (when `?? []` creates a new array) is `.set()` needed. This adds cognitive overhead and could mislead readers into thinking `.set()` is always needed.

### Implementation

1. Open `packages/core/src/optimizer/greedy.ts`
2. Replace lines 288-290 with:
   ```typescript
   let currentTransactions = assignedTransactionsByCard.get(best.cardId);
   if (!currentTransactions) {
     currentTransactions = [transaction];
     assignedTransactionsByCard.set(best.cardId, currentTransactions);
   } else {
     currentTransactions.push(transaction);
   }
   ```
3. Add a code comment above explaining the pattern:
   ```typescript
   // On first insertion, create a new array and store it in the map.
   // On subsequent insertions, push in-place — the map already holds the
   // same reference so no .set() is needed (C31-02).
   ```

### Exit Criterion

- No redundant Map.set() call after in-place push
- Behavior is identical (same array mutations, same map state)
- Comment explains the pattern for future readers

---

## Deferred Findings

| Finding | Severity | Reason for Deferral |
|---|---|---|
| C30-01 | MEDIUM | OptimalCardMap derived re-computation is not actionable at current scale (< 50 assignments). Re-derivation cost is negligible (< 1ms). Exit criterion: if assignments exceed 500, add shallow-equality memoization. |

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | DONE -- commit 000000098f |
| 2 | DONE -- commit 0000000388 |
