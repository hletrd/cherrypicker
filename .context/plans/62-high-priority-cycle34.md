# Plan 62 — High Priority Fixes (Cycle 34)

**Source findings:** C34-N1 (silent reward type fallback)
**Date:** 2026-05-06

---

## Task 1: Throw on unknown reward type in analyzer adapter [C34-N1]

**Finding:** C34-N1 — MEDIUM / High confidence
**File:** `apps/web/src/lib/analyzer.ts:71-73`

### Problem
Unknown reward types are silently coerced to `'discount'`, producing incorrect reward calculations without warning.

### Implementation
1. In `toCoreCardRuleSets()`, change the reward type fallback from silent default to explicit throw:
   ```ts
   type: VALID_REWARD_TYPES.has(r.type)
     ? (r.type as 'discount' | 'points' | 'cashback' | 'mileage')
     : (() => { throw new Error(`Unknown reward type "${r.type}" for card ${rule.card.id}`); })(),
   ```
2. Run tests to ensure no existing card rules have unknown types.
3. Add a test that verifies the throw behavior.

### Exit Criterion
- Unknown reward types throw instead of silently defaulting
- All 213 tests pass
- Lint and typecheck pass

**Status: COMPLETED** — Implemented in commit `703f628`.
