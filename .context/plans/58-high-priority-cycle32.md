# Plan 58 — High Priority Fixes (Cycle 32)

**Source findings:** C32-F1 (XLSX blank-row forward-fill), C32-F2 (isOnline dead code), C32-F3 (UTF-16 gap), C32-BUG-1 (per-tx cap bug), C32-V07 (FIFO cache eviction)
**Date:** 2026-05-06

---

## Task 1: Fix XLSX forward-fill state leak on blank rows [C32-F1]

**Finding:** C32-F1 — HIGH / High confidence
**Files:** `apps/web/src/lib/parser/xlsx.ts:480`, `packages/parser/src/xlsx/index.ts` (server-side parity)

### Problem

The web XLSX parser at line 480 skips blank rows with `continue` but does NOT reset forward-fill state (`lastDate`, `lastMerchant`, `lastCategory`, `lastInstallments`, `lastMemo`, `lastAmount`). Summary rows ARE correctly handled (C27-COR02, lines 484-493), but blank rows are not. When a Korean bank XLSX export uses blank rows to separate monthly sections, values from Section A forward-fill into Section B's first transaction.

The HTML parser was already fixed for this in C31-TRACE01 (Plan 56 Task 8).

### Implementation

1. Open `apps/web/src/lib/parser/xlsx.ts`
2. Locate line 480:
   ```typescript
   if (row.every((c) => !c)) continue;
   ```
3. Replace with the same reset pattern used for summary rows and HTML blank rows:
   ```typescript
   if (row.every((c) => !c)) {
     // Reset forward-fill state on blank rows to prevent values from
     // unrelated data sections from leaking into subsequent sections (C32-F1).
     lastDate = '';
     lastMerchant = '';
     lastCategory = '';
     lastInstallments = '';
     lastMemo = '';
     lastAmount = '';
     continue;
   }
   ```
4. Check `packages/parser/src/xlsx/index.ts` for the same pattern and apply the fix there too (server-side parity).

### Exit Criterion

- Blank rows reset forward-fill state in both web and server XLSX parsers
- Existing XLSX tests pass
- Add test: XLSX with two data sections separated by blank rows — Section B's first merged-cell transaction does NOT inherit Section A's values

---

## Task 2: Fix per-transaction cap applied to amount instead of reward [C32-BUG-1]

**Finding:** C32-BUG-1 — HIGH / High confidence
**File:** `packages/core/src/calculator/reward.ts:265`

### Problem

For percentage-based rewards (cashback, discount, points, mileage), `perTxCap` is applied to the transaction **amount** before computing the reward:
```typescript
const effectiveAmount = perTxCap !== null ? Math.min(tx.amount, perTxCap) : tx.amount;
rawReward = calcFn(effectiveAmount, normalizedRate, null, 0).reward;
```

This is mathematically incorrect. For a card with 5% cashback and per-transaction cap of 500 Won on a 20,000 Won transaction:
- Expected: min(floor(20,000 * 0.05), 500) = 500 Won
- Actual: floor(min(20,000, 500) * 0.05) = floor(500 * 0.05) = 25 Won

The user receives 25 Won instead of 500 Won — a 20x undercalculation.

### Implementation

1. Open `packages/core/src/calculator/reward.ts`
2. Locate lines 264-266:
   ```typescript
   const calcFn = getCalcFn(rule.type);
   const effectiveAmount = perTxCap !== null ? Math.min(tx.amount, perTxCap) : tx.amount;
   rawReward = calcFn(effectiveAmount, normalizedRate, null, 0).reward;
   ```
3. Replace with:
   ```typescript
   const calcFn = getCalcFn(rule.type);
   const uncappedReward = calcFn(tx.amount, normalizedRate, null, 0).reward;
   rawReward = perTxCap !== null ? Math.min(uncappedReward, perTxCap) : uncappedReward;
   ```
4. Note: Fixed rewards (lines 268-271) already correctly apply `perTxCap` to `rawReward`.
5. Add/update tests to verify the fix.

### Exit Criterion

- Rate-based reward with perTxCap produces correct capped reward value
- `calcFn(tx.amount, ...)` is called with full amount, not capped amount
- Existing tests for fixed rewards still pass
- New test: 5% cashback, perTxCap=500, tx=20000 → reward=500 (not 25)

---

## Task 3: Fix MerchantMatcher cache eviction from FIFO to LRU [C32-V07]

**Finding:** C32-V07 — HIGH / High confidence
**File:** `packages/core/src/categorizer/matcher.ts:128-130`

### Problem

The code documents an LRU cache with `MAX_CACHE_SIZE = 500`, but eviction uses `this.cache.keys().next().value`, which evicts the *first-inserted* entry (FIFO), not the *least-recently-used* entry. For workloads with >500 unique merchants, this causes unnecessary cache misses and repeated taxonomy scans.

```typescript
// matcher.ts:128-130 (FIFO, not LRU)
if (this.cache.size >= MAX_CACHE_SIZE) {
  this.cache.delete(this.cache.keys().next().value);
}
```

### Implementation

