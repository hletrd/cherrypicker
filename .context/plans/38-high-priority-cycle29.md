# Plan 38 — High Priority Fixes (Cycle 29)

**Source findings:** C29-01 (MEDIUM, High confidence)

---

## Task 1: Fix performanceExclusions to match subcategory and dot-notation keys

**Finding:** C29-01
**Severity:** MEDIUM
**Confidence:** High
**File:** `apps/web/src/lib/analyzer.ts:189-192`

### Problem

When computing per-card `previousMonthSpending` without explicit user input, the code filters transactions with `!exclusions.has(tx.category)`. However, `performanceExclusions` entries can be subcategory IDs (e.g., `cafe`) or dot-notation keys (e.g., `dining.cafe`). If a card excludes `cafe` from its performance calculation, transactions with `tx.category = 'dining'` and `tx.subcategory = 'cafe'` would NOT be excluded because `exclusions.has('dining')` returns false.

### Implementation

1. Open `apps/web/src/lib/analyzer.ts`
2. Locate the `performanceExclusions` filter block (lines 188-192)
3. Replace the simple `!exclusions.has(tx.category)` check with a comprehensive check that also considers `tx.subcategory` and the dot-notation key:
   ```typescript
   const exclusions = new Set(rule.performanceExclusions);
   const qualifying = transactions
     .filter(tx =>
       !exclusions.has(tx.category) &&
       !(tx.subcategory && exclusions.has(tx.subcategory)) &&
       !(tx.subcategory && exclusions.has(`${tx.category}.${tx.subcategory}`))
     )
     .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
   ```
4. Verify the fix compiles with `cd /Users/hletrd/flash-shared/cherrypicker && npx tsc --noEmit -p apps/web/tsconfig.json`

### Exit Criterion

- All three exclusion matching strategies (parent category, subcategory, dot-notation) are checked
- TypeScript compilation succeeds
- No existing tests break

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | DONE — commit 000000043c |
