# Cycle 26 — Verifier Findings

**Date:** 2026-05-06
**Scope:** Evidence-based correctness check against stated behavior
**Method:** Code-to-comment validation, spec compliance, invariant checking

---

## C26-VERIFY01 — Reward calculator comment claims precedence but code doesn't implement it (MEDIUM)

**File:** `packages/core/src/calculator/reward.ts:261-263`
**Confidence:** High

The comment says: "Both rate and fixedAmount are present on the same tier. Korean card rules do not currently use both together. The if/else structure can only apply one, so rate-based reward takes precedence."

Verification: Traced the code paths for `hasFixedReward=true && normalizedRate > 0`:
- Branch 1 (lines 260-267): Calculates rate-based reward only. Does NOT add fixedAmount.
- Branch 2 (lines 268-272): Also calculates rate-based reward only.
- Branch 3 (lines 273-277): Calculates fixed reward only.

The "precedence" claim is misleading. Both branches 1 and 2 produce identical results. The fixedAmount is never used when rate is present. This is correct behavior if the intent is "rate wins over fixed" — but then branch 1 is redundant with branch 2.

**Fix:** Remove the redundant condition and merge branches 1+2, OR implement actual combined calculation if that's the intent.

---

## C26-VERIFY02 — JSON parser spec: negative amounts "preserved" but silently dropped by optimizer (MEDIUM)

**File:** `packages/parser/src/json/index.ts:113-114` → `packages/core/src/optimizer/greedy.ts:199`
**Confidence:** High

The JSON parser comment says: "Negative amounts (refunds/credits) are preserved — the optimizer's positive-only filter handles them."

Verification:
1. JSON parser returns negative amounts in `RawTransaction[]` ✓
2. `analyzeMultipleFiles` passes them through to `CategorizedTx[]` ✓
3. `store.svelte.ts` stores them in `result.transactions` ✓
4. `TransactionReview.svelte` displays them in the transaction list ✓
5. `greedyOptimize` filters them with `tx.amount > 0` at line 199 ✓

The spec is internally consistent (parser preserves, optimizer filters). But the UX is inconsistent with other parsers that skip negatives at step 1.

**Fix:** Align JSON parser with other parsers by skipping `amount <= 0`, or document the intentional difference and ensure UI handles it.

---

## C26-VERIFY03 — OFX timezone conversion produces correct KST dates (LOW)

**File:** `packages/parser/src/ofx/index.ts:82-108`
**Confidence:** High

Verified the timezone math with concrete examples:

- Input: `20240115120000[0:GMT]` (noon GMT)
  - `Date.UTC(2024, 0, 15, 12, 0, 0)` = 1705320000000 (correct UTC timestamp)
  - `utcMs = 1705320000000 - 0 = 1705320000000`
  - `kst = new Date(1705320000000 + 32400000)` = Date for 2024-01-15T21:00:00Z
  - `getUTCFullYear()` = 2024, `getUTCMonth()` = 0, `getUTCDate()` = 15
  - Result: `2024-01-15` ✓

- Input: `20240115200000[0:GMT]` (8pm GMT)
  - `kst` timestamp = 1705356000000 + 32400000 = 1705388400000
  - = 2024-01-16T05:00:00Z → `getUTCDate()` = 16
  - Result: `2024-01-16` ✓ (8pm GMT = 5am KST next day)

- Input: `20240115120000[+9:KST]` (noon KST)
  - `Date.UTC(2024, 0, 15, 12, 0, 0)` = 1705320000000 (treats as UTC, but it's KST)
  - `utcMs = 1705320000000 - 32400000 = 1705287600000` (= 2024-01-15T03:00:00Z, correct!)
  - `kst = new Date(1705287600000 + 32400000)` = 1705320000000
  - `getUTCDate()` = 15
  - Result: `2024-01-15` ✓

The math is correct. The code is confusing but functional.

---

## Summary

| Severity | Count | Categories |
|----------|-------|------------|
| MEDIUM | 2 | spec mismatch |
| LOW | 1 | verified correct |

**Verdict:** FIX AND SHIP
