# Comprehensive Code Review — Cycle 4 (2026-04-19)

**Reviewer:** multi-angle (code quality, perf, security, debugger, architect, designer, test, verifier)
**Scope:** Full repository — all packages, apps, tools, e2e, tests
**Focus:** New findings beyond cycles 1-3; verification of cycle 3 fixes

---

## Verification of Cycle 3 Fixes

All 5 high-priority and 8 medium-priority cycle 3 fixes verified as correctly implemented:

| Fix | Status | Notes |
|-----|--------|-------|
| C3-T01: `calculateRewards` unit tests | Verified | 361 lines, 15+ test cases covering all edge cases |
| C3-T02: `greedyOptimize` unit tests | Verified | 93 lines, 10+ test cases |
| C3-04: `formatPeriod` timezone bug | Verified | Manual date parsing, no `new Date()` usage |
| C3-D03: single-file previousMonthSpending | Verified | Passes `undefined` when no explicit value, optimizer computes per-card |
| C3-S02: file size limits | Verified | 10MB per file, 50MB total |
| C3-07: `editedTxs` sync | Verified | But see C4-08 below — over-broad re-sync |
| C3-01: `findCategory` fuzzy match | Verified | Best-match selection with shortest keyword |
| C3-02: null rate/fixedAmount warning | Verified | `console.warn` for non-wildcard rules |
| C3-03: category labels from taxonomy | Verified | But see C4-05 below — mutation pattern |
| C3-D01: monthlyBreakdown validation | Verified | Type guards on each field |
| C3-S01: env var name removal | Verified | Generic "API 키" message |
| C3-T05: toCoreCardRuleSets tests | Verified | 10 test cases covering all adapter paths |
| C3-U02: bank selector UX | Verified | Collapsible with TOP_BANKS + "더보기" |

---

## New Findings

### C4-01: `SavingsComparison.svelte` division by zero when `bestSingleCard.totalReward` is 0

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:70-73`
- **Description:** The `savingsPct` derived value computes `opt.savingsVsSingleCard / opt.bestSingleCard.totalReward * 100`. When `bestSingleCard.totalReward` is 0, this produces `Infinity`. The guard `if (!opt.bestSingleCard.totalReward)` on line 71 returns 0 for the falsy case, but if `totalReward` is exactly 0 (which happens when no card has matching rules), the guard correctly catches it. However, if the user has transactions that don't match any reward rule, `totalReward` could be 0 while `savingsVsSingleCard` is also 0 — the result `0/0 = NaN` would bypass the guard (NaN is not 0, so the guard doesn't catch it, and NaN * 100 = NaN).
- **Failure scenario:** All uploaded transactions are in categories with no matching rules. `totalReward = 0`, `bestSingleCard.totalReward = 0`. `savingsPct = Math.round(0 / 0 * 100)` = NaN. The template shows `+NaN%`.
- **Fix:** Add explicit NaN/Infinity guard: `const raw = opt.savingsVsSingleCard / opt.bestSingleCard.totalReward; return Number.isFinite(raw) ? Math.round(raw * 100) : 0;`

### C4-02: `loadCategories()` called twice per optimization — redundant network request

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/analyzer.ts:88,167`
- **Description:** `parseAndCategorize` calls `loadCategories()` at line 88, and `optimizeFromTransactions` calls it again at line 167. While `loadCategories` caches its promise (`categoriesPromise`), the second call still awaits the same promise and rebuilds the `categoryLabels` map. In a single optimization flow (upload → parse → optimize), this means the categories are loaded once but the map construction happens twice.
- **Failure scenario:** No functional failure — just wasted work. The `categoryLabels` map is rebuilt from the same cached data on every `optimizeFromTransactions` call.
- **Fix:** Either pass the `categoryLabels` map from `parseAndCategorize` through to `optimizeFromTransactions`, or build it once in `analyzeMultipleFiles` and pass it down.

