# Cycle 16 — Code Review

**Date:** 2026-05-06
**Scope:** Code quality, logic correctness, maintainability

## Findings

### C16-01 [MEDIUM] — `isOptimizableTx` excludes refund transactions, causing data loss on page refresh
- **File:** `apps/web/src/lib/store.svelte.ts:209`
- **Issue:** The `isOptimizableTx` validation function requires `obj.amount > 0`, but its comment at lines 196-199 states "Zero-amount entries (e.g., balance inquiries, declined transactions) are excluded." This comment does not mention negative amounts, yet the code silently drops refund/credit transactions (negative amounts) during sessionStorage restore.
- **Impact:** Refund transactions that were correctly parsed and categorized survive in the current session but disappear when the page is refreshed and `loadFromStorage` calls `isOptimizableTx` to validate persisted transactions. Users see refunds vanish after reload.
- **Fix:** Change `obj.amount > 0` to `obj.amount !== 0`. The `Number.isFinite(obj.amount)` guard on line 208 already excludes NaN/Infinity. This allows legitimate negative amounts to survive sessionStorage restore while still filtering zero-amount entries.
- **Confidence:** High

### C16-02 [LOW] — `reoptimize` excludes refunds from previous-month spending calculation
- **File:** `apps/web/src/lib/store.svelte.ts:519`
- **Issue:** The `reoptimize` function builds `monthlySpending` using `tx.amount > 0`, which means refund transactions do not contribute to previous-month spending totals. This could undercount spending and affect performance tier selection.
- **Impact:** If a user has significant refunds in a month, the `previousMonthSpending` used for performance tier calculation will be lower than actual gross spending. The comment at line 517-518 mentions "Korean 전월실적 (gross spending) convention" but Korean card companies typically count gross spending (before refunds) for tier qualification.
- **Fix:** Use `tx.amount !== 0` or document explicitly that net spending is used. If gross spending is intended, change to `Math.abs(tx.amount)`.
- **Confidence:** Medium

### C16-03 [LOW] — Redundant amount check in `scoreCardsForTransaction`
- **File:** `packages/core/src/optimizer/greedy.ts:54`
- **Issue:** `const rate = transaction.amount > 0 ? reward / transaction.amount : 0;` is redundant because transactions are already pre-filtered for `amount > 0 && Number.isFinite(tx.amount)` at line 198 before reaching `scoreCardsForTransaction`.
- **Impact:** Minor code clarity issue. The redundant check suggests uncertainty about input validation.
- **Fix:** Remove the conditional and use `reward / transaction.amount` directly, or add a comment/assertion documenting the pre-filter guarantee.
- **Confidence:** High

### C16-04 [LOW] — `findField` uses `in` operator for prototype chain lookup
- **File:** `apps/web/src/lib/parser/json.ts:58` and `packages/parser/src/json/index.ts:65`
- **Issue:** `findField` uses `alias in obj` which checks the entire prototype chain, not just own properties. If a JSON object has polluted prototypes (e.g., via prototype pollution attack or library), `findField` could return unexpected inherited values.
- **Impact:** Theoretically could cause incorrect field matching if prototype pollution occurs. In practice, JSON.parse creates plain objects with no custom prototype.
- **Fix:** Use `Object.hasOwn(obj, alias)` instead of `alias in obj` for safer own-property lookup.
- **Confidence:** Low

## Carry-overs from Previous Cycles
- C15-03 through C15-05, C15-SEC01-02, C15-TEST01-03, C15-PERF02 remain deferred per cycle 15 plan.
- Parser duplication (D-01) remains a deferred architectural concern.

## Summary
Cycle 16 has 1 MEDIUM and 3 LOW actionable code-quality findings. The highest priority is C16-01 (refund data loss on sessionStorage restore), which affects data integrity.
