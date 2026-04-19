# Comprehensive Code Review — Cycle 20

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 20)
**Scope:** Full repository — all packages, apps, and shared code

---

## Methodology

Read every source file in the repository. Cross-referenced with prior cycle 1-19 reviews, deferred items (D-01 through D-105), and the aggregate. Focused on finding genuinely NEW issues not previously reported. Verified that prior cycle 19 findings (C19-01 through C19-06) have all been fixed.

---

## Verification of Cycle 19 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C19-01 | FIXED | `store.svelte.ts:359-368` — previousMonthSpending computed from monthlyBreakdown's previous month |
| C19-02 | FIXED | `store.svelte.ts:256`, `analyzer.ts:200`, `analyzer.ts:258` — dot-notation keys added in all three locations |
| C19-03 | FIXED | `CardGrid.svelte:22` — `availableIssuers` derived from `filteredCards` |
| C19-04 | FIXED | `SpendingSummary.svelte:18-19` — uses `slice(0, 7)` instead of `split('-')` |
| C19-05 | DEFERRED (D-104) | Same as D-38 — acknowledged, LOW, not a bug |
| C19-06 | DEFERRED (D-105) | Same as D-62 — acknowledged, LOW, not a bug |

---

## New Findings

### C20-01: `CardDetail.svelte` reward category names show raw English IDs instead of Korean labels

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/cards/CardDetail.svelte:207-209`
- **Description:** The reward table in CardDetail displays `row.category` directly (e.g., "dining", "fuel", "online_shopping"). The `getCategoryIconName()` function only provides icons, not Korean labels. Unlike the dashboard's `buildAssignments()` which uses `categoryLabels` to resolve Korean names, CardDetail never translates category IDs to Korean. Users browsing card details see raw English category IDs like "dining" instead of "외식", "fuel" instead of "주유".
- **Failure scenario:** Navigate to any card detail page. The "카테고리별 혜택" table shows "dining", "fuel", "online_shopping" as category names — all in English, inconsistent with the Korean-only UI everywhere else.
- **Fix:** Import `loadCategories` and build a category label map in the `onMount` or `$effect`, then resolve `row.category` through it. Alternatively, the `cards.json` reward entries could include a `labelKo` field at build time.

### C20-02: `MerchantMatcher.match` returns wrong subcategory for static keyword matches when keyword value contains dot notation

- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/categorizer/matcher.ts:47-49`
- **Description:** When a static keyword maps to a dot-notation value like `"dining.cafe"`, the code splits on `.` and extracts both `category` and `subcategory`. But when the keyword maps to a simple category like `"dining"`, the subcategory is `undefined`. The issue is that the split produces `[category, subcategory]` but if the keyword value has multiple dots (unlikely today but possible), the split would produce more than 2 elements and only the second would be taken as subcategory, silently discarding the rest. More importantly, the `.split('.')` operation on values like `"public_transit"` (containing underscore) works correctly, but the code assumes the dot notation format is authoritative. If a keyword is mapped to a parent category that also has subcategories, the matcher returns `subcategory: undefined`, which is correct — but if a keyword maps to a value that is both a category AND a subcategory (e.g., `"cafe"` exists as both a top-level entry and a `dining.cafe` subcategory), the match may return the wrong parent.
- **Failure scenario:** A keyword mapped to `"cafe"` returns `{ category: "cafe", subcategory: undefined }` instead of `{ category: "dining", subcategory: "cafe" }`. The optimizer then tries to match reward rules for `"cafe"` category instead of `"dining.cafe"`, potentially missing subcategory-specific reward rules.
- **Fix:** Validate static keyword values against the taxonomy at build time, or add a lookup step after the static match to resolve the correct parent-child relationship.

### C20-03: `TransactionReview` AI categorizer sets `subcategory = undefined` after category change but doesn't clear rawCategory

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:114`
- **Description:** When the AI categorizer changes a transaction's category, it sets `tx.subcategory = undefined` and `tx.category = result.category`. However, `tx.rawCategory` is left as the original bank-provided category. While this doesn't affect optimization (rawCategory is only used for matching), it creates an inconsistency in the transaction data where the displayed category differs from the stored rawCategory.
- **Failure scenario:** A transaction with rawCategory "온라인쇼핑" gets AI-categorized as "online_shopping". The rawCategory still shows "온라인쇼핑" if inspected. This is cosmetic and doesn't affect functionality.
- **Fix:** This is extremely low priority. The rawCategory field is not displayed to users and is only used internally for matching. No action needed unless the data model is refactored.

### C20-04: `calculateRewards` bucket creation uses `??` operator which evaluates the left side even when it exists

- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/calculator/reward.ts:213-223`
- **Description:** The `categoryRewards.get(categoryKey) ?? { ... }` pattern creates a new object literal every time, even when the key already exists in the Map. While V8 optimizes this well in practice (the object literal is not allocated if `??` short-circuits), the pattern is semantically awkward — it creates an implicit dependency on `??` short-circuit behavior for performance. This was flagged as D-87 (LOW, Low confidence) in cycle 11 and the behavior is correct. The `categoryRewards.set(categoryKey, bucket)` on line 228 and 235 is needed for the first occurrence of a categoryKey, but is a no-op on subsequent occurrences. This is not a bug but a code quality observation.
- **Fix:** Use `let bucket = categoryRewards.get(categoryKey); if (!bucket) { bucket = { ... }; categoryRewards.set(categoryKey, bucket); }` for clarity. This is a style improvement only.