### C4-03: `monthlyBreakdown` computed with O(n*m) filter — one filter per month

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/analyzer.ts:267-271`
- **Description:** The `monthlyBreakdown` array is computed with a `.map()` that calls `allTransactions.filter(tx => tx.date.startsWith(month)).length` for each month. This is O(n*m) where n = transaction count and m = month count. A single-pass approach using a counter map would be O(n).
- **Failure scenario:** With 1000 transactions across 12 months, this performs 12 * 1000 = 12,000 comparisons instead of 1,000. Not a real performance problem at this scale, but wasteful.
- **Fix:** Use the already-computed `monthlySpending` map and add a parallel transaction count map:
  ```ts
  const monthlyTxCount = new Map<string, number>();
  for (const tx of allTransactions) {
    const month = tx.date.slice(0, 7);
    monthlyTxCount.set(month, (monthlyTxCount.get(month) ?? 0) + 1);
  }
  // Then use monthlyTxCount.get(month) instead of .filter().length
  ```

### C4-04: `CategoryBreakdown.svelte` tooltip inaccessible via keyboard/touch

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:147-148`
- **Description:** The hover tooltip is triggered by `onmouseenter`/`onmouseleave` events and a click handler (`onclick`). The click handler provides basic touch/keyboard access, but:
  1. The rows lack `tabindex="0"` and `role="button"` for keyboard focusability
  2. The click handler toggles `hoveredIndex`, but there's no visual focus indicator for keyboard users
  3. The `role="row"` on line 144 is incorrect for a standalone interactive element — it should be `role="button"` with `tabindex="0"` and `onkeydown` for Enter/Space
- **Failure scenario:** A keyboard-only user tabs through the page and cannot expand any category tooltip. A screen reader user hears "row" role but cannot interact with it.
- **Fix:** Add `tabindex="0"`, change `role="row"` to `role="button"`, add `onkeydown` handler for Enter/Space, and add a visible focus ring.

### C4-05: `constraints.categoryLabels` set by mutating after `buildConstraints` returns

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/analyzer.ts:164-177`
- **Description:** `buildConstraints` returns an `OptimizationConstraints` object, then line 177 mutates it: `constraints.categoryLabels = categoryLabels;`. This is a side-effect that violates the principle that `buildConstraints` should produce a fully-initialized object. If `buildConstraints` is ever made frozen/immutable (or if `categoryLabels` becomes required in the type), this would break silently.
- **Failure scenario:** A future refactor adds `Object.freeze()` to the constraints object for defensive copying. The mutation at line 177 silently fails (in strict mode throws), and the optimizer falls back to the hardcoded `CATEGORY_NAMES_KO`.
- **Fix:** Pass `categoryLabels` into `buildConstraints` as an optional parameter, or create a separate `buildOptimizationConstraints` function that includes labels.

### C4-06: `SavingsComparison.svelte` annual savings projection is misleading

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:172-173`
- **Description:** Line 173 shows "연간 약 {formatWon(opt.savingsVsSingleCard * 12)} 절약" — multiplying monthly savings by 12. This assumes identical spending every month, which is rarely accurate. Users may make spending decisions based on this projection.
- **Failure scenario:** A user with a holiday-heavy December statement sees "연간 약 360,000원 절약" but their actual annual savings is closer to 120,000원 because December spending was 3x their average month.
- **Fix:** Change the label to "월 절약액 기준 연간 추정" to clarify it's an estimate, or remove the annual projection entirely and just show monthly savings.

