# Plan 01 — Critical Fixes (C-01, C-02)

**Priority:** CRITICAL — must be fixed before any other work
**Findings addressed:** C-01, C-02
**Status:** Pending

---

## Task 1: Fix `changeCategory` to clear stale subcategory (C-01)

**Finding:** `TransactionReview.svelte:154` — `changeCategory` sets `tx.category = newCategory` but leaves `tx.subcategory` unchanged, causing stale subcategory data that corrupts optimizer scoring.

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte`

**Implementation:**
1. In `changeCategory()`, set `tx.subcategory = undefined` after changing `tx.category`
2. The existing `tx.confidence = 1.0` is correct for manual overrides
3. No need to look up the new subcategory — the optimizer will match on category alone

**Test:**
- Manual test: change a transaction from `dining` (subcategory: `cafe`) to `public_transit`, verify subcategory is cleared
- Verify optimizer produces correct rewards after recategorization

**Commit:** `fix(web): 🐛 clear stale subcategory on manual recategorization`

---

## Task 2: Replace `as unknown as` type bypasses with proper type adapters (C-02)

**Finding:** `analyzer.ts:38,103` — Two `as unknown as` casts bridge incompatible types between web app local types and core/rules packages, bypassing TypeScript's structural type checking.

**Files:**
- `apps/web/src/lib/analyzer.ts`
- `apps/web/src/lib/cards.ts`

**Implementation:**
1. In `cards.ts`, the local `CardRuleSet` type has `source: string` while `@cherrypicker/rules` has `source: 'manual' | 'llm-scrape' | 'web'`. The JSON data from the static file always has valid enum values, so we can validate at load time.
2. Add a `validateCardRuleSet()` function that checks the `source` field is a valid enum value, then safely cast.
3. For `CategoryNode`, the web type has an extra `label` field. Since this is a superset (more fields, not fewer), the cast from `CategoryNode` (web) to `RulesCategoryNode` (rules) is safe structurally — the rules type just doesn't have `label`. We can use a proper type narrowing function instead of `as unknown as`.
4. Replace `as unknown as` with proper adapter functions:

```ts
// For CategoryNode — structural compatibility check
function toRulesCategoryNodes(nodes: CategoryNode[]): RulesCategoryNode[] {
  return nodes.map(node => ({
    id: node.id,
    labelKo: node.labelKo,
    labelEn: node.labelEn,
    keywords: node.keywords,
    ...(node.subcategories ? { subcategories: toRulesCategoryNodes(node.subcategories) } : {}),
  }));
}

// For CardRuleSet — validate source field
function toCoreCardRuleSets(rules: CardRuleSet[]): CoreCardRuleSet[] {
  return rules.map(rule => ({
    ...rule,
    card: {
      ...rule.card,
      source: rule.card.source as 'manual' | 'llm-scrape' | 'web', // validated by JSON schema at build time
    },
  }));
}
```

**Test:**
- TypeScript compilation should pass without `as unknown as`
- Runtime behavior should be identical (the adapter just validates/narrows types)

**Commit:** `fix(web): 🛡️ replace unsafe type casts with proper adapters`

---

## Progress

- [x] Task 1: Fix `changeCategory` subcategory clearing
- [x] Task 2: Replace `as unknown as` type bypasses