### C20-05: `OptimalCardMap` `maxRate` derivation uses `Math.max(...array)` which risks stack overflow for large arrays

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:18-19`
- **Description:** This is the same issue as D-73/D-89. `Math.max(...assignments.map((a) => a.rate), 0.001)` spreads the mapped array as arguments. With typical usage (< 50 assignments) this is fine. The existing deferral is appropriate. Noting it for completeness as it was re-confirmed in this review.

### C20-06: `CardGrid` sort by fee ignores international annual fee

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/cards/CardGrid.svelte:62-65`
- **Description:** The fee-asc and fee-desc sort options only sort by `annualFee.domestic`. Cards with the same domestic fee but different international fees (e.g., 0 domestic / 15000 international vs 0 domestic / 20000 international) appear in undefined order. For users who travel internationally, the international fee is relevant.
- **Failure scenario:** Two cards both have 0 domestic annual fee. One has 15,000 international, the other 30,000. Both appear at the same position in fee-asc sort. The user cannot compare international fees from the card list view.
- **Fix:** Sort by `annualFee.domestic` as primary key, then `annualFee.international` as secondary key. Or add a separate "해외연회비" sort option.

### C20-07: `formatIssuerNameKo` in formatters.ts is duplicated from `cards.ts` issuer data

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/formatters.ts:49-77` vs `apps/web/src/lib/cards.ts:110-117`
- **Description:** The `formatIssuerNameKo` function hardcodes issuer Korean names. The same data exists in `cards.json` (IssuerData.nameKo). If a new issuer is added to `cards.json`, the formatter will show the raw issuer ID instead of the Korean name until the formatter is also updated. This is the same class of issue as D-42 (hardcoded maps that drift from the data source).
- **Failure scenario:** A new issuer "citi" is added to `cards.json` with `nameKo: "씨티카드"`. The formatter falls through to the raw ID `"citi"` because it's not in the hardcoded map.
- **Fix:** Replace the hardcoded map with a dynamic lookup from the loaded `cards.json` data. This requires making the issuer name map available to the formatter, which may require a context/store.

---

## Final Sweep — Cross-File Interactions

1. **Category label consistency across all code paths:** Verified that all three `categoryLabels` building locations (store.svelte.ts, analyzer.ts optimizeFromTransactions, analyzer.ts analyzeMultipleFiles) now include dot-notation keys. The fix from C19-02 is correctly applied in all locations.

2. **Reoptimize previousMonthSpending:** Verified that the fix from C19-01 correctly computes previousMonthSpending from monthlyBreakdown. The months array is sorted, so `months[latestIdx - 1]` correctly gives the previous month. Edge case: if the same month appears twice in monthlyBreakdown (shouldn't happen), `indexOf` returns the first occurrence which would be correct anyway.

3. **TransactionReview category change:** The `changeCategory` function correctly uses fully-qualified IDs (`${node.id}.${sub.id}`) for subcategories and resolves the parent category via `subcategoryToParent` map. The `tx.subcategory` is set to the short ID (e.g., "cafe") while `tx.category` is set to the parent (e.g., "dining"). This matches the optimizer's `buildCategoryKey` format.

4. **PDF fallback parser date extraction:** The `fallbackDatePattern` regex at line 315 uses `dateMatch[1]` to extract the date group, but the regex doesn't have a capturing group around the full pattern — it has `(\d{4}[.\-\/]...|\d{1,2}[.\-\/]\d{1,2}(?![.\-\/\d]))` which captures the entire match as group 1. This is correct. However, `dateMatch[1]` assumes the first capture group matches, which is guaranteed by the alternation.

5. **Session storage validation robustness:** The `isValidTx` function (store.svelte.ts:139-151) now checks `Number.isFinite(tx.amount)` and `tx.amount > 0`. This is a complete validation for the amount field. The `loadFromStorage` function (line 159-213) validates the optimization structure with shallow checks, which is acceptable per D-91.

6. **CardDetail category display:** This is the most significant new finding (C20-01). The reward table shows raw English category IDs without Korean translation. This is a user-facing issue that should be fixed.

---

## Summary of Active Findings (New in Cycle 20)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C20-01 | MEDIUM | High | `CardDetail.svelte:207-209` | Reward category names show raw English IDs instead of Korean labels |
| C20-02 | LOW | High | `matcher.ts:47-49` | Static keyword match returns wrong parent when value is non-dotted subcategory ID |
| C20-03 | LOW | Medium | `TransactionReview.svelte:114` | AI categorizer doesn't clear rawCategory after category change |
| C20-04 | LOW | High | `reward.ts:213-223` | Bucket creation `??` pattern is semantically awkward (style only, extends D-87) |
| C20-05 | LOW | High | `OptimalCardMap.svelte:18-19` | Math.max spread stack overflow risk (same as D-73/D-89) |
| C20-06 | LOW | High | `CardGrid.svelte:62-65` | Fee sort ignores international annual fee as secondary sort key |
| C20-07 | LOW | High | `formatters.ts:49-77` | formatIssuerNameKo hardcoded map duplicates cards.json issuer data |
