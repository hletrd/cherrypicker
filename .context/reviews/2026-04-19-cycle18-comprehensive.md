# Cycle 18 Comprehensive Review — 2026-04-19

**Reviewer:** Multi-angle comprehensive review
**Scope:** Full codebase, cross-file interactions, new findings not in D-01 through D-103 or C17-01 through C17-14

---

## Verification of Cycle 17 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C17-01 (parseAmount returns NaN) | FIXED | `pdf.ts:180-185` — returns 0 instead of NaN |
| C17-03 (no tier matched warning) | FIXED | `reward.ts:183-193` — warns when tierId === 'none' and tiers exist |
| C17-11 (rawCategory phantom categories) | FIXED | `matcher.ts:27-28,91-95` — knownCategories Set validates against taxonomy |
| C17-07 (ILP stub console.warn) | FIXED | `ilp.ts:48` — downgraded to console.debug |
| C17-02 (g-flag comment) | FIXED | `pdf.ts:316-318` — safety comment added |
| C17-09 (rate source comment) | FIXED | `greedy.ts:156-162` — comment added |
| C17-12 (E2E dev server) | FIXED | `playwright.config.ts` — switched to preview server |

---

## New Findings

### C18-01: `previousSpending` empty string converts to 0 instead of undefined — tiered cards get 0 reward

**Severity:** HIGH
**Confidence:** High
**File:** `apps/web/src/components/upload/FileDropzone.svelte:200`

```ts
previousMonthSpending: (() => { const v = Number(previousSpending); return Number.isFinite(v) && v >= 0 ? v : undefined; })(),
```

When the user leaves the "전월 카드 이용액" input empty, `previousSpending` is `''` (empty string). `Number('')` returns `0`, not `NaN`. Since `Number.isFinite(0)` is `true` and `0 >= 0` is `true`, the expression evaluates to `0` instead of `undefined`.

This `0` is then passed to `analyzer.ts:174-176`, where `options.previousMonthSpending !== undefined` is true, so all cards get `previousMonthSpending: 0`. This causes `selectTier` to find no qualifying tier for tiered cards, resulting in 0 reward for ALL categories — silently.

The placeholder text says "입력하지 않으면 50만원으로 계산해요" but the actual behavior is `0`, not `undefined` (which would trigger the auto-calculation path) and not `500000`.

**Concrete failure scenario:** User uploads a single-month statement for a card with performance tiers (e.g., minSpending: 300000). Leaves the previousSpending field empty. The optimizer computes `previousMonthSpending: 0`, so no tier matches, and the card gets 0 reward on all categories. The user sees a misleading result with no indication of why.

**Suggested fix:** Check for empty string before Number conversion:

```ts
previousMonthSpending: (() => {
  const v = previousSpending.trim();
  if (v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
})(),
```

**Commit:** `fix(web): 🐛 treat empty previousSpending as undefined to avoid zero-tier default`

---

### C18-02: TransactionReview dropdown has duplicate option values for categories that exist as both parent and subcategory

**Severity:** MEDIUM
**Confidence:** Medium
**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:52-65,287`

When building `categoryOptions`, the code iterates taxonomy nodes and adds both parent categories and subcategories. If a category ID (e.g., "cafe") exists as both a standalone top-level category AND as a subcategory of another category (e.g., dining), two `<option>` elements with the same `value="cafe"` are created — one indented (subcategory) and one not (parent).

The HTML `<select>` element cannot distinguish between options with the same value. When a transaction has `subcategory: "cafe"`, the select highlights the first matching option, which may be the wrong one. Additionally, `changeCategory` always maps "cafe" to the parent "dining" via `subcategoryToParent`, regardless of whether the user intended to select the standalone "cafe" category.

**Concrete failure scenario:** Transaction is categorized as "dining" with subcategory "cafe". The dropdown shows "cafe" selected but highlights the non-indented parent "카페" option instead of the indented "  카페" option. If the user re-selects "cafe" (intending the subcategory), `changeCategory` sets `category: "dining"`, which is correct. But if the user intended to select the standalone "cafe" category, they cannot because the `subcategoryToParent` map overrides the choice.

**Suggested fix:** Use fully-qualified subcategory IDs (e.g., "dining.cafe") as option values for subcategories, not just the node ID. This eliminates the duplicate-value ambiguity:

```ts
for (const sub of node.subcategories) {
  const fqId = `${node.id}.${sub.id}`;
  options.push({ id: fqId, label: `  ${sub.labelKo}` });
  parentMap.set(fqId, node.id);
}
```

Then update the `<select>` binding to handle fully-qualified IDs in `changeCategory`.

**Commit:** `fix(web): 🐛 use fully-qualified subcategory IDs in TransactionReview dropdown to avoid duplicate values`

---

### C18-03: `CardDetail.svelte` globalConstraints cast loses type safety

**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/components/cards/CardDetail.svelte:50-55`

