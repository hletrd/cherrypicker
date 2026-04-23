# Cycle 96 — code-reviewer pass

**Date:** 2026-04-23
**Scope:** Net-new sweep against the full repo since cycle 95 convergence.

---

## New Findings

### C96-01: `analyzer.ts:337` non-null assertion on potentially empty `months` array silently produces zero-reward optimization

- **File/line:** `apps/web/src/lib/analyzer.ts:336-338` (pre-fix)
- **Severity:** MEDIUM
- **Confidence:** HIGH
- **Pattern:** Invalid assumption / invariant violation / silent failure

**Claim.** The line

```ts
const months = [...monthlySpending.keys()].sort();
const latestMonth = months[months.length - 1]!;
```

assumes `monthlySpending` is non-empty whenever `allTransactions.length > 0` (the preceding guard at line 310). That assumption is false.

**Failure scenario.** The parser layer's `parseDateToISO` (in `csv.ts`, `xlsx.ts`, `pdf.ts`) delegates to `parseDateStringToISO`, which — when no known format matches — returns the **raw, unparseable input** as-is, only pushing a parse error. The transaction is still included in the parse result (see `csv.ts:259-263,278`). Therefore, if a statement has a non-standard date format that `parseDateStringToISO` doesn't recognize, every transaction in `allTransactions` carries an invalid date string. Then:

1. `analyzeMultipleFiles` passes the `allTransactions.length === 0` check at line 310 (length is non-zero).
2. The loop at line 320-333 skips every row because the guard at line 323 rejects `tx.date.length < 7`.
3. `monthlySpending` is empty, `months = []`.
4. `months[months.length - 1]!` evaluates to `undefined` with a non-null assertion.
5. `latestTransactions = allTransactions.filter(tx => tx.date.startsWith(undefined))` — `startsWith` coerces to `"undefined"` and always returns false → empty array.
6. `optimizeFromTransactions([], …)` returns `{ assignments: [], totalReward: 0, totalSpending: 0, ... }`.
7. The store reports `success: true` with a blank optimization. The user sees an empty dashboard with no indication that the upload failed.

**Why this slipped past prior cycles.** Earlier cycles addressed (a) all-refund statements by filtering at parser level (`amount <= 0`) and (b) the same length guard in `getLatestMonth`. Neither covers the case where transactions make it through the parser with unparseable dates. The parse error is reported in `result.parseErrors`, but the store's `setResult` only surfaces `error` when `analyzeMultipleFiles` throws — a successful-looking `{ success: true, transactionCount: 0 }` is indistinguishable from real success in the UI.

**Fix.** Throw a user-facing error when `months.length === 0` instead of letting the non-null assertion resolve to `undefined`. Surface the failure before the optimizer runs on empty input.

**Patch (applied):**

```ts
const months = [...monthlySpending.keys()].sort();
if (months.length === 0) {
  throw new Error('거래 내역의 날짜를 해석할 수 없어요. 파일 형식을 확인해 주세요.');
}
const latestMonth = months[months.length - 1]!;
```

**Test:** Regression test added in `apps/web/__tests__/analyzer-adapter.test.ts` asserting that when every transaction has an unparseable date, `monthlySpending` is empty (proving the production branch now fires).

---

## Other areas examined (no findings)

- `store.svelte.ts` reoptimize path — already uses the `latestMonth ? ... : editedTransactions` fallback correctly (line 513-515) and the `else if (latestMonth)` guard on previousMonthSpending computation (line 557).
- Parser-layer `isValidISODate` reporting — correctly pushes errors to `errors` array.
- `getLatestMonth` in analyzer.ts — already uses the safe `?? null` pattern (line 265).

No other net-new issues beyond C96-01.
