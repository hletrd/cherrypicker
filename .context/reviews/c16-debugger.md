# Cycle 16 — Debugger Review

**Date:** 2026-05-06
**Scope:** Latent bugs, edge cases, failure modes

## Findings

### C16-DB01 [MEDIUM] — `loadFromStorage` shallow validation allows corrupted data to propagate
- **File:** `apps/web/src/lib/store.svelte.ts:250-312`
- **Issue:** The validation in `loadFromStorage` only checks that `optimization.assignments`, `totalReward`, `totalSpending`, and `effectiveRate` exist. It does not validate the shape of individual assignments, cardResults entries beyond cardId/totalReward/byCategory, or transactions beyond the `isOptimizableTx` filter. The `as AnalysisResult` cast at line 312 then presents this partially-validated data as fully typed.
- **Concrete failure:** If sessionStorage contains a manipulated object where `optimization.assignments` has entries missing `assignedCardId`, downstream components like `OptimalCardMap` or `CategoryBreakdown` will throw TypeError when accessing nested properties.
- **Fix:** Add Zod schema validation for the full persisted shape, or at minimum validate critical nested fields before the cast.
- **Confidence:** Medium

### C16-DB02 [MEDIUM] — Refund transactions vanish on page refresh
- **File:** `apps/web/src/lib/store.svelte.ts:209`
- **Issue:** `isOptimizableTx` filters `amount > 0`, dropping negative-amount (refund) transactions during sessionStorage restore. The parsers correctly preserve negative amounts, and the optimizer handles them by skipping (line 214 in reward.ts, line 198 in greedy.ts). But the persistence layer incorrectly discards them.
- **Concrete failure:** User uploads a statement with refunds, sees them in TransactionReview, refreshes the page — refunds are gone. The UI shows fewer transactions without explanation.
- **Fix:** Change `obj.amount > 0` to `obj.amount !== 0` in `isOptimizableTx`.
- **Confidence:** High

### C16-DB03 [LOW] — `findField` prototype chain access could match unexpected fields
- **File:** `apps/web/src/lib/parser/json.ts:58`
- **Issue:** `alias in obj` checks the prototype chain. If a JSON object has a `toString` method or other inherited properties matching an alias (e.g., `date` is not an inherited property but edge cases exist), unexpected values could be returned.
- **Concrete failure:** Extremely unlikely with standard JSON.parse output, but could manifest if someone passes a custom object with modified prototype.
- **Fix:** Use `Object.hasOwn(obj, alias)`.
- **Confidence:** Low

## Summary
Two MEDIUM findings (data validation and refund loss) and one LOW finding.
