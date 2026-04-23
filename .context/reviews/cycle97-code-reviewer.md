# Cycle 97 — code-reviewer pass

**Date:** 2026-04-23

## Scope

Net-new issues since cycle 96. Focused sweep over:
- `apps/web/src/lib/analyzer.ts` (all paths, with emphasis on fullStatementPeriod construction lines 369-377)
- `apps/web/src/lib/store.svelte.ts` (reoptimize path lines 486-593, specifically the previousMonthSpending recompute branch)
- `apps/web/src/lib/formatters.ts`
- `packages/core/src/optimizer/greedy.ts`
- `packages/core/src/calculator/reward.ts`

## Findings

### C97-01: `analyzer.ts:369` fullStatementPeriod uses unfiltered dates, producing malformed period bounds when the upload contains any unparseable dates (LOW, HIGH confidence)

**File:** `apps/web/src/lib/analyzer.ts:369-372`

**Problem.** After C96-01 was fixed for the *all-dates-unparseable* case, the *mixed* case still silently produces wrong output. `allTransactions` is NOT filtered by `tx.date.length >= 7` — the length guard on line 323 only gates `monthlySpending` accumulation, not the underlying array. So transactions with short/malformed dates like `"2026-"` or `"1/15"` survive into `allDates = allTransactions.map(tx => tx.date).filter(Boolean).sort()`.

Because `.sort()` with no comparator sorts lexicographically, short non-ISO strings like `"2026-"` (5 chars) sort ahead of `"2026-01-05"` (the char at position 5 differs: end-of-string vs `'0'`, and end-of-string is lexicographically smaller). The result: `fullStatementPeriod.start` becomes the malformed raw string, and `SpendingSummary.formatPeriod()` falls back to `'-'` for the start (via `formatYearMonthKo`), displaying "- ~ 2026년 3월" instead of the actual range.

**Concrete failure scenario.** A user uploads a CSV where one row has a date cell that failed to parse (e.g., a stray footer line slipped through with `"소계"` or `"합계"` in the date column, yielding a raw string after parser fallback). The dashboard banner shows `"- ~ 2026년 3월"` in the "분석 기간" card — visibly wrong.

**Fix.** Filter `allDates` to valid ISO (length >= 10 `YYYY-MM-DD`) before sorting. Same for `optimizedDates` even though the `latestTransactions.filter(tx => tx.date.startsWith(latestMonth))` already excludes short dates — keep them symmetric for clarity and defense-in-depth:

```ts
const allDates = allTransactions
  .map(tx => tx.date)
  .filter((d) => typeof d === 'string' && d.length >= 10)
  .sort();
```

**Confidence:** HIGH (logic traced end-to-end).
**Severity:** LOW (UI cosmetic; throw path for all-unparseable is already covered by C96-01).

---

### C97-02: `store.svelte.ts:557-566` reoptimize previousMonthSpending skipped when latest month has only refunds (LOW, MEDIUM confidence)

**File:** `apps/web/src/lib/store.svelte.ts:557-566`

**Problem.** `reoptimize()` calls `getLatestMonth(editedTransactions)` at line 512, which returns a month based on ALL transaction dates (including refund-only months where every amount is <= 0). The recompute branch at line 557-566 then builds `months` from `updatedMonthlyBreakdown`, which only contains months with `tx.amount > 0` (line 531). If the user's edits reduce the latest month to refunds only (e.g., they reassign every positive amount to a different month, leaving refunds), `latestMonth` is set to a month that does NOT appear in `months` — `months.indexOf(latestMonth)` returns -1, `latestIdx > 0` is false, and `previousMonthSpending` stays undefined. The optimizer then falls back to per-card exclusion-filtered spending, which is fine behaviorally, but creates an unexpected discontinuity between the initial analyze path (where `latestMonth` is always derived from `monthlySpending.keys()`) and reoptimize (where it's derived from ALL dates).

**Concrete failure scenario.** Low-probability but reachable through aggressive editing. The practical impact is that user edits in the latest (refund-only) month don't trigger the normal "use previous month's breakdown spending" branch.

**Fix.** Either (a) align `getLatestMonth` with the analyzer's `monthlySpending.keys()` definition (filter for positive amounts), or (b) in `reoptimize`, derive `latestMonth` from `updatedMonthlyBreakdown` after it's computed, to match analyzer semantics.

**Confidence:** MEDIUM (edge case; unclear if user can realistically produce it).
**Severity:** LOW (no incorrect output, just an unexpected code path).

---

### C97-03: `greedy.ts:330-331` bestSingleCard ignores per-card previousMonthSpending filtering when different cards have different `performanceExclusions` (LOW, MEDIUM confidence)

**File:** `packages/core/src/optimizer/greedy.ts:328-340`

**Observation.** The `bestSingleCard` calculation at line 329-340 passes `sortedTransactions` (filter `tx.amount > 0 && isFinite`) to `calculateCardOutput(sortedTransactions, previousMonthSpending, rule)`. `previousMonthSpending` here is already the per-card exclusion-filtered value from `cardPreviousSpending` — correct.

But the `savingsVsSingleCard` semantic ("if you used just one card") is compared against the multi-card `totalReward`. This is correct as long as the single-card scenario uses the same transaction set (`sortedTransactions`). The current code does this properly.

**No finding.** Sanity check passed.

---

## Commonly-missed-issues sweep

- **localeCompare vs bare sort on ISO date strings.** `store.svelte.ts:559` uses bare `.sort()` on `YYYY-MM` strings — safe (same lexicographic order). `analyzer.ts:369/374` use bare `.sort()` on dates — this is the C97-01 vector.
- **Array index returns on unexpected types.** `store.svelte.ts:560-563` has a defensive `latestIdx > 0` guard, but allows the -1 branch to silently proceed. See C97-02.
- **Non-null assertions.** `date-utils.ts` has several `!.padStart()` chains after regex matches — all safe because the numeric capture groups match `\d{1,4}` which can never produce `undefined` from a successful `exec()`.
- **Maps and Sets without explicit keying.** `rewardTypeAccum` in `reward.ts:221-335` correctly uses `categoryKey`. `assignedTransactionsByCard` in `greedy.ts:275-309` uses card ids. No ambiguity.
- **Sort stability.** `findRule` has secondary sort by index (C1-12 fix in place). `buildAssignments` sorts by `spending` only, which may be non-stable across engines, but the output is deterministic in the positions we care about (tie-breaking not user-visible).

## Summary

1 LOW-severity HIGH-confidence finding (C97-01), 1 LOW-severity MEDIUM-confidence finding (C97-02). Neither is safety-critical.