### C4-07: `SpendingSummary.svelte` uses `localStorage` while rest of app uses `sessionStorage`

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:10-12,107`
- **Description:** The "dismissed warning" state is persisted in `localStorage` (line 11: `localStorage.getItem('cherrypicker:dismissed-warning')` and line 107: `localStorage.setItem('cherrypicker:dismissed-warning', '1')`), while the analysis result is stored in `sessionStorage`. The warning dismissal survives browser restarts, but the analysis data does not. This means a returning user sees no warning about data loss (because it was dismissed in a previous session) but also has no data — they might not realize their data is gone.
- **Failure scenario:** User dismisses the "탭을 닫으면 결과가 사라져요" warning on Monday. On Tuesday, they return, upload new data, and close the tab without reading the (now-absent) warning. They lose their analysis results without realizing it.
- **Fix:** Move the dismissed state to `sessionStorage` so the warning reappears on each new session. Or add the dismissal to the `analysisStore` so it's tied to the analysis lifecycle.

### C4-08: `editedTxs` sync `$effect` re-runs on any store reactivity, not just new data

- **Severity:** MEDIUM
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:124-129`
- **Description:** The cycle 3 fix for C3-07 changed the `$effect` to always re-sync when `analysisStore.transactions` changes. However, the effect depends on `analysisStore.transactions` which is derived from `result?.transactions ?? []`. In Svelte 5, any change to the `result` object (including re-optimization triggered by the user's own edits) will cause `transactions` to be recomputed, which will trigger this effect, which will overwrite the user's manual category edits. This creates a circular problem: user edits category → clicks "변경 적용" → `reoptimize` updates `result` → `transactions` recomputes → `$effect` fires → `editedTxs` is overwritten with the new (re-optimized) data → but the user's edits ARE in the re-optimized data, so this particular flow is actually OK. However, if `persistToStorage` triggers a reactive update (because `result` is reassigned with the same data plus persisted flag), the effect would unnecessarily re-sync.
- **Failure scenario:** A Svelte 5 reactive update that changes the reference of `transactions` without changing the content causes the effect to fire and overwrite `editedTxs`, resetting `hasEdits` to false and losing any in-progress edits the user hasn't applied yet.
- **Fix:** Add a generation counter to the store's `setResult` method. Only re-sync `editedTxs` when the generation changes, not on every reactive update. Alternatively, compare the transaction array reference before overwriting.

### C4-09: `CategoryBreakdown.svelte` hardcoded `CATEGORY_COLORS` not sourced from taxonomy

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:7-49`
- **Description:** Similar to the C3-03 finding about `CATEGORY_NAMES_KO` in `greedy.ts`, the `CATEGORY_COLORS` map in `CategoryBreakdown.svelte` is hardcoded with ~45 entries. Any new category added to `categories.yaml` will fall through to the `uncategorized` color, producing an undifferentiated visualization.
- **Failure scenario:** A new category `coffee` is added to the YAML. The category breakdown chart shows `coffee` with the same gray color as `uncategorized`, making it indistinguishable from uncategorized items.
- **Fix:** Generate colors dynamically from a palette based on category index, or use a hash-based color function, so new categories automatically get a distinct color.

### C4-10: E2E regression test depends on pre-built `dist/` output

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `e2e/core-regressions.spec.js:16-24`
- **Description:** The E2E test imports from `packages/core/dist/categorizer/matcher.js` and similar paths. These files only exist after `bun run build` in `packages/core/`. If a developer runs E2E tests without rebuilding, they test against stale code. The `beforeAll` hook will fail with a module not found error, but the error message won't clearly indicate that a build is needed.
- **Failure scenario:** Developer changes `matcher.ts`, runs E2E tests without rebuilding, and the tests pass against the old code. The developer thinks the change is safe but it may have broken the actual runtime behavior.
- **Fix:** Add a pre-test build step to `playwright.config.ts` via `webServer` or a custom setup script, or use the source files directly with a transpiler.

### C4-11: No regression test for `findCategory` fuzzy match fix (C3-01)

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/core/__tests__/` (missing test)
- **Description:** The C3-01 fix changed `findCategory` step 3 (reverse fuzzy match) to select the shortest matching keyword instead of returning the first match. This was a behavior change that should have a regression test, but no test was added for `CategoryTaxonomy.findCategory` directly.
- **Failure scenario:** A future refactor of `CategoryTaxonomy` reverts to first-match behavior, and no test catches the regression.
- **Fix:** Add a test to `packages/core/__tests__/` that constructs a `CategoryTaxonomy` with two keywords that both contain a short merchant name, and verifies the shortest keyword is selected.

### C4-12: `parseInt` in `FileDropzone.svelte` still produces NaN for edge inputs (D-28 was deferred but fix is trivial)

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:200`
- **Description:** This was deferred as D-28 with the rationale that `<input type="number">` prevents non-numeric input. However, in some browsers (notably Safari on iOS), `<input type="number">` allows the user to enter "e", ".", and "+", which can result in `parseInt("e", 10)` returning NaN. Additionally, `parseInt("1e5", 10)` returns 1 instead of 100000. The fix is a one-liner: `Number.isFinite(val) ? val : undefined`.
- **Failure scenario:** User on iOS Safari types "1e5" in the spending field. `parseInt("1e5", 10)` returns 1, which is treated as 1 Won previous month spending, selecting the wrong performance tier for all cards.
- **Fix:** Replace `previousSpending ? parseInt(previousSpending, 10) : undefined` with `const val = Number(previousSpending); Number.isFinite(val) && val >= 0 ? val : undefined`. Using `Number()` instead of `parseInt()` also handles scientific notation and decimal inputs correctly.

### C4-13: `CategoryBreakdown.svelte` `maxPercentage` fallback of 100 creates invisible bars for small categories

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:114`
- **Description:** When `categories.length === 0`, `maxPercentage` defaults to 100. This fallback is used in the bar width calculation: `style="width: {(cat.percentage / maxPercentage) * 100}%"`. For categories with very small percentages (e.g., 0.5%), the bar renders at 0.5% width which is invisible. While the current "other" grouping (< 2%) mitigates this, any category at exactly 2-3% still renders a nearly invisible bar.
- **Failure scenario:** A category with 2% spending shows a bar that's 2% wide — barely visible. The visual chart doesn't convey the relative proportions effectively.
- **Fix:** Set a minimum bar width (e.g., `max(width, 4)` pixels) or use a logarithmic scale for small values.

### C4-14: `Layout.astro` reads `cards.json` at build time with a silent try/catch — stale fallback values

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/layouts/Layout.astro:15-24`
- **Description:** The layout reads `cards.json` to display `totalCards`, `totalIssuers`, and `totalCategories` in the footer. The try/catch silently falls back to hardcoded values (683, 24, 45). If the build runs before `cards.json` is generated, or if the file is deleted, the footer shows stale numbers with no indication they're wrong.
- **Failure scenario:** After adding 50 new card rules, the footer still shows "683+ 카드" because the build was run before `cards.json` was regenerated.
- **Fix:** Remove the fallback values and show nothing (or "—") if the file can't be read. Alternatively, make the build fail if `cards.json` is missing.

### C4-15: `toCoreCardRuleSets` creates new array copies on every optimization call — no caching

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/analyzer.ts:181`
- **Description:** Every call to `optimizeFromTransactions` creates a new mapped copy of all card rules via `toCoreCardRuleSets(cardRules)`. Since the rules are loaded from static JSON and don't change during a session, this mapping could be cached. For a typical setup with 200+ card rules, this creates 200+ new objects on every optimization (including re-optimization after category edits).
- **Failure scenario:** User edits categories and clicks "apply" multiple times. Each re-optimization re-maps all card rules, creating unnecessary garbage collection pressure.
- **Fix:** Cache the result of `toCoreCardRuleSets` and invalidate it only when `cardRules` changes (which only happens on page load).

---

## Verification Status of Prior C4 Findings

All HIGH-priority findings from the original cycle 4 review have been fixed in prior cycles:

| Finding | Status | Evidence |
|---|---|---|
| C4-01 | **FIXED** | `SavingsComparison.svelte:90` has `Number.isFinite(raw)` guard |
| C4-02 | **FIXED** | `analyzeMultipleFiles` passes prebuilt `categoryLabels` to `optimizeFromTransactions` |
| C4-03 | **FIXED** | Single-pass `monthlyTxCount` map used in `analyzer.ts:298-302` |
| C4-04 | **FIXED** | `CategoryBreakdown.svelte:154-155` has `role="button"` and `tabindex="0"`, line 161 has `onkeydown` handler |
| C4-05 | **FIXED** | `analyzer.ts:225` passes `categoryLabels` directly to `buildConstraints` as parameter |
| C4-06 | **STILL OPEN** | Annual savings projection label unchanged (LOW priority) |
| C4-07 | **STILL OPEN** | `localStorage` vs `sessionStorage` inconsistency in SpendingSummary (LOW priority) |
| C4-08 | **FIXED** | `TransactionReview.svelte:142-150` uses `lastSyncedGeneration` counter to guard re-sync |
| C4-09 | **STILL OPEN** | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown (LOW priority) |
| C4-10 | **STILL OPEN** | E2E test stale dist/ dependency (MEDIUM priority) |
| C4-11 | **STILL OPEN** | No regression test for findCategory fuzzy match (MEDIUM priority) |
| C4-12 | **FIXED** | `FileDropzone.svelte:206` uses `Math.round(Number(v))` with `Number.isFinite` guard |
| C4-13 | **STILL OPEN** | Small-percentage bars nearly invisible (LOW priority) |
| C4-14 | **STILL OPEN** | Stale fallback values in Layout footer (LOW priority) |
| C4-15 | **FIXED** | `analyzer.ts:47,167-168` caches `cachedCoreRules` |

---

## New Findings (This Re-review)

### C4R-M01: `printSpendingSummary` is never called from CLI report command

- **Severity:** MEDIUM (missing functionality)
- **Confidence:** High
- **File+line:** `tools/cli/src/commands/report.ts:143`
- **Description:** The CLI `runReport` function calls `printOptimizationResult(result)` at line 143 and `generateHTMLReport(result, categorized, categoryLabels)` at line 147. However, `printSpendingSummary` from `@cherrypicker/viz` (which shows the spending-by-category breakdown table) is never called. The function was updated in cycle 50 to accept `categoryLabels`, but the CLI never invokes it.

  The HTML report includes the category table via `buildCategoryTable`, but terminal output has no spending summary. Users who only look at terminal output miss the spending breakdown.

- **Concrete failure scenario:** Run `cherrypicker report statement.csv`. Terminal shows card assignments and optimization results but no spending-by-category table. The HTML report has the category table.
- **Fix:** Import `printSpendingSummary` from `@cherrypicker/viz` and add `printSpendingSummary(categorized, categoryLabels);` before `printOptimizationResult(result);` in `report.ts`.

### C4R-M02: Server-side CSV adapters' `parseAmount` returns NaN instead of 0

- **Severity:** LOW (consistency)
- **Confidence:** High
- **File+line:** `packages/parser/src/csv/shinhan.ts:29`, and similarly in other adapter files in that directory
- **Description:** The server-side CSV adapter files (shinhan, etc.) have `parseAmount` functions that return `NaN` when parsing fails. The PDF parsers (both web and server-side) return `0` instead of `NaN` to prevent NaN propagation. While each adapter's `parseCSV` loop catches NaN with `isNaN()` checks before adding transactions, this is inconsistent with the defensive `return 0` pattern used elsewhere.
- **Concrete failure scenario:** If `parseAmount` were ever called outside the adapter's validation loop (e.g., by a future refactoring), NaN would propagate. Currently, NaN is caught.
- **Fix:** Change `if (isNaN(n)) return NaN;` to `if (isNaN(n)) return 0;` in all server-side CSV adapter `parseAmount` functions for consistency.

### C4R-L01: Content-signature adapter failures logged only to console.warn, not collected into ParseResult.errors

- **Severity:** LOW (observability gap, extends D-107)
- **Confidence:** High
- **File+line:** `packages/parser/src/csv/index.ts:60-62`
- **Description:** When a content-signature adapter fails (line 60-62), the error is only logged via `console.warn` and not collected into the ParseResult's errors array. In contrast, the bank-specific adapter failure at line 44-49 does prepend an error message to the fallback result. This extends D-107.
- **Concrete failure scenario:** A Samsung card CSV has a format change. The Samsung adapter's `detect()` returns true but `parseCSV()` throws. The error only appears in console.warn; the user sees the generic parser result with no warning.
- **Fix:** When a content-signature adapter fails, collect the failure into the result's errors array.

---

## Summary of Active Findings (This Re-review)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C4R-M01 | MEDIUM | High | `tools/cli/src/commands/report.ts:143` | `printSpendingSummary` never called from CLI -- terminal missing spending-by-category table | NEW, needs fix |
| C4R-M02 | LOW | High | `packages/parser/src/csv/shinhan.ts:29` | Server-side CSV adapters' `parseAmount` returns NaN instead of 0 (inconsistent with PDF parsers) | NEW, consistency |
| C4R-L01 | LOW | High | `packages/parser/src/csv/index.ts:60-62` | Content-signature adapter failures only in console.warn, not ParseResult.errors | NEW, extends D-107 |
