# Cycle 33 Code Review — CherryPicker

**Agent:** c33-code-reviewer  
**Date:** 2026-05-06  
**Status:** Agent spawn failed; review performed by orchestrator

---

## Finding 1: Type assertions on external data persist in store.svelte.ts [MEDIUM / High confidence]

**Files:** `apps/web/src/lib/store.svelte.ts:267,287,328`

**Problem:** Three `as Record<string, unknown>` casts bypass TypeScript structural checking on data loaded from sessionStorage. If corrupted storage contains arrays or primitives where objects are expected, the casts produce `undefined` dereferences downstream in dashboard components.

- Line 267: `const obj = a as Record<string, unknown>;` — assignment filter
- Line 287: `const obj = cr as Record<string, unknown>;` — card result filter  
- Line 328: `const obj = item && typeof item === 'object' ? item as Record<string, unknown> : null;` — monthly breakdown map

**Failure scenario:** A user with corrupted sessionStorage (e.g., browser extension manipulating storage) has `parsed.optimization.assignments` as a non-array. The `Array.isArray` check at line 263 catches this, but the inner `.filter()` still casts each element. If an element is a number, `typeof obj.assignedCardId === 'string'` evaluates on `undefined`, silently filtering out valid-looking entries.

**Suggested fix:** Replace `as` with `typeof` guards that validate shape before accessing properties, already partially done but the cast remains.

**Confidence:** High

---

## Finding 2: `getCalcFn` silently defaults to `calculateDiscount` for unknown reward types [MEDIUM / High confidence]

**File:** `packages/core/src/calculator/reward.ts:108-111`

**Problem:** The switch statement has no explicit handling for unknown types and falls through to `calculateDiscount`. If a card rule YAML has a typo in `type` (e.g., `cashbak` instead of `cashback`), the calculator silently computes a discount-style reward instead of flagging the error.

```typescript
default:
  return calculateDiscount;
```

**Failure scenario:** A newly scraped card rule has `type: 'point'` (singular). The optimizer computes discount-style rewards (floor(amount * rate)) instead of points rewards. The user sees incorrect recommendations. This is particularly likely given the LLM scraper produces rules from unstructured HTML.

**Suggested fix:** Throw on unknown types in development/test, or log a warning and default. Add a validation step in the rule loader that rejects unknown reward types.

**Confidence:** High

---

## Finding 3: JSON parser `as Record<string, unknown>` casts on wrapper extraction [LOW / Medium confidence]

**Files:** `apps/web/src/lib/parser/json.ts:182,222` and `packages/parser/src/json/index.ts:200,243`

**Problem:** After `JSON.parse`, the code casts the result to `Record<string, unknown>` without validating it's actually an object. `JSON.parse` can return arrays, strings, numbers, booleans, or null.

**Failure scenario:** A wrapped JSON like `"transactions": [1, 2, 3]` (array of numbers instead of objects) passes the `Array.isArray(obj[key])` check, then each number is cast to `Record<string, unknown>` and passed to `parseTransactionObject`, which immediately returns `null` because `typeof item !== 'object'`. This is handled gracefully, but the cast is misleading.

**Suggested fix:** Remove the `as` cast; the `typeof parsed === 'object'` guard at line 181 already narrows. For `items = obj[key] as unknown[]`, use `Array.isArray(obj[key])` as a guard.

**Confidence:** Medium

---

## Finding 4: `tx-validation.ts` type assertion without null guard [LOW / Medium confidence]

**File:** `apps/web/src/lib/tx-validation.ts:10`

**Problem:** `const obj = tx as Record<string, unknown>;` assumes `tx` is an object. The function `isOptimizableTx` is called from `loadFromStorage` on each element of `parsed.transactions`. While `isOptimizableTx` checks `typeof tx === 'object'`, the cast happens before any validation.

Actually, re-reading: the cast is AFTER `typeof tx === 'object'` in the function body. This is acceptable but still bypasses TypeScript's strict checks.

**Suggested fix:** Not urgent — the runtime guard is present.

**Confidence:** Low

---

## Final Sweep

- All C32 fixes verified present: XLSX blank-row reset (line 480), perTxCap fix (line 263-264), LRU cache (matcher.ts lines 45-50), isOnline removal (transaction.ts), UTF-16 BOM (index.ts), JSON findField determinism (lines 75-79), NaN validation (store.svelte.ts:567), sort stability (greedy.ts:198-207).
- No new logic bugs identified in reward.ts, greedy.ts, or analyzer.ts.
- No memory leaks in store.svelte.ts.
