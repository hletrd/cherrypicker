# Cycle 11 — Comprehensive Multi-Angle Code Review

**Date:** 2026-04-19
**Reviewer:** All specialist angles (code quality, performance, security, architecture, debugger, test, UI/UX, documentation)
**Scope:** Full repository — all packages/core, apps/web, packages/rules, tools

---

## Code Quality Review

### C11-01: `scoreCardsForTransaction` computes `calculateCardOutput` twice per card per transaction — redundant recalculation
- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/optimizer/greedy.ts:96-97`
- **Description:** `scoreCardsForTransaction` calls `calculateCardOutput` once for `before` and once for `after`, each of which iterates all previously-assigned transactions. Since only one transaction is added, the `before` result could be cached and reused across subsequent scoring calls. However, this is the same class as D-09/D-51 and is acceptable at current scale.
- **Concrete failure scenario:** With 500 transactions and 10 cards, this produces ~10,000 full recalculation calls, each O(n). Still fast enough for typical use but wasteful.
- **Fix:** Cache the `before` result per card and invalidate when a new transaction is assigned.

### C11-02: `calculateRewards` bucket object is created without `Object.freeze` or explicit prototype — prototype pollution unlikely but pattern is fragile
- **Severity:** LOW
- **Confidence:** Low
- **File:** `packages/core/src/calculator/reward.ts:193-203`
- **Description:** The `bucket` object is created inline with `?? { ... }` which falls through to `categoryRewards.get(categoryKey)`. If `categoryRewards.get` returns an object that was mutated elsewhere (unlikely given current code flow), it could lead to cross-category data contamination. The `Map.get/set` pattern is correct but the fallback object is never explicitly validated.
- **Concrete failure scenario:** Extremely unlikely — would require two transactions with the same categoryKey to be processed with a get returning undefined on the second call despite the first having set it.
- **Fix:** Add a null check after `categoryRewards.get` to explicitly handle the cache-miss case.

### C11-03: CSV bank adapters share ~95% identical code — significant duplication risk
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/csv.ts:247-901`
- **Description:** All 10 bank adapters (samsung, shinhan, kb, hyundai, lotte, hana, woori, nh, ibk, bc) follow the exact same pattern: detect header, find column indices, iterate rows, parse date/amount/merchant, handle installments. The only differences are header names and which columns exist. This is a known issue (extends D-01) but the duplication makes maintenance harder — a bug fix in one adapter must be manually replicated.
- **Concrete failure scenario:** A new date format bug fix applied to one adapter but not others, causing inconsistent parsing across banks.
- **Fix:** Create a generic `parseBankCSV(config)` function that accepts column mappings.

---

## Performance Review

### C11-04: `Math.max(...assignments.map(...))` in OptimalCardMap has stack overflow risk for large arrays
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:19`
- **Description:** Same class as D-73. `Math.max(...array)` can cause a stack overflow for arrays > ~100K entries. Typical usage has < 50 assignments, so this is not a realistic concern. Confirmed still present.
- **Concrete failure scenario:** With > 100K categories (impossible in practice), the spread operator would exceed call stack size.
- **Fix:** Replace with `assignments.reduce((a, b) => Math.max(a, b.rate), 0.001)` if scale increases.

### C11-05: PDF table parser `detectColumnBoundaries` iterates all lines twice with per-character counting
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/pdf.ts:23-58`
- **Description:** `detectColumnBoundaries` creates a `charCount` array of length `maxLen`, then iterates every character of every line to count occupancy. For very large PDFs (> 100 pages), this could be slow. However, PDF parsing is inherently O(n) and the character counting is linear, so this is acceptable.
- **Concrete failure scenario:** A 500-page PDF with dense tables could take several seconds for column detection alone.
- **Fix:** Limit `detectColumnBoundaries` to the first N lines (e.g., 50) instead of all table lines.

---

## Security Review

### C11-06: `loadFromStorage` validates optimization structure but not nested `cardResults` array deeply
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/store.svelte.ts:163-203`
- **Description:** `loadFromStorage` checks that `parsed.optimization.assignments` is an array and that `totalReward`/`totalSpending`/`effectiveRate` are numbers. However, it does not validate the contents of `optimization.cardResults` or `optimization.assignments[].alternatives`. If sessionStorage is tampered with (via dev tools), malformed data could flow into the UI components without validation. This is a defense-in-depth concern, not a real attack vector since sessionStorage is same-origin.
- **Concrete failure scenario:** A developer testing with modified sessionStorage could inject malformed card results that cause UI rendering errors.
- **Fix:** Add basic validation for `cardResults` entries (cardId and totalReward are present and correct types).

### C11-07: No Content-Security-Policy headers for the web app
- **Severity:** MEDIUM
- **Confidence:** Medium
- **File:** `apps/web/astro.config.ts`, deployment configuration
- **Description:** The web app loads data from its own origin and uses inline scripts (dashboard.js). Without CSP headers, XSS could execute arbitrary scripts. The app doesn't have user-generated content that other users see, so the XSS risk is limited to self-XSS, but CSP is a best practice.
- **Concrete failure scenario:** If a third-party dependency has an XSS vulnerability, CSP would prevent script execution. Without CSP, the vulnerability is exploitable.
- **Fix:** Add CSP headers in Astro config or deployment proxy (e.g., `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'`).

