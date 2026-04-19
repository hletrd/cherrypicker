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

## Summary of New Findings

| ID | Severity | Confidence | Category | Description |
|----|----------|------------|----------|-------------|
| C4-01 | MEDIUM | High | debugger | SavingsComparison division by zero → NaN display |
| C4-02 | LOW | High | perf | loadCategories() called twice per optimization |
| C4-03 | LOW | High | perf | monthlyBreakdown O(n*m) filter |
| C4-04 | MEDIUM | High | designer/a11y | CategoryBreakdown tooltip keyboard/touch inaccessible |
| C4-05 | LOW | High | architect | constraints.categoryLabels mutation after build |
| C4-06 | LOW | High | designer | Annual savings projection misleading |
| C4-07 | LOW | High | designer | localStorage vs sessionStorage inconsistency |
| C4-08 | MEDIUM | Medium | debugger | editedTxs effect over-broad re-sync risk |
| C4-09 | LOW | High | code-quality | CategoryBreakdown hardcoded colors |
| C4-10 | MEDIUM | High | test | E2E test depends on stale dist/ |
| C4-11 | MEDIUM | High | test | No regression test for findCategory fuzzy fix |
| C4-12 | LOW | High | debugger | parseInt NaN (D-28 re-evaluation) |
| C4-13 | LOW | Medium | designer | Small-percentage bars nearly invisible |
| C4-14 | LOW | High | code-quality | Stale fallback values in Layout footer |
| C4-15 | LOW | High | perf | toCoreCardRuleSets not cached |

---

## Prioritized Action Items

### HIGH (should fix this cycle)
1. C4-01: Fix SavingsComparison division by zero (NaN display)
2. C4-04: Fix CategoryBreakdown a11y (keyboard/touch access to tooltip)
3. C4-11: Add regression test for findCategory fuzzy match
4. C4-10: Add pre-build step or warning in E2E tests for stale dist/
5. C4-08: Add generation counter to prevent over-broad editedTxs re-sync

### MEDIUM (plan for next cycles)
6. C4-12: Fix parseInt → Number with isFinite guard (trivial fix for D-28)
7. C4-05: Pass categoryLabels into buildConstraints instead of mutating
8. C4-02: Eliminate redundant loadCategories() call
9. C4-03: Compute monthlyBreakdown in single pass
10. C4-15: Cache toCoreCardRuleSets result

### LOW (defer or accept)
- C4-06, C4-07, C4-09, C4-13, C4-14
