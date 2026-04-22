# Cycle 8 Review (2026-04-22)

**Scope:** packages/core/src, apps/web/src, packages/viz/src, packages/parser/src
**Focus:** Bugs, edge cases, security issues (excluding refund-filtering — already thoroughly fixed)

---

## Files Reviewed

| Package | Files |
|---|---|
| core | calculator/{cashback,discount,points,reward,types}.ts, optimizer/{greedy,ilp,constraints}.ts, categorizer/{matcher,taxonomy,keywords,keywords-english,keywords-locations,keywords-niche,index}.ts, models/{transaction,result,card}.ts |
| web | lib/{analyzer,cards,formatters,store.svelte,api,category-labels}.ts, components/{dashboard/*,upload/*,ui/*,report/*}.svelte |
| viz | report/generator.ts, terminal/{comparison,summary}.ts |
| parser | csv/shared.ts, date-utils.ts, detect.ts |

---

## Verification of Prior Cycle Fixes

All prior fixes confirmed still in place:

| Finding | Status | Evidence |
|---|---|---|
| C1-01 monthlySpending positive-only | CONFIRMED | analyzer.ts:329, store.svelte.ts:531 |
| C1-12 findRule sort stability | CONFIRMED | reward.ts:90-93 indexOf tiebreak |
| C1-21 Truncation + reoptimize | CONFIRMED | store.svelte.ts recalc monthlyBreakdown |
| C7-01 generation init from storage | CONFIRMED | store.svelte.ts:361 `result !== null ? 1 : 0` |
| C92-01/C94-01 formatSavingsValue | CONFIRMED | formatters.ts:224-227 |
| C89-02 rawPct threshold rounding | CONFIRMED | CategoryBreakdown.svelte:128 |
| C89-01 classList.toggle isConnected guard | CONFIRMED | VisibilityToggle.svelte:31 |
| C2-01 buildCategoryTable skips tx.amount<=0 | CONFIRMED | generator.ts:73 |
| C3-01/C4-01 includedCount for summary row | CONFIRMED | generator.ts:121, summary.ts:69 |
| C5-01 performanceExclusions tx.amount > 0 | CONFIRMED | analyzer.ts:231 |

---

## New Findings

No new actionable findings this cycle.

### Observations (not actionable, documented for awareness)

1. **CLI/web savings-rate denominator inconsistency:** `comparison.ts:48` computes the savings rate as `savingsVsSingleCard / totalSpending` (percentage of spending), while `SavingsComparison.svelte:113` computes it as `savingsVsSingleCard / bestSingleCard.totalReward` (percentage of single-card reward). These produce different numbers for the same data. This is a presentation difference, not a correctness bug — both are valid interpretations — but could confuse users comparing CLI and web output. Not actionable this cycle because both are intentional design choices with different trade-offs.

2. **HTML report "+0원" edge case:** `generator.ts:41-42` shows a "+" prefix for non-negative savingsVsSingleCard, producing "+0원" when savings is exactly zero. The web app's `formatSavingsValue` hides the "+" for values under 100 won (C82-03). This is a cosmetic difference in the CLI report; not actionable since the HTML report is a secondary output and the display is technically correct.

---

## Areas Reviewed Without New Findings

1. **Reward calculation (reward.ts):** `calculateRewards` correctly skips `tx.amount <= 0` and non-KRW transactions. Global cap rollback correctly adjusts `ruleMonthUsed`. `rewardTypeAccum` correctly tracks dominant type. `applyMonthlyCap` and `calculatePercentageReward` are consistent. Fixed-amount branch correctly handles `won_per_day`, `mile_per_1500won`, and `won_per_liter` units.

2. **Greedy optimizer (greedy.ts):** Transaction filter uses `tx.amount > 0 && Number.isFinite(tx.amount)`. `scoreCardsForTransaction` push/pop is safe (calculateCardOutput only reads). `buildCardResults` sums `tx.amount` directly (optimizer only assigns positive transactions). `buildAssignments` fallback chain for `categoryNameKo` is thorough.

3. **Categorizer (matcher.ts, taxonomy.ts):** `MerchantMatcher.match()` correctly short-circuits on short merchant names (< 2 chars). Substring matching uses precomputed `SUBSTRING_SAFE_ENTRIES`. `rawCategory` validation checks `knownCategories` set. Fuzzy match requires `lower.length >= 3` to avoid false positives.

4. **Analyzer (analyzer.ts):** `performanceExclusions` filter correctly checks all three key forms. Multi-file merge uses `localeCompare` for date sorting. `getLatestMonth` returns `null` for empty arrays. `toCoreCardRuleSets` adapter correctly narrows source and reward type strings.

5. **Session storage persistence (store.svelte.ts):** Version migration runs before validation. `isOptimizableTx` type guard checks all required fields. Persist warnings correctly tracked and consumed. `reoptimize()` uses snapshot pattern to prevent concurrent mutation (C81-01). Generation counter correctly initialized from storage data (C7-01 fix verified).

6. **Formatters (formatters.ts):** `formatWon` normalizes negative zero. `formatSavingsValue` uses `Math.abs(value)` unconditionally. `buildPageUrl` handles BASE_URL with/without trailing slash. `formatYearMonthKo` has NaN guard on parseInt.

7. **Card data loading (cards.ts):** `chainAbortSignal` correctly chains signals. Retry on undefined result handles AbortError race. `cardIndex` provides O(1) lookups. Empty-array caching guard prevents poisoned cache on AbortError.

8. **CSV parsing (shared.ts):** `splitCSVLine` handles RFC 4180 quoted fields. `parseCSVAmount` handles parenthesized negatives and Korean Won suffix. `isValidCSVAmount` is a correct type guard.

9. **Date parsing (date-utils.ts):** All branches validate month/day ranges. `inferYear` look-back heuristic handles year rollover. All regexes are anchored (no ReDoS risk).

10. **HTML report (generator.ts):** `esc()` properly HTML-escapes all user-provided strings (`&`, `<`, `>`, `"`). `buildCategoryTable` correctly skips `tx.amount <= 0`. Template uses `replaceAll` for safe substitution.

11. **Svelte components:** All dashboard components correctly read from `analysisStore` reactive state. `TransactionReview` category changes use fully-qualified IDs. `FileDropzone` validates file types and sizes. `SpendingSummary` persist-warning dismissal resets on new generation.

---

## Still-Open Actionable Items (LOW, carried forward)

| Priority | ID | Finding | Effort | Impact |
|---|---|---|---|---|
| 1 | C1-N01 | formatIssuerNameKo 24-entry hardcoded map drifts from YAML | Medium | Correctness |
| 2 | C1-N02 | CATEGORY_COLORS 84-entry hardcoded map drifts from YAML | Medium | Correctness |
| 3 | C1-N04 | Web parser CSV helpers duplicated from server shared.ts | Large | Maintenance |
| 4 | C89-03 | formatters.ts m! non-null assertion after length check | Small | Type safety |

---

## Summary

Cycle 8 found 0 new actionable findings. All prior fixes remain in place and verified. The four LOW-priority carried-forward items (C1-N01, C1-N02, C1-N04, C89-03) remain open but are maintenance concerns rather than bugs or security issues. Two non-actionable observations were documented: a CLI/web savings-rate denominator inconsistency and a minor "+0원" cosmetic difference in the HTML report.