---

## Architecture Review

### C11-08: `greedyOptimize` creates a new `cardPreviousSpending` Map from `constraints.cards` on every call — unnecessary object allocation
- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/optimizer/greedy.ts:211-213`
- **Description:** `cardPreviousSpending` is reconstructed from `constraints.cards.map()` on every call. If `optimizeFromTransactions` is called in a loop (e.g., reoptimize), this creates a new Map each time. The `constraints.cards` array already has the data in the right shape — the Map is redundant.
- **Concrete failure scenario:** No functional impact. Minor GC pressure from repeated Map creation.
- **Fix:** Accept `Map<string, number>` directly in `OptimizationConstraints` instead of the `cards` array.

### C11-09: `buildConstraints` shallow-copies transactions but `greedyOptimize` also filters and sorts them — redundant array creation
- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/optimizer/constraints.ts:17`, `packages/core/src/optimizer/greedy.ts:219-221`
- **Description:** `buildConstraints` creates `preservedTransactions = [...transactions]` (a shallow copy). Then `greedyOptimize` creates `sortedTransactions = [...constraints.transactions].filter().sort()` — another copy with filtering and sorting. The first copy in `buildConstraints` is unnecessary since `greedyOptimize` always creates its own filtered/sorted copy.
- **Concrete failure scenario:** For 10,000 transactions, two unnecessary array copies are created (one in buildConstraints, one sorted copy in greedyOptimize).
- **Fix:** Remove the spread copy in `buildConstraints` and add a comment that the optimizer creates its own working copy.

---

## Debugger Review

### C11-10: `calculateRewards` can produce `rewardType` that is never updated for categories with no matching rule
- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/calculator/reward.ts:200-203`
- **Description:** When a bucket is created (cache miss), `rewardType` defaults to `rule?.type ?? 'discount'`. Since `rule` is looked up AFTER the bucket is created (line 191), the initial `rewardType` is always `'discount'` for the first transaction of a category (because `rule` is not yet resolved at bucket creation time). If the rule is later found and is of type `points`, the `rewardType` is updated at line 276. However, if the bucket has no matching rule (`!rule`), the `rewardType` stays as `'discount'` even though it should arguably be `'none'` or `'uncategorized'`.
- **Concrete failure scenario:** A category with spending but no matching rule shows `rewardType: 'discount'` in the output, which is misleading. The UI uses `rewardType` for display, so users might think they're getting a discount when they're not.
- **Fix:** Set `rewardType` to `'none'` or `undefined` when no rule matches, and handle that in the UI.

### C11-11: `detectBank` confidence score can be 0 for all banks but still returns `bank: null` with `confidence: 0`
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/detect.ts:127-150`
- **Description:** When no bank signature matches, `detectBank` returns `{ bank: null, confidence: 0 }`. The calling code in `csv.ts:924` assigns `resolvedBank = detected` which becomes `null`. This is correct behavior but the `confidence: 0` is potentially misleading — it suggests a detection was attempted with 0 confidence, when in reality no detection was possible. The `confidence` value is never surfaced to the user.
- **Concrete failure scenario:** No functional impact. If `confidence` were ever displayed to the user, a 0 score would be confusing.
- **Fix:** No action needed — `confidence` is internal-only.

### C11-12: `reoptimize` filters to latest month but `monthlyBreakdown` in result still reflects all months — potential confusion
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/store.svelte.ts:334-363`
- **Description:** When `reoptimize` is called, it filters transactions to the latest month before optimization. However, the `result.monthlyBreakdown` field (from the original `analyzeMultipleFiles` call) still shows all months. After reoptimize, `result = { ...result, transactions: editedTransactions, optimization }` — the `monthlyBreakdown` is carried over from the previous result and is not recalculated. If the user edited transactions in a non-latest month, the `monthlyBreakdown` for that month would be stale.
- **Concrete failure scenario:** User edits a transaction amount in a non-latest month, applies changes via reoptimize. The monthly breakdown for that month still shows the old spending total.
- **Fix:** Recalculate `monthlyBreakdown` from `editedTransactions` after reoptimize.

---

## Test Engineer Review

### C11-13: No unit tests for `MerchantMatcher` with the new minimum merchant name length guard
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/core/__tests__/categorizer.test.ts`
- **Description:** The cycle 10 fix added a `lower.length < 2` guard in `MerchantMatcher.match()` and a `lower.length >= 3` check for reverse substring matching. These are important behavioral changes that should have dedicated test cases:
  1. Empty string merchant name → uncategorized with confidence 0
  2. Single character merchant name → uncategorized with confidence 0
  3. Two-character merchant name → should work (forward matching)
  4. Two-character merchant name → should NOT reverse-match longer keywords
  5. Three-character merchant name → should reverse-match longer keywords
