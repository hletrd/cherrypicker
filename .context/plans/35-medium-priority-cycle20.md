# Plan 35 — Medium/Low-Priority Fixes (Cycle 20)

**Priority:** MEDIUM/LOW
**Findings addressed:** C20-06
**Status:** TODO

---

## Task 1: Add international annual fee as secondary sort key in CardGrid (C20-06)

**Finding:** C20-06 — The fee-asc and fee-desc sort options only sort by `annualFee.domestic`. Cards with the same domestic fee but different international fees appear in undefined order. For users who travel internationally, the international fee is relevant.

**File:** `apps/web/src/components/cards/CardGrid.svelte:62-65`

**Implementation:**

```ts
if (sortOrder === 'fee-asc') {
  result.sort((a, b) => a.annualFee.domestic - b.annualFee.domestic || a.annualFee.international - b.annualFee.international);
} else if (sortOrder === 'fee-desc') {
  result.sort((a, b) => b.annualFee.domestic - a.annualFee.domestic || b.annualFee.international - a.annualFee.international);
}
```

**Commit:** `fix(web): 🐛 add international annual fee as secondary sort key in CardGrid fee sorting`

---

## Deferred Items from This Cycle

### C20-02: Static keyword match returns wrong parent when value is non-dotted subcategory ID

- **Original finding:** C20-02
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `packages/core/src/categorizer/matcher.ts:47-49`
- **Reason for deferral:** All existing keyword values in the codebase use the correct dot-notation format for subcategories (e.g., `"dining.cafe"`) or simple category IDs. The theoretical mismatch requires a keyword mapped to a bare subcategory ID that also exists as a top-level category. No such case exists in the current keyword files. Fixing this would require adding a taxonomy-aware resolution step after the static match, which adds complexity for no current benefit.
- **Exit criterion:** If a new keyword is added that maps to a bare subcategory ID and causes incorrect categorization, add taxonomy-aware resolution.

### C20-03: AI categorizer doesn't clear rawCategory after category change

- **Original finding:** C20-03
- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:114`
- **Reason for deferral:** The `rawCategory` field is not displayed to users and is only used internally for matching on subsequent categorization attempts. After the AI changes the category, the transaction's `category` and `subcategory` fields are correctly updated, which is what the optimizer uses. The stale `rawCategory` has no functional impact.
- **Exit criterion:** If `rawCategory` is ever displayed in the UI or used in a way that produces incorrect results after AI categorization, clear it on category change.

### C20-04: Bucket creation `??` pattern is semantically awkward

- **Original finding:** C20-04 (extends D-87)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `packages/core/src/calculator/reward.ts:213-223`
- **Reason for deferral:** Same as D-87. The behavior is correct and V8 optimizes the `??` short-circuit. The style improvement is low priority and could be done as part of a broader refactoring of `calculateRewards`.
- **Exit criterion:** If the bucket creation logic is refactored, add explicit null check pattern.

### C20-05: Math.max spread stack overflow risk

- **Original finding:** C20-05 (same as D-73/D-89)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:18-19`
- **Reason for deferral:** Same as D-73/D-89. Typical usage has < 50 assignments.
- **Exit criterion:** If assignments ever exceed 10,000 entries, replace with `array.reduce()`.

### C20-07: formatIssuerNameKo hardcoded map duplicates cards.json issuer data

- **Original finding:** C20-07 (extends D-42/D-57)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/formatters.ts:49-77`
- **Reason for deferral:** Same class as D-42/D-57. The hardcoded map covers all current issuers. Replacing with dynamic lookup requires architectural changes (making the issuer name map available to the formatter, which may require a context/store). New issuers are rare and the fallback to the raw ID is functional.
- **Exit criterion:** When D-42 is resolved (dynamic data source lookup), apply the same pattern to formatter maps. If a new issuer is added and the formatter shows the raw ID, update the hardcoded map immediately.

---

## Progress

- [ ] Task 1: Add international annual fee as secondary sort key
