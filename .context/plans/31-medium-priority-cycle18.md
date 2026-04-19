# Plan 31 — Medium/Low-Priority Fixes (Cycle 18)

**Priority:** MEDIUM/LOW
**Findings addressed:** C18-03, C18-04
**Status:** TODO

---

## Task 1: Remove unnecessary globalConstraints type cast in CardDetail (C18-03)

**Finding:** C18-03 — `card.globalConstraints` is already typed as `{ monthlyTotalDiscountCap: number | null; minimumAnnualSpending: number | null }` from the `CardDetail` interface. Casting to `Record<string, unknown>` loses type safety.

**File:** `apps/web/src/components/cards/CardDetail.svelte:50-55`

**Implementation:**

Replace the cast with direct property access:

```ts
let globalLimit = $derived.by(() => {
  if (!card?.globalConstraints) return null;
  return card.globalConstraints.monthlyTotalDiscountCap;
});
```

**Commit:** `refactor(web): ♻️ remove unnecessary type cast in CardDetail globalLimit`

---

## Task 2: Add minimum keyword length guard to Taxonomy.findCategory substring search (C18-04)

**Finding:** C18-04 — `MerchantMatcher.match` has a `isSubstringSafeKeyword(kw)` guard that skips keywords shorter than 2 characters, but `Taxonomy.findCategory` has no equivalent guard. Single-character taxonomy keywords would match any merchant name containing that character.

**File:** `packages/core/src/categorizer/taxonomy.ts:68-76`

**Implementation:**

Add the same minimum keyword length guard:

```ts
for (const [kw, mapping] of this.keywordMap) {
  if (kw.trim().length < 2) continue;
  if (lower.includes(kw)) {
```

**Commit:** `fix(core): 🐛 add minimum keyword length guard to Taxonomy.findCategory substring search`

---

## Progress

- [x] Task 1: Remove unnecessary globalConstraints type cast
- [x] Task 2: Add minimum keyword length guard to Taxonomy.findCategory