- **Concrete failure scenario:** A regression in the length guard could re-introduce false positive matching for short merchant names.
- **Fix:** Add test cases for edge cases around the 2-char and 3-char boundaries.

### C11-14: No integration test for `reoptimize` filtering to latest month
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/__tests__/`
- **Description:** The cycle 10 fix added `getLatestMonth` and filtering logic in `reoptimize`. This is a critical behavioral change — if the filtering breaks, cap distortion would silently occur. There is no integration test that:
  1. Uploads multi-month transactions
  2. Verifies initial optimization covers only the latest month
  3. Calls reoptimize with edited transactions
  4. Verifies the reoptimized result also covers only the latest month
- **Concrete failure scenario:** A bug in `getLatestMonth` could cause `reoptimize` to include all months, leading to incorrect cap calculations.
- **Fix:** Add an integration test for multi-month reoptimize behavior.

---

## UI/UX Designer Review

### C11-15: CategoryBreakdown "other" group color is hardcoded slate instead of derived from subcategory colors
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:51`
- **Description:** The `OTHER_COLOR` constant is `#cbd5e1` (slate). When subcategories are grouped into "other", the expanded subcategory list shows individual amounts but they all share the same gray visual treatment. This makes it hard to visually distinguish the subcategories within the "other" group.
- **Concrete failure scenario:** A user sees 5 subcategories in "other" but cannot tell which is which from the color.
- **Fix:** Use a small palette of muted colors for the subcategory items within the "other" expansion.

### C11-16: SpendingSummary shows "전월실적 {amount} 기준" using `monthlyBreakdown[n-2]` which can be undefined for single-month data
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:104`
- **Description:** The code `analysisStore.result.monthlyBreakdown[analysisStore.result.monthlyBreakdown.length - 2]?.spending ?? 0` uses optional chaining, so it won't crash. But when there's only 1 month of data and `monthlyBreakdown.length` is 1, `monthlyBreakdown[-1]` is `undefined`, and the displayed value is `0원`. This means the UI shows "전월실적 0원 기준" which is misleading — it should either hide this line or show "자동 계산" instead.
- **Concrete failure scenario:** User uploads a single month statement and sees "전월실적 0원 기준" — confusing because the actual previous month spending was calculated from the transactions.
- **Fix:** When `monthlyBreakdown.length < 2`, either hide the previous-month-spending line or show the calculated value from the optimization.

### C11-17: TransactionReview `changeCategory` doesn't update `subcategory` options when category changes
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:153-161`
- **Description:** When a user changes a transaction's category via the `<select>`, the code sets `tx.category = newCategory` and `tx.subcategory = undefined`. However, the category select only shows top-level categories and subcategories mixed together in a flat list. If a user selects a subcategory (e.g., "카페" under "외식"), the `tx.category` is set to the subcategory ID, but there's no way to select a parent category and then choose a subcategory. The flat list approach is confusing.
- **Concrete failure scenario:** User wants to change a transaction from "미분류" to "카페" (a subcategory of "외식"). The flat list shows "카페" as an indented option, but selecting it sets `category: 'cafe'` instead of `category: 'dining', subcategory: 'cafe'`. This is incorrect — `cafe` should be a subcategory, not a standalone category.
- **Fix:** When a subcategory is selected, set both `tx.category` (parent) and `tx.subcategory` (child) correctly, or restructure the select to use optgroup elements.

---

## Documentation Review

### C11-18: `normalizeRate` divides by 100 but the comment says "All YAML rates are stored in percentage form" — this assumption should be validated
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `packages/core/src/calculator/reward.ts:113-117`
- **Description:** The comment states "All YAML rates are stored in percentage form (e.g., 1.5 means 1.5%)". The code divides by 100 to normalize. If any YAML file stores rates as decimal (e.g., 0.015 for 1.5%), the division would produce 0.015% instead of 1.5%. This is a data contract assumption that should be validated at schema level, not just documented in code.
- **Concrete failure scenario:** A new YAML file is created with decimal rates instead of percentage form. The optimizer would produce rewards that are 100x too small.
- **Fix:** Add a Zod schema validation that rejects rates < 0.01 (which would indicate decimal-form input) in the rules package.

