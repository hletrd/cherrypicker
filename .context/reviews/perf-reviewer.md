# Performance Review — cherrypicker (Cycle 20)

**Reviewer:** perf-reviewer (opus)
**Scope:** Full repository — hot paths, allocations, algorithmic complexity
**Date:** 2026-05-05

---

## Summary

Cycle 19 fixed monthly spending normalization but introduced no performance changes. Cycle 20 review finds 2 new performance-related findings: the greedy optimizer still recalculates rewards from scratch per transaction (carried from cycle 5, now with clearer impact), and the HTML parser's forward-fill creates unnecessary string allocations.

---

## New Findings

### [C20-PERF01-MEDIUM] Greedy optimizer recalculates full card rewards for every marginal score

**Files:** `packages/core/src/optimizer/greedy.ts:51-53`, `packages/core/src/optimizer/greedy.ts:124-156`
**Confidence:** High

For each transaction, `scoreCardsForTransaction` calls `calculateCardOutput` twice per card:
```ts
const before = calculateCardOutput(currentTransactions, previousMonthSpending, rule).totalReward;
const after = calculateCardOutput([...currentTransactions, transaction], previousMonthSpending, rule).totalReward;
```

Each call to `calculateCardOutput` re-evaluates ALL reward rules for ALL transactions assigned to that card. This is O(r * t) per call, where r = rules per card, t = transactions. With n transactions and m cards, total complexity is O(n * m * r * t).

**Concrete impact:** 500 transactions, 10 cards, 20 rules each. Each transaction triggers 20 full recalculations. Each recalculation processes up to 500 transactions * 20 rules = 10,000 evaluations. Total: 500 * 20 * 10,000 = 100,000,000 rule evaluations.

**Fix:** Cache marginal reward. Store `previousTotalReward` per card and compute only the incremental reward for the new transaction. This reduces complexity to O(n * m * r).

---

### [C20-PERF02-LOW] HTML parser forward-fill allocates strings per cell per row

**Files:** `apps/web/src/lib/parser/html.ts:141-244`
**Confidence:** High

Every row iteration creates multiple `String()` conversions and `isSummaryRow()` calls:
```ts
const dateRaw = String(dateCol !== -1 ? (isNonEmpty(rawDateValue) ? rawDateValue : lastDate) : '').trim();
```

For a 1000-row HTML table, this creates ~5000 intermediate strings and runs `isSummaryRow` up to 6000 times (once per cell update + once per row check). The `isSummaryRow` regex is large and recompiled on each call (no caching).

**Fix:** Pre-compile `SUMMARY_ROW_PATTERN` once (it already is at module level, but verify). Batch the `isSummaryRow` check: test the full row text once at line 146, then skip per-cell summary checks for rows already identified as summary rows.

---

## Previously Reported — Status

| Finding | Cycle | Status | Notes |
|---------|-------|--------|-------|
| MerchantMatcher O(n*m) scan | 4 | **OPEN** | LRU cache added (500 cap) but still linear scan on cache miss |
| PDF text extraction materializes entire document | 4 | **OPEN** | No streaming implemented |
| Greedy optimizer recalculation | 5 | **OPEN** | Same as C20-PERF01 |

---

## Verdict

**FIX AND SHIP** — C20-PERF01 is the most impactful. Marginal reward caching would reduce optimizer runtime by orders of magnitude for large datasets.