1. Open `packages/core/src/categorizer/matcher.ts`
2. Modify the `setCache` method to implement true LRU via Map ordering:
   - On every `getCache` hit, delete and re-insert the key to move it to the end
   - On eviction, delete the first key (oldest accessed)
3. The current code already does `this.cache.set(key, result)` on insertion, which puts it at the end.
4. Add `getCache` method that promotes accessed entries:
   ```typescript
   private getCache(key: string): MatchResult | undefined {
     const result = this.cache.get(key);
     if (result !== undefined) {
       // Promote to most-recently-used by re-inserting
       this.cache.delete(key);
       this.cache.set(key, result);
     }
     return result;
   }
   ```
5. Update all cache reads in `match()` to use `getCache`.

### Exit Criterion

- Accessing a cached entry moves it to the "newest" position
- Eviction removes the least-recently-accessed entry, not the first-inserted
- Cache tests pass (if any exist) or add new LRU eviction test

---

## Task 4: Remove isOnline / excludeOnline dead code [C32-F2]

**Finding:** C32-F2 — HIGH / High confidence
**Files:** `apps/web/src/lib/parser/types.ts:18`, `apps/web/src/lib/analyzer.ts:97,153,186`, `packages/core/src/calculator/reward.ts:40`, `packages/core/src/models/transaction.ts:8`

### Problem

`RawTransaction.isOnline` is declared in types but NEVER populated by any parser. `CategorizedTx.isOnline` propagates `undefined` through the pipeline. `ruleConditionsMatch` at `reward.ts:40` evaluates `excludeOnline && tx.isOnline` — since `isOnline` is always `undefined` (falsy), this branch is unreachable. Users with "offline-only" cards see online transactions incorrectly assigned.

### Implementation

**Option A (recommended — immediate correctness):** Remove `excludeOnline` from the schema, calculator, and UI.

1. Remove `isOnline?: boolean` from `RawTransaction` in `apps/web/src/lib/parser/types.ts`
2. Remove `isOnline?: boolean` from `packages/parser/src/types.ts`
3. Remove `isOnline?: boolean` from `CategorizedTx` in `apps/web/src/lib/analyzer.ts:97`
4. Remove `isOnline: tx.isOnline` from `analyzer.ts:153` and `isOnline: tx.isOnline` from `analyzer.ts:186`
5. Remove `isOnline?: boolean` from `CategorizedTransaction` in `packages/core/src/models/transaction.ts:8`
6. Remove `isOnline` from the `ruleConditionsMatch` check in `packages/core/src/calculator/reward.ts:40`
7. Remove `excludeOnline?: boolean` from any rule schema/YAML types
8. Update tests that reference `isOnline` or `excludeOnline`

### Exit Criterion

- No references to `isOnline` or `excludeOnline` remain in production code
- TypeScript compilation succeeds
- All tests pass
- The dead code path in `reward.ts` no longer exists

---

## Task 5: Add UTF-16 LE/BE BOM detection to web-side parseFile [C32-F3]

**Finding:** C32-F3 — MEDIUM / High confidence
**File:** `apps/web/src/lib/parser/index.ts:26-62`

### Problem

Web-side `parseFile` only tries `['utf-8', 'cp949']` encodings. Server-side `detectEncoding` (`packages/parser/src/detect.ts:9-47`) handles UTF-16 LE BOM (`0xFF 0xFE`) and UTF-16 BE BOM (`0xFE 0xFF`). Older Korean bank systems occasionally export UTF-16 LE CSVs. The web app produces replacement characters and fails categorization.

### Implementation

1. Open `apps/web/src/lib/parser/index.ts`
2. Before the encoding trial loop (around line 28), add BOM detection:
   ```typescript
   // Check for UTF-16 BOM before the utf-8/cp949 trial (C32-F3).
   // Korean bank systems occasionally export UTF-16 "Unicode" CSVs.
   const arr = new Uint8Array(buffer);
   if (arr.length >= 2 && arr[0] === 0xFF && arr[1] === 0xFE) {
     content = new TextDecoder('utf-16le').decode(buffer);
     // Skip the encoding trial — BOM is authoritative
     const detectedBank = bank ?? detectBankFromText(content);
     const result = parseCSV(content, detectedBank ?? undefined);
     return result;
   } else if (arr.length >= 2 && arr[0] === 0xFE && arr[1] === 0xFF) {
     content = new TextDecoder('utf-16be').decode(buffer);
     const detectedBank = bank ?? detectBankFromText(content);
     const result = parseCSV(content, detectedBank ?? undefined);
     return result;
   }
   ```
3. Keep the existing `utf-8`/`cp949` trial as fallback for non-UTF-16 files.

### Exit Criterion

- UTF-16 LE CSV with BOM parses correctly (no replacement characters)
- UTF-16 BE CSV with BOM parses correctly
- UTF-8 and CP949 files still work as before
- Add test with synthetic UTF-16 LE BOM CSV

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | pending |
| 2 | pending |
| 3 | pending |
| 4 | pending |
| 5 | pending |
