# Code Review — CherryPicker Cycle 35

## Methodology
Reviewed packages/core/src/, packages/parser/src/, packages/rules/src/, packages/viz/src/, tools/cli/src/, tools/scraper/src/, apps/web/src/ from code quality, logic correctness, SOLID, and maintainability angles.

---

## CONFIRMED ISSUES

### CR-01: Silent error swallowing in format detection JSON.parse
**File**: `packages/parser/src/detect.ts:290`
**Severity**: Medium | **Confidence**: High
```typescript
} catch {
  format = 'csv';
}
```
When sniffing unknown file extensions, the code attempts `JSON.parse(sniffBuffer.toString())` but silently swallows ALL parse errors, defaulting to CSV. A malformed JSON file (e.g., syntax error) will be incorrectly treated as CSV instead of surfacing a parse error. This hides real user mistakes.
**Fix**: Capture the parse error and include it in the result's errors array, or at minimum log it.

### CR-02: Silent error swallowing in HTML parser
**File**: `packages/parser/src/html/index.ts:48`
**Severity**: Medium | **Confidence**: High
Same pattern: XLSX parsing errors are silently caught and the function returns `{transactions: [], errors: []}` with no indication that parsing failed.
**Fix**: Surface the caught error as a ParseError in the returned errors array.

### CR-03: `toCoreCardRuleSets` throws on unknown reward type instead of graceful degradation
**File**: `apps/web/src/lib/analyzer.ts:76-81`
**Severity**: Medium | **Confidence**: High
```typescript
throw new Error(
  `Unknown reward type "${r.type}" in rule for category "${r.category}" on card "${rule.card.id}". ` +
  `Expected one of: discount, points, cashback, mileage`,
);
```
If a card YAML has a typo in reward type (e.g., "point" instead of "points"), the entire optimization crashes. Since card rules come from scraped/curated data and may have human error, this should default to a safe value and warn instead of throwing.
**Fix**: Default to `'discount'` (or `'none'`) and emit a `console.warn` rather than throwing.

### CR-04: `console.warn` in production code for unknown card source
**File**: `apps/web/src/lib/analyzer.ts:68`
**Severity**: Low | **Confidence**: High
Console warnings leak into production builds. The `toCoreCardRuleSets` adapter logs a warning for unknown card sources. While functional, this creates noise in production.
**Fix**: Remove the console.warn or guard it behind a development-only check.

### CR-05: Greedy optimizer `rate` calculation could divide by zero
**File**: `packages/core/src/optimizer/greedy.ts:55`
**Severity**: Low | **Confidence**: Medium
```typescript
const rate = reward / transaction.amount;
```
While `transaction.amount` is pre-filtered at line 199 for `> 0`, this is a separate location. If `scoreCardsForTransaction` is ever called directly with unfiltered data, this divides by zero. The function has no guard.
**Fix**: Add `if (transaction.amount <= 0) continue;` at the top of `scoreCardsForTransaction`.

### CR-06: Missing validation for `performanceTiers` in `selectTier`
**File**: `packages/core/src/calculator/reward.ts:13-22`
**Severity**: Low | **Confidence**: Medium
`selectTier` assumes `performanceTiers` is sorted. If tiers are out of order (e.g., minSpending descending instead of ascending), the `reduce` picks the wrong tier. No validation enforces ordering.
**Fix**: Sort tiers by `minSpending` before processing, or validate ordering at load time.

---

## LIKELY ISSUES / RISKS

### CR-07: Type duplication between core and web
**File**: `apps/web/src/lib/store.svelte.ts`, `packages/core/src/models/result.ts`
**Severity**: Low | **Confidence**: High
`store.svelte.ts` re-declares `CardRewardResult`, `CategoryReward`, `CapInfo`, `CardAssignment`, `OptimizationResult` — all duplicating core package types. This increases maintenance burden and risks divergence.
**Fix**: Import types from `@cherrypicker/core` directly instead of re-declaring.

---

## COMMONLY MISSED CHECK

### CR-08: No validation that `categoryLabels` Map is non-empty
**File**: `apps/web/src/lib/analyzer.ts:260-265`
**Severity**: Low | **Confidence**: Medium
If `loadCategories()` returns empty array, `buildCategoryLabelMap` returns empty Map. The optimizer then uses raw English category keys as labels. No error is thrown.
**Fix**: Validate that categoryLabels has entries before passing to optimizer, or handle empty labels gracefully.
