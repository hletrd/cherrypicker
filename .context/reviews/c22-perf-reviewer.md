# Cycle 22 — Performance Reviewer

**Date:** 2026-05-05
**Scope:** apps/web/src/lib/store.svelte.ts, packages/parser/src/
**Previous:** 21 cycles completed

---

## Finding C22-PERF01: SessionStorage size check uses character count instead of byte count [LOW]

**File:** `apps/web/src/lib/store.svelte.ts:170`

**Problem:** The persistence size check uses `serialized.length` which returns the number of UTF-16 code units:
```ts
if (serialized.length > MAX_PERSIST_SIZE) {
```

For text containing primarily Korean characters (Hangul), each character is 1 UTF-16 code unit but 3 bytes in UTF-8. The `sessionStorage` limit is typically 5-10MB per origin in bytes, not characters. A payload of 4 million Korean characters (approaching `MAX_PERSIST_SIZE = 4 * 1024 * 1024`) would consume approximately 12MB in UTF-8 bytes, well exceeding the typical 5-10MB browser limit.

**Impact:** Users with large Korean transaction datasets could experience `QuotaExceededError` even though the character-count check passed, because the actual byte size exceeds the browser's byte limit.

**Concrete failure scenario:** A user uploads 50,000 transactions with Korean merchant names. Each transaction JSON averages ~200 characters. Total: ~10M characters. The size check passes (10M > 4M, so truncation kicks in). But if the dataset is exactly 3.5M characters of mostly Korean text, the size check would NOT trigger truncation, yet the actual UTF-8 byte size would be ~10.5MB, causing a `QuotaExceededError`.

**Fix:** Use actual byte count:
```ts
const byteSize = new Blob([serialized]).size;
if (byteSize > MAX_PERSIST_SIZE) {
```

**Confidence:** Medium

---

## Finding C22-PERF02: Greedy optimizer re-calculates card outputs redundantly [LOW — Architectural]

**File:** `packages/core/src/optimizer/greedy.ts:51-52`

**Problem:** In `scoreCardsForTransaction`, the `calculateCardOutput` function is called twice per card per transaction:
```ts
const before = calculateCardOutput(currentTransactions, previousMonthSpending, rule).totalReward;
const after = calculateCardOutput([...currentTransactions, transaction], previousMonthSpending, rule).totalReward;
```

For N transactions and M cards, this is O(N * M * 2) calls to `calculateCardOutput`, which internally iterates over all transactions to compute caps and rewards. This is O(N² * M) overall. For a user with 10,000 transactions and 10 cards, this is 200,000 calls to `calculateCardOutput`, each of which iterates over up to 10,000 transactions.

**Impact:** The greedy optimizer has quadratic complexity which could become slow for very large datasets. However, typical credit card statements have < 1,000 transactions, so this is not a practical concern for the current use case.

**Fix:** Consider memoizing `calculateCardOutput` results keyed by `(cardId, transactionCount)` or implementing incremental reward calculation. This is architectural work deferred to D-09.

**Confidence:** Medium

---

## Commonly Missed Issues Sweep

- No memory leaks detected in Svelte store (proper cleanup on reset).
- No infinite loops in parsing logic (all loops have bounded iterations).
- No recursive functions that could cause stack overflow.
- File reads use reasonable buffer sizes (1024 bytes for sniffing, full read only when needed).

---

## Regressions

None found. Performance is acceptable for the target use case.
