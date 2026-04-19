# Plan 29 — Medium/Low-Priority Fixes (Cycle 17)

**Priority:** MEDIUM/LOW
**Findings addressed:** C17-07, C17-02, C17-09, C17-12
**Status:** TODO

---

## Task 1: Downgrade ILP stub warning to debug level (C17-07)

**Finding:** C17-07 — `ilpOptimize` always warns on console. A public API that always warns is misleading.

**File:** `packages/core/src/optimizer/ilp.ts:48`

**Implementation:**

Change `console.warn` to `console.debug`:

```ts
console.debug('[cherrypicker] ILP optimizer is not yet implemented — falling back to greedy optimizer');
```

Or better, remove the log entirely since it fires on every call and the stub nature is documented in the JSDoc.

**Commit:** `fix(core): 🐛 downgrade ILP stub console.warn to debug level`

---

## Task 2: Add comment about g-flag safety on fallbackAmountPattern (C17-02)

**Finding:** C17-02 — The `g` flag on `fallbackAmountPattern` is needed for `matchAll` but would cause `lastIndex` issues if the regex were moved to module scope.

**File:** `apps/web/src/lib/parser/pdf.ts:313`

**Implementation:**

Add a comment:

```ts
// The 'g' flag is required for matchAll() below. Do NOT hoist this regex
// to module scope — the global flag's lastIndex mutation would break
// .test()/.exec() calls if the regex were shared across invocations.
const fallbackAmountPattern = /([\d,]+)원?/g;
```

**Commit:** `docs(parser): 📝 add g-flag safety comment on fallbackAmountPattern`

---

## Task 3: Fix rate source inconsistency in buildAssignments (C17-09)

**Finding:** C17-09 — For the first transaction in a category, `rate` is set from `assignment.rate` (marginal rate). For subsequent transactions, it's recalculated as `reward / spending` (effective rate). While both produce the same result for a single transaction, the inconsistency is confusing.

**File:** `packages/core/src/optimizer/greedy.ts:158-166`

**Implementation:**

Always use the effective rate calculation for consistency:

```ts
if (current) {
  current.spending += assignment.tx.amount;
  current.reward += assignment.reward;
} else {
  assignmentMap.set(key, {
    category: categoryKey,
    categoryNameKo: ...,
    assignedCardId: assignment.assignedCardId,
    assignedCardName: assignment.assignedCardName,
    spending: assignment.tx.amount,
    reward: assignment.reward,
    rate: 0, // Will be recalculated below
    alternatives: [],
  });
}

// Recalculate rate for both new and existing entries
const entry = assignmentMap.get(key)!;
entry.rate = entry.spending > 0 ? entry.reward / entry.spending : 0;
```

Actually, simpler: just move the rate calculation outside the if/else. Or even simpler, set `rate: assignment.rate` in the else branch and keep the existing recalculation in the if branch — the values are equivalent for a single transaction, and the recalculation for accumulated entries is correct. Add a comment instead:

```ts
// For the first transaction, assignment.rate equals reward/spending.
// For accumulated entries, we recalculate the effective rate.
```

**Commit:** `refactor(core): ♻️ add comment clarifying rate source in buildAssignments`

---

## Task 4: Switch E2E tests to use production preview server (C17-12)

**Finding:** C17-12 — E2E tests run against dev server, not production build.

**File:** `playwright.config.ts:17`

**Implementation:**

Change the webServer command:

```ts
webServer: {
  command: `cd apps/web && bunx astro preview --host ${host} --port ${port}`,
  url: `http://${host}:${port}${basePath}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
},
```

Note: This requires a prior `astro build` step. The `test:e2e` script already runs `turbo run build` before `playwright test`, so this should work. But verify the preview server starts correctly before committing.

**Commit:** `test(e2e): 🧪 switch playwright config to use production preview server`

---

## Progress

- [ ] Task 1: Downgrade ILP stub warning to debug level
- [ ] Task 2: Add g-flag safety comment on fallbackAmountPattern
- [ ] Task 3: Add rate source clarification comment in buildAssignments
- [ ] Task 4: Switch E2E tests to production preview server
