# Performance Review — cherrypicker (Cycle 19)

**Reviewer:** perf-reviewer
**Scope:** CPU efficiency, memory usage, algorithmic complexity, hot paths
**Date:** 2026-05-06

---

## Summary

Cycle 18 fixed the redundant amount check in `scoreCardsForTransaction`. Cycle 19 review confirms no new performance regressions. The dominant remaining issue is the O(N*M^2) complexity in the greedy optimizer's card scoring, unchanged since prior cycles.

---

## New Findings

### C19-PERF01 [LOW] — Greedy optimizer recalculates card outputs repeatedly

**File:** `packages/core/src/optimizer/greedy.ts:51-52`
**Confidence:** High

```ts
const before = calculateCardOutput(currentTransactions, previousMonthSpending, rule).totalReward;
const after = calculateCardOutput([...currentTransactions, transaction], previousMonthSpending, rule).totalReward;
```

For each of M transactions, this iterates over all N cards and calls `calculateRewards` twice. `calculateRewards` itself iterates over all transactions assigned to that card. In the worst case (all transactions on one card), this is O(2*N*M^2) total work.

**Impact:** With 1000 transactions and 50 cards, this could take several seconds on slower devices.

**Fix:** Incrementally update card reward state instead of recomputing from scratch. Cache per-card reward totals and only add the marginal reward for the new transaction.

---

### C19-PERF02 [LOW] — MerchantMatcher substring scan is O(n) per call

**File:** `packages/core/src/categorizer/matcher.ts:76-91`
**Confidence:** Medium

The substring match loop iterates over all keyword entries for every merchant name. With ~500 keywords and thousands of transactions, this adds up. The LRU cache mitigates repeated merchants, but first-seen merchants pay full cost.

**Fix:** Consider a Trie or Aho-Corasick automaton for O(length_of_merchant) matching instead of O(keywords).

---

## Carry-overs from Previous Cycles

- **P2-MEDIUM** — PDF text extraction materializes entire document (MEDIUM)
- **P2-MEDIUM** — Taxonomy keywordMap iterates all entries (MEDIUM)

---

## Verdict

**SHIP IT** — C19-PERF01 is a known architectural limitation, not a new regression. Address when transaction volumes justify the refactoring effort.
