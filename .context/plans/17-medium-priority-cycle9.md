# Plan 17 — Medium-Priority Fixes (Cycle 9)

**Priority:** MEDIUM
**Findings addressed:** C9-03, C9-11, C9-13
**Status:** DONE

---

## Task 1: Add non-empty string checks to `isValidTx` validation (C9-11)

**Finding:** `apps/web/src/lib/store.svelte.ts:139-149` — `isValidTx` checks `typeof tx.date === 'string'` etc., which passes for empty strings. A transaction with empty-string fields would pass validation but be silently skipped by the optimizer.

**File:** `apps/web/src/lib/store.svelte.ts`

**Implementation:**
1. Add non-empty checks for critical fields:
```ts
function isValidTx(tx: any): tx is CategorizedTx {
  return (
    tx &&
    typeof tx === 'object' &&
    typeof tx.id === 'string' && tx.id.length > 0 &&
    typeof tx.date === 'string' && tx.date.length > 0 &&
    typeof tx.merchant === 'string' &&
    typeof tx.amount === 'number' &&
    typeof tx.category === 'string' && tx.category.length > 0
  );
}
```

Note: `merchant` is allowed to be empty since some statements have rows without merchant names. `id`, `date`, and `category` are required for the optimizer to function correctly.

**Commit:** `fix(web): 🛡️ add non-empty checks for critical fields in isValidTx validation`

---

## Task 2: Explicitly sort `monthlyBreakdown` by month before rendering (C9-13)

**Finding:** `apps/web/src/components/dashboard/SpendingSummary.svelte:101-106` — The template accesses `monthlyBreakdown[length-2]` assuming chronological order, but this relies on the implicit contract that `Map` insertion order matches date order. This is fragile — if `analyzeMultipleFiles` ever changes the iteration order, the wrong month's data would be displayed.

**File:** `apps/web/src/lib/analyzer.ts`

**Implementation:**
1. Sort `monthlyBreakdown` by month before returning:
```ts
monthlyBreakdown: [...monthlySpending.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([month, spending]) => ({
    month,
    spending,
    transactionCount: monthlyTxCount.get(month) ?? 0,
  })),
```

This makes the chronological ordering explicit rather than relying on `Map` insertion order.

**Commit:** `fix(web): 🛡️ explicitly sort monthlyBreakdown by month for robust ordering`

---

## Task 3: Document bank detection tie-breaking behavior (C9-03)

**Finding:** `apps/web/src/lib/parser/detect.ts:114-137` — When two banks have the same `bestScore`, the first one in `BANK_SIGNATURES` order wins. This tie-breaking is undocumented and could lead to wrong bank detection for documents mentioning multiple banks equally.

**File:** `apps/web/src/lib/parser/detect.ts`

**Implementation:**
1. Add a documentation comment explaining the tie-breaking behavior:
```ts
/**
 * Detect which bank issued a statement based on keyword signatures.
 *
 * @param content - Full text content of the statement
 * @returns The detected bank ID and confidence score (0–1)
 *
 * Tie-breaking: When multiple banks have the same match count,
 * the bank that appears first in BANK_SIGNATURES wins. Banks with
 * more specific patterns (more entries) are naturally more likely
 * to match multiple patterns and win ties.
 */
export function detectBank(content: string): { bank: BankId | null; confidence: number } {
```

2. Also add a tie-breaking improvement: when scores are tied, prefer the bank with more total patterns (higher specificity):
```ts
if (score > bestScore || (score === bestScore && bestBank && sig.patterns.length > bestBank.patterns.length)) {
  bestScore = score;
  bestMatch = sig.bankId;
  bestBank = sig;
}
```

This ensures that a bank with 3/5 patterns matched (score=3) still beats a bank with 3/3 patterns (score=3) — wait, that would make the 3/3 bank lose, which is wrong. The tie-breaking should prefer the bank with the higher ratio. Let me reconsider.

Actually, the correct approach for tie-breaking is: when `bestScore` is equal, prefer the bank with the higher absolute score (more patterns matched). This is already handled because `score` IS the absolute count. So if bank A matches 2/3 patterns and bank B matches 2/2 patterns, both have `score=2` and the first one in the array wins. The tie-breaker should prefer the bank that matched a higher fraction of its patterns, i.e., the one with higher confidence. Let me implement that:

```ts
if (score > bestScore) {
  bestScore = score;
  bestMatch = sig.bankId;
  bestBank = sig;
} else if (score === bestScore && score > 0 && bestBank) {
  // Tie-breaker: prefer the bank with higher confidence (matched ratio)
  const sigConfidence = score / sig.patterns.length;
  const bestConfidence = bestScore / bestBank.patterns.length;
  if (sigConfidence > bestConfidence) {
    bestMatch = sig.bankId;
    bestBank = sig;
  }
}
```

Wait, this changes the current behavior. The current code just picks the first match. Adding this tie-breaker would change which bank is selected in edge cases. Since this is C9-03 with MEDIUM confidence, let me just add the documentation comment and keep the behavior unchanged. The tie-breaker improvement can be a separate task if users report issues.

**Revised Implementation (documentation only):**
1. Add documentation comment explaining tie-breaking behavior.

**Commit:** `docs(parser): 📝 document bank detection tie-breaking behavior`

---

## Progress

- [x] Task 1: Add non-empty checks in isValidTx
- [x] Task 2: Sort monthlyBreakdown by month
- [x] Task 3: Document bank detection tie-breaking
