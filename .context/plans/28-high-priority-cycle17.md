# Plan 28 — High-Priority Fixes (Cycle 17)

**Priority:** HIGH
**Findings addressed:** C17-01, C17-03, C17-11
**Status:** TODO

---

## Task 1: Fix `parseAmount` to return 0 instead of NaN (C17-01)

**Finding:** C17-01 — `parseAmount` in `pdf.ts` returns `NaN` for unparseable inputs. While current callers check for NaN, the API contract is fragile — any new code path that forgets the NaN check will silently propagate NaN into transaction amounts.

**File:** `apps/web/src/lib/parser/pdf.ts:180-183`

**Implementation:**

Change `parseAmount` to return 0 instead of NaN:

```ts
function parseAmount(raw: string): number {
  const n = parseInt(raw.replace(/원$/, '').replace(/,/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}
```

Also update the callers that check for NaN — they should check for 0 or positive amounts instead:

- Line 232: `if (Number.isNaN(amount) || (!merchant && amount === 0))` → `if (amount <= 0 || (!merchant && amount === 0))`
- Line 329: `if (!Number.isNaN(amount) && amount > 0)` → `if (amount > 0)` (already correct, NaN check becomes redundant)

**Commit:** `fix(parser): 🐛 return 0 instead of NaN from parseAmount to prevent NaN propagation`

---

## Task 2: Add warning when no performance tier is matched in `calculateRewards` (C17-03)

**Finding:** C17-03 — When `previousMonthSpending` is 0 and no tier matches, `tierId` becomes `'none'` and all reward rules are silently skipped. This produces 0 reward with no indication of why.

**File:** `packages/core/src/calculator/reward.ts:176-178`

**Implementation:**

Add a warning when no tier is matched:

```ts
const tier = selectTier(performanceTiers, previousMonthSpending);
const tierId = tier?.id ?? 'none';
if (tierId === 'none' && performanceTiers.length > 0) {
  console.warn(
    `[cherrypicker] No performance tier matched for card "${card.id}" ` +
    `with previousMonthSpending=${previousMonthSpending}. ` +
    `All rewards will be 0. Minimum tier requires ` +
    `${performanceTiers.reduce((min, t) => Math.min(min, t.minSpending), Infinity)} Won.`
  );
}
```

This only warns when the card actually HAS tiers (not for cards with no tiers at all), making it useful without being noisy.

**Commit:** `fix(core): 🐛 warn when no performance tier matches in calculateRewards`

---

## Task 3: Validate rawCategory normalization against taxonomy (C17-11)

**Finding:** C17-11 — When a bank provides a Korean text category (e.g., "온라인 쇼핑"), the `MerchantMatcher.match` normalizes it to "온라인_쇼핑" but doesn't check if this matches any taxonomy category. The result is a phantom category with 0 reward.

**File:** `packages/core/src/categorizer/matcher.ts:84-87`

**Implementation:**

The `MerchantMatcher` constructor already builds a `CategoryTaxonomy` which has a `getAllCategories()` method. Add a validation check after normalization:

```ts
// 4. Use rawCategory from bank as a weak signal (confidence 0.5)
if (rawCategory && rawCategory.trim().length > 0) {
  const normalised = rawCategory.trim().toLowerCase().replace(/\s+/g, '_');
  // Validate that the normalized category exists in the taxonomy.
  // If not, it's a Korean text label or bank-specific code that won't
  // match any reward rules — better to fall through to uncategorized.
  if (this.taxonomy.getAllCategories().includes(normalised)) {
    return { category: normalised, confidence: 0.5 };
  }
  // The raw category doesn't match any known taxonomy ID.
  // Fall through to uncategorized rather than creating a phantom category.
}
```

Note: `getAllCategories()` returns a new array each call. To avoid O(n) lookups per transaction, cache the category set in the constructor:

```ts
constructor(categoryNodes: CategoryNode[]) {
  this.taxonomy = new CategoryTaxonomy(categoryNodes);
  this.knownCategories = new Set(this.taxonomy.getAllCategories());
}
```

Then use `this.knownCategories.has(normalised)` for O(1) lookup.

**Commit:** `fix(core): 🐛 validate rawCategory against taxonomy to prevent phantom categories`

---

## Progress

- [x] Task 1: Fix parseAmount to return 0 instead of NaN
- [x] Task 2: Add warning when no performance tier is matched
- [x] Task 3: Validate rawCategory normalization against taxonomy
