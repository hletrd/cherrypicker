# Performance Review — cherrypicker (Cycle 5)

**Reviewer:** perf-reviewer (opus)
**Scope:** Full repository
**Date:** 2026-05-05

---

## Summary

One critical performance issue from cycle 4 (`rules.indexOf` in greedy optimizer sort) has been fixed. The remaining bottlenecks are the merchant matcher's O(n*m) scan and the greedy optimizer's O(m*n*r) recalculation pattern. Both are algorithmic issues that will degrade with scale. No new critical performance regressions found.

---

## New Findings (Cycle 5)

### [P1-HIGH] MerchantMatcher full-array scan on every transaction

**File:** `packages/core/src/categorizer/matcher.ts:58-81`
**Confidence:** High

```ts
for (const [kw, categoryStr] of SUBSTRING_SAFE_ENTRIES) {
  const merchantContainsKw = lower.includes(kw);
  const kwContainsMerchant = kw.includes(lower) && lower.length >= 3;
  if (merchantContainsKw || kwContainsMerchant) {
    // ...
  }
}
```

`SUBSTRING_SAFE_ENTRIES` contains all ~10,000+ keywords. Every transaction triggers a full linear scan with string `includes()` checks. For 1,000 transactions: 10M+ string operations.

**Fix:** Build a trie or Aho-Corasick automaton. Alternatively, add an LRU cache keyed by merchant name (common merchants like "스타벅스" appear dozens of times per statement).

---

### [P1-HIGH] Greedy optimizer recalculates card rewards from scratch per transaction

**File:** `packages/core/src/optimizer/greedy.ts:124-156`
**Confidence:** High

For each transaction, the optimizer calls `calculateCardOutput` twice per card (before/after adding the transaction). Each call re-evaluates ALL reward rules for ALL assigned transactions. This is O(m * n * r * a) where a = average transactions per card.

**Concrete scenario:** 500 transactions, 10 cards, 20 rules each. Each of 500 transactions triggers 10 * 2 = 20 full recalculations. Each recalculation processes up to 500 transactions * 20 rules = 10,000 rule evaluations. Total: 500 * 20 * 10,000 = 100,000,000 rule evaluations.

**Fix:** Cache marginal reward delta. Instead of recalculating from scratch, compute the incremental reward for adding one transaction to a card's existing assignment.

---

### [P2-MEDIUM] PDF text extraction materializes entire document

**File:** `packages/parser/src/pdf/extractor.ts:32-56`
**Confidence:** High

Entire PDF is read as a buffer, all pages extracted, then joined into a single string. For multi-year statements (100+ pages), this can consume 100MB+ of memory.

**Fix:** Stream pages one at a time. Process each page and extract transaction rows incrementally.

---

### [P2-MEDIUM] Taxonomy keywordMap iterates all entries

**File:** `packages/core/src/categorizer/taxonomy.ts:71-78`
**Confidence:** High

Same pattern as MerchantMatcher: full `keywordMap` iteration for substring matching.

**Fix:** Share the same trie/cache structure between matcher and taxonomy.

---

### [P3-LOW] `normalizeHeader` creates multiple intermediate strings

**File:** `packages/parser/src/csv/column-matcher.ts:14-21`
**Confidence:** Low

Minor: each header cell triggers 4 `.replace()` calls creating intermediate strings. With 30 headers per file and 1000 files, it's negligible compared to the matcher/optimizer bottlenecks.

**Fix:** Only relevant if headers are normalized repeatedly. Cache normalized headers after first computation.

---

## Previously Reported — Status

| Finding | Cycle | Status | Notes |
|---------|-------|--------|-------|
| Greedy optimizer sort O(n^2 log n) | 4 | **FIXED** | `rules.indexOf` removed |
| MerchantMatcher O(n*m) scan | 4 | **OPEN** | No trie or cache added |
| PDF LLM fallback truncates at 8000 | 4 | **OPEN** | No chunking implemented |
| SheetJS loads full HTML | 4 | **OPEN** | No pre-filtering added |
| PDF parser allocates strings | 4 | **OPEN** | No index-based scanning |
| Store loads from sessionStorage sync | 4 | **OPEN** | Still synchronous |

---

## Verdict

**FIX AND SHIP** — The optimizer's recalculation pattern and merchant matcher's linear scan are the two algorithmic debts that will become painful as user data scales.