---

## Final Sweep — Commonly Missed Issues

### C11-19: `parseAmount` in CSV parser uses `parseInt` which truncates decimals — consistent with project convention but inconsistent with `parseFloat` used in XLSX
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/csv.ts:82-91` vs `apps/web/src/lib/parser/xlsx.ts:241-255`
- **Description:** CSV `parseAmount` uses `parseInt` (truncates to integer). XLSX `parseAmount` uses `parseInt` for string input but returns raw number for numeric input (which can be a float). For Korean Won, amounts are always integers, so this is correct. But the inconsistency could cause issues if foreign-currency-converted amounts with decimal remainders appear in XLSX files.
- **Concrete failure scenario:** An XLSX file with amount 1500.7 would be stored as 1500.7 by the XLSX parser (numeric path) but 1500 by the CSV parser. Same class as D-67.
- **Fix:** Add `Math.round()` in the XLSX numeric path for consistency.

### C11-20: `isValidTx` validation doesn't check `amount` for negative values
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/store.svelte.ts:139-149`
- **Description:** `isValidTx` checks that `amount` is of type `number` and that `id`, `date`, `category` are non-empty strings. It doesn't check that `amount` is positive or finite. A restored transaction with `amount: NaN` or `amount: -5000` would pass validation.
- **Concrete failure scenario:** After sessionStorage corruption, a transaction with `amount: NaN` is restored and displayed as "NaN원" in the UI.
- **Fix:** Add `typeof tx.amount === 'number' && Number.isFinite(tx.amount)` to the validation check.

---

## Summary of New Findings

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C11-01 | LOW | High | `greedy.ts:96-97` | Redundant recalculation in `scoreCardsForTransaction` (extends D-09/D-51) |
| C11-02 | LOW | Low | `reward.ts:193-203` | Bucket object pattern fragile (theoretical) |
| C11-03 | LOW | High | `csv.ts:247-901` | Bank adapter code duplication (extends D-01) |
| C11-04 | LOW | Medium | `OptimalCardMap.svelte:19` | Math.max spread overflow risk (extends D-73) |
| C11-05 | LOW | High | `pdf.ts:23-58` | Column detection iterates all lines |
| C11-06 | LOW | Medium | `store.svelte.ts:163-203` | Shallow validation of nested optimization data |
| C11-07 | MEDIUM | Medium | `astro.config.ts` | No Content-Security-Policy headers |
| C11-08 | LOW | High | `greedy.ts:211-213` | Redundant Map creation from constraints.cards |
| C11-09 | LOW | High | `constraints.ts:17`, `greedy.ts:219` | Redundant array copy in buildConstraints |
| C11-10 | LOW | High | `reward.ts:200-203` | Default `rewardType: 'discount'` is misleading for no-rule categories |
| C11-11 | LOW | High | `detect.ts:127-150` | Confidence 0 when no detection is confusing (internal only) |
| C11-12 | MEDIUM | High | `store.svelte.ts:334-363` | `monthlyBreakdown` stale after reoptimize with multi-month edits |
| C11-13 | MEDIUM | High | `categorizer.test.ts` | Missing tests for merchant name length guard |
| C11-14 | MEDIUM | High | `__tests__/` | Missing integration test for reoptimize latest-month filtering |
| C11-15 | LOW | High | `CategoryBreakdown.svelte:51` | "Other" group color is hardcoded gray |
| C11-16 | MEDIUM | High | `SpendingSummary.svelte:104` | "전월실적 0원" displayed for single-month data |
| C11-17 | MEDIUM | High | `TransactionReview.svelte:153-161` | Category select doesn't set subcategory correctly |
| C11-18 | LOW | Medium | `reward.ts:113-117` | normalizeRate assumption not validated at schema level |
| C11-19 | LOW | High | `csv.ts:82` vs `xlsx.ts:241` | parseInt vs raw number inconsistency |
| C11-20 | LOW | Medium | `store.svelte.ts:139-149` | isValidTx doesn't check amount for NaN/negative |

---

## Actionable High-Priority Findings

1. **C11-12** (MEDIUM): `monthlyBreakdown` becomes stale after reoptimize — should recalculate from edited transactions
2. **C11-17** (MEDIUM): Category select in TransactionReview doesn't correctly handle subcategory selection
3. **C11-16** (MEDIUM): Misleading "전월실적 0원" for single-month data
4. **C11-07** (MEDIUM): No CSP headers — defense-in-depth improvement
5. **C11-13** (MEDIUM): Missing unit tests for merchant name length guard
6. **C11-14** (MEDIUM): Missing integration test for reoptimize latest-month filtering
