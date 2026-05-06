# Performance Review — CherryPicker Cycle 39

**Reviewer:** perf-reviewer (manual, Agent tool unavailable)
**Date:** 2026-05-06
**Cycle:** 39 / 100
**HEAD:** d265c46

---

## Findings

### PERF-39-01 — Low — JSON `findField` is O(aliases × keys) instead of O(keys)

**File:** `packages/parser/src/json/index.ts:67-82`
**File:** `apps/web/src/lib/parser/json.ts:67-82`

```typescript
function findField(obj: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (Object.hasOwn(obj, alias)) return obj[alias];
  }
  for (const alias of aliases) {
    const lower = alias.toLowerCase();
    for (const key of Object.keys(obj)) {
      if (key.toLowerCase() === lower) return obj[key];
    }
  }
  return undefined;
}
```

**Problem:** In the case-insensitive fallback path, for each alias (up to ~40 for merchant), it scans ALL object keys. For a JSON object with 20 keys and 3 fields to find (date, merchant, amount), this is ~40×20 + ~30×20 + ~40×20 = 2200 lowercasing+comparison operations per transaction. For 1000 transactions, that's 2.2M operations.

**Fix:** Build a lowercase lookup map once per object:
```typescript
function findField(obj: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (Object.hasOwn(obj, alias)) return obj[alias];
  }
  const lowerMap = new Map(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
  for (const alias of aliases) {
    const v = lowerMap.get(alias.toLowerCase());
    if (v !== undefined) return v;
  }
  return undefined;
}
```

**Impact:** In typical usage, objects have < 20 keys and the exact-match path usually succeeds, so the case-insensitive path is rarely hit. However, when it IS hit (e.g., mixed-case field names from certain APIs), the cost is unnecessary.

**Confidence:** Medium

---

### PERF-39-02 — Low — OFX `extractTag` creates RegExp objects on every call

**File:** `packages/parser/src/ofx/index.ts:67-78`

See BUG-39-03. Creating RegExp objects is relatively expensive compared to execution.

**Confidence:** Low

---

### PERF-39-03 — Medium — `cardPreviousSpending` is O(cards × tx) for excluded cards

**File:** `apps/web/src/lib/analyzer.ts:224-263`

For each card with performanceExclusions, the code loops over ALL transactions:
```typescript
for (const rule of coreRules) {
  // ...
  if (rule.performanceExclusions.length === 0) {
    cardPreviousSpending.set(rule.card.id, totalPositiveSpending);
  } else {
    let qualifying = 0;
    for (const tx of transactions) {
      if (tx.amount <= 0) continue;
      if (!exclusions.has(tx.category) && ...) {
        qualifying += tx.amount;
      }
    }
    cardPreviousSpending.set(rule.card.id, qualifying);
  }
}
```

**Problem:** With ~500 cards and ~500 transactions, and assuming 20% of cards have exclusions, that's 100 cards × 500 transactions = 50K iteration steps. Each step does 3 Set lookups and branching.

**Mitigation:** The comment at line 245 says "Single-pass loop avoids intermediate array allocation". The current approach is already optimized for memory. A true speedup would require pre-computing per-category spending totals and summing only the included categories — but this requires knowing the category taxonomy structure.

**Confidence:** Low (known trade-off, documented)

---

## Carryover Status

| ID | Status | Notes |
|----|--------|-------|
| PERF-02 | OPEN | Greedy optimizer still O(C × T²) in worst case |
| PERF-06 | OPEN | cardPreviousSpending O(cards × tx) for excluded cards |
| PERF-01 | DEFERRED | keywords.ts bundle size deferred |