```ts
let globalLimit = $derived.by(() => {
  if (!card?.globalConstraints) return null;
  const gc = card.globalConstraints as Record<string, unknown>;
  if (typeof gc.monthlyTotalDiscountCap === 'number') return gc.monthlyTotalDiscountCap as number;
  return null;
});
```

The `card.globalConstraints` is already typed as `{ monthlyTotalDiscountCap: number | null; minimumAnnualSpending: number | null }` from the `CardDetail` interface. Casting to `Record<string, unknown>` loses type safety and requires a runtime `typeof` check that TypeScript would have caught at compile time. The cast is unnecessary.

**Suggested fix:** Access the property directly:

```ts
let globalLimit = $derived.by(() => {
  if (!card?.globalConstraints) return null;
  return card.globalConstraints.monthlyTotalDiscountCap;
});
```

**Commit:** `refactor(web): ♻️ remove unnecessary type cast in CardDetail globalLimit`

---

### C18-04: `Taxonomy.findCategory` substring search has no minimum keyword length guard

**Severity:** LOW
**Confidence:** Medium
**File:** `packages/core/src/categorizer/taxonomy.ts:68-76`

```ts
for (const [kw, mapping] of this.keywordMap) {
  if (lower.includes(kw)) {
    if (!bestSubstring || kw.length > bestSubstring.kwLen) {
      bestSubstring = { ...mapping, kwLen: kw.length };
    }
  }
}
```

The `MerchantMatcher.match` method in `matcher.ts:56` has a guard `if (!isSubstringSafeKeyword(kw)) continue;` that skips keywords shorter than 2 characters. However, `Taxonomy.findCategory` has no such guard. Single-character taxonomy keywords would match any merchant name containing that character. While the longest-match heuristic reduces the risk (a 1-char match would lose to any 2+ char match), if only a 1-char keyword matches, it would be returned with 0.8 confidence, which is too high for such a weak match.

**Suggested fix:** Add the same minimum keyword length guard:

```ts
for (const [kw, mapping] of this.keywordMap) {
  if (kw.trim().length < 2) continue;
  if (lower.includes(kw)) {
```

**Commit:** `fix(core): 🐛 add minimum keyword length guard to Taxonomy.findCategory substring search`

---

## Summary of New Findings (Not in D-01 through D-103 or C17-01 through C17-14)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C18-01 | HIGH | High | `FileDropzone.svelte:200` | Empty previousSpending string converts to 0 instead of undefined — tiered cards get 0 reward |
| C18-02 | MEDIUM | Medium | `TransactionReview.svelte:52-65` | Dropdown has duplicate option values for categories that exist as both parent and subcategory |
| C18-03 | LOW | High | `CardDetail.svelte:50-55` | Unnecessary globalConstraints type cast loses type safety |
| C18-04 | LOW | Medium | `taxonomy.ts:68-76` | Substring search has no minimum keyword length guard unlike MerchantMatcher |

---

## Final Sweep — No Missed Files

All source files examined:
- `packages/core/src/` — all .ts files (models, calculator, optimizer, categorizer)
- `apps/web/src/lib/` — analyzer.ts, cards.ts, store.svelte.ts, formatters.ts, parser/*
- `apps/web/src/components/` — all dashboard/*.svelte, upload/*.svelte, cards/*.svelte, ui/*.svelte
- `apps/web/src/pages/` — all .astro files
- `apps/web/src/layouts/` — Layout.astro

All previously deferred items (D-01 through D-103) remain correctly deferred. One new HIGH finding (C18-01) that silently produces wrong optimization results for the common case of single-file uploads with tiered cards.
